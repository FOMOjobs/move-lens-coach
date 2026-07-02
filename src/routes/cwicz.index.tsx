import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Dumbbell, Activity, Minus, Footprints, Armchair, PersonStanding } from "lucide-react";

export const Route = createFileRoute("/cwicz/")({
  head: () => ({
    meta: [
      { title: "Ćwicz — MoveLens" },
      { name: "description", content: "Wybierz ćwiczenie i przejdź do analizy techniki na żywo." },
    ],
  }),
  component: ExerciseListPage,
});

interface ExerciseCard {
  slug: string;
  name: string;
  desc: string;
  attention: string;
  icon: any;
  flagship?: boolean;
}

const exercises: ExerciseCard[] = [
  {
    slug: "przysiad",
    name: "Przysiad",
    desc: "Klasyczne ćwiczenie na siłę i mobilność dolnych partii.",
    attention: "Głębokość · Kolana · Plecy · Tempo",
    icon: Dumbbell,
    flagship: true,
  },
  {
    slug: "pompka",
    name: "Pompka",
    desc: "Praca klatki, barków i mięśni stabilizujących tułów.",
    attention: "Liczenie powtórzeń · uproszczona analiza",
    icon: Activity,
  },
  {
    slug: "deska",
    name: "Deska (plank)",
    desc: "Statyczne wzmocnienie środka ciała.",
    attention: "Pomiar czasu · uproszczona analiza",
    icon: Minus,
  },
  {
    slug: "wykrok",
    name: "Wykrok",
    desc: "Praca jednonóż, równowaga i kontrola kolana.",
    attention: "Liczenie powtórzeń · uproszczona analiza",
    icon: Footprints,
  },
];

const tests: ExerciseCard[] = [
  {
    slug: "test-wstawania",
    name: "Test wstawania z krzesła",
    desc: "30 sekund: ile razy wstaniesz? Kliniczny test siły nóg i ryzyka upadków.",
    attention: "Wynik porównany z normą dla wieku i płci",
    icon: Armchair,
    flagship: true,
  },
  {
    slug: "test-rownowagi",
    name: "Test równowagi",
    desc: "Stanie na jednej nodze — zwalidowany wskaźnik ryzyka upadków.",
    attention: "Pomiar czasu automatycznie, z normami wiekowymi",
    icon: PersonStanding,
    flagship: true,
  },
];

function ExerciseListPage() {
  return (
    <div className="px-5 pt-8">
      <header className="mb-5">
        <h1 className="text-3xl font-semibold tracking-tight">Ćwicz</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wybierz ćwiczenie. „Przysiad" jest w pełni analizowany — pozostałe na razie z liczeniem powtórzeń.
        </p>
      </header>

      <ul className="space-y-3 pb-2">
        {exercises.map((ex) => (
          <ExerciseItem key={ex.slug} ex={ex} badge="Pełna analiza" />
        ))}
      </ul>

      <h2 className="mb-3 mt-7 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Testy zdrowia ruchu
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Zwalidowane testy kliniczne, które normalnie wykonuje się w gabinecie — teraz w Twoim telefonie.
      </p>
      <ul className="space-y-3 pb-2">
        {tests.map((ex) => (
          <ExerciseItem key={ex.slug} ex={ex} badge="Test kliniczny" />
        ))}
      </ul>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Analiza odbywa się lokalnie na Twoim urządzeniu. Obraz nigdzie nie jest wysyłany.
      </p>
    </div>
  );
}

function ExerciseItem({ ex, badge }: { ex: ExerciseCard; badge: string }) {
  return (
    <li>
      <Link
        to="/cwicz/$exercise/prep"
        params={{ exercise: ex.slug }}
        className="group block rounded-3xl border border-hairline bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-tint p-3">
            <ex.icon className="h-6 w-6 text-primary-deep" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">{ex.name}</h2>
              {ex.flagship && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                  {badge}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{ex.desc}</p>
            <p className="mt-2 text-xs text-primary-deep">{ex.attention}</p>
          </div>
          <ArrowRight className="mt-2 h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    </li>
  );
}
