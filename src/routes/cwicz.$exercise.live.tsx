import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, SwitchCamera, Volume2, VolumeX, X } from "lucide-react";
import { Ring } from "@/components/Ring";
import { cn } from "@/lib/utils";
import { usePoseAnalysis } from "@/lib/pose/usePoseAnalysis";
import { SquatAnalyzer, type SquatFeedback, type SquatSummary } from "@/lib/pose/squatAnalyzer";
import { POSE_CONNECTIONS } from "@/lib/pose/geometry";
import { VoiceCoach } from "@/lib/pose/voiceCoach";
import { TestLive } from "@/components/TestLive";
import { saveSquatSession } from "@/lib/health/results";
import {
  createTvTransport,
  savedPairCode,
  type TvChip,
  type TvTransport,
} from "@/lib/live/tvLink";

export const Route = createFileRoute("/cwicz/$exercise/live")({
  head: () => ({
    meta: [{ title: "Trening na żywo — MoveLens" }],
  }),
  component: LiveRouter,
});

const NAMES: Record<string, string> = {
  przysiad: "Przysiad",
  pompka: "Pompka",
  deska: "Deska",
  wykrok: "Wykrok",
};

/** Testy kliniczne mają własny ekran; ćwiczenia — LivePage. */
function LiveRouter() {
  const { exercise } = Route.useParams();
  if (exercise === "test-wstawania") return <TestLive kind="sit-to-stand" />;
  if (exercise === "test-rownowagi") return <TestLive kind="balance" />;
  return <LivePage />;
}

function LivePage() {
  const { exercise } = Route.useParams();
  const navigate = useNavigate();
  const name = NAMES[exercise] ?? "Ćwiczenie";
  const isSquat = exercise === "przysiad";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyzerRef = useRef<SquatAnalyzer>(new SquatAnalyzer());
  const coachRef = useRef<VoiceCoach | null>(null);
  if (coachRef.current === null && typeof window !== "undefined") {
    coachRef.current = new VoiceCoach();
  }
  const startedAtRef = useRef<number>(Date.now());

  // Faza sesji: podgląd (przed Startem) → trwa → pauza
  const [phase, setPhase] = useState<"preview" | "running" | "paused">("preview");
  const [facing, setFacing] = useState<"user" | "environment">("user"); // domyślnie przednia
  const [voiceOn, setVoiceOn] = useState(true);
  const [feedback, setFeedback] = useState<SquatFeedback | null>(null);
  const [displayReps, setDisplayReps] = useState(0); // licznik utrzymywany też w pauzie
  const [simpleCount, setSimpleCount] = useState(0); // dla nie-przysiadów (na razie czas)
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<SquatSummary | null>(null);

  // Tykanie czasu sesji — tylko gdy trwa
  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const onFrame = useCallback(
    (landmarks: any, ts: number, ctx: { videoWidth: number; videoHeight: number }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (parent) {
        // Dopasuj rozmiar canvas do widoku (CSS) i do faktycznej rozdzielczości wideo (bitmap)
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== w * devicePixelRatio || canvas.height !== h * devicePixelRatio) {
          canvas.width = Math.round(w * devicePixelRatio);
          canvas.height = Math.round(h * devicePixelRatio);
          canvas.style.width = w + "px";
          canvas.style.height = h + "px";
        }
      }
      const g = canvas.getContext("2d");
      if (!g) return;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);

      if (!landmarks) {
        setFeedback(null);
        return;
      }

      let fb: SquatFeedback | null = null;
      if (isSquat) {
        fb = analyzerRef.current.analyze(landmarks, ts);
        setFeedback(fb);
        if (fb?.ready) setDisplayReps(fb.reps); // utrzymaj licznik (także w pauzie)
        if (fb) coachRef.current?.onSquatFeedback(fb, ts); // głosowy trener
      } else {
        // Uproszczona "analiza" — tylko szkielet, brak liczenia
        setSimpleCount((c) => c);
      }

      // Rysuj szkielet — mirror dla kamery przedniej
      const W = canvas.width;
      const H = canvas.height;
      // Wpasowanie "object-cover": używamy współrzędnych znormalizowanych 0..1
      const mirror = facing === "user";

      const px = (x: number) => (mirror ? (1 - x) : x) * W;
      const py = (y: number) => y * H;

      const flagged = fb?.flaggedLandmarks ?? new Set<number>();
      const warnColor = "rgba(224, 164, 88, 0.95)"; // bursztyn
      const goodColor = "rgba(63, 169, 141, 0.95)"; // primary

      // Połączenia
      g.lineWidth = Math.max(3, W * 0.006);
      g.lineCap = "round";
      POSE_CONNECTIONS.forEach(([a, b]) => {
        const A = landmarks[a];
        const B = landmarks[b];
        if (!A || !B) return;
        g.strokeStyle = flagged.has(a) || flagged.has(b) ? warnColor : goodColor;
        g.beginPath();
        g.moveTo(px(A.x), py(A.y));
        g.lineTo(px(B.x), py(B.y));
        g.stroke();
      });

      // Stawy
      const r = Math.max(4, W * 0.008);
      landmarks.forEach((p: any, i: number) => {
        if (!p) return;
        // pomijamy twarzowe punkty (1..10) dla czytelności
        if (i > 0 && i < 11) return;
        g.fillStyle = flagged.has(i) ? warnColor : goodColor;
        g.beginPath();
        g.arc(px(p.x), py(p.y), r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.85)";
        g.beginPath();
        g.arc(px(p.x), py(p.y), r * 0.4, 0, Math.PI * 2);
        g.fill();
      });
    },
    [facing, isSquat],
  );

  const { videoRef, status, error } = usePoseAnalysis({
    onFrame,
    enabled: !summary, // kamera + model aktywne przez cały ekran (oprócz podsumowania)
    detecting: phase === "running", // detekcja dopiero po Starcie, wstrzymana w pauzie
    facingMode: facing,
  });

  const start = () => {
    analyzerRef.current.reset();
    coachRef.current?.reset();
    coachRef.current?.unlock(); // iOS: odblokuj mowę w geście użytkownika
    startedAtRef.current = Date.now();
    setDisplayReps(0);
    setSimpleCount(0);
    setElapsed(0);
    setFeedback(null);
    setPhase("running");
    if (isSquat) coachRef.current?.say("Zaczynamy. Pierwszy przysiad!");
  };

  const stopAndSummarize = () => {
    if (isSquat) {
      const s = analyzerRef.current.summary();
      setSummary(s);
      if (s.reps > 0) {
        saveSquatSession({
          reps: s.reps,
          avgDepthAngle: s.avgDepthAngle,
          avgFormScore: s.avgFormScore,
          symmetryDelta: s.symmetryDelta,
          topTip: s.topTip,
        });
      }
      coachRef.current?.say(
        `Koniec serii. ${s.reps} powtórzeń, forma ${Math.round(s.avgFormScore)} na sto. ${s.topTip}`,
      );
    } else {
      setSummary({ reps: simpleCount, avgDepthAngle: 0, avgFormScore: 0, topTip: "Brawo! Sesja zapisana.", symmetryDelta: 0 });
    }
  };

  const restart = () => {
    analyzerRef.current.reset();
    coachRef.current?.reset();
    startedAtRef.current = Date.now();
    setSummary(null);
    setFeedback(null);
    setDisplayReps(0);
    setSimpleCount(0);
    setElapsed(0);
    setPhase("preview");
  };

  const toggleVoice = () => {
    setVoiceOn((v) => {
      coachRef.current?.setEnabled(!v);
      return !v;
    });
  };

  const togglePause = () => {
    setPhase((p) => {
      const next = p === "paused" ? "running" : "paused";
      if (next === "paused") coachRef.current?.say("Pauza.");
      else coachRef.current?.say("Wznawiamy.");
      return next;
    });
  };

  // Ucisz mowę przy wyjściu z ekranu
  useEffect(() => {
    return () => coachRef.current?.reset();
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const formScore = feedback?.formScore ?? 0;
  const reps = isSquat ? displayReps : simpleCount;

  /* --- Ekran zewnetrzny (telewizor) -------------------------------------
     Wysylamy WYLACZNIE policzone liczby. Obraz z kamery nigdy nie opuszcza
     tego urzadzenia, wiec obietnica prywatnosci obowiazuje takze tutaj.
     Kanal jest calkowicie bierny, dopoki uzytkownik nie sparuje ekranu.   */
  const tvRef = useRef<TvTransport | null>(null);
  const [tvCode, setTvCode] = useState<string | null>(null);
  useEffect(() => setTvCode(savedPairCode()), []);
  useEffect(() => {
    if (!tvCode) return;
    tvRef.current = createTvTransport(tvCode);
    return () => {
      tvRef.current?.close();
      tvRef.current = null;
    };
  }, [tvCode]);
  useEffect(() => {
    const tv = tvRef.current;
    if (!tv) return;
    const chips: TvChip[] =
      isSquat && feedback?.ready
        ? [
            { label: "Glebokosc", status: feedback.chips.depth.status, hint: feedback.chips.depth.hint },
            { label: "Kolana", status: feedback.chips.knees.status, hint: feedback.chips.knees.hint },
            { label: "Plecy", status: feedback.chips.back.status, hint: feedback.chips.back.hint },
            { label: "Tempo", status: feedback.chips.tempo.status, hint: feedback.chips.tempo.hint },
          ]
        : [];
    // Jedno zdanie korekty: priorytet jak u trenera glosowego.
    const worst =
      feedback && !feedback.ready
        ? feedback.coach
        : (chips.find((c) => c.status === "bad") ?? chips.find((c) => c.status === "warn"))?.hint ??
          null;
    tv.post({
      exercise: name,
      phase: summary ? "summary" : phase === "running" ? "live" : phase === "paused" ? "paused" : "idle",
      reps,
      seconds: elapsed,
      formScore: isSquat && feedback?.ready ? Math.round(formScore) : null,
      coach: worst,
      chips,
      hr: null,
      at: Date.now(),
    });
  }, [feedback, reps, elapsed, phase, summary, name, isSquat, formScore]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      {/* Wideo */}
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          facing === "user" && "[transform:scaleX(-1)]",
        )}
        playsInline
        muted
      />
      {/* Canvas ze szkieletem */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Górny pasek */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 bg-gradient-to-b from-black/60 to-transparent p-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <button
          onClick={() => navigate({ to: "/cwicz" })}
          className="rounded-full bg-black/40 p-2 backdrop-blur"
          aria-label="Zamknij"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <div className="text-xs uppercase tracking-wider text-white/70">{name} · {mm}:{ss}</div>
          <div className="text-5xl font-semibold tabular-nums leading-tight">{reps}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/60">powtórzeń</div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            className="rounded-full bg-black/40 p-2 backdrop-blur"
            aria-label="Przełącz kamerę"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
          <button
            onClick={toggleVoice}
            className={cn(
              "rounded-full p-2 backdrop-blur",
              voiceOn ? "bg-primary/80" : "bg-black/40",
            )}
            aria-label={voiceOn ? "Wyłącz głos trenera" : "Włącz głos trenera"}
          >
            {voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Pierścień Form Score (prawy bok) */}
      {isSquat && feedback?.ready && (
        <div className="absolute right-4 top-28 z-10 rounded-3xl bg-black/35 p-2 backdrop-blur">
          <Ring
            value={formScore}
            size={84}
            stroke={8}
            label={String(formScore)}
            sublabel="Forma"
            trackClass="stroke-white/20"
            progressClass="stroke-primary"
          />
        </div>
      )}

      {/* Komunikat o statusie */}
      {status !== "ready" && !summary && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6 text-center">
          {status === "loading" && <p>Ładuję model i kamerę…</p>}
          {status === "error" && (
            <div className="max-w-sm">
              <p className="text-base font-semibold">Nie udało się włączyć kamery</p>
              <p className="mt-2 text-sm text-white/70">{error ?? "Sprawdź uprawnienia w przeglądarce."}</p>
              <button
                onClick={() => navigate({ to: "/cwicz" })}
                className="mt-4 rounded-2xl bg-white/15 px-4 py-2 text-sm"
              >
                Wróć
              </button>
            </div>
          )}
        </div>
      )}

      {/* Prywatność */}
      <div className="absolute bottom-44 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
        Analiza lokalnie. Obraz nie jest wysyłany.
      </div>

      {/* Podgląd przed startem — instrukcja ustawienia */}
      {status === "ready" && !summary && phase === "preview" && (
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8 text-center">
          <div className="mx-auto max-w-xs rounded-3xl bg-black/55 px-5 py-4 backdrop-blur">
            <p className="text-base font-semibold">Ustaw się i naciśnij Start</p>
            <p className="mt-1 text-sm text-white/80">
              {isSquat
                ? "Oprzyj telefon, stań bokiem 2–3 m tak, aby było widać całą sylwetkę."
                : "Ustaw telefon tak, aby było widać całą sylwetkę."}
            </p>
          </div>
        </div>
      )}

      {/* Coaching ustawienia — gdy sylwetka nie jest pewnie w kadrze (po starcie) */}
      {isSquat && status === "ready" && !summary && phase === "running" && feedback && !feedback.ready && (
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8 text-center">
          <div className="mx-auto max-w-xs rounded-3xl bg-black/55 px-5 py-4 backdrop-blur">
            <p className="text-base font-semibold">Ustaw się do analizy</p>
            <p className="mt-1 text-sm text-white/80">{feedback.coach}</p>
          </div>
        </div>
      )}
      {isSquat && status === "ready" && !summary && phase === "running" && !feedback && (
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8 text-center">
          <div className="mx-auto max-w-xs rounded-3xl bg-black/55 px-5 py-4 backdrop-blur">
            <p className="text-sm text-white/80">Nie wykrywam sylwetki — wejdź w kadr.</p>
          </div>
        </div>
      )}

      {/* Etykieta pauzy */}
      {!summary && phase === "paused" && (
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8 text-center">
          <div className="mx-auto rounded-full bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur">
            Pauza
          </div>
        </div>
      )}

      {/* Chipy podpowiedzi */}
      {isSquat && feedback?.ready && (
        <div className="absolute inset-x-0 bottom-28 z-10 flex flex-wrap justify-center gap-2 px-4">
          <Chip label="Głębokość" {...feedback.chips.depth} />
          <Chip label="Kolana" {...feedback.chips.knees} />
          <Chip label="Plecy" {...feedback.chips.back} />
          <Chip label="Tempo" {...feedback.chips.tempo} />
        </div>
      )}

      {/* Dolne sterowanie */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {phase === "preview" ? (
          <button
            onClick={start}
            disabled={status !== "ready"}
            className="rounded-full bg-primary px-10 py-4 text-base font-semibold text-primary-foreground disabled:opacity-50"
          >
            Start
          </button>
        ) : (
          <>
            <button
              onClick={togglePause}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur"
              aria-label={phase === "paused" ? "Wznów" : "Pauza"}
            >
              {phase === "paused" ? <Play className="h-6 w-6" /> : <Pause className="h-6 w-6" />}
            </button>
            <button
              onClick={stopAndSummarize}
              className="rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground"
            >
              Zakończ serię
            </button>
            <button
              onClick={restart}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur"
              aria-label="Reset"
            >
              <RotateCcw className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {/* Modal podsumowania */}
      {summary && (
        <SummarySheet
          summary={summary}
          onClose={() => navigate({ to: "/postepy" })}
          onAgain={restart}
        />
      )}
    </div>
  );
}

function Chip({ label, status, hint }: { label: string; status: "ok" | "warn" | "bad" | "idle"; hint: string }) {
  const cls =
    status === "warn"
      ? "bg-warn/90 text-foreground"
      : status === "bad"
        ? "bg-bad/90 text-white"
        : status === "idle"
          ? "bg-white/15 text-white/80"
          : "bg-primary/90 text-primary-foreground";
  return (
    <div className={cn("rounded-full px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur", cls)}>
      <span className="opacity-80">{label}:</span> <span className="font-semibold">{hint}</span>
    </div>
  );
}

function SummarySheet({
  summary,
  onClose,
  onAgain,
}: {
  summary: SquatSummary;
  onClose: () => void;
  onAgain: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="w-full rounded-t-3xl bg-card p-6 text-foreground">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-hairline" />
        <h2 className="text-xl font-semibold">Sesja zakończona</h2>
        <p className="mt-1 text-sm text-muted-foreground">Dobra robota — oto skrót:</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <Stat label="Powtórzenia" value={String(summary.reps)} />
          <Stat label="Średnia głębokość" value={`${Math.round(summary.avgDepthAngle)}°`} hint="kąt kolana" />
          <Stat label="Forma" value={String(Math.round(summary.avgFormScore))} hint="/ 100" />
        </div>
        <div className="mt-5 rounded-2xl bg-tint p-4">
          <p className="text-xs uppercase tracking-wider text-primary-deep">Najważniejsze do poprawy</p>
          <p className="mt-1 text-sm">{summary.topTip}</p>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            onClick={onAgain}
            className="flex-1 rounded-2xl border border-hairline px-4 py-3 text-sm font-medium"
          >
            Jeszcze raz
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-deep"
          >
            Zobacz postępy
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-hairline p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</div>}
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
