import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LAB_CATALOG,
  deleteLabPanel,
  labTrend,
  listLabPanels,
  rangeLabel,
  rangeStatus,
  saveLabPanel,
  STATUS_LABEL,
  type LabPanel,
  type LabValue,
  type RangeStatus,
} from "@/lib/health/labResults";
import { DEMO_PANELS, parseLabText, runOcr, type ParsedLab } from "@/lib/health/labOcr";

export const Route = createFileRoute("/wyniki")({
  head: () => ({
    meta: [
      { title: "Wyniki badań — MoveLens" },
      {
        name: "description",
        content: "Wyniki badań w jednym miejscu. Odczyt zakresów z laboratorium i trend w czasie.",
      },
    ],
  }),
  component: LabsPage,
});

const STATUS_STYLE: Record<RangeStatus, string> = {
  in: "bg-good/15 text-good",
  below: "bg-warn/20 text-warn",
  above: "bg-warn/20 text-warn",
  unknown: "bg-muted text-muted-foreground",
};

function LabsPage() {
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [draft, setDraft] = useState<{ day: string; lab: string; values: ParsedLab[] } | null>(null);
  const [ocrBusy, setOcrBusy] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => setPanels(listLabPanels());
  useEffect(reload, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrError(null);
    setOcrBusy("Przygotowuję silnik OCR…");
    try {
      const text = await runOcr(file, (p) =>
        setOcrBusy(`${p.status} — ${Math.round(p.progress * 100)}%`),
      );
      const parsed = parseLabText(text);
      if (parsed.length === 0) {
        setOcrError(
          "Nie rozpoznałem żadnego badania na tym zdjęciu. Spróbuj wyraźniejszego kadru albo wpisz wyniki ręcznie.",
        );
      } else {
        setDraft({ day: new Date().toISOString().slice(0, 10), lab: "", values: parsed });
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "Nie udało się odczytać zdjęcia.");
    } finally {
      setOcrBusy(null);
    }
  }

  function startManual() {
    setDraft({ day: new Date().toISOString().slice(0, 10), lab: "", values: [] });
  }

  function loadDemo() {
    for (const p of DEMO_PANELS) {
      saveLabPanel({ day: p.day, lab: p.lab, source: "demo", values: p.values });
    }
    reload();
  }

  if (draft) {
    return (
      <ReviewDraft
        draft={draft}
        setDraft={setDraft}
        onSave={(panel) => {
          saveLabPanel(panel);
          setDraft(null);
          reload();
        }}
        onCancel={() => setDraft(null)}
      />
    );
  }

  return (
    <div className="px-5 pt-8">
      <header className="mb-5">
        <Link to="/dane" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
          <ArrowLeft className="h-4 w-4" /> Dane
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Wyniki badań</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Zdjęcie wyników przetwarzamy na Twoim telefonie. Dokument nigdzie nie jest wysyłany.
        </p>
      </header>

      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-tint/70 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-deep" />
        <p className="text-sm text-muted-foreground">
          MoveLens pokazuje wyłącznie to, co jest na kartce z laboratorium: wartość i zakres
          referencyjny. <span className="font-medium text-foreground">Nie interpretuje wyników</span> —
          od tego jest lekarz.
        </p>
      </div>

      <section className="mb-6 space-y-3">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={ocrBusy != null}
          className="flex w-full items-center gap-3 rounded-3xl border border-hairline bg-card p-4 text-left shadow-sm disabled:opacity-60"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tint">
            {ocrBusy ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary-deep" />
            ) : (
              <Camera className="h-5 w-5 text-primary-deep" />
            )}
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Zeskanuj zdjęcie wyników</span>
            <span className="block text-sm text-muted-foreground">
              {ocrBusy ?? "OCR lokalnie na urządzeniu · wynik zawsze do potwierdzenia"}
            </span>
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onFile}
          className="hidden"
        />

        <button
          onClick={startManual}
          className="flex w-full items-center gap-3 rounded-3xl border border-hairline bg-card p-4 text-left shadow-sm"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tint">
            <Pencil className="h-5 w-5 text-primary-deep" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">Wpisz ręcznie</span>
            <span className="block text-sm text-muted-foreground">Najpewniejsza droga</span>
          </span>
        </button>

        {panels.length === 0 && (
          <button
            onClick={loadDemo}
            className="w-full rounded-2xl border border-dashed border-hairline p-3 text-sm text-muted-foreground"
          >
            Wczytaj dane przykładowe (do demonstracji)
          </button>
        )}
      </section>

      {ocrError && (
        <p className="mb-5 rounded-2xl bg-warn/15 p-4 text-sm text-foreground">{ocrError}</p>
      )}

      {panels.length === 0 ? (
        <p className="rounded-3xl border border-hairline bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">
          Nie masz jeszcze zapisanych wyników.
        </p>
      ) : (
        <>
          <section className="space-y-4">
            {panels.map((p) => (
              <PanelCard
                key={p.id}
                panel={p}
                onDelete={() => {
                  deleteLabPanel(p.id);
                  reload();
                }}
              />
            ))}
          </section>

          <Link
            to="/konsultacja"
            className="mt-6 mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-medium text-primary-foreground"
          >
            Przygotuj paczkę dla lekarza <ShieldCheck className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- karta panelu */

function PanelCard({ panel, onDelete }: { panel: LabPanel; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const outOfRange = panel.values.filter((v) => {
    const s = rangeStatus(v);
    return s === "below" || s === "above";
  }).length;

  return (
    <div className="rounded-3xl border border-hairline bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {new Date(panel.day).toLocaleDateString("pl-PL")}
            {panel.lab ? ` · ${panel.lab}` : ""}
          </p>
          <h2 className="mt-1 font-semibold">{panel.values.length} parametrów</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {outOfRange === 0
              ? "Wszystkie w zakresie laboratorium"
              : `${outOfRange} poza zakresem laboratorium`}
          </p>
        </div>
        <button onClick={onDelete} aria-label="Usuń panel" className="p-2 text-muted-foreground">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 text-sm font-medium text-primary"
      >
        {open ? "Zwiń" : "Pokaż wyniki"}
      </button>

      {open && (
        <ul className="mt-3 space-y-2 border-t border-hairline pt-3">
          {panel.values.map((v) => (
            <ValueRow key={v.code} value={v} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ValueRow({ value }: { value: LabValue }) {
  const status = rangeStatus(value);
  const trend = labTrend(value.code);
  return (
    <li className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{value.name}</p>
        <p className="text-xs text-muted-foreground">
          Zakres laboratorium: {rangeLabel(value)}
          {value.refSource === "fallback" && " · do potwierdzenia"}
        </p>
        {trend.length > 1 && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {trend.map((t) => t.value).join(" → ")} {value.unit}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">
          {value.value} <span className="text-xs font-normal text-muted-foreground">{value.unit}</span>
        </p>
        <span
          className={cn(
            "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
            STATUS_STYLE[status],
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </div>
    </li>
  );
}

/* ----------------------------------------------------------- ekran korekty */

function ReviewDraft({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: { day: string; lab: string; values: ParsedLab[] };
  setDraft: (d: { day: string; lab: string; values: ParsedLab[] }) => void;
  onSave: (p: Omit<LabPanel, "id" | "addedISO">) => void;
  onCancel: () => void;
}) {
  const [adding, setAdding] = useState(false);

  const patch = (i: number, next: Partial<ParsedLab>) =>
    setDraft({ ...draft, values: draft.values.map((v, j) => (j === i ? { ...v, ...next } : v)) });

  const remove = (i: number) =>
    setDraft({ ...draft, values: draft.values.filter((_, j) => j !== i) });

  function addFromCatalog(code: string) {
    const def = LAB_CATALOG.find((d) => d.code === code);
    if (!def) return;
    setDraft({
      ...draft,
      values: [
        ...draft.values,
        {
          code: def.code,
          loinc: def.loinc,
          name: def.name,
          unit: def.unit,
          value: 0,
          refLow: def.low,
          refHigh: def.high,
          refSource: "fallback",
          rawLine: "",
          confident: false,
        },
      ],
    });
    setAdding(false);
  }

  const used = new Set(draft.values.map((v) => v.code));

  return (
    <div className="px-5 pt-8">
      <header className="mb-5">
        <button onClick={onCancel} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
          <ArrowLeft className="h-4 w-4" /> Anuluj
        </button>
        <h1 className="text-3xl font-semibold tracking-tight">Sprawdź i popraw</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Każde laboratorium drukuje inaczej, więc odczyt bywa niedokładny. Potwierdź wartości,
          zanim je zapiszemy.
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Data badania
          </span>
          <input
            type="date"
            value={draft.day}
            onChange={(e) => setDraft({ ...draft, day: e.target.value })}
            className="w-full rounded-2xl border border-hairline bg-card px-3 py-2.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Laboratorium
          </span>
          <input
            value={draft.lab}
            onChange={(e) => setDraft({ ...draft, lab: e.target.value })}
            placeholder="opcjonalnie"
            className="w-full rounded-2xl border border-hairline bg-card px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <ul className="space-y-3">
        {draft.values.map((v, i) => (
          <li key={`${v.code}-${i}`} className="rounded-3xl border border-hairline bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{v.name}</p>
                {v.rawLine && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" title={v.rawLine}>
                    Odczytano: „{v.rawLine}"
                  </p>
                )}
              </div>
              <button onClick={() => remove(i)} aria-label="Usuń" className="p-1 text-muted-foreground">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                  Wynik
                </span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={v.value}
                  onChange={(e) => patch(i, { value: Number(e.target.value) })}
                  className="w-full rounded-xl border border-hairline bg-background px-2 py-2 text-sm tabular-nums"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                  Zakres od
                </span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={v.refLow ?? ""}
                  onChange={(e) =>
                    patch(i, { refLow: e.target.value === "" ? null : Number(e.target.value), refSource: "sheet" })
                  }
                  className="w-full rounded-xl border border-hairline bg-background px-2 py-2 text-sm tabular-nums"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                  Zakres do
                </span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={v.refHigh ?? ""}
                  onChange={(e) =>
                    patch(i, { refHigh: e.target.value === "" ? null : Number(e.target.value), refSource: "sheet" })
                  }
                  className="w-full rounded-xl border border-hairline bg-background px-2 py-2 text-sm tabular-nums"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Jednostka: {v.unit}
              {!v.confident && " · zakres podpowiedziany, sprawdź z kartką"}
            </p>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-3 rounded-3xl border border-hairline bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-medium">Wybierz badanie</p>
          <div className="flex flex-wrap gap-2">
            {LAB_CATALOG.filter((d) => !used.has(d.code)).map((d) => (
              <button
                key={d.code}
                onClick={() => addFromCatalog(d.code)}
                className="rounded-full border border-hairline px-3 py-1.5 text-xs"
              >
                {d.name}
              </button>
            ))}
          </div>
          <button onClick={() => setAdding(false)} className="mt-3 text-sm text-muted-foreground">
            Zamknij
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline p-3 text-sm text-muted-foreground"
        >
          <Plus className="h-4 w-4" /> Dodaj badanie
        </button>
      )}

      <button
        disabled={draft.values.length === 0}
        onClick={() =>
          onSave({
            day: draft.day,
            lab: draft.lab,
            source: draft.values.some((v) => v.rawLine) ? "ocr" : "manual",
            values: draft.values.map(({ rawLine: _r, confident: _c, ...rest }) => rest),
          })
        }
        className="mt-6 mb-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-medium text-primary-foreground disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" /> Zapisz {draft.values.length} wyników
      </button>
    </div>
  );
}
