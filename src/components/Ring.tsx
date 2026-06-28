import { cn } from "@/lib/utils";

interface RingProps {
  value: number; // 0..100
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  className?: string;
  trackClass?: string;
  progressClass?: string;
}

/** Pierścień postępu (SVG) — używany dla Form Score, Gotowości, itp. */
export function Ring({
  value,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  className,
  trackClass = "stroke-tint",
  progressClass = "stroke-primary",
}: RingProps) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-300", progressClass)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && <span className="text-2xl font-semibold tracking-tight">{label}</span>}
        {sublabel && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}
