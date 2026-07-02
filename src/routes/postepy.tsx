import { createFileRoute } from "@tanstack/react-router";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { Ring } from "@/components/Ring";

export const Route = createFileRoute("/postepy")({
  head: () => ({
    meta: [
      { title: "Postępy — MoveLens" },
      { name: "description", content: "Trendy jakości ruchu w czasie: powtórzenia, głębokość, Form Score." },
    ],
  }),
  component: ProgressPage,
});

const repsData = [
  { d: "Pn", v: 18 },
  { d: "Wt", v: 22 },
  { d: "Śr", v: 0 },
  { d: "Cz", v: 25 },
  { d: "Pt", v: 28 },
  { d: "Sb", v: 30 },
  { d: "Nd", v: 30 },
];

const depthData = [
  { d: "T-6", v: 108 },
  { d: "T-5", v: 104 },
  { d: "T-4", v: 99 },
  { d: "T-3", v: 96 },
  { d: "T-2", v: 92 },
  { d: "T-1", v: 90 },
  { d: "Teraz", v: 88 },
];

const formData = [
  { d: "T-6", v: 64 },
  { d: "T-5", v: 68 },
  { d: "T-4", v: 71 },
  { d: "T-3", v: 75 },
  { d: "T-2", v: 78 },
  { d: "T-1", v: 81 },
  { d: "Teraz", v: 84 },
];

const sessions = [
  { date: "Wczoraj · 18:40", reps: 30, score: 83, tip: "Brawo — głębokość OK" },
  { date: "Pt · 19:10", reps: 28, score: 79, tip: "Pilnuj pleców" },
  { date: "Cz · 07:55", reps: 25, score: 74, tip: "Zejdź niżej" },
  { date: "Wt · 18:25", reps: 22, score: 70, tip: "Tempo szybsze niż chciałeś" },
];

function ProgressPage() {
  return (
    <div className="px-5 pt-8">
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Postępy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Śledzimy <em>jakość</em> ruchu w czasie, nie tylko ilość.</p>
      </header>

      <section className="rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <div className="flex items-center gap-5">
          <Ring value={84} size={108} label="84" sublabel="Forma" />
          <div className="flex-1">
            <h2 className="text-base font-semibold">+20 pkt w 6 tygodni</h2>
            <p className="mt-1 text-sm text-muted-foreground">Twoja średnia jakość wykonania rośnie konsekwentnie. Świetna praca.</p>
          </div>
        </div>
      </section>

      <ChartCard title="Form Score — trend tygodniowy" hint="0–100, im wyżej, tym lepiej">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={formData} margin={{ left: -20, right: 0, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="formGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} domain={[40, 100]} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} />
            <Area type="monotone" dataKey="v" stroke="var(--primary-deep)" strokeWidth={2.5} fill="url(#formGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Głębokość przysiadu" hint="kąt kolana w dolnej fazie (mniej = głębiej)">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={depthData} margin={{ left: -20, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} reversed domain={[80, 120]} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} />
            <Line type="monotone" dataKey="v" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary-deep)" }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Powtórzenia w tygodniu" hint="dziennie">
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={repsData} margin={{ left: -20, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--hairline)", background: "var(--card)", color: "var(--foreground)", fontSize: 12 }} />
            <Line type="monotone" dataKey="v" stroke="var(--good)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--good)" }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <section className="mt-5 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ostatnie sesje</h3>
        <ul className="mt-3 divide-y divide-hairline">
          {sessions.map((s) => (
            <li key={s.date} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{s.date}</p>
                <p className="text-xs text-muted-foreground">{s.reps} powt. · {s.tip}</p>
              </div>
              <div className="rounded-full bg-tint px-3 py-1 text-sm font-semibold text-primary-deep">{s.score}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-3xl border border-hairline bg-card p-5 shadow-sm">
      <div className="mb-2 flex items-end justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
