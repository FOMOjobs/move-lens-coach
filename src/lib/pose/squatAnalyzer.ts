/**
 * Analizator techniki przysiadu.
 *
 * Wejście: tablica 33 landmarków MediaPipe Pose (znormalizowane 0..1,
 * z polem `visibility`). Wyjście: bieżąca ocena (kąty, chipy
 * "głębokość/plecy/kolana/tempo"), automatyczne liczenie powtórzeń
 * (maszyna stanów góra→dół→góra) oraz sygnał gotowości/coachingu.
 *
 * Założenia projektowe (ważne dla wiarygodności demo):
 *  - Demo robimy BOKIEM do kamery. W tym ujęciu daleka noga jest
 *    zasłonięta i ma niską `visibility`, więc do kąta kolana i głębokości
 *    bierzemy nogę BLIŻSZĄ kamerze (większa widoczność), zamiast uśredniać
 *    obie. Dzięki temu liczenie powtórzeń jest stabilne, a nie drgające.
 *  - Dopóki cała sylwetka nie jest pewnie widoczna w kadrze, NIE liczymy
 *    powtórzeń — zamiast tego zwracamy podpowiedź ustawienia (`coach`).
 *    To eliminuje "powtórzenia widmo", gdy ktoś podchodzi do telefonu.
 *  - Koślawość kolan ma sens tylko w ujęciu z PRZODU — w ujęciu z boku
 *    chip "Kolana" jest neutralny, żeby nie alarmować fałszywie.
 *  - Logika świadomie konserwatywna i wygładzona (MovingAverage), żeby
 *    chipy nie migotały na pojedynczej drganej klatce.
 */

import { LM, MovingAverage, Pt, angleAt, angleFromVertical, vis } from "./geometry";

export type ChipStatus = "ok" | "warn" | "bad" | "idle";
export type ViewKind = "side" | "front" | "unknown";

export interface SquatFeedback {
  ready: boolean; // czy sylwetka jest pewnie widoczna i można liczyć
  coach: string | null; // podpowiedź ustawienia, gdy !ready
  view: ViewKind; // wykryte ujęcie (bok/przód)
  reps: number;
  state: "up" | "down" | "transition";
  kneeAngle: number; // kąt kolana nogi bliższej kamerze
  backAngle: number; // pochylenie tułowia (0=pion)
  depthRatio: number; // 0..1 — jak głęboko zszedł w bieżącym ruchu
  formScore: number; // 0..100, EWMA
  chips: {
    depth: { status: ChipStatus; hint: string };
    knees: { status: ChipStatus; hint: string };
    back: { status: ChipStatus; hint: string };
    tempo: { status: ChipStatus; hint: string };
  };
  /** Indeksy landmarków, które aktualnie sygnalizują błąd. */
  flaggedLandmarks: Set<number>;
}

export interface SquatSummary {
  reps: number;
  avgDepthAngle: number; // średni kąt kolana w dolnej fazie (im mniej, tym głębiej)
  avgFormScore: number;
  topTip: string;
  symmetryDelta: number;
}

const UP_THRESHOLD = 160; // > -> wyprost
const DOWN_THRESHOLD = 100; // < -> głęboki przysiad (~równolegle)
const PARTIAL_DOWN = 130; // poniżej tego wchodzimy w "transition"

// Progi gotowości / pewności wykrycia
const SIDE_VIS_MIN = 0.5; // min. widoczność nogi bliższej kamerze
const TORSO_VIS_MIN = 0.4; // min. średnia widoczność barków+bioder
const MIN_BODY_EXTENT = 0.35; // bark→kostka w pionie (sylwetka w kadrze)
const BOTH_LEGS_VIS = 0.6; // próg "obie nogi widać" (do symetrii)

export class SquatAnalyzer {
  private reps = 0;
  private state: "up" | "down" | "transition" = "up";
  private repStartedAt = 0;
  private minKneeInRep = 180;

  private kneeAvg = new MovingAverage(5);
  private backAvg = new MovingAverage(7);
  private kneeValgusAvg = new MovingAverage(5);
  private formAvg = new MovingAverage(8);

  // Statystyki sesji
  private depthAnglesAtBottom: number[] = [];
  private formScores: number[] = [];
  private tooFastReps = 0;
  private shallowReps = 0;
  private valgusFrames = 0;
  private backFrames = 0;
  private framesCount = 0;
  private symmetryDeltas: number[] = [];

  reset() {
    this.reps = 0;
    this.state = "up";
    this.repStartedAt = 0;
    this.minKneeInRep = 180;
    this.kneeAvg.reset();
    this.backAvg.reset();
    this.kneeValgusAvg.reset();
    this.formAvg.reset();
    this.depthAnglesAtBottom = [];
    this.formScores = [];
    this.tooFastReps = 0;
    this.shallowReps = 0;
    this.valgusFrames = 0;
    this.backFrames = 0;
    this.framesCount = 0;
    this.symmetryDeltas = [];
  }

  /** Zwraca feedback "niegotowy" z podpowiedzią — nie liczy powtórzeń. */
  private notReady(coach: string, view: ViewKind): SquatFeedback {
    // Przerwij ewentualne rozpoczęte powtórzenie, żeby nie doliczyć śmiecia.
    if (this.state !== "up") {
      this.state = "up";
      this.minKneeInRep = 180;
    }
    const idle = (hint: string) => ({ status: "idle" as ChipStatus, hint });
    return {
      ready: false,
      coach,
      view,
      reps: this.reps,
      state: "up",
      kneeAngle: 0,
      backAngle: 0,
      depthRatio: 0,
      formScore: 0,
      chips: {
        depth: idle("—"),
        knees: idle("—"),
        back: idle("—"),
        tempo: idle("—"),
      },
      flaggedLandmarks: new Set<number>(),
    };
  }

  analyze(lm: Pt[], nowMs: number): SquatFeedback | null {
    if (!lm || lm.length < 29) return null;

    const lHip = lm[LM.LEFT_HIP];
    const rHip = lm[LM.RIGHT_HIP];
    const lKnee = lm[LM.LEFT_KNEE];
    const rKnee = lm[LM.RIGHT_KNEE];
    const lAnkle = lm[LM.LEFT_ANKLE];
    const rAnkle = lm[LM.RIGHT_ANKLE];
    const lShoulder = lm[LM.LEFT_SHOULDER];
    const rShoulder = lm[LM.RIGHT_SHOULDER];

    // Sprawdź obecność kluczowych punktów
    const keyPts = [lHip, rHip, lKnee, rKnee, lAnkle, rAnkle, lShoulder, rShoulder];
    for (const p of keyPts) {
      if (!p) return null;
    }

    // === Wykrycie ujęcia (bok vs przód) ===
    const shoulderSpread = Math.abs(lShoulder.x - rShoulder.x);
    const hipSpread = Math.abs(lHip.x - rHip.x);
    const spread = Math.max(shoulderSpread, hipSpread);
    const view: ViewKind = spread < 0.12 ? "side" : spread > 0.18 ? "front" : "unknown";

    // === Wybór nogi bliższej kamerze (większa widoczność) ===
    const leftVis = (vis(lHip) + vis(lKnee) + vis(lAnkle)) / 3;
    const rightVis = (vis(rHip) + vis(rKnee) + vis(rAnkle)) / 3;
    const useLeft = leftVis >= rightVis;
    const primaryVis = Math.max(leftVis, rightVis);

    const hip = useLeft ? lHip : rHip;
    const knee = useLeft ? lKnee : rKnee;
    const ankle = useLeft ? lAnkle : rAnkle;

    // === Bramka gotowości ===
    const torsoVis = (vis(lShoulder) + vis(rShoulder) + vis(lHip) + vis(rHip)) / 4;
    const midShoulderY = (lShoulder.y + rShoulder.y) / 2;
    const bodyExtent = Math.abs(ankle.y - midShoulderY); // pionowy zasięg sylwetki

    if (torsoVis < TORSO_VIS_MIN) {
      return this.notReady("Stań tak, aby było widać całą sylwetkę.", view);
    }
    if (primaryVis < SIDE_VIS_MIN) {
      return this.notReady("Ustaw się bokiem — tak, by było widać całą nogę.", view);
    }
    if (ankle.y > 1.01 || midShoulderY < -0.01) {
      return this.notReady("Cofnij telefon — głowa i stopy mają być w kadrze.", view);
    }
    if (bodyExtent < MIN_BODY_EXTENT) {
      return this.notReady("Cofnij się — całe ciało w kadrze (2–3 m).", view);
    }

    // === Kąty (na nodze bliższej kamerze) ===
    const kneeRaw = angleAt(hip, knee, ankle);
    const kneeSmoothed = this.kneeAvg.push(kneeRaw);

    // Tułów: bark↔biodro vs pion
    const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
    const midHip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
    const back = angleFromVertical(midHip, midShoulder);
    const backSmoothed = this.backAvg.push(back);

    // Symetria — tylko gdy obie nogi pewnie widoczne (ujęcie z przodu)
    if (leftVis > BOTH_LEGS_VIS && rightVis > BOTH_LEGS_VIS) {
      const kneeL = angleAt(lHip, lKnee, lAnkle);
      const kneeR = angleAt(rHip, rKnee, rAnkle);
      this.symmetryDeltas.push(Math.abs(kneeL - kneeR));
    }

    // Koślawość kolan — wiarygodna tylko z przodu
    let valgusSmoothed = 0;
    if (view === "front") {
      const hipWidth = Math.max(0.01, Math.abs(lHip.x - rHip.x));
      const valgusL = (lAnkle.x - lKnee.x) / hipWidth;
      const valgusR = (rKnee.x - rAnkle.x) / hipWidth;
      const valgus = (valgusL + valgusR) / 2; // > 0.18 → kolana do środka
      valgusSmoothed = this.kneeValgusAvg.push(valgus);
    } else {
      this.kneeValgusAvg.reset();
    }

    this.framesCount += 1;

    // === Maszyna stanów powtórzeń ===
    const flagged = new Set<number>();
    const chips: SquatFeedback["chips"] = {
      depth: { status: "ok", hint: "Głębokość OK" },
      knees:
        view === "front"
          ? { status: "ok", hint: "Kolana w linii" }
          : { status: "idle", hint: "Widok z boku" },
      back: { status: "ok", hint: "Plecy proste" },
      tempo: { status: "ok", hint: "Tempo dobre" },
    };

    if (this.state === "up" && kneeSmoothed < PARTIAL_DOWN) {
      this.state = "transition";
      this.repStartedAt = nowMs;
      this.minKneeInRep = kneeSmoothed;
    } else if (this.state === "transition") {
      this.minKneeInRep = Math.min(this.minKneeInRep, kneeSmoothed);
      if (kneeSmoothed < DOWN_THRESHOLD) {
        this.state = "down";
      } else if (kneeSmoothed > UP_THRESHOLD) {
        // Wrócił w górę bez osiągnięcia głębokości — płytko
        this.shallowReps += 1;
        this.reps += 1;
        this.depthAnglesAtBottom.push(this.minKneeInRep);
        this.state = "up";
        this.minKneeInRep = 180;
      }
    } else if (this.state === "down") {
      this.minKneeInRep = Math.min(this.minKneeInRep, kneeSmoothed);
      if (kneeSmoothed > UP_THRESHOLD) {
        // Powtórzenie zakończone
        const dur = nowMs - this.repStartedAt;
        if (dur < 1000) this.tooFastReps += 1;
        this.reps += 1;
        this.depthAnglesAtBottom.push(this.minKneeInRep);
        this.state = "up";
        this.minKneeInRep = 180;
      }
    }

    // === Chipy (na żywo) ===
    // Głębokość
    if (this.state !== "up") {
      if (kneeSmoothed > DOWN_THRESHOLD && kneeSmoothed < PARTIAL_DOWN) {
        chips.depth = { status: "warn", hint: "Zejdź niżej" };
      } else if (kneeSmoothed <= DOWN_THRESHOLD) {
        chips.depth = { status: "ok", hint: "Świetna głębokość" };
      }
    }

    // Plecy
    if (backSmoothed > 50) {
      chips.back = { status: "warn", hint: "Klatka wyżej, plecy prosto" };
      this.backFrames += 1;
      flagged.add(LM.LEFT_SHOULDER);
      flagged.add(LM.RIGHT_SHOULDER);
      flagged.add(LM.LEFT_HIP);
      flagged.add(LM.RIGHT_HIP);
    } else if (backSmoothed > 40) {
      chips.back = { status: "warn", hint: "Lekkie pochylenie" };
    }

    // Kolana (tylko z przodu)
    if (view === "front" && valgusSmoothed > 0.18) {
      chips.knees = { status: "warn", hint: "Kolana na zewnątrz" };
      this.valgusFrames += 1;
      flagged.add(LM.LEFT_KNEE);
      flagged.add(LM.RIGHT_KNEE);
    }

    // Tempo (sygnalizacja w trakcie down)
    if (this.state === "down" && nowMs - this.repStartedAt < 700) {
      chips.tempo = { status: "warn", hint: "Wolniej w dół" };
    }

    // === Form Score (0..100) ===
    let score = 100;
    if (chips.depth.status === "warn") score -= 20;
    if (chips.back.status === "warn") score -= 15;
    if (chips.knees.status === "warn") score -= 15;
    if (chips.tempo.status === "warn") score -= 10;
    score = Math.max(0, score);
    const formSmoothed = this.formAvg.push(score);
    this.formScores.push(formSmoothed);

    const depthRatio = Math.max(
      0,
      Math.min(1, (UP_THRESHOLD - kneeSmoothed) / (UP_THRESHOLD - DOWN_THRESHOLD)),
    );

    return {
      ready: true,
      coach: null,
      view,
      reps: this.reps,
      state: this.state,
      kneeAngle: kneeSmoothed,
      backAngle: backSmoothed,
      depthRatio,
      formScore: Math.round(formSmoothed),
      chips,
      flaggedLandmarks: flagged,
    };
  }

  summary(): SquatSummary {
    const avgDepth =
      this.depthAnglesAtBottom.length > 0
        ? this.depthAnglesAtBottom.reduce((a, b) => a + b, 0) / this.depthAnglesAtBottom.length
        : 0;
    const avgForm =
      this.formScores.length > 0
        ? this.formScores.reduce((a, b) => a + b, 0) / this.formScores.length
        : 0;
    const symAvg =
      this.symmetryDeltas.length > 0
        ? this.symmetryDeltas.reduce((a, b) => a + b, 0) / this.symmetryDeltas.length
        : 0;

    let tip = "Dobra robota! Utrzymaj jakość ruchu.";
    if (this.shallowReps > this.reps * 0.3) tip = "Schodź głębiej — celuj w udo równolegle do podłogi.";
    else if (this.backFrames > this.framesCount * 0.25) tip = "Trzymaj klatkę wyżej, nie pochylaj się tak mocno.";
    else if (this.valgusFrames > this.framesCount * 0.25) tip = "Pilnuj kolan — prowadź je na zewnątrz, w linii ze stopami.";
    else if (this.tooFastReps > this.reps * 0.3) tip = "Spróbuj wolniejszej fazy schodzenia (~2 s).";
    else if (symAvg > 15) tip = "Pracuj nad symetrią — jedna noga pracuje mocniej.";

    return {
      reps: this.reps,
      avgDepthAngle: avgDepth,
      avgFormScore: avgForm,
      topTip: tip,
      symmetryDelta: symAvg,
    };
  }
}
