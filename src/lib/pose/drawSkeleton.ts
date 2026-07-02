/**
 * Rysowanie szkieletu pozy na canvasie — wspólne dla ekranów na żywo.
 * Kolory spójne z tokenami (primary / bursztyn dla błędów).
 */

import { POSE_CONNECTIONS } from "./geometry";
import type { Pt } from "./geometry";

const WARN_COLOR = "rgba(224, 164, 88, 0.95)"; // bursztyn
const GOOD_COLOR = "rgba(63, 169, 141, 0.95)"; // primary

export function fitCanvasToParent(canvas: HTMLCanvasElement) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const w = parent.clientWidth;
  const h = parent.clientHeight;
  if (canvas.width !== w * devicePixelRatio || canvas.height !== h * devicePixelRatio) {
    canvas.width = Math.round(w * devicePixelRatio);
    canvas.height = Math.round(h * devicePixelRatio);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }
}

export function drawSkeleton(
  canvas: HTMLCanvasElement,
  landmarks: Pt[] | null,
  opts: { mirror: boolean; flagged?: Set<number> },
) {
  const g = canvas.getContext("2d");
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;

  const W = canvas.width;
  const H = canvas.height;
  const px = (x: number) => (opts.mirror ? 1 - x : x) * W;
  const py = (y: number) => y * H;
  const flagged = opts.flagged ?? new Set<number>();

  g.lineWidth = Math.max(3, W * 0.006);
  g.lineCap = "round";
  POSE_CONNECTIONS.forEach(([a, b]) => {
    const A = landmarks[a];
    const B = landmarks[b];
    if (!A || !B) return;
    g.strokeStyle = flagged.has(a) || flagged.has(b) ? WARN_COLOR : GOOD_COLOR;
    g.beginPath();
    g.moveTo(px(A.x), py(A.y));
    g.lineTo(px(B.x), py(B.y));
    g.stroke();
  });

  const r = Math.max(4, W * 0.008);
  landmarks.forEach((p, i) => {
    if (!p) return;
    if (i > 0 && i < 11) return; // punkty twarzy pomijamy dla czytelności
    g.fillStyle = flagged.has(i) ? WARN_COLOR : GOOD_COLOR;
    g.beginPath();
    g.arc(px(p.x), py(p.y), r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(px(p.x), py(p.y), r * 0.4, 0, Math.PI * 2);
    g.fill();
  });
}
