/**
 * Analizator testu "30 s wstawania z krzesła" (30-s Chair Stand Test).
 *
 * Protokół: osoba siedzi na krześle (ręce skrzyżowane na klatce piersiowej),
 * na sygnał wstaje do pełnego wyprostu i siada — jak najwięcej razy w 30 s.
 * Kamera z boku, jak przy przysiadzie.
 *
 * Liczymy PEŁNE wstania: przejście siad (kąt kolana < SIT_ANGLE)
 * → pełny wyprost (kąt kolana > STAND_ANGLE). Histereza progów + średnia
 * ruchoma eliminują drgania. Noga bliższa kamerze wg widoczności
 * (jak w SquatAnalyzer).
 */

import { LM, MovingAverage, Pt, angleAt, vis } from "./geometry";

const STAND_ANGLE = 160; // > -> pełny wyprost (wstanie zaliczone)
const SIT_ANGLE = 110; // < -> siad (gotowy do kolejnego wstania)
const VIS_MIN = 0.5;

export interface SitToStandFeedback {
  ready: boolean;
  coach: string | null;
  stands: number;
  state: "sitting" | "rising" | "standing";
  kneeAngle: number;
}

export class SitToStandAnalyzer {
  private stands = 0;
  private state: "sitting" | "rising" | "standing" = "sitting";
  private kneeAvg = new MovingAverage(5);
  private everSat = false; // test zaczyna się od siadu

  reset() {
    this.stands = 0;
    this.state = "sitting";
    this.kneeAvg.reset();
    this.everSat = false;
  }

  private notReady(coach: string): SitToStandFeedback {
    return { ready: false, coach, stands: this.stands, state: this.state, kneeAngle: 0 };
  }

  analyze(lm: Pt[]): SitToStandFeedback | null {
    if (!lm || lm.length < 29) return null;

    const lHip = lm[LM.LEFT_HIP];
    const rHip = lm[LM.RIGHT_HIP];
    const lKnee = lm[LM.LEFT_KNEE];
    const rKnee = lm[LM.RIGHT_KNEE];
    const lAnkle = lm[LM.LEFT_ANKLE];
    const rAnkle = lm[LM.RIGHT_ANKLE];
    if (!lHip || !rHip || !lKnee || !rKnee || !lAnkle || !rAnkle) return null;

    // Noga bliższa kamerze — jak w przysiadzie
    const leftVis = (vis(lHip) + vis(lKnee) + vis(lAnkle)) / 3;
    const rightVis = (vis(rHip) + vis(rKnee) + vis(rAnkle)) / 3;
    const useLeft = leftVis >= rightVis;
    if (Math.max(leftVis, rightVis) < VIS_MIN) {
      return this.notReady("Ustaw się bokiem — tak, aby było widać całą nogę.");
    }

    const hip = useLeft ? lHip : rHip;
    const knee = useLeft ? lKnee : rKnee;
    const ankle = useLeft ? lAnkle : rAnkle;
    if (ankle.y > 1.01) {
      return this.notReady("Cofnij telefon — stopy mają być w kadrze.");
    }

    const kneeAngle = this.kneeAvg.push(angleAt(hip, knee, ankle));

    if (!this.everSat && kneeAngle < SIT_ANGLE) this.everSat = true;
    if (!this.everSat) {
      return this.notReady("Usiądź na krześle, ręce skrzyżuj na klatce piersiowej.");
    }

    // Maszyna stanów z histerezą
    if (this.state === "sitting" && kneeAngle > SIT_ANGLE + 10) {
      this.state = "rising";
    } else if (this.state === "rising") {
      if (kneeAngle > STAND_ANGLE) {
        this.state = "standing";
        this.stands += 1; // pełne wstanie zaliczone
      } else if (kneeAngle < SIT_ANGLE) {
        this.state = "sitting"; // nie doszedł do wyprostu — nie liczymy
      }
    } else if (this.state === "standing" && kneeAngle < SIT_ANGLE) {
      this.state = "sitting";
    }

    return { ready: true, coach: null, stands: this.stands, state: this.state, kneeAngle };
  }
}
