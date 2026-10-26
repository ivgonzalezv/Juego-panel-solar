// ─── HELIOS TRACKER · Game Engine ──────────────────────────────
export interface Cloud { id: number; x: number; y: number; scale: number; speed: number; opacity: number; dark: number; }
export interface PhoneState { id: number; name: string; pct: number; plugged: boolean; color: string; done: boolean; }
export interface Mission { id: string; title: string; desc: string; target: number; progress: number; xp: number; done: boolean; icon: string; }
export interface FloatMsg { id: number; text: string; sub?: string; kind: 'good' | 'bad' | 'info' | 'energy'; x: number; y: number; }
export interface LogEntry { id: number; t: string; msg: string; kind: 'info' | 'good' | 'warn' | 'bad'; }

export const DAY_START = 6;
export const DAY_END = 20;
export const PANEL_W = 20; // W
export const PANEL_V = 18; // V
export const BAT_WH = 120; // 12V 10Ah
export const PHONE_WH = 15;

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** azimuth del sol: -90 (este, 6h) → +90 (oeste, 20h) */
export function sunAzimuth(h: number): number {
  const t = (h - DAY_START) / (DAY_END - DAY_START);
  return lerp(-90, 90, clamp(t, 0, 1));
}
/** elevación 0..~68° con curva senoidal */
export function sunElevation(h: number): number {
  const t = (h - DAY_START) / (DAY_END - DAY_START);
  return Math.sin(clamp(t, 0, 1) * Math.PI) * 68;
}
/** posición % del sol en el cielo */
export function sunXY(h: number): { x: number; y: number } {
  const t = clamp((h - DAY_START) / (DAY_END - DAY_START), 0, 1);
  return { x: 6 + t * 88, y: 78 - Math.sin(t * Math.PI) * 62 };
}
export function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
/** gradiente del cielo según elevación */
export function skyGradient(elev: number): string {
  if (elev <= 0.5) return 'linear-gradient(to bottom, #020617 0%, #0b1026 45%, #1a2340 75%, #2b2a4a 100%)';
  if (elev < 10) return 'linear-gradient(to bottom, #1e2a5a 0%, #7c4a2d 48%, #e8823f 72%, #f5b04c 100%)';
  if (elev < 22) return 'linear-gradient(to bottom, #2f6fbf 0%, #6fa8dc 45%, #a8c8e8 72%, #f2c879 100%)';
  if (elev < 45) return 'linear-gradient(to bottom, #1d5fb8 0%, #4f9be0 42%, #8ec3ee 70%, #cfe8c8 100%)';
  return 'linear-gradient(to bottom, #155aB8 0%, #3f8fd6 40%, #7db9e8 68%, #cfe8b8 100%)';
}
export function groundGradient(elev: number): string {
  if (elev <= 0.5) return 'linear-gradient(to bottom, #0a0f1e, #04060c)';
  if (elev < 10) return 'linear-gradient(to bottom, #6b5136, #3a2d22)';
  return 'linear-gradient(to bottom, #7fa35a 0%, #5d8442 40%, #3f6130 100%)';
}

/** oclusión del sol por nubes (0..1) */
export function cloudOcclusion(clouds: Cloud[], sunX: number): number {
  let occ = 0;
  for (const c of clouds) {
    const w = 9 * c.scale;
    const d = Math.abs(c.x - sunX);
    if (d < w) occ += (1 - d / w) * c.opacity * (0.55 + c.dark * 0.45);
  }
  return clamp(occ, 0, 0.96);
}

// ─── Audio synth ───
let ctx: AudioContext | null = null;
let muted = false;
export function setMuted(m: boolean) { muted = m; }
export function tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.08, slide = 0) {
  if (muted) return;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch { /* noop */ }
}
export const sfx = {
  click: () => tone(660, 0.06, 'square', 0.03),
  toggle: () => tone(520, 0.08, 'triangle', 0.06, 180),
  servo: () => tone(180, 0.09, 'sawtooth', 0.018, 60),
  good: () => { tone(523, 0.1, 'sine', 0.07); setTimeout(() => tone(784, 0.14, 'sine', 0.07), 90); },
  warn: () => tone(220, 0.2, 'sawtooth', 0.05, -80),
  full: () => { tone(659, 0.1, 'sine', 0.08); setTimeout(() => tone(880, 0.1, 'sine', 0.08), 100); setTimeout(() => tone(1318, 0.22, 'sine', 0.09), 200); },
  pop: () => tone(880, 0.07, 'sine', 0.06, 320),
};

export function initialMissions(): Mission[] {
  return [
    { id: 'eff', title: 'Amanecer Eficiente', desc: 'Alcanza 90% de eficiencia de seguimiento', target: 90, progress: 0, xp: 120, done: false, icon: 'target' },
    { id: 'wh', title: 'Cazador de Sol', desc: 'Genera 60 Wh en el día', target: 60, progress: 0, xp: 300, done: false, icon: 'zap' },
    { id: 'phones', title: 'Triple Carga', desc: 'Carga 3 celulares al 100%', target: 3, progress: 0, xp: 500, done: false, icon: 'phone' },
    { id: 'clouds', title: 'Cazatormentas', desc: 'Disipa 5 nubes tocándolas', target: 5, progress: 0, xp: 150, done: false, icon: 'cloud' },
    { id: 'track', title: 'Servo Master', desc: 'Mantén error < 6° durante 45 s ( MANUAL )', target: 45, progress: 0, xp: 250, done: false, icon: 'cpu' },
  ];
}

export function initialClouds(n = 4): Cloud[] {
  return Array.from({ length: n }, (_, i) => ({
    id: Date.now() + i,
    x: 8 + Math.random() * 84,
    y: 6 + Math.random() * 30,
    scale: 0.7 + Math.random() * 0.9,
    speed: 0.6 + Math.random() * 1.4,
    opacity: 0.75 + Math.random() * 0.25,
    dark: Math.random() * 0.7,
  }));
}
