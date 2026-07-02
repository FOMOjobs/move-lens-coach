/**
 * TestLive — ekran wykonania testu klinicznego na żywo:
 *  - "sit-to-stand": 30 s wstawania z krzesła (kamera z boku),
 *  - "balance": stanie na jednej nodze (kamera z przodu).
 *
 * Przepływ jak w treningu: podgląd (wybór grupy wiekowej/płci) → Start →
 * pomiar → wynik z interpretacją wg norm (src/lib/health/norms.ts) + zapis
 * lokalny (src/lib/health/results.ts). Głosowy trener prowadzi cały test.
 */

import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SwitchCamera, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePoseAnalysis } from "@/lib/pose/usePoseAnalysis";
import { drawSkeleton, fitCanvasToParent } from "@/lib/pose/drawSkeleton";
import { SitToStandAnalyzer } from "@/lib/pose/sitToStandAnalyzer";
import { BalanceAnalyzer } from "@/lib/pose/balanceAnalyzer";
import { VoiceCoach } from "@/lib/pose/voiceCoach";
import {
  AGE_BANDS,
  BALANCE_CAP_S,
  interpretBalance,
  interpretSitToStand,
  type AgeBand,
  type Interpretation,
  type Sex,
} from "@/lib/health/norms";
import { saveTestResult, type TestKind } from "@/lib/health/results";

const STS_DURATION_S = 30;

interface TestResultView {
  value: number;
  unit: string;
  interp: Interpretation;
  leg?: "left" | "right" | null;
}

export function TestLive({ kind }: { kind: TestKind }) {
  const navigate = useNavigate();
  const isSts = kind === "sit-to-stand";
  const title = isSts ? "Test wstawania z krzesła" : "Test równowagi";

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stsRef = useRef(new SitToStandAnalyzer());
  const balRef = useRef(new BalanceAnalyzer());
  const coachRef = useRef<VoiceCoach | null>(null);
  if (coachRef.current === null && typeof window !== "undefined") {
    coachRef.current = new VoiceCoach();
  }

  const [phase, setPhase] = useState<"preview" | "running" | "done">("preview");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [voiceOn, setVoiceOn] = useState(true);
  const [sex, setSex] = useState<Sex>("K");
  const [ageBand, setAgeBand] = useState<AgeBand>("60–69");
  const [coachMsg, setCoachMsg] = useState<string | null>(null);
  const [bigValue, setBigValue] = useState(0); // STS: wstania; balans: sekundy
  const [timeLeft, setTimeLeft] = useState(STS_DURATION_S);
  const [result, setResult] = useState<TestResultView | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const lastStandsRef = useRef(0);
  const lastSaidSecRef = useRef(0);
  const startedAtRef = useRef(0);
  const finishedRef = useRef(false);

  const sexRef = useRef(sex);
  sexRef.current = sex;
  const ageRef = useRef(ageBand);
  ageRef.current = ageBand;

  const finalize = useCallback(
    (value: number, leg?: "left" | "right" | null) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const interp = isSts
        ? interpretSitToStand(value, sexRef.current, ageRef.current)
        : interpretBalance(value, sexRef.current, ageRef.current);
      saveTestResult({
        kind,
        value,
        leg: leg ?? undefined,
        band: interp.band,
        note: interp.note,
        ageBand: ageRef.current,
        sex: sexRef.current,
      });
      setResult({ value, unit: isSts ? "wstań" : "s", interp, leg });
      setPhase("done");
      const spoken = isSts
        ? `Koniec testu. ${value} wstań w trzydzieści sekund.`
        : `Koniec próby. ${value} sekund.`;
      coachRef.current?.say(`${spoken} ${interp.note}`);
    },
    [isSts, kind],
  );

  const onFrame = useCallback(
    (landmarks: any, ts: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        fitCanvasToParent(canvas);
        drawSkeleton(canvas, phaseRef.current === "running" ? landmarks : null, {
          mirror: facing === "user",
        });
      }
      if (phaseRef.current !== "running" || !landmarks) return;

      if (isSts) {
        const fb = stsRef.current.analyze(landmarks);
        if (!fb) return;
        setCoachMsg(fb.ready ? null : fb.coach);
        if (!fb.ready && fb.coach) coachRef.current?.hint(fb.coach, ts);
        setBigValue(fb.stands);
        if (fb.stands > lastStandsRef.current) {
          lastStandsRef.current = fb.stands;
          coachRef.current?.say(String(fb.stands));
        }
      } else {
        const fb = balRef.current.analyze(landmarks, ts);
        if (!fb) return;
        setCoachMsg(fb.ready ? (fb.phase === "waiting" ? fb.coach : null) : fb.coach);
        const sec = Math.floor(fb.elapsedMs / 1000);
        setBigValue(sec);
        if (fb.phase === "balancing") {
          if (sec >= BALANCE_CAP_S) {
            balRef.current.finish(ts);
            finalize(BALANCE_CAP_S, fb.raisedLeg);
            return;
          }
          if (sec > 0 && sec % 10 === 0 && sec !== lastSaidSecRef.current) {
            lastSaidSecRef.current = sec;
            coachRef.current?.say(`${sec} sekund. Trzymaj!`, false);
          }
        }
        if (fb.phase === "done") {
          finalize(Math.round(fb.elapsedMs / 1000), fb.raisedLeg);
        }
      }
    },
    [facing, isSts, finalize],
  );

  const { videoRef, status, error } = usePoseAnalysis({
    onFrame,
    enabled: phase !== "done",
    detecting: phase === "running",
    facingMode: facing,
  });

  // Zegar testu wstawania: 30 s i koniec
  useEffect(() => {
    if (!isSts || phase !== "running") return;
    const id = setInterval(() => {
      const left = Math.max(0, STS_DURATION_S - Math.floor((Date.now() - startedAtRef.current) / 1000));
      setTimeLeft(left);
      if (left === 10) coachRef.current?.say("Jeszcze dziesięć sekund!", false);
      if (left <= 0) {
        clearInterval(id);
        finalize(lastStandsRef.current);
      }
    }, 250);
    return () => clearInterval(id);
  }, [isSts, phase, finalize]);

  const start = () => {
    stsRef.current.reset();
    balRef.current.reset();
    coachRef.current?.reset();
    coachRef.current?.unlock();
    lastStandsRef.current = 0;
    lastSaidSecRef.current = 0;
    finishedRef.current = false;
    startedAtRef.current = Date.now();
    setBigValue(0);
    setTimeLeft(STS_DURATION_S);
    setResult(null);
    setPhase("running");
    coachRef.current?.say(
      isSts
        ? "Start! Wstawaj i siadaj jak najwięcej razy przez trzydzieści sekund."
        : "Gotowe. Unieś jedną stopę — czas ruszy automatycznie.",
    );
  };

  const again = () => {
    setPhase("preview");
    setResult(null);
    setBigValue(0);
    setTimeLeft(STS_DURATION_S);
    setCoachMsg(null);
  };

  useEffect(() => () => coachRef.current?.reset(), []);

  const toggleVoice = () => {
    setVoiceOn((v) => {
      coachRef.current?.setEnabled(!v);
      return !v;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <video
        ref={videoRef}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          facing === "user" && "[transform:scaleX(-1)]",
        )}
        playsInline
        muted
      />
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
          <div className="text-xs uppercase tracking-wider text-white/70">{title}</div>
          <div className="text-5xl font-semibold tabular-nums leading-tight">{bigValue}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/60">
            {isSts ? `wstań · zostało ${timeLeft} s` : "sekund równowagi"}
          </div>
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
            className={cn("rounded-full p-2 backdrop-blur", voiceOn ? "bg-primary/80" : "bg-black/40")}
            aria-label={voiceOn ? "Wyłącz głos" : "Włącz głos"}
          >
            {voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Status ładowania / błąd kamery */}
      {status !== "ready" && phase !== "done" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-6 text-center">
          {status === "loading" && <p>Ładuję model i kamerę…</p>}
          {status === "error" && (
            <div className="max-w-sm">
              <p className="text-base font-semibold">Nie udało się włączyć kamery</p>
              <p className="mt-2 text-sm text-white/70">{error ?? "Sprawdź uprawnienia w przeglądarce."}</p>
              <button onClick={() => navigate({ to: "/cwicz" })} className="mt-4 rounded-2xl bg-white/15 px-4 py-2 text-sm">
                Wróć
              </button>
            </div>
          )}
        </div>
      )}

      {/* Podgląd: instrukcja + grupa porównawcza */}
      {status === "ready" && phase === "preview" && (
        <div className="absolute inset-x-0 bottom-32 z-10 px-5">
          <div className="rounded-3xl bg-black/60 p-5 backdrop-blur">
            <p className="text-base font-semibold">{title}</p>
            <p className="mt-1 text-sm text-white/80">
              {isSts
                ? "Postaw krzesło bokiem do kamery (2–3 m). Usiądź, ręce skrzyżowane na klatce. Masz 30 sekund."
                : "Stań przodem do kamery, całe nogi w kadrze. Po starcie unieś jedną stopę i stój jak najdłużej."}
            </p>
            <p className="mt-3 text-xs uppercase tracking-wider text-white/60">Porównanie z normą dla:</p>
            <div className="mt-2 flex gap-2">
              {(["K", "M"] as Sex[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSex(s)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium",
                    sex === s ? "bg-primary text-primary-foreground" : "bg-white/15 text-white/80",
                  )}
                >
                  {s === "K" ? "Kobieta" : "Mężczyzna"}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {AGE_BANDS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAgeBand(a)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium",
                    ageBand === a ? "bg-primary text-primary-foreground" : "bg-white/15 text-white/80",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Coaching ustawienia w trakcie */}
      {phase === "running" && coachMsg && (
        <div className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-8 text-center">
          <div className="mx-auto max-w-xs rounded-3xl bg-black/55 px-5 py-4 backdrop-blur">
            <p className="text-sm text-white/85">{coachMsg}</p>
          </div>
        </div>
      )}

      {/* Prywatność */}
      <div className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[11px] text-white/80 backdrop-blur">
        Analiza lokalnie. Obraz nie jest wysyłany.
      </div>

      {/* Dolne sterowanie */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-4 bg-gradient-to-t from-black/70 to-transparent p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        {phase === "preview" && (
          <button
            onClick={start}
            disabled={status !== "ready"}
            className="rounded-full bg-primary px-10 py-4 text-base font-semibold text-primary-foreground disabled:opacity-50"
          >
            Start
          </button>
        )}
        {phase === "running" && (
          <button
            onClick={() => {
              if (isSts) {
                finalize(lastStandsRef.current);
              } else {
                balRef.current.finish(performance.now());
                finalize(bigValue, null); // guard finishedRef zapobiega podwójnemu zapisowi
              }
            }}
            className="rounded-full bg-white/15 px-8 py-4 text-base font-semibold backdrop-blur"
          >
            Przerwij test
          </button>
        )}
      </div>

      {/* Wynik */}
      {result && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60 backdrop-blur-sm">
          <div className="w-full rounded-t-3xl bg-card p-6 text-foreground">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-hairline" />
            <h2 className="text-xl font-semibold">{title} — wynik</h2>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tabular-nums">{result.value}</span>
              <span className="text-lg text-muted-foreground">{result.unit}</span>
              {!isSts && result.leg && (
                <span className="text-sm text-muted-foreground">
                  · noga {result.leg === "left" ? "lewa" : "prawa"}
                </span>
              )}
            </div>
            <div
              className={cn(
                "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                result.interp.band === "below" ? "bg-warn/20 text-warn" : "bg-tint text-primary-deep",
              )}
            >
              {result.interp.band === "below"
                ? "Poniżej normy"
                : result.interp.band === "above"
                  ? "Powyżej normy"
                  : "W normie"}
              {" · "}norma: {result.interp.normLabel}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{result.interp.note}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Wynik zapisany. To informacja i wsparcie decyzji — nie diagnoza.
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={again} className="flex-1 rounded-2xl border border-hairline px-4 py-3 text-sm font-medium">
                Jeszcze raz
              </button>
              <button
                onClick={() => navigate({ to: "/cwicz" })}
                className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-deep"
              >
                Gotowe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
