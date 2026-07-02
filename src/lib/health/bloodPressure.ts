/**
 * Dzienniczek ciśnienia — domowy pomiar rano i wieczorem (protokół HBPM).
 *
 * Zasady kliniczne (ESC/ESH, pomiar DOMOWY):
 *  - norma domowa jest niższa niż gabinetowa: podwyższone od ≥135/85 mmHg,
 *  - liczy się średnia z wielu dni (rano i wieczorem osobno), nie pojedynczy odczyt.
 *
 * Świadomie BEZ grywalizacji: kalendarz tygodnia pokazuje wyłącznie
 * kompletność zapisu (tak, jak patrzy na dzienniczek lekarz) — bez serii,
 * punktów i ocen. Brak pomiaru niczego nie "psuje".
 */

export type BpSlot = "morning" | "evening";

export interface BpReading {
  id: string;
  dateISO: string; // pełny timestamp zapisu
  day: string; // YYYY-MM-DD (dzień pomiaru)
  slot: BpSlot;
  sys: number;
  dia: number;
  pulse?: number;
}

const BP_KEY = "movelens.bp.v1";

function read(): BpReading[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BP_KEY);
    return raw ? (JSON.parse(raw) as BpReading[]) : [];
  } catch {
    return [];
  }
}

function write(list: BpReading[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BP_KEY, JSON.stringify(list));
  } catch {
    // pełny storage / tryb prywatny — pomijamy
  }
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Domyślny slot wg pory dnia. */
export function defaultSlot(d = new Date()): BpSlot {
  return d.getHours() < 14 ? "morning" : "evening";
}

export function saveBpReading(r: { sys: number; dia: number; pulse?: number; slot: BpSlot }): BpReading {
  const now = new Date();
  const item: BpReading = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    dateISO: now.toISOString(),
    day: todayKey(now),
    slot: r.slot,
    sys: r.sys,
    dia: r.dia,
    pulse: r.pulse,
  };
  const list = read();
  // Jeden pomiar na slot dziennie — nowy nadpisuje (poprawka pomyłki)
  const filtered = list.filter((x) => !(x.day === item.day && x.slot === item.slot));
  filtered.push(item);
  write(filtered);
  return item;
}

export function listBpReadings(): BpReading[] {
  return read().sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}

export interface BpWeekDay {
  day: string; // YYYY-MM-DD
  weekdayShort: string; // Pn, Wt, ...
  isToday: boolean;
  morning: BpReading | null;
  evening: BpReading | null;
}

/** Ostatnie 7 dni (najstarszy pierwszy) z wypełnieniem slotów. */
export function bpWeek(): BpWeekDay[] {
  const readings = read();
  const days: BpWeekDay[] = [];
  const fmt = new Intl.DateTimeFormat("pl-PL", { weekday: "short" });
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const label = fmt.format(d).replace(".", "");
    days.push({
      day: key,
      weekdayShort: label.charAt(0).toUpperCase() + label.slice(1),
      isToday: i === 0,
      morning: readings.find((r) => r.day === key && r.slot === "morning") ?? null,
      evening: readings.find((r) => r.day === key && r.slot === "evening") ?? null,
    });
  }
  return days;
}

export interface BpSummary {
  morningAvg: { sys: number; dia: number; n: number } | null;
  eveningAvg: { sys: number; dia: number; n: number } | null;
  /** Liczba wypełnionych slotów z 14 możliwych w tygodniu. */
  filled: number;
  /** Średnia ogólna ≥135/85 (norma domowa) → warto omówić z lekarzem. */
  elevated: boolean;
}

export function bpWeekSummary(week = bpWeek()): BpSummary {
  const morning = week.map((d) => d.morning).filter((x): x is BpReading => x != null);
  const evening = week.map((d) => d.evening).filter((x): x is BpReading => x != null);
  const avg = (xs: BpReading[]) =>
    xs.length === 0
      ? null
      : {
          sys: Math.round(xs.reduce((a, r) => a + r.sys, 0) / xs.length),
          dia: Math.round(xs.reduce((a, r) => a + r.dia, 0) / xs.length),
          n: xs.length,
        };
  const morningAvg = avg(morning);
  const eveningAvg = avg(evening);
  const all = [...morning, ...evening];
  const allAvg = avg(all);
  return {
    morningAvg,
    eveningAvg,
    filled: all.length,
    elevated: allAvg != null && (allAvg.sys >= 135 || allAvg.dia >= 85),
  };
}
