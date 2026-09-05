/**
 * Wyniki badań laboratoryjnych — WARSTWA ODCZYTU.
 *
 * ZASADA ARCHITEKTONICZNA (nie tylko polityka — patrz doctorFlags.ts):
 * ten moduł umie powiedzieć wyłącznie to, co i tak jest wydrukowane na
 * kartce z laboratorium: jaka jest wartość i czy mieści się w zakresie
 * referencyjnym podanym przez to laboratorium. NIE MA tu i nie wolno tu
 * dodawać: przyczyn, sugestii leczenia, ani zdań typu "to może oznaczać".
 * Warstwa interpretacyjna żyje w doctorFlags.ts i jest dostępna dopiero
 * po stronie lekarza.
 *
 * Zakres referencyjny bierzemy z KARTKI (refSource: "sheet"). Tabela
 * FALLBACK_RANGES służy wyłącznie do podpowiedzi, gdy OCR nie znalazł
 * zakresu — jest wtedy wyraźnie oznaczona jako do potwierdzenia.
 */

export type RangeStatus = "below" | "in" | "above" | "unknown";
export type LabSource = "ocr" | "manual" | "demo";

export interface LabValue {
  /** Klucz wewnętrzny, np. "ferrytyna". */
  code: string;
  /** Kod LOINC — wewnętrzny standard porządkowania danych (FHIR). */
  loinc: string;
  name: string;
  value: number;
  unit: string;
  /** Zakres z kartki; null gdy nieodczytany. */
  refLow: number | null;
  refHigh: number | null;
  refSource: "sheet" | "fallback";
}

export interface LabPanel {
  id: string;
  /** Data pobrania/badania (YYYY-MM-DD). */
  day: string;
  /** Kiedy trafiło do aplikacji. */
  addedISO: string;
  lab: string;
  source: LabSource;
  values: LabValue[];
}

/* --------------------------------------------------------- katalog badań */

export interface LabDef {
  code: string;
  loinc: string;
  name: string;
  unit: string;
  /** Typowy zakres dorosłych — WYŁĄCZNIE jako podpowiedź do potwierdzenia. */
  low: number | null;
  high: number | null;
  /** Warianty nazw spotykane na polskich wynikach — do dopasowania w OCR. */
  aliases: string[];
}

export const LAB_CATALOG: LabDef[] = [
  { code: "hgb", loinc: "718-7", name: "Hemoglobina", unit: "g/dl", low: 13, high: 17, aliases: ["hemoglobina", "hgb", "hb"] },
  { code: "rbc", loinc: "789-8", name: "Erytrocyty", unit: "mln/µl", low: 4.2, high: 5.4, aliases: ["erytrocyty", "rbc"] },
  { code: "wbc", loinc: "6690-2", name: "Leukocyty", unit: "tys/µl", low: 4, high: 10, aliases: ["leukocyty", "wbc"] },
  { code: "plt", loinc: "777-3", name: "Płytki krwi", unit: "tys/µl", low: 150, high: 400, aliases: ["płytki", "plytki", "plt", "trombocyty"] },
  { code: "ferrytyna", loinc: "2276-4", name: "Ferrytyna", unit: "µg/l", low: 30, high: 400, aliases: ["ferrytyna", "ferritin"] },
  { code: "zelazo", loinc: "2498-4", name: "Żelazo", unit: "µg/dl", low: 60, high: 160, aliases: ["żelazo", "zelazo", "fe"] },
  { code: "glukoza", loinc: "1558-6", name: "Glukoza na czczo", unit: "mg/dl", low: 70, high: 99, aliases: ["glukoza", "glc", "cukier"] },
  { code: "hba1c", loinc: "4548-4", name: "Hemoglobina glikowana", unit: "%", low: null, high: 5.7, aliases: ["hba1c", "hemoglobina glikowana"] },
  { code: "chol", loinc: "2093-3", name: "Cholesterol całkowity", unit: "mg/dl", low: null, high: 190, aliases: ["cholesterol całkowity", "cholesterol calkowity", "chol"] },
  { code: "hdl", loinc: "2085-9", name: "Cholesterol HDL", unit: "mg/dl", low: 40, high: null, aliases: ["hdl"] },
  { code: "ldl", loinc: "13457-7", name: "Cholesterol LDL", unit: "mg/dl", low: null, high: 115, aliases: ["ldl"] },
  { code: "tg", loinc: "2571-8", name: "Trójglicerydy", unit: "mg/dl", low: null, high: 150, aliases: ["trójglicerydy", "trojglicerydy", "tg"] },
  { code: "tsh", loinc: "3016-3", name: "TSH", unit: "µIU/ml", low: 0.27, high: 4.2, aliases: ["tsh", "tyreotropina"] },
  { code: "kreatynina", loinc: "2160-0", name: "Kreatynina", unit: "mg/dl", low: 0.7, high: 1.3, aliases: ["kreatynina"] },
  { code: "egfr", loinc: "33914-3", name: "eGFR", unit: "ml/min/1,73m²", low: 90, high: null, aliases: ["egfr", "gfr"] },
  { code: "alt", loinc: "1742-6", name: "ALT", unit: "U/l", low: null, high: 41, aliases: ["alt", "alat", "gpt"] },
  { code: "ast", loinc: "1920-8", name: "AST", unit: "U/l", low: null, high: 40, aliases: ["ast", "aspat", "got"] },
  { code: "crp", loinc: "1988-5", name: "CRP", unit: "mg/l", low: null, high: 5, aliases: ["crp", "białko c-reaktywne"] },
  { code: "vitd", loinc: "1989-3", name: "Witamina D (25-OH)", unit: "ng/ml", low: 30, high: 50, aliases: ["witamina d", "25-oh", "25(oh)d"] },
  { code: "b12", loinc: "2132-9", name: "Witamina B12", unit: "pg/ml", low: 197, high: 771, aliases: ["witamina b12", "b12", "kobalamina"] },
  { code: "kwas_moczowy", loinc: "3084-1", name: "Kwas moczowy", unit: "mg/dl", low: 3.5, high: 7.2, aliases: ["kwas moczowy"] },
  { code: "potas", loinc: "2823-3", name: "Potas", unit: "mmol/l", low: 3.5, high: 5.1, aliases: ["potas", "k+"] },
  { code: "sod", loinc: "2951-2", name: "Sód", unit: "mmol/l", low: 136, high: 145, aliases: ["sód", "sod", "na+"] },
];

export function findLabDef(code: string): LabDef | undefined {
  return LAB_CATALOG.find((d) => d.code === code);
}

/* ------------------------------------------------------------ odczyt normy */

/**
 * Jedyna "ocena", na jaką pozwalamy pacjentowi: czy wartość mieści się
 * w zakresie z kartki. To odczyt, nie interpretacja.
 */
export function rangeStatus(v: LabValue): RangeStatus {
  if (v.refLow == null && v.refHigh == null) return "unknown";
  if (v.refLow != null && v.value < v.refLow) return "below";
  if (v.refHigh != null && v.value > v.refHigh) return "above";
  return "in";
}

export function rangeLabel(v: LabValue): string {
  if (v.refLow != null && v.refHigh != null) return `${v.refLow}–${v.refHigh} ${v.unit}`;
  if (v.refHigh != null) return `< ${v.refHigh} ${v.unit}`;
  if (v.refLow != null) return `> ${v.refLow} ${v.unit}`;
  return "brak zakresu";
}

export const STATUS_LABEL: Record<RangeStatus, string> = {
  below: "poniżej zakresu",
  in: "w zakresie",
  above: "powyżej zakresu",
  unknown: "brak zakresu na wyniku",
};

/* ---------------------------------------------------------------- storage */

const LABS_KEY = "movelens.labs.v1";

function read(): LabPanel[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LABS_KEY);
    return raw ? (JSON.parse(raw) as LabPanel[]) : [];
  } catch {
    return [];
  }
}

function write(list: LabPanel[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LABS_KEY, JSON.stringify(list));
  } catch {
    // pełny storage / tryb prywatny — nie wywalamy aplikacji
  }
}

export function listLabPanels(): LabPanel[] {
  return read().sort((a, b) => b.day.localeCompare(a.day));
}

export function saveLabPanel(p: Omit<LabPanel, "id" | "addedISO">): LabPanel {
  const item: LabPanel = {
    ...p,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    addedISO: new Date().toISOString(),
  };
  const list = read();
  list.push(item);
  write(list);
  return item;
}

export function deleteLabPanel(id: string) {
  write(read().filter((p) => p.id !== id));
}

/* ------------------------------------------------------------------ trendy */

export interface LabTrendPoint {
  day: string;
  value: number;
  status: RangeStatus;
}

/** Szereg czasowy jednego parametru — do wykresu i do paczki dla lekarza. */
export function labTrend(code: string): LabTrendPoint[] {
  const points: LabTrendPoint[] = [];
  for (const panel of listLabPanels()) {
    const v = panel.values.find((x) => x.code === code);
    if (v) points.push({ day: panel.day, value: v.value, status: rangeStatus(v) });
  }
  return points.sort((a, b) => a.day.localeCompare(b.day));
}

/** Kody obecne w co najmniej jednym panelu — do listy „co śledzimy". */
export function trackedCodes(): string[] {
  const set = new Set<string>();
  for (const p of listLabPanels()) for (const v of p.values) set.add(v.code);
  return [...set];
}

/* -------------------------------------------------------------------- FHIR */

/**
 * Eksport do FHIR R4 (Bundle/collection z zasobami Observation).
 * FHIR jest naszym wewnętrznym standardem porządkowania danych — dzięki
 * temu paczka dla lekarza jest czytelna dla systemów gabinetowych.
 */
export function toFhirBundle(panels: LabPanel[]): unknown {
  return {
    resourceType: "Bundle",
    type: "collection",
    entry: panels.flatMap((panel) =>
      panel.values.map((v) => ({
        resource: {
          resourceType: "Observation",
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "laboratory",
                },
              ],
            },
          ],
          code: {
            coding: [{ system: "http://loinc.org", code: v.loinc, display: v.name }],
            text: v.name,
          },
          effectiveDateTime: panel.day,
          performer: panel.lab ? [{ display: panel.lab }] : undefined,
          valueQuantity: {
            value: v.value,
            unit: v.unit,
            system: "http://unitsofmeasure.org",
          },
          referenceRange:
            v.refLow != null || v.refHigh != null
              ? [
                  {
                    low: v.refLow != null ? { value: v.refLow, unit: v.unit } : undefined,
                    high: v.refHigh != null ? { value: v.refHigh, unit: v.unit } : undefined,
                    text: rangeLabel(v),
                  },
                ]
              : undefined,
        },
      })),
    ),
  };
}
