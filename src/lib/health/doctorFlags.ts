/**
 * WARSTWA INTERPRETACYJNA — WYŁĄCZNIE DLA LEKARZA.
 *
 * =====================================================================
 *  Ten moduł wolno importować TYLKO z trasy /k/$id (widok lekarza).
 *  Import z jakiegokolwiek ekranu pacjenta jest błędem architektonicznym
 *  i zostanie wyłapany przez assertDoctorContext() w czasie działania.
 * =====================================================================
 *
 * Co tu jest, a czego nie ma:
 *  - SĄ "flagi do rozważenia": zestawienia twardych liczb z różnych
 *    domen (laboratorium, ruch, ciśnienie), które mogą umknąć przy
 *    kartkowaniu papierów.
 *  - NIE MA rozpoznań, przyczyn ani zaleceń leczniczych. Flaga mówi
 *    "oto co widać w danych", nigdy "to jest choroba X".
 *
 * Gwarancja dla pacjenta (i to jest prawdziwy zamek, nie deklaracja):
 * jedyną drogą, którą treść interpretacyjna może trafić na ekran
 * pacjenta, jest podpisany DoctorVerdict. Ekrany pacjenta renderują
 * wyłącznie werdykt z podpisem lekarza — nigdy wyniku tego modułu.
 */

import type { ConsultPackage } from "./consultPackage";
import { rangeLabel, rangeStatus, STATUS_LABEL, type LabValue } from "./labResults";

export type FlagSeverity = "info" | "attention";
export type FlagDomain = "lab" | "movement" | "bp" | "cross";

export interface DoctorFlag {
  id: string;
  severity: FlagSeverity;
  domain: FlagDomain;
  title: string;
  /** Wyłącznie konkretne liczby z paczki — bez wnioskowania. */
  evidence: string[];
}

/**
 * Strażnik kontekstu. Rzuca, jeśli moduł zostanie użyty poza widokiem
 * lekarza — dzięki temu przypadkowy import na ekranie pacjenta nie
 * przejdzie niezauważony.
 */
export function assertDoctorContext() {
  if (typeof window === "undefined") return; // SSR: nic nie renderujemy
  if (!window.location.pathname.includes("/k/")) {
    throw new Error(
      "doctorFlags jest dostępny wyłącznie w widoku lekarza (/k/:id). " +
        "Ekrany pacjenta pokazują tylko podpisany werdykt.",
    );
  }
}

function fmt(n: number, digits = 1): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function labLine(v: LabValue): string {
  return `${v.name}: ${fmt(v.value, 2)} ${v.unit} (zakres laboratorium ${rangeLabel(v)}, ${
    STATUS_LABEL[rangeStatus(v)]
  })`;
}

/**
 * Buduje flagi z paczki. Kolejność: najpierw powiązania międzydomenowe
 * (bo to one są niewidoczne przy kartkowaniu papierów), potem pojedyncze
 * odchylenia.
 */
export function buildDoctorFlags(pkg: ConsultPackage): DoctorFlag[] {
  assertDoctorContext();

  const flags: DoctorFlag[] = [];
  const latest = pkg.labs[0];
  const values = latest?.values ?? [];
  const byCode = new Map(values.map((v) => [v.code, v]));
  const outOfRange = values.filter((v) => {
    const s = rangeStatus(v);
    return s === "below" || s === "above";
  });

  const m = pkg.movement;
  const formDropped = m.formTrend != null && m.formTrend <= -5;
  const testsBelow = m.tests.filter((t) => t.band === "below");

  /* ---------------------------------------------- powiązania międzydomenowe */

  // Niedobór w morfologii/żelazie razem ze spadkiem jakości ruchu.
  const ferr = byCode.get("ferrytyna");
  const hgb = byCode.get("hgb");
  const anaemiaSignal =
    (ferr && rangeStatus(ferr) === "below") || (hgb && rangeStatus(hgb) === "below");
  if (anaemiaSignal && formDropped) {
    const ev: string[] = [];
    if (ferr && rangeStatus(ferr) === "below") ev.push(labLine(ferr));
    if (hgb && rangeStatus(hgb) === "below") ev.push(labLine(hgb));
    ev.push(`Form Score: zmiana ${m.formTrend} pkt między najstarszymi a najnowszymi sesjami`);
    if (m.avgFormRecent != null) ev.push(`Średni Form Score (ostatnie sesje): ${m.avgFormRecent}`);
    flags.push({
      id: "cross-iron-performance",
      severity: "attention",
      domain: "cross",
      title: "Odchylenie w gospodarce żelazem współwystępuje ze spadkiem jakości ruchu",
      evidence: ev,
    });
  }

  // Gospodarka węglowodanowa a aktywność.
  const glu = byCode.get("glukoza");
  const hba1c = byCode.get("hba1c");
  const glycemia =
    (glu && rangeStatus(glu) === "above") || (hba1c && rangeStatus(hba1c) === "above");
  if (glycemia) {
    const ev: string[] = [];
    if (glu && rangeStatus(glu) === "above") ev.push(labLine(glu));
    if (hba1c && rangeStatus(hba1c) === "above") ev.push(labLine(hba1c));
    ev.push(`Sesje ruchowe zarejestrowane w aplikacji: ${m.sessionCount}`);
    flags.push({
      id: "cross-glycemia-activity",
      severity: "attention",
      domain: "cross",
      title: "Podwyższone parametry węglowodanowe w zestawieniu z wolumenem aktywności",
      evidence: ev,
    });
  }

  // Ciśnienie domowe a ruch.
  if (pkg.bp.summary.elevated) {
    const ev: string[] = [];
    const s = pkg.bp.summary;
    if (s.morningAvg)
      ev.push(`Średnia poranna: ${s.morningAvg.sys}/${s.morningAvg.dia} (n=${s.morningAvg.n})`);
    if (s.eveningAvg)
      ev.push(`Średnia wieczorna: ${s.eveningAvg.sys}/${s.eveningAvg.dia} (n=${s.eveningAvg.n})`);
    ev.push(`Wypełnione pomiary w tygodniu: ${s.filled}/14`);
    ev.push("Próg domowy uznawany za podwyższony: ≥135/85");
    flags.push({
      id: "bp-elevated",
      severity: "attention",
      domain: "bp",
      title: "Średnia z pomiarów domowych powyżej progu 135/85",
      evidence: ev,
    });
  }

  /* --------------------------------------------------- pojedyncze odchylenia */

  for (const v of outOfRange) {
    flags.push({
      id: `lab-${v.code}`,
      severity: "attention",
      domain: "lab",
      title: `${v.name} poza zakresem laboratorium`,
      evidence: [labLine(v), ...trendEvidence(pkg, v.code)],
    });
  }

  for (const t of testsBelow) {
    flags.push({
      id: `test-${t.kind}`,
      severity: "attention",
      domain: "movement",
      title: `${t.label}: wynik poniżej normy referencyjnej`,
      evidence: [`Wynik: ${t.valueLabel} (${t.dateLabel})`, t.note],
    });
  }

  if (m.symmetryAvg != null && m.symmetryAvg > 15) {
    flags.push({
      id: "movement-symmetry",
      severity: "attention",
      domain: "movement",
      title: "Utrzymująca się asymetria pracy kolan",
      evidence: [
        `Średnia różnica kątów lewego i prawego kolana: ${m.symmetryAvg}°`,
        "Wartość odniesienia przyjęta w aplikacji: 15°",
      ],
    });
  }

  if (formDropped && !anaemiaSignal) {
    flags.push({
      id: "movement-form-trend",
      severity: "info",
      domain: "movement",
      title: "Spadek jakości wykonywania przysiadu",
      evidence: [
        `Zmiana Form Score: ${m.formTrend} pkt`,
        `Liczba sesji w zestawieniu: ${m.sessionCount}`,
      ],
    });
  }

  /* ----------------------------------------------- kontekst, gdy nic nie kłuje */

  if (flags.length === 0) {
    flags.push({
      id: "none",
      severity: "info",
      domain: "cross",
      title: "Brak odchyleń w danych przekazanych przez pacjenta",
      evidence: [
        `Paneli laboratoryjnych: ${pkg.labs.length}`,
        `Sesji ruchowych: ${m.sessionCount}`,
        `Pomiarów ciśnienia w tygodniu: ${pkg.bp.summary.filled}/14`,
      ],
    });
  }

  return flags;
}

/** Jeśli parametr ma historię, dołóż kierunek zmiany — bez wnioskowania. */
function trendEvidence(pkg: ConsultPackage, code: string): string[] {
  const t = pkg.labTrends[code];
  if (!t || t.length < 2) return [];
  const first = t[0]!;
  const last = t[t.length - 1]!;
  const delta = last.value - first.value;
  const dir = delta > 0 ? "wzrost" : delta < 0 ? "spadek" : "bez zmiany";
  return [
    `Historia (${t.length} pomiary): ${fmt(first.value, 2)} → ${fmt(last.value, 2)} (${dir}), ${first.day} → ${last.day}`,
  ];
}
