/**
 * Budowanie "Podsumowania dla lekarza/fizjoterapeuty" z realnych danych
 * zebranych przez MoveLens (sesje treningowe + testy kliniczne ruchu).
 *
 * Zwraca gotowe, otypowane wartości — UI tylko renderuje. Wskaźniki
 * ogólnozdrowotne (tętno, sen, badania) pozostają na razie przykładowe,
 * dopóki nie podłączymy importu Apple Health.
 */

import { listSquatSessions, listTestResults, type NormBand, type TestKind } from "./results";

export interface TestLine {
  kind: TestKind;
  label: string;
  valueLabel: string;
  band: NormBand;
  bandLabel: string;
  note: string;
  dateLabel: string;
}

export interface MovementSummary {
  hasData: boolean;
  sessionCount: number;
  totalReps: number;
  /** Średni Form Score z ostatnich maks. 5 sesji. */
  avgFormRecent: number | null;
  /** Zmiana formy: śr. 3 ostatnich vs 3 najstarszych sesji (pkt). */
  formTrend: number | null;
  /** Średni kąt kolana w dole z ostatnich sesji (mniej = głębiej). */
  avgDepthRecent: number | null;
  /** Średnia asymetria kolan (stopnie) — >15° warte uwagi. */
  symmetryAvg: number | null;
  lastTopTip: string | null;
  /** Najnowszy wynik każdego testu. */
  tests: TestLine[];
  observations: string[];
}

const TEST_LABELS: Record<TestKind, string> = {
  "sit-to-stand": "Wstawanie z krzesła (30 s)",
  balance: "Równowaga na jednej nodze",
};

const BAND_LABELS: Record<NormBand, string> = {
  above: "powyżej normy",
  norm: "w normie",
  below: "poniżej normy",
};

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function buildMovementSummary(): MovementSummary {
  const sessions = listSquatSessions(); // najnowsze pierwsze
  const tests = listTestResults();

  const recent = sessions.slice(0, 5);
  const avgFormRecent = avg(recent.map((s) => s.avgFormScore));
  const avgDepthRecent = avg(recent.filter((s) => s.avgDepthAngle > 0).map((s) => s.avgDepthAngle));
  const symmetryAvg = avg(recent.map((s) => s.symmetryDelta));

  let formTrend: number | null = null;
  if (sessions.length >= 4) {
    const newest = avg(sessions.slice(0, 3).map((s) => s.avgFormScore));
    const oldest = avg(sessions.slice(-3).map((s) => s.avgFormScore));
    if (newest != null && oldest != null) formTrend = Math.round(newest - oldest);
  }

  // Najnowszy wynik per rodzaj testu
  const latestByKind = new Map<TestKind, (typeof tests)[number]>();
  for (const t of tests) {
    if (!latestByKind.has(t.kind)) latestByKind.set(t.kind, t);
  }
  const testLines: TestLine[] = [...latestByKind.values()].map((t) => ({
    kind: t.kind,
    label: TEST_LABELS[t.kind],
    valueLabel: t.kind === "sit-to-stand" ? `${t.value} wstań` : `${t.value} s`,
    band: t.band,
    bandLabel: BAND_LABELS[t.band],
    note: t.note,
    dateLabel: new Date(t.dateISO).toLocaleDateString("pl-PL"),
  }));

  // Obserwacje ludzkim językiem — tylko z twardych danych
  const observations: string[] = [];
  if (formTrend != null && Math.abs(formTrend) >= 5) {
    observations.push(
      formTrend > 0
        ? `Jakość wykonywania przysiadu poprawia się (+${formTrend} pkt Form Score).`
        : `Jakość wykonywania przysiadu spada (${formTrend} pkt Form Score) — warto omówić przyczynę.`,
    );
  }
  if (symmetryAvg != null && symmetryAvg > 15) {
    observations.push(
      `Utrzymująca się asymetria pracy kolan (śr. ${Math.round(symmetryAvg)}°) — do oceny fizjoterapeutycznej.`,
    );
  }
  for (const t of testLines) {
    if (t.band === "below") observations.push(`${t.label}: wynik ${t.bandLabel}. ${t.note}`);
  }
  if (sessions.length > 0 && observations.length === 0) {
    observations.push("Jakość ruchu stabilna, bez niepokojących sygnałów w pomiarach.");
  }

  return {
    hasData: sessions.length > 0 || testLines.length > 0,
    sessionCount: sessions.length,
    totalReps: sessions.reduce((a, s) => a + s.reps, 0),
    avgFormRecent: avgFormRecent != null ? Math.round(avgFormRecent) : null,
    formTrend,
    avgDepthRecent: avgDepthRecent != null ? Math.round(avgDepthRecent) : null,
    symmetryAvg: symmetryAvg != null ? Math.round(symmetryAvg) : null,
    lastTopTip: sessions[0]?.topTip ?? null,
    tests: testLines,
    observations,
  };
}
