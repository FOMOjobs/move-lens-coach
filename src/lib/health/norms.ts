/**
 * Normy kliniczne dla testów ruchowych — interpretacja wyników.
 *
 * Źródła (publiczne, uznane w praktyce klinicznej):
 *  - 30-sekundowy test wstawania z krzesła (30-s Chair Stand Test):
 *    zakresy normatywne Rikli & Jones, Senior Fitness Test (1999),
 *    używane m.in. w materiałach CDC STEADI dot. profilaktyki upadków.
 *  - Stanie na jednej nodze (Single-Leg Stance, oczy otwarte):
 *    wartości referencyjne wg Springer i wsp. (2007); w praktyce klinicznej
 *    czas < 10 s u osób starszych wiąże się z podwyższonym ryzykiem upadków.
 *
 * To INFORMACJA i wsparcie decyzji (jak prognoza pogody) — nie diagnoza.
 */

import type { NormBand } from "./results";

export type Sex = "K" | "M";
export type AgeBand = "<60" | "60–69" | "70–79" | "80+";

export const AGE_BANDS: AgeBand[] = ["<60", "60–69", "70–79", "80+"];

export interface Interpretation {
  band: NormBand;
  note: string;
  /** Zakres "w normie" dla wybranej grupy — do pokazania w UI. */
  normLabel: string;
}

/** 30-s Chair Stand: dolna/górna granica normy (liczba wstań). */
const STS_NORMS: Record<Sex, Record<AgeBand, [number, number]>> = {
  M: { "<60": [14, 22], "60–69": [12, 18], "70–79": [11, 17], "80+": [8, 14] },
  K: { "<60": [12, 20], "60–69": [11, 16], "70–79": [10, 15], "80+": [6, 13] },
};

export function interpretSitToStand(reps: number, sex: Sex, age: AgeBand): Interpretation {
  const [lo, hi] = STS_NORMS[sex][age];
  const normLabel = `${lo}–${hi} wstań`;
  if (reps < lo) {
    return {
      band: "below",
      normLabel,
      note: `Wynik poniżej normy dla Twojej grupy (${normLabel}). Warto omówić siłę nóg z fizjoterapeutą — to się dobrze trenuje.`,
    };
  }
  if (reps > hi) {
    return {
      band: "above",
      normLabel,
      note: `Wynik powyżej normy dla Twojej grupy (${normLabel}). Bardzo dobra siła kończyn dolnych.`,
    };
  }
  return {
    band: "norm",
    normLabel,
    note: `Wynik w normie dla Twojej grupy (${normLabel}). Utrzymuj regularny ruch.`,
  };
}

/** Stanie na jednej nodze (oczy otwarte): minimalny czas "w normie" (s). */
const BALANCE_MIN: Record<AgeBand, number> = {
  "<60": 30,
  "60–69": 20,
  "70–79": 10,
  "80+": 5,
};

/** Maksymalny czas próby — dłużej nie mierzymy (wynik "sufitowy"). */
export const BALANCE_CAP_S = 30;

export function interpretBalance(seconds: number, _sex: Sex, age: AgeBand): Interpretation {
  const min = BALANCE_MIN[age];
  const normLabel = `≥ ${min} s`;
  if (seconds >= BALANCE_CAP_S) {
    return {
      band: "above",
      normLabel,
      note: `Pełne ${BALANCE_CAP_S} s — świetna równowaga. Tak trzymaj.`,
    };
  }
  if (seconds < min) {
    const fallRisk = age !== "<60" && seconds < 10;
    return {
      band: "below",
      normLabel,
      note: fallRisk
        ? `Poniżej 10 s — w Twojej grupie wiekowej to sygnał podwyższonego ryzyka upadków. Porozmawiaj o równowadze z fizjoterapeutą.`
        : `Wynik poniżej normy dla Twojej grupy (${normLabel}). Równowagę można skutecznie ćwiczyć.`,
    };
  }
  return {
    band: "norm",
    normLabel,
    note: `Wynik w normie dla Twojej grupy (${normLabel}).`,
  };
}
