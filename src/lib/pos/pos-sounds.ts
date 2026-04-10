// POS Sound Effects — programmatic Web Audio API tones (no audio files)

const STORAGE_KEY = "bizarch-pos-sound-enabled";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem(STORAGE_KEY);
  return val !== "false";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

/** Light tap — add item to cart */
export function playTap(): void {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 1200;
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.04);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.04);
}

/** Soft tick — quantity change, remove item, select payment method */
export function playTick(): void {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 800;
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.025);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.025);
}

/** Two-note ascending arpeggio — completed sale, KOT sent */
export function playSuccess(): void {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  const t = ctx.currentTime;

  // Note 1: C5 (523 Hz)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.value = 523;
  gain1.gain.setValueAtTime(0.12, t);
  gain1.gain.linearRampToValueAtTime(0, t + 0.1);
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start(t);
  osc1.stop(t + 0.1);

  // Note 2: E5 (659 Hz)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.value = 659;
  gain2.gain.setValueAtTime(0.12, t + 0.08);
  gain2.gain.linearRampToValueAtTime(0, t + 0.2);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(t + 0.08);
  osc2.stop(t + 0.2);
}

/** Low buzz — error / validation failure */
export function playError(): void {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 200;
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

/** Descending chirp — barcode scan success */
export function playScan(): void {
  if (!isSoundEnabled()) return;
  const ctx = getContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(2000, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(1000, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}
