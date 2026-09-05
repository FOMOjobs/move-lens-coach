import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MonitorPlay, ShieldCheck, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Ring } from "@/components/Ring";
import {
  createTvTransport,
  isStale,
  savePairCode,
  savedPairCode,
  TV_STALE_MS,
  type TvChipStatus,
  type TvState,
} from "@/lib/live/tvLink";

export const Route = createFileRoute("/tv")({
  head: () => ({
    meta: [
      { title: "MoveLens na dużym ekranie" },
      {
        name: "description",
        content: "Ekran zewnętrzny MoveLens — duże liczby, bez obrazu z kamery.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    kod: typeof search.kod === "string" ? search.kod : undefined,
  }),
  component: TvPage,
});

const CHIP_STYLE: Record<TvChipStatus, string> = {
  ok: "bg-good/20 text-good",
  warn: "bg-warn/25 text-warn",
  bad: "bg-bad/25 text-bad",
  idle: "bg-white/10 text-white/50",
};

function TvPage() {
  const { kod } = Route.useSearch();
  const [code, setCode] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<TvState | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [, tick] = useState(0);

  // Kod z adresu ma pierwszeństwo, potem zapamiętany na tym urządzeniu.
  useEffect(() => {
    setCode(kod ?? savedPairCode());
  }, [kod]);

  // Subskrypcja kanału
  useEffect(() => {
    if (!code) return;
    const transport = createTvTransport(code);
    if (!transport) {
      setUnsupported(true);
      return;
    }
    const off = transport.subscribe(setState);
    return () => {
      off();
      transport.close();
    };
  }, [code]);

  // Odświeżanie, żeby wykryć zerwane połączenie
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!code) {
    return (
      <PairScreen
        draft={draft}
        setDraft={setDraft}
        onPair={(c) => {
          savePairCode(c);
          setCode(c);
        }}
      />
    );
  }

  const stale = isStale(state);
  const mm = String(Math.floor((state?.seconds ?? 0) / 60)).padStart(2, "0");
  const ss = String((state?.seconds ?? 0) % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 flex flex-col bg-[#0B1512] px-[4vw] py-[4vh] text-white">
      {/* Nagłówek */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[2.2vw] font-semibold uppercase tracking-[0.2em] text-white/60">
            MoveLens
          </p>
          <h1 className="text-[4vw] font-semibold leading-tight">
            {state?.exercise ?? "Oczekiwanie na trening"}
          </h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-[4vw] font-semibold tabular-nums">
            {mm}:{ss}
          </p>
          <p className={cn("text-[1.6vw] font-medium", stale ? "text-warn" : "text-good")}>
            {stale ? "brak połączenia" : `połączono · kod ${code}`}
          </p>
        </div>
      </header>

      {/* Główna część */}
      {unsupported ? (
        <Centered>
          <WifiOff className="mx-auto h-[6vw] w-[6vw] text-warn" />
          <p className="mt-[2vh] text-[2.5vw]">Ta przeglądarka nie obsługuje kanału lokalnego.</p>
          <p className="mt-[1vh] text-[1.6vw] text-white/60">
            Otwórz ten adres w Chrome, Edge lub Safari 15.4+.
          </p>
        </Centered>
      ) : stale ? (
        <Centered>
          <MonitorPlay className="mx-auto h-[6vw] w-[6vw] text-white/40" />
          <p className="mt-[2vh] text-[2.5vw]">Czekam na trening…</p>
          <p className="mt-[1vh] text-[1.6vw] text-white/60">
            Na telefonie wybierz ćwiczenie i wpisz kod <span className="font-mono">{code}</span>.
          </p>
          <p className="mt-[1vh] text-[1.3vw] text-white/40">
            Sygnał wygasa po {TV_STALE_MS / 1000} s ciszy.
          </p>
        </Centered>
      ) : (
        <main className="flex flex-1 items-center justify-center gap-[6vw]">
          {/* Licznik powtórzeń — czytelny z drugiego końca pokoju */}
          <div className="text-center">
            <p className="font-mono text-[26vw] font-bold leading-none tabular-nums">
              {state?.reps ?? 0}
            </p>
            <p className="mt-[1vh] text-[2.2vw] uppercase tracking-[0.25em] text-white/60">
              powtórzeń
            </p>
          </div>

          {state?.formScore != null && (
            <div className="text-center">
              <Ring
                value={state.formScore}
                size={260}
                stroke={22}
                label={String(state.formScore)}
                sublabel="Forma"
                trackClass="stroke-white/15"
                progressClass="stroke-primary"
              />
            </div>
          )}
        </main>
      )}

      {/* Korekta i chipy */}
      {!stale && (
        <footer>
          {state?.coach && (
            <p className="mb-[2vh] text-center text-[3.4vw] font-semibold leading-tight text-warn">
              {state.coach}
            </p>
          )}
          {state && state.chips.length > 0 && (
            <div className="flex flex-wrap justify-center gap-[1.2vw]">
              {state.chips.map((c) => (
                <span
                  key={c.label}
                  className={cn(
                    "rounded-full px-[2vw] py-[1vh] text-[1.8vw] font-medium",
                    CHIP_STYLE[c.status],
                  )}
                >
                  {c.label}
                  {c.status === "warn" || c.status === "bad" ? ` — ${c.hint}` : ""}
                </span>
              ))}
            </div>
          )}
          <p className="mt-[2vh] flex items-center justify-center gap-2 text-[1.3vw] text-white/40">
            <ShieldCheck className="h-[1.6vw] w-[1.6vw]" />
            Obraz z kamery zostaje w telefonie. Na ten ekran trafiają wyłącznie liczby.
          </p>
        </footer>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 items-center justify-center text-center">{children}</main>;
}

/* --------------------------------------------------------- ekran parowania */

function PairScreen({
  draft,
  setDraft,
  onPair,
}: {
  draft: string;
  setDraft: (s: string) => void;
  onPair: (code: string) => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0B1512] px-[6vw] text-white">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.length === 4) onPair(draft);
        }}
        className="w-full max-w-xl text-center"
      >
        <MonitorPlay className="mx-auto h-16 w-16 text-primary" />
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">MoveLens na dużym ekranie</h1>
        <p className="mt-3 text-lg text-white/60">
          Na telefonie otwórz „Ćwicz", włącz tryb telewizora i przepisz tutaj czterocyfrowy kod.
        </p>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoFocus
          placeholder="0000"
          className="mx-auto mt-8 block w-64 rounded-3xl border border-white/20 bg-white/5 px-6 py-5 text-center font-mono text-5xl tracking-[0.3em] tabular-nums text-white placeholder:text-white/25"
        />
        <button
          type="submit"
          disabled={draft.length !== 4}
          className="mx-auto mt-6 block rounded-2xl bg-primary px-10 py-4 text-lg font-medium text-primary-foreground disabled:opacity-40"
        >
          Połącz
        </button>
        <p className="mt-8 text-sm text-white/40">
          Ekran działa lokalnie — nie wysyła ani nie odbiera niczego z internetu.
        </p>
      </form>
    </div>
  );
}
