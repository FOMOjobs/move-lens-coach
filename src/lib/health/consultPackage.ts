/**
 * Paczka konsultacyjna — jeden zaszyfrowany pakiet dla lekarza.
 *
 * TRANSPORT: paczka podróżuje w FRAGMENCIE URL (po "#"). Fragment nie jest
 * wysyłany na serwer przez żadną przeglądarkę, więc w tej wersji dane nie
 * trafiają na serwer nawet w postaci zaszyfrowanej. Nie ma czego wykraść,
 * bo nie ma czego przechowywać.
 *
 * SZEW NA PRZYSZŁOŚĆ: gdy dojdzie backend (TTL, jednorazowość, dziennik
 * dostępu po stronie serwera), podmienia się wyłącznie createShareLink()
 * i readIncoming() — reszta (krypto, budowa paczki, widok lekarza) zostaje
 * bez zmian. Interfejs PackageTransport poniżej opisuje ten kontrakt.
 *
 * DWA KLUCZE: fragment zawiera losowy sekret, a PIN idzie drugim kanałem
 * (ustnie w gabinecie). Przechwycenie samego linku nie wystarcza.
 */

import { buildMovementSummary, type MovementSummary } from "./doctorSummary";
import { bpWeek, bpWeekSummary, type BpSummary, type BpWeekDay } from "./bloodPressure";
import { listLabPanels, labTrend, toFhirBundle, trackedCodes, type LabPanel, type LabTrendPoint } from "./labResults";
import { decryptJson, encryptJson, fingerprint, generatePin, generateSecret } from "./crypto";

export const PACKAGE_VERSION = 1;

export interface PatientMeta {
  /** Etykieta pokazywana lekarzowi — pacjent decyduje, ile ujawnia. */
  label: string;
  age: number | null;
  sex: "K" | "M" | null;
}

export interface ConsultPackage {
  v: number;
  id: string;
  createdISO: string;
  patient: PatientMeta;
  labs: LabPanel[];
  labTrends: Record<string, LabTrendPoint[]>;
  movement: MovementSummary;
  bp: { week: BpWeekDay[]; summary: BpSummary };
  /** FHIR Bundle — dla systemów gabinetowych. */
  fhir: unknown;
}

/* ----------------------------------------------------------- budowa paczki */

export function buildConsultPackage(patient: PatientMeta): ConsultPackage {
  const labs = listLabPanels();
  const trends: Record<string, LabTrendPoint[]> = {};
  for (const code of trackedCodes()) {
    const t = labTrend(code);
    if (t.length > 1) trends[code] = t; // trend ma sens dopiero od 2 punktów
  }
  const week = bpWeek();
  return {
    v: PACKAGE_VERSION,
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    createdISO: new Date().toISOString(),
    patient,
    labs,
    labTrends: trends,
    movement: buildMovementSummary(),
    bp: { week, summary: bpWeekSummary(week) },
    fhir: toFhirBundle(labs),
  };
}

/* --------------------------------------------------------------- transport */

/** Kontrakt, który podmieni backend Andrzeja. */
export interface PackageTransport {
  /** Publikuje ładunek i zwraca URL, pod którym lekarz go otworzy. */
  publish(id: string, payload: string, secret: string): Promise<string>;
  /** Odczytuje ładunek z bieżącego adresu (lub z serwera po id). */
  read(): Promise<{ id: string; payload: string; secret: string } | null>;
}

function origin(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}`;
}

/**
 * Transport domyślny: wszystko w fragmencie URL.
 * Format: <origin>/k/<id>#<sekret>.<ładunek>
 */
export const fragmentTransport: PackageTransport = {
  async publish(id, payload, secret) {
    return `${origin()}/k/${id}#${secret}.${payload}`;
  },
  async read() {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return null;
    const dot = hash.indexOf(".");
    if (dot <= 0) return null;
    const id = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
    return { id, secret: hash.slice(0, dot), payload: hash.slice(dot + 1) };
  },
};

export interface IssuedShare {
  id: string;
  createdISO: string;
  url: string;
  pin: string;
  fingerprint: string;
  /** Rozmiar ładunku — pilnujemy, czy zmieści się w kodzie QR. */
  bytes: number;
}

/** Szyfruje paczkę i buduje link + PIN. Zapisuje wpis do dziennika pacjenta. */
export async function createShare(
  pkg: ConsultPackage,
  transport: PackageTransport = fragmentTransport,
): Promise<IssuedShare> {
  const secret = generateSecret();
  const pin = generatePin();
  const payload = await encryptJson(pkg, secret, pin);
  const url = await transport.publish(pkg.id, payload, secret);
  const share: IssuedShare = {
    id: pkg.id,
    createdISO: pkg.createdISO,
    url,
    pin,
    fingerprint: await fingerprint(payload),
    bytes: payload.length,
  };
  logIssued(share);
  return share;
}

/** Odczyt po stronie lekarza: bierze ładunek z adresu i odszyfrowuje PIN-em. */
export async function openShare(
  pin: string,
  transport: PackageTransport = fragmentTransport,
): Promise<ConsultPackage> {
  const incoming = await transport.read();
  if (!incoming) throw new Error("Ten link nie zawiera paczki. Poproś pacjenta o nowy.");
  return decryptJson<ConsultPackage>(incoming.payload, incoming.secret, pin);
}

/* ------------------------------------------------- werdykt lekarza (powrót) */

export interface VerdictDecision {
  flagId: string;
  /** Lekarz potwierdza flagę jako istotną albo ją odrzuca. */
  accepted: boolean;
}

/**
 * Podpisany komentarz lekarza. To JEDYNA droga, którą treść interpretacyjna
 * może dotrzeć do pacjenta — aplikacja nie ma innej ścieżki kodowej.
 */
export interface DoctorVerdict {
  v: number;
  packageId: string;
  doctor: string;
  signedISO: string;
  decisions: VerdictDecision[];
  /** Komentarz własny lekarza, widoczny dla pacjenta. */
  note: string;
}

export async function createVerdictLink(
  verdict: DoctorVerdict,
  secret: string,
  pin: string,
): Promise<string> {
  const payload = await encryptJson(verdict, secret, pin);
  return `${origin()}/dane/werdykt#${secret}.${payload}`;
}

export async function readVerdictFromLocation(pin: string): Promise<DoctorVerdict> {
  const incoming = await fragmentTransport.read();
  if (!incoming) throw new Error("Ten link nie zawiera odpowiedzi lekarza.");
  return decryptJson<DoctorVerdict>(incoming.payload, incoming.secret, pin);
}

/* ---------------------------------------------- dzienniki po stronie pacjenta */

const ISSUED_KEY = "movelens.consult.issued.v1";
const VERDICTS_KEY = "movelens.consult.verdicts.v1";

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
    // brak miejsca — pomijamy
  }
}

function logIssued(share: IssuedShare) {
  const list = readList<IssuedShare>(ISSUED_KEY);
  list.unshift(share);
  writeList(ISSUED_KEY, list.slice(0, 20));
}

export function listIssuedShares(): IssuedShare[] {
  return readList<IssuedShare>(ISSUED_KEY);
}

export function revokeShare(id: string) {
  writeList(
    ISSUED_KEY,
    readList<IssuedShare>(ISSUED_KEY).filter((s) => s.id !== id),
  );
}

export function saveVerdict(v: DoctorVerdict) {
  const list = readList<DoctorVerdict>(VERDICTS_KEY).filter((x) => x.packageId !== v.packageId);
  list.unshift(v);
  writeList(VERDICTS_KEY, list.slice(0, 20));
}

export function listVerdicts(): DoctorVerdict[] {
  return readList<DoctorVerdict>(VERDICTS_KEY);
}
