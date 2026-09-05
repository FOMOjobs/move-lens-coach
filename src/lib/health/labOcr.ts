/**
 * OCR wyników laboratoryjnych — całość lokalnie, w przeglądarce.
 *
 * Tesseract.js ładujemy LENIWIE z CDN dopiero w chwili, gdy użytkownik
 * naprawdę kliknie "skanuj". Dzięki temu ~3 MB wasm nie obciąża startu
 * aplikacji, a osoby wpisujące wyniki ręcznie nie pobierają nic.
 *
 * UCZCIWOŚĆ: każde polskie laboratorium ma inny układ wydruku. Parser
 * poniżej jest heurystyczny i ma prawo się mylić — dlatego wynik OCR
 * ZAWSZE trafia na ekran korekty, a nie prosto do bazy. Ścieżką główną
 * jest potwierdzenie/poprawienie przez człowieka.
 */

import { LAB_CATALOG, type LabValue } from "./labResults";

const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js";

export interface OcrProgress {
  status: string;
  progress: number; // 0..1
}

interface TesseractLike {
  recognize(
    image: File | Blob | string,
    langs: string,
    opts: { logger?: (m: { status: string; progress: number }) => void },
  ): Promise<{ data: { text: string } }>;
}

/**
 * Uruchamia OCR na zdjęciu wyników. Zwraca surowy tekst.
 * Wymaga sieci przy PIERWSZYM użyciu (pobranie modelu języka polskiego).
 */
export async function runOcr(
  image: File | Blob,
  onProgress?: (p: OcrProgress) => void,
): Promise<string> {
  let mod: unknown;
  try {
    mod = await import(/* @vite-ignore */ TESSERACT_CDN);
  } catch {
    throw new Error(
      "Nie udało się pobrać silnika OCR. Sprawdź połączenie albo wpisz wyniki ręcznie.",
    );
  }
  const tesseract = mod as TesseractLike;
  const res = await tesseract.recognize(image, "pol", {
    logger: (m) => onProgress?.({ status: m.status, progress: m.progress ?? 0 }),
  });
  return res.data.text ?? "";
}

/* ------------------------------------------------------------------ parser */

/** Liczba w formacie polskim (przecinek) lub angielskim (kropka). */
function num(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ąĄ]/g, "a")
    .replace(/[ćĆ]/g, "c")
    .replace(/[ęĘ]/g, "e")
    .replace(/[łŁ]/g, "l")
    .replace(/[ńŃ]/g, "n")
    .replace(/[óÓ]/g, "o")
    .replace(/[śŚ]/g, "s")
    .replace(/[źżŹŻ]/g, "z");
}

export interface ParsedLab extends LabValue {
  /** Surowa linia — pokazujemy ją przy korekcie, żeby dało się zweryfikować. */
  rawLine: string;
  /** Czy parser jest pewny wartości (znalazł też zakres). */
  confident: boolean;
}

/**
 * Wyciąga z tekstu OCR pary (badanie, wartość, zakres).
 * Strategia: dla każdej linii szukamy aliasu z katalogu, potem pierwszej
 * liczby (wartość), potem pary liczb rozdzielonych myślnikiem (zakres).
 */
export function parseLabText(text: string): ParsedLab[] {
  const out: ParsedLab[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length < 3) continue;
    const hay = normalize(line);

    // Najdłuższy pasujący alias wygrywa (żeby "cholesterol hdl" nie wpadł w "cholesterol").
    let best: { def: (typeof LAB_CATALOG)[number]; at: number; len: number } | null = null;
    for (const def of LAB_CATALOG) {
      for (const alias of def.aliases) {
        const at = hay.indexOf(normalize(alias));
        if (at === -1) continue;
        if (!best || alias.length > best.len) best = { def, at, len: alias.length };
      }
    }
    if (!best || seen.has(best.def.code)) continue;

    // Część linii po nazwie badania — tam siedzą liczby.
    const tail = line.slice(best.at + best.len);
    const numbers = [...tail.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => num(m[0]!));
    const clean = numbers.filter((n): n is number => n != null);
    if (clean.length === 0) continue;

    const value = clean[0]!;
    // Zakres: para liczb po wartości, zwykle "13.0 - 17.0"
    const rangeMatch = tail.match(/(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)/);
    let refLow: number | null = null;
    let refHigh: number | null = null;
    if (rangeMatch) {
      const a = num(rangeMatch[1]!);
      const b = num(rangeMatch[2]!);
      if (a != null && b != null && a !== value) {
        refLow = Math.min(a, b);
        refHigh = Math.max(a, b);
      }
    }

    seen.add(best.def.code);
    out.push({
      code: best.def.code,
      loinc: best.def.loinc,
      name: best.def.name,
      unit: best.def.unit,
      value,
      refLow: refLow ?? best.def.low,
      refHigh: refHigh ?? best.def.high,
      refSource: rangeMatch ? "sheet" : "fallback",
      rawLine: line,
      confident: rangeMatch != null,
    });
  }

  return out;
}

/* -------------------------------------------------------- dane przykładowe */

/**
 * Realistyczne panele do demonstracji i do pracy bez skanowania.
 * Ferrytyna celowo poniżej zakresu — pokazuje powiązanie międzydomenowe
 * w widoku lekarza.
 */
export const DEMO_PANELS: { day: string; lab: string; values: LabValue[] }[] = [
  {
    day: "2026-08-14",
    lab: "Laboratorium Diagnostyka",
    values: [
      {
        code: "hgb",
        loinc: "718-7",
        name: "Hemoglobina",
        unit: "g/dl",
        value: 13.4,
        refLow: 13,
        refHigh: 17,
        refSource: "sheet",
      },
      {
        code: "ferrytyna",
        loinc: "2276-4",
        name: "Ferrytyna",
        unit: "µg/l",
        value: 41,
        refLow: 30,
        refHigh: 400,
        refSource: "sheet",
      },
      {
        code: "glukoza",
        loinc: "1558-6",
        name: "Glukoza na czczo",
        unit: "mg/dl",
        value: 94,
        refLow: 70,
        refHigh: 99,
        refSource: "sheet",
      },
      {
        code: "chol",
        loinc: "2093-3",
        name: "Cholesterol całkowity",
        unit: "mg/dl",
        value: 196,
        refLow: null,
        refHigh: 190,
        refSource: "sheet",
      },
      {
        code: "tsh",
        loinc: "3016-3",
        name: "TSH",
        unit: "µIU/ml",
        value: 2.1,
        refLow: 0.27,
        refHigh: 4.2,
        refSource: "sheet",
      },
      {
        code: "vitd",
        loinc: "1989-3",
        name: "Witamina D (25-OH)",
        unit: "ng/ml",
        value: 24,
        refLow: 30,
        refHigh: 50,
        refSource: "sheet",
      },
    ],
  },
  {
    day: "2026-02-03",
    lab: "Laboratorium Diagnostyka",
    values: [
      {
        code: "hgb",
        loinc: "718-7",
        name: "Hemoglobina",
        unit: "g/dl",
        value: 14.1,
        refLow: 13,
        refHigh: 17,
        refSource: "sheet",
      },
      {
        code: "ferrytyna",
        loinc: "2276-4",
        name: "Ferrytyna",
        unit: "µg/l",
        value: 68,
        refLow: 30,
        refHigh: 400,
        refSource: "sheet",
      },
      {
        code: "glukoza",
        loinc: "1558-6",
        name: "Glukoza na czczo",
        unit: "mg/dl",
        value: 91,
        refLow: 70,
        refHigh: 99,
        refSource: "sheet",
      },
      {
        code: "chol",
        loinc: "2093-3",
        name: "Cholesterol całkowity",
        unit: "mg/dl",
        value: 188,
        refLow: null,
        refHigh: 190,
        refSource: "sheet",
      },
      {
        code: "tsh",
        loinc: "3016-3",
        name: "TSH",
        unit: "µIU/ml",
        value: 1.8,
        refLow: 0.27,
        refHigh: 4.2,
        refSource: "sheet",
      },
    ],
  },
];
