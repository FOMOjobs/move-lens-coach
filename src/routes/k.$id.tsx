import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  FileJson,
  Info,
  KeyRound,
  Lock,
  Stethoscope,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createVerdictLink,
  fragmentTransport,
  openShare,
  PACKAGE_VERSION,
  type ConsultPackage,
  type DoctorVerdict,
  type VerdictDecision,
} from "@/lib/health/consultPackage";
import { buildDoctorFlags, type DoctorFlag } from "@/lib/health/doctorFlags";
import { rangeLabel, rangeStatus, STATUS_LABEL } from "@/lib/health/labResults";

export const Route = createFileRoute("/k/$id")({
  head: () => ({
    meta: [
      { title: "Paczka konsultacyjna — MoveLens" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DoctorView,
});

function DoctorView() {
  const [pin, setPin] = useState("");
  const [pkg, setPkg] = useState<ConsultPackage | null>(null);
  const [flags, setFlags] = useState<DoctorFlag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await openShare(pin);
      if (p.v !== PACKAGE_VERSION) throw new Error("Paczka pochodzi z innej wersji aplikacji.");
      setPkg(p);
      setFlags(buildDoctorFlags(p));
    } catch {
      setError("Nie udało się otworzyć paczki. Sprawdź PIN i kompletność linku.");
    } finally {
      setBusy(false);
    }
  }

  if (!pkg) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center px-5">
        <form onSubmit={unlock} className="w-full">
          <div className="rounded-3xl border border-hairline bg-card p-6 shadow-sm">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tint">
              <Lock className="h-6 w-6 text-primary-deep" />
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight">Paczka konsultacyjna</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Pacjent udostępnił Panu/Pani zaszyfrowany pakiet danych. Aby go otworzyć, potrzebny
              jest 6-cyfrowy PIN przekazany przez pacjenta osobno.
            </p>

            <label className="mt-5 block">
              <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
                PIN od pacjenta
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
              {busy ? "Odszyfrowuję…" : "Otwórz paczkę"}
            </button>

            <p className="mt-4 text-xs text-muted-foreground">
              Odszyfrowanie odbywa się w tej przeglądarce. Dane nie są wysyłane na serwer.
            </p>
          </div>
        </form>
      </div>
    );
  }

  return <UnlockedView pkg={pkg} flags={flags} pin={pin} />;
}

/* ------------------------------------------------------- widok po odblokowaniu */

function UnlockedView({
  pkg,
  flags,
  pin,
}: {
  pkg: ConsultPackage;
  flags: DoctorFlag[];
  pin: string;
}) {
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [doctor, setDoctor] = useState("");
  const [note, setNote] = useState("");
  const [verdictUrl, setVerdictUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decided = Object.keys(decisions).length;

  async function sign() {
    setError(null);
    try {
      const incoming = await fragmentTransport.read();
      if (!incoming) throw new Error("Brak danych w adresie.");
      const verdict: DoctorVerdict = {
        v: PACKAGE_VERSION,
        packageId: pkg.id,
        doctor: doctor.trim() || "Lekarz",
        signedISO: new Date().toISOString(),
        decisions: Object.entries(decisions).map(
          ([flagId, accepted]): VerdictDecision => ({ flagId, accepted }),
        ),
        note: note.trim(),
      };
      setVerdictUrl(await createVerdictLink(verdict, incoming.secret, pin));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się podpisać odpowiedzi.");
    }
  }

  const m = pkg.movement;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-6 border-b border-hairline pb-5">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Stethoscope className="h-4 w-4" /> Paczka konsultacyjna MoveLens
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {pkg.patient.label || "Pacjent"}
          {pkg.patient.age != null && (
            <span className="text-muted-foreground"> · {pkg.patient.age} lat</span>
          )}
          {pkg.patient.sex && <span className="text-muted-foreground"> · {pkg.patient.sex}</span>}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Przekazano {new Date(pkg.createdISO).toLocaleString("pl-PL")}
        </p>
      </header>

      <div className="mb-6 flex items-start gap-3 rounded-2xl bg-tint/70 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary-deep" />
        <p className="text-sm text-muted-foreground">
          Poniższe pozycje to <span className="font-medium text-foreground">zestawienia danych do rozważenia</span>,
          a nie rozpoznania. MoveLens nie interpretuje wyników wobec pacjenta — pacjent zobaczy
          wyłącznie to, co Pan/Pani zatwierdzi i podpisze.
        </p>
      </div>

      {/* Flagi */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Do rozważenia ({flags.length})
        </h2>
        <ul className="space-y-3">
          {flags.map((f) => (
            <li key={f.id} className="rounded-3xl border border-hairline bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                {f.severity === "attention" ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
                ) : (
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{f.title}</p>
                  <ul className="mt-2 space-y-1">
                    {f.evidence.map((e, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        · {e}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {f.id !== "none" && (
                <div className="mt-4 flex gap-2 border-t border-hairline pt-3">
                  <button
                    onClick={() => setDecisions((d) => ({ ...d, [f.id]: true }))}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-medium",
                      decisions[f.id] === true
                        ? "bg-primary text-primary-foreground"
                        : "border border-hairline",
                    )}
                  >
                    <Check className="h-4 w-4" /> Istotne
                  </button>
                  <button
                    onClick={() => setDecisions((d) => ({ ...d, [f.id]: false }))}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-medium",
                      decisions[f.id] === false
                        ? "bg-muted text-foreground"
                        : "border border-hairline",
                    )}
                  >
                    <X className="h-4 w-4" /> Bez znaczenia
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Dane źródłowe */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Dane źródłowe
        </h2>

        {pkg.labs.map((panel) => (
          <div key={panel.id} className="mb-3 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {new Date(panel.day).toLocaleDateString("pl-PL")}
              {panel.lab ? ` · ${panel.lab}` : ""}
            </p>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {panel.values.map((v) => {
                  const s = rangeStatus(v);
                  return (
                    <tr key={v.code} className="border-t border-hairline/60">
                      <td className="py-2 pr-3">{v.name}</td>
                      <td className="py-2 pr-3 text-right font-medium tabular-nums">
                        {v.value} {v.unit}
                      </td>
                      <td className="py-2 pr-3 text-right text-muted-foreground">{rangeLabel(v)}</td>
                      <td
                        className={cn(
                          "py-2 text-right text-xs",
                          s === "in" ? "text-good" : s === "unknown" ? "text-muted-foreground" : "text-warn",
                        )}
                      >
                        {STATUS_LABEL[s]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}

        <div className="mb-3 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
          <p className="font-semibold">Dane ruchowe</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>Sesje: {m.sessionCount} · łącznie powtórzeń: {m.totalReps}</li>
            {m.avgFormRecent != null && <li>Średni Form Score (ostatnie): {m.avgFormRecent}/100</li>}
            {m.formTrend != null && <li>Zmiana Form Score: {m.formTrend} pkt</li>}
            {m.avgDepthRecent != null && <li>Średni kąt kolana w dole: {m.avgDepthRecent}°</li>}
            {m.symmetryAvg != null && <li>Asymetria kolan: {m.symmetryAvg}°</li>}
          </ul>
          {m.tests.length > 0 && (
            <table className="mt-3 w-full text-sm">
              <tbody>
                {m.tests.map((t) => (
                  <tr key={t.kind} className="border-t border-hairline/60">
                    <td className="py-2 pr-3">{t.label}</td>
                    <td className="py-2 pr-3 text-right font-medium">{t.valueLabel}</td>
                    <td
                      className={cn(
                        "py-2 text-right text-xs",
                        t.band === "below" ? "text-warn" : "text-good",
                      )}
                    >
                      {t.bandLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mb-3 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
          <p className="font-semibold">Ciśnienie — pomiary domowe</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {pkg.bp.summary.morningAvg && (
              <li>
                Rano: {pkg.bp.summary.morningAvg.sys}/{pkg.bp.summary.morningAvg.dia} (n=
                {pkg.bp.summary.morningAvg.n})
              </li>
            )}
            {pkg.bp.summary.eveningAvg && (
              <li>
                Wieczorem: {pkg.bp.summary.eveningAvg.sys}/{pkg.bp.summary.eveningAvg.dia} (n=
                {pkg.bp.summary.eveningAvg.n})
              </li>
            )}
            <li>Wypełnione pomiary: {pkg.bp.summary.filled}/14</li>
          </ul>
        </div>

        <details className="rounded-3xl border border-hairline bg-card p-5 shadow-sm">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <FileJson className="h-4 w-4 text-primary-deep" /> Eksport FHIR (Bundle)
          </summary>
          <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-muted p-3 text-xs">
            {JSON.stringify(pkg.fhir, null, 2)}
          </pre>
        </details>
      </section>

      {/* Podpis */}
      <section className="mb-8 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Odpowiedź dla pacjenta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          To jedyna treść, jaką pacjent zobaczy w aplikacji. Zostanie oznaczona Pana/Pani podpisem
          i datą.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Podpis
          </span>
          <input
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            placeholder="np. dr n. med. Anna Nowak"
            className="w-full rounded-2xl border border-hairline bg-background px-3 py-2.5 text-sm"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Komentarz
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={5}
            placeholder="Zalecenia i komentarz dla pacjenta…"
            className="w-full rounded-2xl border border-hairline bg-background px-3 py-2.5 text-sm"
          />
        </label>

        <p className="mt-2 text-xs text-muted-foreground">
          Rozpatrzone pozycje: {decided}/{flags.filter((f) => f.id !== "none").length}
        </p>

        {error && <p className="mt-3 rounded-2xl bg-bad/15 p-3 text-sm">{error}</p>}

        {verdictUrl ? (
          <div className="mt-4 rounded-2xl bg-tint/70 p-4">
            <p className="text-sm font-medium">Odpowiedź podpisana</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Przekaż pacjentowi poniższy link. Otworzy go tym samym PIN-em.
            </p>
            <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{verdictUrl}</p>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(verdictUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Skopiowano" : "Kopiuj link z odpowiedzią"}
            </button>
          </div>
        ) : (
          <button
            onClick={sign}
            disabled={note.trim().length === 0}
            className="mt-4 w-full rounded-2xl bg-primary px-4 py-3.5 font-medium text-primary-foreground disabled:opacity-50"
          >
            Podpisz i przekaż pacjentowi
          </button>
        )}
      </section>
    </div>
  );
}
