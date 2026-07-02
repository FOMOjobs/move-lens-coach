/**
 * Karta "Ciśnienie — dzienniczek domowy" (zakładka Dane).
 *
 * Design: czysta subtelność. Kalendarz tygodnia pokazuje wyłącznie
 * kompletność zapisu (jak dzienniczek u lekarza) — bez serii, punktów
 * i ocen. Brak pomiaru to pusta obwódka, nie "porażka". Własne tempo.
 */

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  bpWeek,
  bpWeekSummary,
  defaultSlot,
  saveBpReading,
  type BpSlot,
  type BpWeekDay,
} from "@/lib/health/bloodPressure";

export function BloodPressureCard() {
  const [week, setWeek] = useState<BpWeekDay[] | null>(null); // null = przed montażem (SSR)
  const [formOpen, setFormOpen] = useState(false);
  const [slot, setSlot] = useState<BpSlot>("morning");
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [pulse, setPulse] = useState("");
  const [selected, setSelected] = useState<{ day: string; slot: BpSlot } | null>(null);

  const refresh = () => setWeek(bpWeek());

  useEffect(() => {
    refresh();
    setSlot(defaultSlot());
  }, []);

  const summary = week ? bpWeekSummary(week) : null;

  const canSave = (() => {
    const s = Number(sys);
    const d = Number(dia);
    return Number.isFinite(s) && Number.isFinite(d) && s >= 60 && s <= 260 && d >= 30 && d <= 160;
  })();

  const save = () => {
    if (!canSave) return;
    saveBpReading({
      sys: Number(sys),
      dia: Number(dia),
      pulse: pulse ? Number(pulse) : undefined,
      slot,
    });
    setSys("");
    setDia("");
    setPulse("");
    setFormOpen(false);
    refresh(); // nowa kropka w kalendarzu jest całym "potwierdzeniem"
  };

  const selectedReading =
    selected && week
      ? (week.find((d) => d.day === selected.day)?.[selected.slot] ?? null)
      : null;

  return (
    <section className="mt-5 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ciśnienie · dzienniczek domowy
        </h2>
        {summary && summary.filled > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">{summary.filled}/14</span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Rano i wieczorem — we własnym tempie.</p>

      {/* Kalendarz tygodnia: kompletność zapisu, nic więcej */}
      <div className="mt-4">
        {week ? (
          <div className="grid grid-cols-[auto_repeat(7,1fr)] items-center gap-y-2">
            <span />
            {week.map((d) => (
              <span
                key={d.day}
                className={cn(
                  "text-center text-[11px]",
                  d.isToday ? "font-semibold text-primary-deep" : "text-muted-foreground",
                )}
              >
                {d.weekdayShort}
              </span>
            ))}

            <span className="pr-3 text-[11px] text-muted-foreground">Rano</span>
            {week.map((d) => (
              <Dot
                key={`${d.day}-m`}
                filled={!!d.morning}
                active={selected?.day === d.day && selected.slot === "morning"}
                onClick={() =>
                  d.morning &&
                  setSelected(
                    selected?.day === d.day && selected.slot === "morning"
                      ? null
                      : { day: d.day, slot: "morning" },
                  )
                }
              />
            ))}

            <span className="pr-3 text-[11px] text-muted-foreground">Wieczór</span>
            {week.map((d) => (
              <Dot
                key={`${d.day}-e`}
                filled={!!d.evening}
                active={selected?.day === d.day && selected.slot === "evening"}
                onClick={() =>
                  d.evening &&
                  setSelected(
                    selected?.day === d.day && selected.slot === "evening"
                      ? null
                      : { day: d.day, slot: "evening" },
                  )
                }
              />
            ))}
          </div>
        ) : (
          <div className="h-[76px]" />
        )}
      </div>

      {/* Dotknięty pomiar — cicha adnotacja zamiast tooltipa */}
      {selectedReading && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {selectedReading.slot === "morning" ? "Rano" : "Wieczorem"} ·{" "}
          <span className="font-medium text-foreground tabular-nums">
            {selectedReading.sys}/{selectedReading.dia}
          </span>{" "}
          mmHg
          {selectedReading.pulse ? ` · tętno ${selectedReading.pulse}` : ""}
        </p>
      )}

      {/* Średnie tygodnia — osobno rano i wieczorem, jak w dzienniczku HBPM */}
      {summary && (summary.morningAvg || summary.eveningAvg) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <AvgTile label="Rano" avg={summary.morningAvg} />
          <AvgTile label="Wieczorem" avg={summary.eveningAvg} />
        </div>
      )}

      {summary?.elevated && (
        <p className="mt-3 text-sm text-warn">
          Średnia z tygodnia ≥ 135/85 (norma domowa) — warto omówić z lekarzem.
        </p>
      )}

      {/* Dodawanie pomiaru */}
      {formOpen ? (
        <div className="mt-4 rounded-2xl bg-tint/60 p-4">
          <div className="flex gap-2">
            {(["morning", "evening"] as BpSlot[]).map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                className={cn(
                  "flex-1 rounded-full px-3 py-2 text-sm font-medium",
                  slot === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                )}
              >
                {s === "morning" ? "Rano" : "Wieczór"}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <BpInput label="Skurczowe" value={sys} onChange={setSys} placeholder="120" />
            <BpInput label="Rozkurczowe" value={dia} onChange={setDia} placeholder="80" />
            <BpInput label="Tętno (opc.)" value={pulse} onChange={setPulse} placeholder="—" />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setFormOpen(false)}
              className="flex-1 rounded-2xl border border-hairline bg-card px-4 py-2.5 text-sm font-medium"
            >
              Anuluj
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="flex-1 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Zapisz
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => {
            setSlot(defaultSlot());
            setFormOpen(true);
          }}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-hairline px-4 py-2.5 text-sm font-medium text-primary-deep"
        >
          <Plus className="h-4 w-4" /> Dodaj pomiar
        </button>
      )}
    </section>
  );
}

function Dot({ filled, active, onClick }: { filled: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={filled ? "Pokaż pomiar" : "Brak pomiaru"}
      // 44px pole dotyku wokół małej kropki
      className="mx-auto flex h-9 w-9 items-center justify-center"
    >
      <span
        className={cn(
          "block h-3.5 w-3.5 rounded-full transition-all",
          filled ? "bg-good" : "border border-hairline",
          active && "ring-2 ring-good/30",
        )}
      />
    </button>
  );
}

function AvgTile({ label, avg }: { label: string; avg: { sys: number; dia: number; n: number } | null }) {
  return (
    <div className="rounded-2xl border border-hairline p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {avg ? (
        <p className="mt-1 text-xl font-semibold tabular-nums">
          {avg.sys}/{avg.dia}
          <span className="ml-1 text-xs font-normal text-muted-foreground">śr. z {avg.n}</span>
        </p>
      ) : (
        <p className="mt-1 text-xl font-semibold text-muted-foreground">—</p>
      )}
    </div>
  );
}

function BpInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-hairline bg-card px-3 py-2.5 text-center text-base font-medium tabular-nums outline-none placeholder:text-muted-foreground/50 focus:border-primary"
      />
    </label>
  );
}
