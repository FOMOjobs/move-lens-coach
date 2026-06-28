import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Activity, Moon, HeartPulse, Dumbbell } from "lucide-react";
import { Ring } from "@/components/Ring";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dziś — MoveLens" },
      { name: "description", content: "Twój dzisiejszy przegląd: gotowość, sugerowana sesja i wnioski z danych." },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="px-5 pt-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{dateStr}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Cześć 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spokojny dzień. Twoje ciało jest gotowe na lekki trening techniki.
        </p>
      </header>

      {/* Pierścień gotowości */}
      <section className="rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <div className="flex items-center gap-5">
          <Ring value={78} size={108} label="78" sublabel="Gotowość" />
          <div className="flex-1">
            <h2 className="text-base font-semibold">Dobra regeneracja</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tętno spoczynkowe 58 bpm, sen 7 h 12 min. Możesz potrenować z umiarkowaną intensywnością.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric icon={HeartPulse} label="HR spocz." value="58" unit="bpm" />
          <Metric icon={Moon} label="Sen" value="7:12" unit="h" />
          <Metric icon={Activity} label="Kroki" value="6 240" unit="" />
        </div>
      </section>

      {/* Sugerowana sesja */}
      <section className="mt-5 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Sugerowana sesja</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Przysiady — technika</h3>
            <p className="mt-1 text-sm text-muted-foreground">3 serie × 10 powtórzeń. Skupimy się na głębokości i pozycji kolan.</p>
          </div>
          <div className="rounded-2xl bg-tint p-3">
            <Dumbbell className="h-6 w-6 text-primary-deep" />
          </div>
        </div>
        <Link
          to="/cwicz/$exercise/prep"
          params={{ exercise: "przysiad" }}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-deep"
        >
          Zaczynamy <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Co mówią dane */}
      <section className="mt-5 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Co mówią Twoje dane</p>
        <ul className="mt-3 space-y-3">
          <Insight title="Tętno spoczynkowe stabilne" body="Od 14 dni utrzymuje się w okolicach 58 bpm — dobry sygnał regeneracji." />
          <Insight title="Forma przysiadu rośnie" body="Średni Form Score: 72 → 81 w ostatnich 2 tygodniach. Brawo!" />
        </ul>
      </section>

      {/* Ostatni trening */}
      <section className="mt-5 mb-2 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Ostatni trening</p>
            <h3 className="mt-1 font-semibold">Przysiady · wczoraj</h3>
            <p className="mt-1 text-sm text-muted-foreground">30 powtórzeń · Form Score 83 · głębokość OK</p>
          </div>
          <Link to="/postepy" className="text-sm font-medium text-primary">Zobacz</Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, unit }: { icon: any; label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-tint/60 p-3">
      <Icon className="mx-auto mb-1 h-4 w-4 text-primary-deep" />
      <div className="text-sm font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
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
