/**
 * Przełącznik jasny/ciemny. Preferencja trafia do localStorage
 * ("movelens.theme"); przy braku preferencji obowiązuje motyw systemowy
 * (ustawiany skryptem w <head> — patrz __root.tsx).
 */

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  // null do montażu — SSR nie zna motywu, unikamy niezgodności hydratacji
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("movelens.theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
    >
      {dark === null ? (
        <span className="h-4 w-4" />
      ) : dark ? (
        <Sun className="h-4.5 w-4.5" />
      ) : (
        <Moon className="h-4.5 w-4.5" />
      )}
    </button>
  );
}
