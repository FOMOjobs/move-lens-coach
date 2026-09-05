import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Link2,
  Lock,
  ShieldCheck,
  Stethoscope,
  Trash2,
} from "lucide-react";
import {
  buildConsultPackage,
  createShare,
  listIssuedShares,
  listVerdicts,
  revokeShare,
  type ConsultPackage,
  type DoctorVerdict,
  type IssuedShare,
  type PatientMeta,
} from "@/lib/health/consultPackage";

export const Route = createFileRoute("/konsultacja")({
  head: () => ({
    meta: [
      { title: "Paczka dla lekarza — MoveLens" },
      {
        name: "description",
        content: "Zaszyfrowana paczka konsultacyjna: wyniki, ruch i ciśnienie w jednym miejscu.",
      },
    ],
  }),
  component: ConsultPage,
});

function ConsultPage() {
  const [meta, setMeta] = useState<PatientMeta>({ label: "", age: null, sex: null });
  const [preview, setPreview] = useState<ConsultPackage | null>(null);
  const [share, setShare] = useState<IssuedShare | null>(null);
  const [issued, setIssued] = useState<IssuedShare[]>([]);
  const [verdicts, setVerdicts] = useState<DoctorVerdict[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPreview(buildConsultPackage({ label: "", age: null, sex: null }));
    setIssued(listIssuedShares());
    setVerdicts(listVerdicts());
  }, []);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const pkg = buildConsultPackage(meta);
      const s = await createShare(pkg);
      setShare(s);
      setIssued(listIssuedShares());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się przygotować paczki.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Nie udało się skopiować. Zaznacz link ręcznie.");
    }
  }

  if (share) {
    return (
      <ShareReady
        share={share}
        onDone={() => {
          setShare(null);
          setIssued(listIssuedShares());
        }}
        onCopy={copyLink}
        copied={copied}
      />
    );
  }

  return (
    <div className="px-5 pt-8">
      <header className="mb-5">
        <Link
          to="/dane"
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Dane
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Paczka dla lekarza</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Jeden zaszyfrowany pakiet: wyniki badań, dane ruchowe i ciśnienie. Otwiera go wyłącznie
          osoba, której dasz link i PIN.
        </p>
      </header>

      {/* Model bezpieczeństwa — to jest sedno, więc mówimy o tym wprost */}
      <section className="mb-6 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4 text-primary-deep" /> Jak to jest zabezpieczone
        </h2>
        <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Paczka jest szyfrowana{" "}
              <span className="font-medium text-foreground">na Twoim telefonie</span> (AES-GCM).
              Klucz nigdy nie trafia na żaden serwer.
            </span>
          </li>
          <li className="flex gap-2">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Dane jadą w części linku po znaku <code className="font-mono">#</code>, której
              przeglądarka{" "}
              <span className="font-medium text-foreground">z zasady nie wysyła na serwer</span>.
            </span>
          </li>
          <li className="flex gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Do otwarcia potrzebny jest jeszcze{" "}
              <span className="font-medium text-foreground">PIN</span>, który podajesz lekarzowi
              osobno. Sam link nie wystarcza.
            </span>
          </li>
        </ul>
      </section>

      {/* Co wejdzie do paczki */}
      {preview && (
        <section className="mb-6 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Co wejdzie do paczki
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            <Item label="Panele badań" value={`${preview.labs.length}`} />
            <Item label="Parametry z trendem" value={`${Object.keys(preview.labTrends).length}`} />
            <Item label="Sesje ruchowe" value={`${preview.movement.sessionCount}`} />
            <Item label="Testy funkcjonalne" value={`${preview.movement.tests.length}`} />
            <Item label="Pomiary ciśnienia (tydzień)" value={`${preview.bp.summary.filled}/14`} />
            <Item label="Eksport FHIR" value="dołączony" />
          </ul>
          {preview.labs.length === 0 && preview.movement.sessionCount === 0 && (
            <p className="mt-3 rounded-2xl bg-warn/15 p-3 text-sm">
              Nie masz jeszcze żadnych danych.{" "}
              <Link to="/wyniki" className="font-medium underline">
                Dodaj wyniki badań
              </Link>{" "}
              albo wykonaj trening.
            </p>
          )}
        </section>
      )}

      {/* Ile ujawniasz */}
      <section className="mb-6 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Twoje dane
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Ty decydujesz, ile lekarz zobaczy.</p>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Podpis (imię lub pseudonim)
          </span>
          <input
            value={meta.label}
            onChange={(e) => setMeta({ ...meta, label: e.target.value })}
            placeholder="np. Jan K."
            className="w-full rounded-2xl border border-hairline bg-background px-3 py-2.5 text-sm"
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              Wiek
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={meta.age ?? ""}
              onChange={(e) =>
                setMeta({ ...meta, age: e.target.value === "" ? null : Number(e.target.value) })
              }
              className="w-full rounded-2xl border border-hairline bg-background px-3 py-2.5 text-sm tabular-nums"
            />
          </label>
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
              Płeć
            </span>
            <div className="flex gap-2">
              {(["K", "M"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setMeta({ ...meta, sex: meta.sex === s ? null : s })}
                  className={
                    meta.sex === s
                      ? "flex-1 rounded-2xl bg-primary py-2.5 text-sm font-medium text-primary-foreground"
                      : "flex-1 rounded-2xl border border-hairline py-2.5 text-sm"
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 rounded-2xl bg-bad/15 p-4 text-sm">{error}</p>}

      <button
        onClick={generate}
        disabled={busy}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-medium text-primary-foreground disabled:opacity-60"
      >
        <ShieldCheck className="h-4 w-4" />
        {busy ? "Szyfruję…" : "Zaszyfruj i utwórz link"}
      </button>

      {/* Odpowiedzi lekarza */}
      {verdicts.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Odpowiedzi lekarza
          </h2>
          {verdicts.map((v) => (
            <div
              key={v.packageId}
              className="mb-3 rounded-3xl border border-hairline bg-card p-5 shadow-sm"
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Stethoscope className="h-4 w-4 text-primary-deep" /> {v.doctor}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{v.note}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Zweryfikowano: {new Date(v.signedISO).toLocaleString("pl-PL")}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Dziennik wystawionych paczek */}
      {issued.length > 0 && (
        <section className="mb-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Wystawione paczki
          </h2>
          <ul className="space-y-2">
            {issued.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-card p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {new Date(s.createdISO).toLocaleString("pl-PL")}
                  </p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    odcisk {s.fingerprint}
                  </p>
                </div>
                <button
                  onClick={() => {
                    revokeShare(s.id);
                    setIssued(listIssuedShares());
                  }}
                  aria-label="Usuń z dziennika"
                  className="p-2 text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Dziennik jest lokalny. Po dołożeniu serwera pojawi się tu również informacja, kiedy
            lekarz otworzył paczkę, oraz wygaszanie linku po 72 godzinach.
          </p>
        </section>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  );
}

/* ------------------------------------------------------- ekran po utworzeniu */

function ShareReady({
  share,
  onDone,
  onCopy,
  copied,
}: {
  share: IssuedShare;
  onDone: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="px-5 pt-8">
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Paczka gotowa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Przekaż lekarzowi link, a PIN podaj osobno — najlepiej ustnie w gabinecie.
        </p>
      </header>

      <section className="mb-5 rounded-3xl border border-hairline bg-card p-5 text-center shadow-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">PIN dla lekarza</p>
        <p className="mt-2 font-mono text-4xl font-semibold tracking-[0.3em] tabular-nums">
          {share.pin}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Nie wysyłaj PIN-u tym samym kanałem co link. To drugi klucz.
        </p>
      </section>

      <section className="mb-5 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Link do paczki</p>
        <p className="mt-2 break-all font-mono text-xs text-muted-foreground">{share.url}</p>
        <button
          onClick={onCopy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Skopiowano" : "Kopiuj link"}
        </button>
        <p className="mt-3 text-xs text-muted-foreground">
          Odcisk paczki: <span className="font-mono">{share.fingerprint}</span> · rozmiar{" "}
          {(share.bytes / 1024).toFixed(1)} kB
        </p>
      </section>

      <button
        onClick={onDone}
        className="mb-2 w-full rounded-2xl border border-hairline px-4 py-4 font-medium"
      >
        Gotowe
      </button>
    </div>
  );
}
