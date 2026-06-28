/**
 * Geometria pozy — funkcje pomocnicze do liczenia kątów i wektorów.
 * Niezależne od UI i biblioteki MediaPipe (przyjmują zwykłe {x,y}).
 */

export type Pt = { x: number; y: number; visibility?: number };

/** Kąt w punkcie B utworzony przez A-B-C, w stopniach (0..180). */
export function angleAt(a: Pt, b: Pt, c: Pt): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Kąt linii AB względem pionu, w stopniach. 0 = pionowo. */
export function angleFromVertical(a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ang = (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
  return ang;
}

/** Średnia ruchoma na buforze. */
export class MovingAverage {
  private buf: number[] = [];
  constructor(private size = 5) {}
  push(v: number) {
    this.buf.push(v);
    if (this.buf.length > this.size) this.buf.shift();
    return this.value;
  }
  get value(): number {
    if (!this.buf.length) return 0;
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }
  reset() {
    this.buf = [];
  }
}

/** Indeksy landmarków MediaPipe Pose (33 punkty). */
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

/** Pary do rysowania szkieletu (uproszczone). */
export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
];
