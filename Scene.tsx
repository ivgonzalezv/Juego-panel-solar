import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Zap, PlugZap, Plug, CloudRainWind } from 'lucide-react';
import {
  Cloud, PhoneState, FloatMsg, sunXY, sunElevation, sunAzimuth,
  skyGradient, groundGradient, clamp, fmtHour,
} from '../game/engine';

interface Props {
  timeH: number;
  panelAngle: number;
  mode: 'auto' | 'manual';
  clouds: Cloud[];
  dust: number;
  power: number;
  alignEff: number;
  angleError: number;
  occlusion: number;
  phones: PhoneState[];
  batteryPct: number;
  mrActive: boolean;
  arLabels: boolean;
  charging: boolean;
  heatWave: boolean;
  dustStorm: boolean;
  floatMsgs: FloatMsg[];
  onScrubTime: (h: number) => void;
  onPanelAngle: (a: number) => void;
  onPopCloud: (id: number) => void;
  onTogglePhone: (id: number) => void;
  servoMoving: boolean;
}

export default function Scene(p: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [dragSun, setDragSun] = useState(false);
  const [dragPanel, setDragPanel] = useState(false);
  const [camError, setCamError] = useState('');

  const elev = sunElevation(p.timeH);
  const azim = sunAzimuth(p.timeH);
  const sun = sunXY(p.timeH);
  const night = elev <= 0.5;
  const tiltX = clamp(58 - elev * 0.42, 16, 60);
  const visRY = clamp(p.panelAngle * 0.52, -52, 52);
  const irr = clamp(Math.sin((elev / 68) * Math.PI / 2), 0, 1);

  // ── MR camera ──
  useEffect(() => {
    const start = async () => {
      if (!p.mrActive) {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null; setCamError('');
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        streamRef.current = s;
        if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => {}); }
      } catch {
        setCamError('Sin acceso a cámara — modo holograma simulado');
      }
    };
    start();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, [p.mrActive]);

  const timeFromX = useCallback((clientX: number) => {
    const el = boxRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const t = clamp((clientX - r.left) / r.width, 0.04, 0.96);
    p.onScrubTime(6 + t * 14);
  }, [p]);

  useEffect(() => {
    if (!dragSun && !dragPanel) return;
    const mv = (e: PointerEvent) => {
      if (dragSun) timeFromX(e.clientX);
      if (dragPanel && boxRef.current) {
        const r = boxRef.current.getBoundingClientRect();
        const rel = clamp((e.clientX - (r.left + r.width * 0.42)) / (r.width * 0.3), -1, 1);
        p.onPanelAngle(clamp(rel * 90, -90, 90));
      }
    };
    const up = () => { setDragSun(false); setDragPanel(false); };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [dragSun, dragPanel, timeFromX, p]);

  const aligned = Math.abs(p.angleError) < 8 && !night && p.occlusion < 0.5;

  return (
    <div ref={boxRef} className="scanlines relative h-full min-h-[540px] w-full select-none overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#04060c] no-select">
      {/* MR camera layer */}
      {p.mrActive && (
        <div className="absolute inset-0 z-0 bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover opacity-80" />
          {camError && <div className="mr-grid absolute inset-0 opacity-60" />}
          <div className="absolute inset-0 bg-cyan-500/10 mix-blend-overlay" />
        </div>
      )}

      {/* SKY */}
      <div className="absolute inset-x-0 top-0 z-[1] transition-all duration-700" style={{ height: '72%', background: skyGradient(elev), opacity: p.mrActive ? 0.35 : 1 }} />

      {/* Stars */}
      {night && !p.mrActive && (
        <div className="absolute inset-x-0 top-0 z-[2] h-[55%]">
          {Array.from({ length: 60 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white" style={{ left: `${(i * 37.7) % 100}%`, top: `${(i * 53.3) % 100}%`, width: i % 5 === 0 ? 2.5 : 1.4, height: i % 5 === 0 ? 2.5 : 1.4, opacity: 0.4 + ((i * 13) % 60) / 100 }} />
          ))}
        </div>
      )}

      {/* Sun path arc */}
      <svg className="absolute inset-x-0 top-0 z-[2] h-[72%] w-full" viewBox="0 0 100 72" preserveAspectRatio="none">
        <path d="M 6 70 Q 50 -8 94 70" fill="none" stroke={p.mrActive ? 'rgba(34,211,238,0.7)' : 'rgba(255,255,255,0.45)'} strokeWidth="0.5" strokeDasharray="1.6 1.2" />
        {[6, 9, 13, 17, 20].map(h => {
          const s = sunXY(h);
          return <g key={h}><circle cx={s.x} cy={s.y * 0.72} r="0.7" fill="rgba(255,255,255,0.6)" /><text x={s.x} y={s.y * 0.72 - 3} fontSize="2.4" fill="rgba(255,255,255,0.75)" textAnchor="middle" fontFamily="monospace">{h}h</text></g>;
        })}
      </svg>

      {/* Clouds */}
      <div className="absolute inset-x-0 top-0 z-[5] h-[60%]">
        {p.clouds.map(c => (
          <button
            key={c.id}
            onClick={() => p.onPopCloud(c.id)}
            title="Toca para disipar la nube (+XP)"
            className="group absolute cursor-pointer transition-transform hover:scale-110 active:scale-95"
            style={{ left: `${c.x}%`, top: `${c.y}%`, transform: `translate(-50%,0) scale(${c.scale})`, opacity: c.opacity }}
          >
            <svg width="120" height="52" viewBox="0 0 120 52" className="drop-shadow-xl">
              <ellipse cx="34" cy="36" rx="26" ry="14" fill={c.dark > 0.5 ? '#5b6b84' : '#f1f5f9'} />
              <ellipse cx="62" cy="28" rx="30" ry="18" fill={c.dark > 0.5 ? '#6b7c96' : '#ffffff'} />
              <ellipse cx="90" cy="37" rx="22" ry="12" fill={c.dark > 0.5 ? '#525f78' : '#e2e8f0'} />
            </svg>
            <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-2 py-0.5 font-mono text-[10px] text-cyan-300 opacity-0 transition group-hover:opacity-100">DISIPAR ☁️✕</span>
          </button>
        ))}
      </div>

      {/* SUN (draggable) */}
      <div
        className="absolute z-[6] grabbable"
        style={{ left: `${sun.x}%`, top: `${sun.y * 0.72}%`, transform: 'translate(-50%,-50%)' }}
        onPointerDown={(e) => { e.preventDefault(); setDragSun(true); }}
        title="Arrastra el sol para viajar en el tiempo"
      >
        <div className="sun-rays absolute -inset-10 rounded-full opacity-70" style={{ opacity: night ? 0 : 0.35 + irr * 0.5 }} />
        <div className="sun-core relative h-14 w-14 rounded-full md:h-16 md:w-16" style={{ opacity: night ? 0.25 : 1 }}>
          {!night && <Sun className="absolute inset-0 m-auto h-6 w-6 text-amber-900/60" />}
        </div>
        <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/60 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300 backdrop-blur">
          {fmtHour(p.timeH)} · {Math.round(elev)}°
        </div>
        {dragSun && <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-amber-400 px-2 py-0.5 font-mono text-[10px] font-bold text-black">VIAJANDO EN EL TIEMPO…</div>}
      </div>

      {/* Sunbeams to panel */}
      {!night && p.occlusion < 0.75 && (
        <svg className="pointer-events-none absolute inset-0 z-[7] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[0, 1, 2].map(i => (
            <line
              key={i}
              x1={sun.x} y1={sun.y * 0.72}
              x2={42 + (i - 1) * 7} y2={58}
              stroke={aligned ? '#fde047' : 'rgba(253,224,71,0.4)'}
              strokeWidth={aligned ? 0.55 : 0.3}
              strokeDasharray="2 1.4"
              style={{ animation: 'dashFlow 0.7s linear infinite', opacity: (1 - p.occlusion) * (aligned ? 1 : 0.5) }}
            />
          ))}
        </svg>
      )}

      {/* Mountains + ground */}
      {!p.mrActive && (
        <svg className="absolute inset-x-0 z-[3] h-[30%] w-full" style={{ top: '52%' }} viewBox="0 0 100 30" preserveAspectRatio="none">
          <path d="M0 30 L0 22 L12 10 L24 20 L38 6 L52 19 L66 12 L80 21 L92 14 L100 20 L100 30 Z" fill={night ? '#0a1128' : elev < 12 ? '#4a3a52' : '#5b7a8c'} opacity="0.9" />
          <path d="M0 30 L0 26 L20 16 L40 24 L60 17 L80 25 L100 20 L100 30 Z" fill={night ? '#060b1d' : elev < 12 ? '#3a2d42' : '#48647a'} />
        </svg>
      )}
      <div className="absolute inset-x-0 bottom-0 z-[3]" style={{ height: '32%', background: p.mrActive ? 'transparent' : groundGradient(elev) }}>
        {p.mrActive && <div className="mr-grid absolute inset-0" />}
        {!p.mrActive && <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/25 to-transparent" />}
      </div>

      {/* Ground shadow of rig */}
      <div className="absolute z-[4] h-6 w-64 rounded-[100%] bg-black/40 blur-md transition-all duration-500" style={{ left: `calc(42% + ${-azim * 0.35}px)`, bottom: '9%' }} />

      {/* ═════════ SOLAR RIG ═════════ */}
      <div className="absolute z-[8] flex flex-col items-center" style={{ left: '42%', bottom: '13%', transform: 'translateX(-50%)' }}>
        {/* alignment badge */}
        <div className={`mb-1 whitespace-nowrap rounded-full px-3 py-0.5 font-mono text-[11px] font-bold backdrop-blur transition-all ${aligned ? 'bg-lime-400/90 text-black' : Math.abs(p.angleError) > 20 ? 'bg-red-500/85 text-white' : 'bg-amber-400/85 text-black'}`}>
          {night ? '🌙 NOCHE — EN REPOSO' : aligned ? `◉ BLOQUEO SOLAR · ${p.power.toFixed(1)}W` : `△ ERROR ${p.angleError > 0 ? '+' : ''}${Math.round(p.angleError)}° · ${p.power.toFixed(1)}W`}
        </div>

        {/* Panel 3D */}
        <div style={{ perspective: '900px' }} className={p.mode === 'manual' ? 'grabbable' : ''} onPointerDown={(e) => { if (p.mode === 'manual') { e.preventDefault(); setDragPanel(true); } }} title={p.mode === 'manual' ? 'Arrastra para orientar el panel' : 'Modo AUTO — el servo sigue al sol'}>
          <motion.div
            animate={{ rotateX: tiltX, rotateY: -visRY }}
            transition={{ type: 'spring', stiffness: 60, damping: 14 }}
            className="relative h-36 w-60 md:h-44 md:w-72"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* frame */}
            <div className="absolute -inset-2 rounded-lg bg-gradient-to-br from-slate-200 via-slate-400 to-slate-500 shadow-[0_18px_40px_rgba(0,0,0,0.5)]" />
            <div className="absolute -inset-2 rounded-lg border-2 border-white/40" />
            {/* cells */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 gap-[2px] rounded bg-slate-300 p-[3px]">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="panel-cell rounded-[1px]">
                  {i % 6 === 2 && <div className="panel-bus absolute inset-y-0 left-1/2 w-[2px]" />}
                </div>
              ))}
              {/* glare */}
              <div className="pointer-events-none absolute inset-0 rounded overflow-hidden" style={{ opacity: clamp(irr * (1 - p.occlusion) * p.alignEff * 1.2, 0, 1) }}>
                <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent" style={{ animation: 'shimmer 2.6s ease-in-out infinite' }} />
              </div>
              {/* dust */}
              <div className="dust-overlay pointer-events-none absolute inset-0 rounded" style={{ opacity: p.dust / 130 }} />
              {/* side brackets */}
              <div className="absolute -left-4 top-1/2 h-14 w-3 -translate-y-1/2 rounded bg-gradient-to-b from-slate-300 to-slate-500" />
              <div className="absolute -right-4 top-1/2 h-14 w-3 -translate-y-1/2 rounded bg-gradient-to-b from-slate-300 to-slate-500" />
            </div>
            {p.mrActive && <div className="pointer-events-none absolute -inset-2 rounded-lg border border-cyan-300/60" style={{ boxShadow: '0 0 30px rgba(34,211,238,0.35), inset 0 0 30px rgba(34,211,238,0.15)' }} />}
          </motion.div>
        </div>

        {/* Servo motor */}
        <div className="relative z-10 -mt-1 flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-md border border-slate-500/60 bg-gradient-to-b from-slate-600 to-slate-800 px-3 py-1 shadow-lg">
            <div className={`h-2.5 w-2.5 rounded-full ${p.servoMoving ? 'bg-amber-300' : 'bg-emerald-400'}`} style={{ animation: p.servoMoving ? 'blinkLed 0.4s infinite' : 'none', color: p.servoMoving ? '#fcd34d' : '#34d399' }} />
            <span className="font-mono text-[9px] font-bold tracking-wider text-slate-200">SERVO 180° · {Math.round(p.panelAngle)}°</span>
            {p.servoMoving && <span className="font-mono text-[9px] text-amber-300">◀▶</span>}
          </div>
          <div className="h-10 w-5 bg-gradient-to-r from-slate-500 via-slate-700 to-slate-500 md:h-12" />
          {/* tripod */}
          <svg width="120" height="34" viewBox="0 0 120 34" className="drop-shadow-lg">
            <path d="M60 0 L20 30 M60 0 L100 30 M60 0 L60 30" stroke="#3f4a5f" strokeWidth="7" strokeLinecap="round" />
            <circle cx="60" cy="6" r="9" fill="#525f78" stroke="#2b3446" strokeWidth="2" />
            <circle cx="20" cy="30" r="4" fill="#2b3446" /><circle cx="100" cy="30" r="4" fill="#2b3446" /><circle cx="60" cy="30" r="4" fill="#2b3446" />
          </svg>
        </div>
      </div>

      {/* ═════════ CONTROL BOX + PHONES ═════════ */}
      <div className="absolute z-[8] flex items-end gap-3" style={{ right: '4%', bottom: '6%' }}>
        {/* control unit */}
        <div className="relative rounded-xl border border-slate-500/50 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-900 p-3 shadow-[0_16px_36px_rgba(0,0,0,0.55)]">
          <div className="mb-1 text-center font-mono text-[8px] font-bold tracking-widest text-slate-300">CONTROL UNIT / BATERÍA 12V</div>
          <div className="mb-2 flex items-center justify-center gap-1">
            <div className="h-1.5 w-10 overflow-hidden rounded-full bg-black/60"><div className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-400 transition-all" style={{ width: `${p.batteryPct}%` }} /></div>
            <span className="font-mono text-[9px] font-bold text-lime-300">{Math.round(p.batteryPct)}%</span>
          </div>
          <div className="flex gap-1.5">
            {p.phones.map(ph => (
              <button key={ph.id} onClick={() => p.onTogglePhone(ph.id)} title={`${ph.name} — clic para conectar/desconectar USB`}
                className={`flex flex-col items-center rounded-md border px-1.5 py-1 transition ${ph.plugged ? 'border-emerald-400/60 bg-emerald-500/10' : 'border-slate-500/50 bg-black/30 opacity-60'}`}>
                <span className="font-mono text-[8px] font-bold text-slate-300">USB{ph.id}</span>
                <div className="h-1 w-6 rounded bg-black/70" />
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full" style={{ background: ph.plugged ? '#34d399' : '#475569', animation: ph.plugged && p.charging ? 'blinkLed 1s infinite' : 'none', color: '#34d399' }} />
              </button>
            ))}
          </div>
          {p.charging && <Zap className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-amber-400 p-0.5 text-black" style={{ animation: 'boltFlash 0.8s infinite' }} />}
        </div>
      </div>

      {/* Phones row */}
      <div className="absolute inset-x-0 bottom-[2%] z-[9] flex items-end justify-center gap-3 pl-[38%] sm:pl-[28%] md:gap-5 lg:pl-[30%]">
        {p.phones.map(ph => {
          const isCharging = ph.plugged && p.charging && ph.pct < 100;
          return (
            <button key={ph.id} onClick={() => p.onTogglePhone(ph.id)} className="group relative flex flex-col items-center" title={`${ph.name} · ${Math.round(ph.pct)}% — clic para ${ph.plugged ? 'desconectar' : 'conectar'}`}>
              {/* cable */}
              {ph.plugged && (
                <svg className="absolute -top-9 left-1/2 h-10 w-16 -translate-x-1/2" viewBox="0 0 64 40">
                  <path d="M32 40 C 32 28, 10 26, 8 2" fill="none" stroke={isCharging ? '#4ade80' : '#334155'} strokeWidth="2.6" strokeDasharray={isCharging ? '5 3' : 'none'} style={isCharging ? { animation: 'chargeFlow 0.5s linear infinite' } : {}} />
                </svg>
              )}
              <div className={`phone-screen relative h-24 w-[52px] rounded-[12px] border-2 p-1 transition-all md:h-28 md:w-[60px] ${ph.plugged ? 'border-slate-500' : 'border-slate-700 opacity-70'} ${isCharging ? 'charging-glow border-emerald-400' : ''} ${ph.pct >= 100 ? 'border-lime-300' : ''}`}>
                <div className="mx-auto mb-1 h-1 w-6 rounded-full bg-slate-700" />
                <div className="flex h-8 items-center justify-center rounded bg-black/60 md:h-9">
                  <div className="h-3.5 w-8 rounded-[3px] border border-slate-400 p-[2px]">
                    <div className="h-full rounded-[1px] transition-all" style={{ width: `${ph.pct}%`, background: ph.pct >= 100 ? '#a3e635' : ph.pct > 20 ? '#4ade80' : '#f87171' }} />
                  </div>
                </div>
                <div className={`mt-0.5 text-center font-mono text-[11px] font-bold md:text-xs ${ph.pct >= 100 ? 'text-lime-300' : 'text-slate-100'}`}>{Math.round(ph.pct)}%</div>
                <div className="text-center font-mono text-[7px] text-slate-400">{ph.name}</div>
                {isCharging && <PlugZap className="absolute inset-x-0 bottom-6 mx-auto h-4 w-4 text-lime-300" style={{ animation: 'boltFlash 0.7s infinite' }} />}
                {ph.pct >= 100 && <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-lime-400 px-1.5 font-mono text-[8px] font-bold text-black">FULL</div>}
                {!ph.plugged && <Plug className="absolute inset-0 m-auto h-4 w-4 text-slate-600" />}
              </div>
              <span className={`mt-0.5 font-mono text-[8px] ${ph.plugged ? 'text-emerald-300' : 'text-slate-500'}`}>{ph.plugged ? '● USB ON' : '○ USB OFF'}</span>
            </button>
          );
        })}
      </div>

      {/* AR labels */}
      {p.arLabels && (
        <div className="pointer-events-none absolute inset-0 z-[12] hidden md:block">
          <div className="hud-chip absolute rounded-lg px-2.5 py-1.5" style={{ left: '6%', top: '38%' }}>
            <div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300" style={{ animation: 'blinkLed 1.6s infinite', color: '#67e8f9' }} /><span className="font-mono text-[10px] font-bold text-cyan-200">PANEL SOLAR · 20W · 18V</span></div>
            <div className="font-mono text-[9px] text-slate-400">η {Math.round(p.alignEff * 100)}% · {p.power.toFixed(1)}W</div>
            <div className="absolute left-full top-1/2 h-px w-16 bg-cyan-300/60" />
          </div>
          <div className="hud-chip absolute rounded-lg px-2.5 py-1.5" style={{ left: '8%', top: '66%' }}>
            <div className="font-mono text-[10px] font-bold text-cyan-200">SERVO · GIRO 180° · {p.mode}</div>
            <div className="font-mono text-[9px] text-slate-400">ángulo {Math.round(p.panelAngle)}° → sol {Math.round(azim)}°</div>
            <div className="absolute left-full top-1/2 h-px w-24 bg-cyan-300/60" />
          </div>
          <div className="hud-chip absolute rounded-lg px-2.5 py-1.5" style={{ right: '3%', top: '52%' }}>
            <div className="font-mono text-[10px] font-bold text-cyan-200">BATERÍA Li-ion 10Ah</div>
            <div className="font-mono text-[9px] text-slate-400">{Math.round(p.batteryPct)}% · SALIDA USB ×3</div>
          </div>
        </div>
      )}

      {/* Weather overlays */}
      {p.dustStorm && (
        <div className="pointer-events-none absolute inset-0 z-[10] bg-amber-700/25 backdrop-blur-[1px]">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="absolute h-1 w-8 rounded bg-amber-200/60" style={{ left: `${(i * 29) % 100}%`, top: `${(i * 41) % 100}%`, animation: `drift ${2 + (i % 4)}s linear infinite` }} />
          ))}
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500/90 px-4 py-1 font-mono text-xs font-bold text-black"><CloudRainWind className="h-4 w-4" /> TORMENTA DE POLVO — ¡LIMPIA EL PANEL!</div>
        </div>
      )}
      {p.heatWave && !night && (
        <div className="heat-haze pointer-events-none absolute inset-0 z-[10] bg-red-500/10">
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-red-500/90 px-4 py-1 font-mono text-xs font-bold text-white">🔥 OLA DE CALOR — η térmica reducida</div>
        </div>
      )}
      {p.occlusion > 0.55 && !night && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[10] -translate-x-1/2 rounded-full bg-slate-800/85 px-4 py-1 font-mono text-xs font-bold text-slate-200 backdrop-blur">☁️ SOL BLOQUEADO {(p.occlusion * 100).toFixed(0)}% — toca las nubes</div>
      )}

      {/* Floating messages */}
      <div className="pointer-events-none absolute inset-0 z-[20]">
        <AnimatePresence>
          {p.floatMsgs.map(m => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: -44, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className={`absolute rounded-lg px-3 py-1 font-mono text-sm font-bold backdrop-blur ${m.kind === 'good' ? 'bg-lime-400/90 text-black' : m.kind === 'bad' ? 'bg-red-500/90 text-white' : m.kind === 'energy' ? 'bg-amber-400/90 text-black' : 'bg-cyan-400/90 text-black'}`}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}>
              {m.text}{m.sub && <div className="text-[10px] font-medium opacity-80">{m.sub}</div>}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* MR frame corners */}
      <div className="corner left-2 top-2 border-l-2 border-t-2" />
      <div className="corner right-2 top-2 border-r-2 border-t-2" />
      <div className="corner bottom-2 left-2 border-b-2 border-l-2" />
      <div className="corner bottom-2 right-2 border-b-2 border-r-2" />
      <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-3 py-1 backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${p.mrActive ? 'bg-red-500' : 'bg-cyan-400'}`} style={{ animation: 'blinkLed 1.2s infinite', color: p.mrActive ? '#ef4444' : '#22d3ee' }} />
        <span className="font-mono text-[10px] font-bold tracking-widest text-white/90">{p.mrActive ? (camError ? 'MR SIMULADO · SIN CÁMARA' : '● MERGED REALITY · CÁMARA VIVA') : 'SIMULACIÓN MR · HELIOS-1'}</span>
      </div>
      {camError && p.mrActive && <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 rounded bg-red-500/80 px-3 py-1 font-mono text-[10px] text-white">{camError}</div>}
    </div>
  );
}
