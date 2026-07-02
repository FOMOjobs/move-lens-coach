/**
 * Warstwa danych zdrowotnych — zapis wyników treningów i testów klinicznych.
 *
 * Ekrany czytają WYŁĄCZNIE przez te funkcje (nigdy localStorage bezpośrednio),
 * dzięki czemu później można podmienić środek (API/FHIR) bez ruszania UI.
 * Wszystko lokalnie na urządzeniu — spójnie z "prywatność by design".
 */

export interface StoredSquatSession {
  id: string;
  dateISO: string;
  kind: "przysiad";
  reps: number;
  avgDepthAngle: number; // średni kąt kolana w dole (mniej = głębiej)
  avgFormScore: number; // 0..100
  symmetryDelta: number; // różnica kątów kolan w stopniach
  topTip: string;
}

export type TestKind = "sit-to-stand" | "balance";
export type NormBand = "above" | "norm" | "below";

export interface StoredTestResult {
  id: string;
  dateISO: string;
  kind: TestKind;
  /** sit-to-stand: liczba wstań w 30 s; balance: czas w sekundach */
  value: number;
  /** balance: która noga */
  leg?: "left" | "right";
  band: NormBand;
  note: string; // interpretacja ludzkim językiem
  ageBand: string;
  sex: "K" | "M";
}

const SESSIONS_KEY = "movelens.sessions.v1";
const TESTS_KEY = "movelens.tests.v1";

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // brak miejsca / tryb prywatny — trudno, nie wywalamy aplikacji
  }
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function saveSquatSession(
  s: Omit<StoredSquatSession, "id" | "dateISO" | "kind">,
): StoredSquatSession {
  const item: StoredSquatSession = {
    ...s,
    id: newId(),
    dateISO: new Date().toISOString(),
    kind: "przysiad",
  };
  const list = readList<StoredSquatSession>(SESSIONS_KEY);
  list.push(item);
  writeList(SESSIONS_KEY, list);
  return item;
}

export function listSquatSessions(): StoredSquatSession[] {
  return readList<StoredSquatSession>(SESSIONS_KEY).sort((a, b) =>
    b.dateISO.localeCompare(a.dateISO),
  );
}

export function saveTestResult(t: Omit<StoredTestResult, "id" | "dateISO">): StoredTestResult {
  const item: StoredTestResult = { ...t, id: newId(), dateISO: new Date().toISOString() };
  const list = readList<StoredTestResult>(TESTS_KEY);
  list.push(item);
  writeList(TESTS_KEY, list);
  return item;
}

export function listTestResults(): StoredTestResult[] {
  return readList<StoredTestResult>(TESTS_KEY).sort((a, b) => b.dateISO.localeCompare(a.dateISO));
}
