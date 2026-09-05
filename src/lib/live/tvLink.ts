/**
 * Ekran zewnętrzny ("tryb telewizora").
 *
 * Po co: przy przysiadzie stoisz 2–3 m od telefonu, bokiem. Ekranu 6"
 * i tak nie widzisz. Duży ekran rozwiązuje realny problem, a przy okazji
 * pozwala pokazać aplikację na scenie jako produkt, a nie zrzut ekranu.
 *
 * ZASADA: na telewizor NIE IDZIE OBRAZ Z KAMERY — wyłącznie policzone
 * liczby (kilkadziesiąt bajtów na klatkę). Analiza zostaje na urządzeniu,
 * więc "obraz nie opuszcza telefonu" pozostaje prawdą także w tym trybie.
 * Nikt też nie chce siebie w zbliżeniu na 55 calach.
 *
 * TRANSPORT: domyślnie BroadcastChannel — działa między kartami/oknami
 * tej samej przeglądarki, czyli w układzie "laptop podpięty HDMI do
 * telewizora", który na hackathonie jest najpewniejszy i nie wymaga
 * żadnej infrastruktury.
 *
 * SZEW: aby połączyć telefon z osobnym telewizorem, wystarczy dopisać
 * drugi sterownik implementujący TvTransport (WebSocket przez backend
 * albo WebRTC DataChannel z sygnalizacją). Reszta kodu i cały ekran /tv
 * zostają bez zmian.
 */

export type TvPhase = "idle" | "live" | "paused" | "summary";
export type TvChipStatus = "ok" | "warn" | "bad" | "idle";

export interface TvChip {
  label: string;
  status: TvChipStatus;
  hint: string;
}

export interface TvState {
  exercise: string;
  phase: TvPhase;
  reps: number;
  /** Czas trwania serii w sekundach. */
  seconds: number;
  formScore: number | null;
  /** Jedno zdanie korekty — to, co trener powiedziałby na głos. */
  coach: string | null;
  chips: TvChip[];
  /** Tętno z opaski, gdy podłączona (przygotowane pod przyszły moduł). */
  hr: number | null;
  /** Znacznik czasu nadania — ekran wykrywa po nim zerwane połączenie. */
  at: number;
}

export interface TvTransport {
  post(state: TvState): void;
  subscribe(onState: (s: TvState) => void): () => void;
  close(): void;
}

const CODE_KEY = "movelens.tv.code";

/** Czterocyfrowy kod parowania — czytelny z drugiego końca pokoju. */
export function randomPairCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0]! % 10000).padStart(4, "0");
}

/** Kod zapamiętany na tym urządzeniu (żeby nie parować przy każdej serii). */
export function savedPairCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
}

export function savePairCode(code: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (code) window.localStorage.setItem(CODE_KEY, code);
    else window.localStorage.removeItem(CODE_KEY);
  } catch {
    // tryb prywatny — trudno, kod trzeba będzie podać ponownie
  }
}

/* --------------------------------------------- sterownik: BroadcastChannel */

function channelName(code: string): string {
  return `movelens-tv-${code}`;
}

/**
 * Zwraca transport albo null, gdy przeglądarka nie zna BroadcastChannel
 * (wtedy ekran TV pokaże czytelny komunikat zamiast milczeć).
 */
export function createTvTransport(code: string): TvTransport | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  const ch = new BroadcastChannel(channelName(code));
  let closed = false;
  return {
    post(state) {
      if (closed) return;
      try {
        ch.postMessage(state);
      } catch {
        // zbyt duży obiekt / kanał zamknięty — pomijamy klatkę
      }
    },
    subscribe(onState) {
      const handler = (e: MessageEvent) => {
        const data = e.data as TvState | undefined;
        if (data && typeof data.reps === "number") onState(data);
      };
      ch.addEventListener("message", handler);
      return () => ch.removeEventListener("message", handler);
    },
    close() {
      closed = true;
      ch.close();
    },
  };
}

/** Po tylu ms bez wiadomości ekran uznaje połączenie za zerwane. */
export const TV_STALE_MS = 3000;

export function isStale(state: TvState | null, now = Date.now()): boolean {
  return state == null || now - state.at > TV_STALE_MS;
}
