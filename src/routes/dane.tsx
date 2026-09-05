import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Apple, Activity, FileText, Upload, Heart, Footprints, Stethoscope, FlaskConical, CheckCircle2, ArrowRight, Printer, Dumbbell, ShieldCheck, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildMovementSummary, type MovementSummary } from "@/lib/health/doctorSummary";
import { bpWeekSummary, type BpSummary } from "@/lib/health/bloodPressure";
import { BloodPressureCard } from "@/components/BloodPressureCard";

export const Route = createFileRoute("/dane")({
  head: () => ({
    meta: [
      { title: "Dane — MoveLens" },
      { name: "description", content: "Twoje dane o zdrowiu w jednym miejscu. Import z Apple Health, Google Fit i wyników badań." },
    ],
  }),
  component: DataPage,
});

type SourceKey = "apple" | "google" | "labs";

function DataPage() {
  const [imported, setImported] = useState<Record<SourceKey, boolean>>({
    apple: true,
    google: false,
    labs: true,
  });
  const [doctorOpen, setDoctorOpen] = useState(false);
  // Realne pomiary MoveLens — ładowane po montażu (localStorage, klient)
  const [movement, setMovement] = useState<MovementSummary | null>(null);
  useEffect(() => setMovement(buildMovementSummary()), []);

  const toggle = (k: SourceKey) => setImported((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="px-5 pt-8">
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Dane</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Połącz rozproszone źródła w jeden, czytelny obraz Twojego zdrowia.
        </p>
      </header>

      <section className="space-y-3">
        <SourceCard
          k="apple"
          icon={Apple}
          title="Apple Health"
          desc="Import z pliku export.xml"
          connected={imported.apple}
          onToggle={toggle}
        />
        <SourceCard
          k="google"
          icon={Activity}
          title="Google Fit · Health Connect"
          desc="Połącz z kontem Google"
          connected={imported.google}
          onToggle={toggle}
        />
        <Link
          to="/wyniki"
          className="flex items-center gap-3 rounded-3xl border border-hairline bg-card p-4 shadow-sm"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tint">
            <FileText className="h-5 w-5 text-primary-deep" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Wyniki badań</span>
            <span className="block text-sm text-muted-foreground">
              Zdjęcie lub wpis ręczny · odczyt lokalnie
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      </section>

      {/* Dzienniczek ciśnienia (dane realne, lokalne) */}
      <BloodPressureCard />

      {/* Najważniejsze wskaźniki */}
      <section className="mt-6 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Najważniejsze wskaźniki</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Indicator icon={Heart} label="Tętno spoczynkowe" value="58" unit="bpm" status="good" />
          <Indicator
            icon={Dumbbell}
            label="Form Score (ost. sesje)"
            value={movement?.avgFormRecent != null ? String(movement.avgFormRecent) : "—"}
            unit={movement?.avgFormRecent != null ? "/ 100" : ""}
            status="good"
            hint={movement?.avgFormRecent == null ? "wykonaj trening" : undefined}
          />
          <Indicator icon={Footprints} label="Aktywność" value="6 240" unit="kroków" status="warn" hint="poniżej celu" />
          <Indicator icon={FlaskConical} label="Witamina D" value="22" unit="ng/ml" status="warn" hint="lekko obniżona" />
        </div>
      </section>

      {/* Wnioski */}
      <section className="mt-5 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Wnioski</h2>
        <ul className="mt-3 space-y-3">
          <Insight
            title="Regeneracja jest stabilna"
            body="HR spoczynkowe i HRV utrzymują się w dobrym zakresie od 2 tygodni — możesz spokojnie trenować."
          />
          <Insight
            title="Rozważ suplementację witaminy D"
            body="Twój ostatni wynik (22 ng/ml) sugeruje konsultację z lekarzem. To częsty problem zimą."
          />
          <Insight
            title="Głębokość przysiadu rośnie"
            body="Twój zakres ruchu poprawia się z tygodnia na tydzień — dobra praca nad mobilnością."
          />
        </ul>
      </section>

      {/* Oś czasu */}
      <section className="mt-5 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Oś czasu zdrowia</h2>
        <ol className="mt-4 space-y-4 border-l border-hairline pl-5">
          <Timeline icon={Activity} date="Dziś" title="6 240 kroków" body="Niska aktywność — krótszy spacer." color="warn" />
          <Timeline icon={Heart} date="Wczoraj" title="Trening: przysiady" body="30 powtórzeń, Form Score 83." color="good" />
          <Timeline icon={Heart} date="Wczoraj rano" title="Ciśnienie 118/76" body="W normie domowej. Dzienniczek uzupełniony." color="good" />
          <Timeline icon={FlaskConical} date="3 dni temu" title="Wyniki badań" body="Morfologia w normie. Witamina D obniżona." color="warn" />
          <Timeline icon={Stethoscope} date="2 tygodnie temu" title="Wizyta — fizjoterapia" body="Plan mobilności bioder." color="good" />
        </ol>
      </section>

      {/* CTA dla lekarza */}
      <section className="mt-5 mb-2 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Podsumowanie dla lekarza</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Wygeneruj 1-stronicowy raport z najważniejszymi wskaźnikami i trendami — do pokazania na wizycie.
        </p>
        <button
          onClick={() => setDoctorOpen(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-deep"
        >
          Generuj podsumowanie <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      {/* Bezpieczne przekazanie danych lekarzowi */}
      <section className="mt-5 mb-2 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Lock className="h-4 w-4 text-primary-deep" /> Paczka dla lekarza
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Zaszyfrowany pakiet: wyniki badań, dane ruchowe i ciśnienie. Otworzy go wyłącznie osoba,
          której dasz link i PIN — a interpretację zobaczysz dopiero po podpisie lekarza.
        </p>
        <Link
          to="/konsultacja"
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline px-4 py-3 text-sm font-semibold"
        >
          Przygotuj paczkę <ShieldCheck className="h-4 w-4" />
        </Link>
      </section>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        MoveLens wspiera świadomy ruch i nie zastępuje konsultacji z lekarzem ani fizjoterapeutą.
      </p>

      {doctorOpen && <DoctorSheet onClose={() => setDoctorOpen(false)} />}
    </div>
  );
}

function SourceCard({
  k,
  icon: Icon,
  title,
  desc,
  connected,
  onToggle,
}: {
  k: SourceKey;
  icon: any;
  title: string;
  desc: string;
  connected: boolean;
  onToggle: (k: SourceKey) => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-hairline bg-card p-4 shadow-sm">
      <div className="rounded-2xl bg-tint p-3">
        <Icon className="h-5 w-5 text-primary-deep" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => onToggle(k)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
          connected ? "bg-tint text-primary-deep" : "bg-primary text-primary-foreground",
        )}
      >
        {connected ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" /> Połączono
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" /> Importuj
          </>
        )}
      </button>
    </div>
  );
}

function Indicator({
  icon: Icon,
  label,
  value,
  unit,
  status,
  hint,
}: {
  icon: any;
  label: string;
  value: string;
  unit: string;
  status: "good" | "warn";
  hint?: string;
}) {
  const dot = status === "good" ? "bg-good" : "bg-warn";
  return (
    <div className="rounded-2xl border border-hairline p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary-deep" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
        <span className={cn("ml-auto h-2 w-2 rounded-full", dot)} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Insight({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function Timeline({ icon: Icon, date, title, body, color }: { icon: any; date: string; title: string; body: string; color: "good" | "warn" }) {
  return (
    <li className="relative">
      <span className={cn("absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-card", color === "good" ? "bg-good" : "bg-warn")}>
        <Icon className="h-2.5 w-2.5 text-white" />
      </span>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{date}</p>
      <p className="mt-0.5 text-sm font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </li>
  );
}

function DoctorSheet({ onClose }: { onClose: () => void }) {
  // Realne dane zebrane przez MoveLens (localStorage; arkusz montuje się tylko na kliencie)
  const movement = useMemo(() => buildMovementSummary(), []);
  const bp: BpSummary = useMemo(() => bpWeekSummary(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center">
      <div id="doctor-print" className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-6 sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-hairline print:hidden sm:hidden" />
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Podsumowanie dla lekarza</p>
            <h2 className="text-xl font-semibold">Jan Kowalski · 34 lata</h2>
            <p className="text-xs text-muted-foreground">Wygenerowano {new Date().toLocaleDateString("pl-PL")} · MoveLens</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-tint px-3 py-1 text-xs print:hidden">Zamknij</button>
        </div>

        {/* Realne pomiary MoveLens */}
        <Section title="Jakość ruchu — pomiar MoveLens (kamera)">
          {movement.sessionCount > 0 ? (
            <>
              <Row k="Sesje przysiadu" v={`${movement.sessionCount} (łącznie ${movement.totalReps} powt.)`} />
              {movement.avgFormRecent != null && <Row k="Form Score (ost. sesje)" v={`${movement.avgFormRecent} / 100`} />}
              {movement.formTrend != null && (
                <Row k="Trend jakości" v={`${movement.formTrend > 0 ? "+" : ""}${movement.formTrend} pkt`} />
              )}
              {movement.avgDepthRecent != null && <Row k="Głębokość (kąt kolana w dole)" v={`${movement.avgDepthRecent}°`} />}
              {movement.symmetryAvg != null && <Row k="Asymetria kolan (śr.)" v={`${movement.symmetryAvg}°`} />}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Brak zapisanych sesji — wykonaj trening w zakładce „Ćwicz".</p>
          )}
        </Section>

        <Section title="Testy kliniczne ruchu">
          {movement.tests.length > 0 ? (
            movement.tests.map((t) => (
              <Row key={t.kind} k={`${t.label} (${t.dateLabel})`} v={`${t.valueLabel} · ${t.bandLabel}`} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Brak wyników — wykonaj test wstawania z krzesła lub test równowagi w zakładce „Ćwicz".
            </p>
          )}
        </Section>

        {/* Dzienniczek ciśnienia — realne wpisy użytkownika (protokół HBPM) */}
        <Section title="Dzienniczek ciśnienia — pomiar domowy (7 dni)">
          {bp.filled > 0 ? (
            <>
              {bp.morningAvg && (
                <Row k={`Rano (śr. z ${bp.morningAvg.n})`} v={`${bp.morningAvg.sys}/${bp.morningAvg.dia} mmHg`} />
              )}
              {bp.eveningAvg && (
                <Row k={`Wieczorem (śr. z ${bp.eveningAvg.n})`} v={`${bp.eveningAvg.sys}/${bp.eveningAvg.dia} mmHg`} />
              )}
              <Row k="Kompletność zapisu" v={`${bp.filled} z 14 pomiarów`} />
              {bp.elevated && <Row k="Uwaga" v="śr. ≥ 135/85 (norma domowa) ⚠" />}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Brak pomiarów — dzienniczek w zakładce „Dane".</p>
          )}
        </Section>

        {/* Wskaźniki ogólne — dane przykładowe do czasu importu Apple Health */}
        <Section title="Wskaźniki podstawowe (import)">
          <Row k="Tętno spoczynkowe (śr. 30 dni)" v="58 bpm" />
          <Row k="HRV (śr. 30 dni)" v="64 ms" />
        </Section>

        <Section title="Wyniki badań (ost. 3 mies.)">
          <Row k="Morfologia" v="w normie" />
          <Row k="Glukoza na czczo" v="91 mg/dl" />
          <Row k="Witamina D" v="22 ng/ml ⚠ obniżona" />
          <Row k="TSH" v="2,1 µIU/ml" />
        </Section>

        <Section title="Obserwacje">
          {movement.observations.length > 0 ? (
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {movement.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Za mało danych na obserwacje — wykonaj trening lub test.</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Pomiary z kamery wykonano lokalnie na urządzeniu użytkownika. Materiał informacyjny — nie stanowi diagnozy.
          </p>
        </Section>

        <div className="mt-5 flex gap-3 print:hidden">
          <button
            onClick={() => window.print()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-hairline px-4 py-3 text-sm font-medium"
          >
            <Printer className="h-4 w-4" /> Drukuj / PDF
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary-deep"
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-deep">{title}</h3>
      <div className="mt-2 space-y-1">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
