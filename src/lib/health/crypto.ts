/**
 * Kryptografia paczki konsultacyjnej — WebCrypto, wyłącznie po stronie klienta.
 *
 * Model zagrożeń, który realizujemy:
 *  - dane pacjenta NIGDY nie opuszczają urządzenia w postaci jawnej,
 *  - klucz jest losowy i żyje w URL-owym fragmencie (po "#"), którego
 *    przeglądarka z definicji NIE wysyła na serwer (RFC 3986 / RFC 7230),
 *  - drugi składnik to 6-cyfrowy PIN przekazywany innym kanałem (ustnie
 *    w gabinecie). Sam przechwycony link nie wystarcza do odszyfrowania.
 *
 * Klucz AES-GCM powstaje z PBKDF2(klucz_losowy || PIN, sól) — więc brak
 * któregokolwiek składnika oznacza brak dostępu. To jest "dwuklucz".
 *
 * Format ładunku (bajty, potem base64url):
 *   [0]      wersja (1)
 *   [1]      flagi (bit0 = treść skompresowana gzipem)
 *   [2..17]  sól PBKDF2 (16 B)
 *   [18..29] IV dla AES-GCM (12 B)
 *   [30..]   szyfrogram
 */

const VERSION = 1;
const FLAG_GZIP = 0x01;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PBKDF2_ITERATIONS = 150_000;

/** Rzuca czytelnym błędem, gdy strona nie jest w bezpiecznym kontekście. */
function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error(
      "Szyfrowanie wymaga bezpiecznego połączenia (HTTPS lub localhost). " +
        "Otwórz aplikację po HTTPS i spróbuj ponownie.",
    );
  }
  return c.subtle;
}

/* ---------------------------------------------------------------- base64url */

export function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* -------------------------------------------------------------- kompresja */

/**
 * Gzip przez CompressionStream (Chrome 80+, Safari 16.4+). Gdy niedostępny —
 * zwracamy null i lecimy bez kompresji (flaga w nagłówku to odnotuje).
 * Kompresja jest istotna, bo cała paczka musi zmieścić się w kodzie QR.
 */
async function gzip(data: Uint8Array): Promise<Uint8Array | null> {
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream;
  if (!CS) return null;
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CS("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    return null;
  }
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream })
    .DecompressionStream;
  if (!DS) throw new Error("Ta przeglądarka nie potrafi rozpakować paczki (brak gzip).");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DS("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ------------------------------------------------------------- klucz + AES */

/** Losowy klucz sekretny, który trafi do fragmentu URL. */
export function generateSecret(): string {
  const raw = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(raw);
  return toBase64Url(raw);
}

/** Losowy 6-cyfrowy PIN przekazywany drugim kanałem. */
export function generatePin(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0]! % 1_000_000).padStart(6, "0");
}

async function deriveKey(secret: string, pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await subtle().importKey(
    "raw",
    new TextEncoder().encode(`${secret}:${pin}`) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/* ---------------------------------------------------------------- publiczne */

/** Szyfruje dowolny obiekt JSON. Zwraca ładunek base64url gotowy do URL-a. */
export async function encryptJson(value: unknown, secret: string, pin: string): Promise<string> {
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const packed = await gzip(plain);
  const body = packed ?? plain;
  const flags = packed ? FLAG_GZIP : 0;

  const salt = new Uint8Array(SALT_BYTES);
  const iv = new Uint8Array(IV_BYTES);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);

  const key = await deriveKey(secret, pin, salt);
  const cipher = new Uint8Array(
    await subtle().encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, body as BufferSource),
  );

  const out = new Uint8Array(2 + SALT_BYTES + IV_BYTES + cipher.length);
  out[0] = VERSION;
  out[1] = flags;
  out.set(salt, 2);
  out.set(iv, 2 + SALT_BYTES);
  out.set(cipher, 2 + SALT_BYTES + IV_BYTES);
  return toBase64Url(out);
}

/**
 * Odszyfrowuje ładunek. Zły PIN lub uszkodzony link kończy się wyjątkiem
 * (AES-GCM wykrywa to po nieudanej weryfikacji tagu) — wołający ma to
 * potraktować jako "błędny PIN", bez rozróżniania przyczyny.
 */
export async function decryptJson<T>(payload: string, secret: string, pin: string): Promise<T> {
  const raw = fromBase64Url(payload);
  if (raw.length < 2 + SALT_BYTES + IV_BYTES) throw new Error("Uszkodzony link.");
  if (raw[0] !== VERSION) throw new Error("Nieobsługiwana wersja paczki.");

  const flags = raw[1]!;
  const salt = raw.slice(2, 2 + SALT_BYTES);
  const iv = raw.slice(2 + SALT_BYTES, 2 + SALT_BYTES + IV_BYTES);
  const cipher = raw.slice(2 + SALT_BYTES + IV_BYTES);

  const key = await deriveKey(secret, pin, salt);
  const body = new Uint8Array(
    await subtle().decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, cipher as BufferSource),
  );
  const plain = flags & FLAG_GZIP ? await gunzip(body) : body;
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** Krótki, czytelny odcisk paczki — do dziennika dostępu i weryfikacji wzrokowej. */
export async function fingerprint(payload: string): Promise<string> {
  const hash = new Uint8Array(
    await subtle().digest("SHA-256", new TextEncoder().encode(payload) as BufferSource),
  );
  return toBase64Url(hash.slice(0, 6)).toUpperCase();
}
