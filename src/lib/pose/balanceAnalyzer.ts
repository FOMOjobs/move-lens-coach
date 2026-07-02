/**
 * Analizator testu równowagi na jednej nodze (Single-Leg Stance, oczy otwarte).
 *
 * Protokół: osoba stoi PRZODEM do kamery, unosi jedną stopę (nie opierając
 * jej o drugą nogę) i stoi jak najdłużej. Mierzymy czas od uniesienia stopy
 * do jej opuszczenia. Kamera z przodu — obie kostki muszą być widoczne.
 *
 * Detekcja uniesienia: różnica wysokości kostek znormalizowana długością
 * goleni (kolano→kostka). Histereza progów RAISE/DROP zapobiega migotaniu
 * na drganiach pojedynczych klatek.
 */

import { LM, MovingAverage, Pt, vis } from "./geometry";

const RAISE_RATIO = 0.35; // różnica kostek > 35% goleni -> stopa uniesiona
const DROP_RATIO = 0.18; // spadek poniżej 18% -> stopa opuszczona (koniec próby)
const VIS_MIN = 0.5;

export interface BalanceFeedback {
  ready: boolean;
  coach: string | null;
  phase: "waiting" | "balancing" | "done";
  /** Czas bieżącej/ukończonej próby w ms. */
  elapsedMs: number;
  raisedLeg: "left" | "right" | null;
}

export class BalanceAnalyzer {
  private phase: "waiting" | "balancing" | "done" = "waiting";
  private raisedLeg: "left" | "right" | null = null;
  private startedAt = 0;
  private finalMs = 0;
  private diffAvg = new MovingAverage(4);

  reset() {
    this.phase = "waiting";
    this.raisedLeg = null;
    this.startedAt = 0;
    this.finalMs = 0;
    this.diffAvg.reset();
  }

  /** Zakończ próbę z zewnątrz (np. osiągnięto limit czasu). */
  finish(nowMs: number) {
    if (this.phase === "balancing") {
      this.finalMs = nowMs - this.startedAt;
      this.phase = "done";
    }
  }

  private notReady(coach: string): BalanceFeedback {
    return {
      ready: false,
      coach,
      phase: this.phase,
      elapsedMs: this.currentMs(performance.now()),
      raisedLeg: this.raisedLeg,
    };
  }

  private currentMs(nowMs: number): number {
    if (this.phase === "balancing") return nowMs - this.startedAt;
    return this.finalMs;
  }

  analyze(lm: Pt[], nowMs: number): BalanceFeedback | null {
    if (!lm || lm.length < 29) return null;
    if (this.phase === "done") {
      return { ready: true, coach: null, phase: "done", elapsedMs: this.finalMs, raisedLeg: this.raisedLeg };
    }

    const lKnee = lm[LM.LEFT_KNEE];
    const rKnee = lm[LM.RIGHT_KNEE];
    const lAnkle = lm[LM.LEFT_ANKLE];
    const rAnkle = lm[LM.RIGHT_ANKLE];
    if (!lKnee || !rKnee || !lAnkle || !rAnkle) return null;

    const bothVis = Math.min(vis(lAnkle), vis(rAnkle), vis(lKnee), vis(rKnee));
    if (bothVis < VIS_MIN) {
      return this.notReady("Stań przodem do kamery — obie nogi muszą być widoczne.");
    }

    // Długość goleni jako skala (uśredniona z obu nóg)
    const shin =
      (Math.hypot(lKnee.x - lAnkle.x, lKnee.y - lAnkle.y) +
        Math.hypot(rKnee.x - rAnkle.x, rKnee.y - rAnkle.y)) /
      2;
    if (shin < 0.03) {
      return this.notReady("Cofnij się — całe nogi w kadrze.");
    }

    const diff = this.diffAvg.push((lAnkle.y - rAnkle.y) / shin); // >0: lewa niżej → prawa uniesiona? (y rośnie w dół)
    const absDiff = Math.abs(diff);

    if (this.phase === "waiting") {
      if (absDiff > RAISE_RATIO) {
        this.phase = "balancing";
        this.startedAt = nowMs;
        // y większe = niżej; stopa uniesiona to ta z MNIEJSZYM y
        this.raisedLeg = diff > 0 ? "right" : "left";
      }
      return {
        ready: true,
        coach: "Unieś jedną stopę, kiedy będziesz gotowy — czas ruszy automatycznie.",
        phase: this.phase,
        elapsedMs: 0,
        raisedLeg: null,
      };
    }

    // balancing
    if (absDiff < DROP_RATIO) {
      this.finalMs = nowMs - this.startedAt;
      this.phase = "done";
      return { ready: true, coach: null, phase: "done", elapsedMs: this.finalMs, raisedLeg: this.raisedLeg };
    }

    return {
      ready: true,
      coach: null,
      phase: "balancing",
      elapsedMs: nowMs - this.startedAt,
      raisedLeg: this.raisedLeg,
    };
  }
}
