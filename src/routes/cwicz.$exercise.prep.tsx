import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Camera, Shield } from "lucide-react";

export const Route = createFileRoute("/cwicz/$exercise/prep")({
  head: () => ({
    meta: [{ title: "Przygotowanie — MoveLens" }],
  }),
  component: PrepPage,
});

const NAMES: Record<string, string> = {
  przysiad: "Przysiad",
  pompka: "Pompka",
  deska: "Deska (plank)",
  wykrok: "Wykrok",
};

function PrepPage() {
  const { exercise } = Route.useParams();
  const navigate = useNavigate();
  const name = NAMES[exercise] ?? "Ćwiczenie";

  return (
    <div className="px-5 pt-6">
      <Link to="/cwicz" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Wybór ćwiczenia
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Przygotuj scenę — to zajmie chwilę.</p>

      <ol className="mt-6 space-y-3">
        <Step n={1} title="Oprzyj telefon" body="Postaw go pionowo lub poziomo o stabilny przedmiot — tak, żeby się nie ruszał." />
        <Step n={2} title="Stań bokiem do kamery" body="Sylwetka z boku ujawnia najwięcej o technice — szczególnie w przysiadzie." />
        <Step n={3} title="Odsuń się na 2–3 m" body="Cała sylwetka od głowy do stóp powinna być widoczna w kadrze." />
        <Step n={4} title="Dobre światło" body="Najlepiej dzienne, bez ostrego kontrastu za plecami." />
      </ol>

      <div className="mt-6 flex items-start gap-3 rounded-2xl bg-tint/70 p-4 text-sm">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary-deep" />
        <p className="text-foreground">
          Analiza odbywa się <strong>lokalnie</strong> na Twoim urządzeniu. Obraz z kamery nigdzie nie jest wysyłany.
        </p>
      </div>

      <button
        onClick={() => navigate({ to: "/cwicz/$exercise/live", params: { exercise } })}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-medium text-primary-foreground hover:bg-primary-deep"
      >
        <Camera className="h-5 w-5" />
        Zaczynamy
        <ArrowRight className="h-5 w-5" />
      </button>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Przeglądarka poprosi o dostęp do kamery — to potrzebne do analizy.
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-hairline bg-card p-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-semibold text-primary-deep">
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
