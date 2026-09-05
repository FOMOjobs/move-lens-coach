import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, KeyRound, Lock, Stethoscope } from "lucide-react";
import {
  readVerdictFromLocation,
  saveVerdict,
  type DoctorVerdict,
} from "@/lib/health/consultPackage";

export const Route = createFileRoute("/werdykt")({
  head: () => ({
    meta: [
      { title: "Odpowiedź lekarza — MoveLens" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: VerdictPage,
});

function VerdictPage() {
  const [pin, setPin] = useState("");
  const [verdict, setVerdict] = useState<DoctorVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const v = await readVerdictFromLocation(pin);
      saveVerdict(v);
      setVerdict(v);
    } catch {
      setError("Nie udało się otworzyć odpowiedzi. Sprawdź PIN i kompletność linku.");
    } finally {
      setBusy(false);
    }
  }

  if (verdict) {
    const accepted = verdict.decisions.filter((d) => d.accepted).length;
    return (
      <div className="px-5 pt-8">
        <header className="mb-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tint">
            <CheckCircle2 className="h-6 w-6 text-primary-deep" />
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Odpowiedź lekarza</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Zapisano w Twojej aplikacji. Znajdziesz ją też w sekcji „Paczka dla lekarza".
          </p>
        </header>

        <section className="rounded-3xl border border-hairline bg-card p-5 shadow-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Stethoscope className="h-4 w-4 text-primary-deep" /> {verdict.doctor}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm">{verdict.note}</p>
          <div className="mt-4 border-t border-hairline pt-3 text-xs text-muted-foreground">
            <p>Zweryfikowano: {new Date(verdict.signedISO).toLocaleString("pl-PL")}</p>
            {verdict.decisions.length > 0 && (
              <p className="mt-1">
                Lekarz rozpatrzył {verdict.decisions.length} pozycji, z czego {accepted} uznał za
                istotne.
              </p>
            )}
          </div>
        </section>

        <p className="mt-4 rounded-2xl bg-tint/70 p-4 text-sm text-muted-foreground">
          To jedyna treść interpretacyjna, jaką MoveLens pokazuje. Aplikacja sama nie ocenia
          wyników — pochodzi ona w całości od lekarza i jest opatrzona jego podpisem.
        </p>

        <Link
          to="/dane"
          className="mt-5 mb-2 flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-4 font-medium text-primary-foreground"
        >
          Wróć do danych
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center px-5">
      <form onSubmit={unlock} className="w-full">
        <div className="rounded-3xl border border-hairline bg-card p-6 shadow-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tint">
            <Lock className="h-6 w-6 text-primary-deep" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Odpowiedź od lekarza</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Podaj ten sam PIN, który przekazałeś lekarzowi razem z paczką.
          </p>

          <label className="mt-5 block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              PIN
            </span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="000000"
              className="w-full rounded-2xl border border-hairline bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] tabular-nums"
            />
          </label>

          {error && <p className="mt-3 rounded-2xl bg-bad/15 p-3 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={pin.length !== 6 || busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 font-medium text-primary-foreground disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            {busy ? "Odszyfrowuję…" : "Otwórz odpowiedź"}
          </button>
        </div>
      </form>
    </div>
  );
}
