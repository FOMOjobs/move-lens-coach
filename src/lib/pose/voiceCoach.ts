/**
 * VoiceCoach — głosowy trener na Web Speech API (speechSynthesis).
 *
 * Dlaczego głos: ćwiczący stoi 2–3 m od telefonu, bokiem — nie widzi ekranu.
 * Naturalny kanał feedbacku to mowa. Wszystko lokalnie, bez sieci, po polsku.
 *
 * Zasady "niegadatliwości" (żeby coach nie męczył):
 *  - numer powtórzenia ZAWSZE i natychmiast (przerywa inne komunikaty),
 *  - korekty błędów z cooldownem per kategoria (nie powtarza w kółko),
 *  - pochwała najwcześniej co PRAISE_EVERY powtórzeń i tylko przy dobrej formie,
 *  - podpowiedzi ustawienia (coach) z własnym cooldownem,
 *  - nigdy nie kolejkuje starych komunikatów — mówi albo odpuszcza.
 *
 * iOS/Safari: mowa musi być "odblokowana" gestem użytkownika — wołaj unlock()
 * w handlerze kliknięcia (np. przycisk Start).
 */

import type { SquatFeedback } from "./squatAnalyzer";

const CUE_COOLDOWN_MS = 6000; // ta sama korekta nie częściej niż co 6 s
const COACH_COOLDOWN_MS = 5000; // podpowiedzi ustawienia
const PRAISE_EVERY = 3; // pochwała co najwyżej co 3 powtórzenia
const PRAISE_MIN_FORM = 80;

const PRAISES = ["Świetnie!", "Dobra technika!", "Tak trzymaj!", "Bardzo dobrze!"];

export class VoiceCoach {
  private enabled = true;
  private voice: SpeechSynthesisVoice | null = null;
  private lastCueAt = new Map<string, number>();
  private lastReps = 0;
  private lastPraiseRep = 0;
  private praiseIdx = 0;
  private repHadWarning = false;

  constructor() {
    if (!this.supported()) return;
    // Głosy na iOS/Chrome ładują się asynchronicznie
    this.pickVoice();
    window.speechSynthesis.addEventListener?.("voiceschanged", () => this.pickVoice());
  }

  supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    this.voice =
      voices.find((v) => v.lang?.toLowerCase().startsWith("pl") && v.localService) ??
      voices.find((v) => v.lang?.toLowerCase().startsWith("pl")) ??
      null;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on && this.supported()) window.speechSynthesis.cancel();
  }

  isEnabled() {
    return this.enabled;
  }

  /** Wołaj w handlerze gestu (Start) — odblokowuje mowę na iOS. */
  unlock() {
    if (!this.supported()) return;
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }

  reset() {
    this.lastCueAt.clear();
    this.lastReps = 0;
    this.lastPraiseRep = 0;
    this.repHadWarning = false;
    if (this.supported()) window.speechSynthesis.cancel();
  }

  private speak(text: string, opts: { interrupt?: boolean; rate?: number } = {}) {
    if (!this.enabled || !this.supported()) return;
    const synth = window.speechSynthesis;
    if (opts.interrupt) synth.cancel();
    else if (synth.speaking || synth.pending) return; // nie kolejkuj — odpuść
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pl-PL";
    if (this.voice) u.voice = this.voice;
    u.rate = opts.rate ?? 1.05;
    synth.speak(u);
  }

  /** Komunikat z cooldownem per kategoria (korekty, podpowiedzi). */
  private cue(category: string, text: string, cooldownMs: number, nowMs: number) {
    const last = this.lastCueAt.get(category) ?? -Infinity;
    if (nowMs - last < cooldownMs) return;
    if (!this.enabled || !this.supported()) return;
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) return;
    this.lastCueAt.set(category, nowMs);
    this.speak(text);
  }

  /** Powiedz dowolny komunikat od razu (np. start testu, wynik). */
  say(text: string, interrupt = true) {
    this.speak(text, { interrupt });
  }

  /** Podpowiedź ustawienia z cooldownem (dla testów i innych ekranów). */
  hint(text: string, nowMs: number) {
    this.cue("coach", text, COACH_COOLDOWN_MS, nowMs);
  }

  /** Główne wejście dla przysiadu — wołane z pętli klatek. */
  onSquatFeedback(fb: SquatFeedback, nowMs: number) {
    if (!this.enabled || !this.supported()) return;

    // Poza kadrem → podpowiedz ustawienie głosem (ekranu i tak nie widać)
    if (!fb.ready) {
      if (fb.coach) this.cue("coach", fb.coach, COACH_COOLDOWN_MS, nowMs);
      return;
    }

    const warns: string[] = [];
    if (fb.chips.depth.status === "warn") warns.push(fb.chips.depth.hint);
    if (fb.chips.back.status === "warn") warns.push(fb.chips.back.hint);
    if (fb.chips.knees.status === "warn") warns.push(fb.chips.knees.hint);
    if (fb.chips.tempo.status === "warn") warns.push(fb.chips.tempo.hint);
    if (warns.length > 0) this.repHadWarning = true;

    // Nowe powtórzenie → policz na głos (zawsze, przerywając inne)
    if (fb.reps > this.lastReps) {
      this.lastReps = fb.reps;
      this.speak(String(fb.reps), { interrupt: true, rate: 1.15 });

      // Pochwała: czysta seria od ostatniej pochwały + dobra forma
      if (
        !this.repHadWarning &&
        fb.formScore >= PRAISE_MIN_FORM &&
        fb.reps - this.lastPraiseRep >= PRAISE_EVERY
      ) {
        this.lastPraiseRep = fb.reps;
        this.lastCueAt.set("praise", nowMs);
        // krótka pauza po numerze załatwia się sama — kolejka po interrupt
        const praise = PRAISES[this.praiseIdx % PRAISES.length];
        this.praiseIdx += 1;
        const u = new SpeechSynthesisUtterance(praise);
        u.lang = "pl-PL";
        if (this.voice) u.voice = this.voice;
        window.speechSynthesis.speak(u); // dokolejkuj za numerem
      }
      this.repHadWarning = false;
      return;
    }

    // Korekty w trakcie ruchu — priorytet: plecy > kolana > głębokość > tempo
    if (fb.chips.back.status === "warn") {
      this.cue("back", fb.chips.back.hint, CUE_COOLDOWN_MS, nowMs);
    } else if (fb.chips.knees.status === "warn") {
      this.cue("knees", fb.chips.knees.hint, CUE_COOLDOWN_MS, nowMs);
    } else if (fb.chips.depth.status === "warn" && fb.state !== "up") {
      this.cue("depth", fb.chips.depth.hint, CUE_COOLDOWN_MS, nowMs);
    } else if (fb.chips.tempo.status === "warn") {
      this.cue("tempo", fb.chips.tempo.hint, CUE_COOLDOWN_MS, nowMs);
    }
  }
}
