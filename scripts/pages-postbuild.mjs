// GitHub Pages serwuje pliki statyczne — nie ma serwera, ktory zrobilby fallback
// na aplikacje SPA. Bierzemy wiec shell wygenerowany przez prerender i kladziemy go
// jako index.html (wejscie) oraz 404.html (deep linki typu /cwicz/przysiad/live,
// ktore Pages inaczej odrzuci wlasnym bledem 404).
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = "dist/client";
const shell = join(out, "_shell.html");

if (!existsSync(shell)) {
  console.error(`[pages] Brak ${shell} — prerender nie wygenerowal shella.`);
  process.exit(1);
}

for (const name of ["index.html", "404.html"]) {
  copyFileSync(shell, join(out, name));
  console.log(`[pages] ${name} <- _shell.html`);
}

// Bez tego Jekyll na Pages zjada katalogi i pliki zaczynajace sie od podkreslenia.
writeFileSync(join(out, ".nojekyll"), "");
console.log("[pages] .nojekyll");
