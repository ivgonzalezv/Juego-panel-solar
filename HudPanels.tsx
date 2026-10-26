import { motion } from 'framer-motion';
import {
  Zap, Sun, Gauge, BatteryCharging, Play, Pause, Bot, Hand,
  Cloud, Wind, Flame, Sparkles, Smartphone, Target, Cpu, CheckCircle2,
  PlugZap, Plug, Video, VideoOff, Tags, Volume2, VolumeX, RotateCcw, Trophy, Activity,
} from 'lucide-react';
import { Mission, PhoneState, clamp, fmtHour } from '../game/engine';

/* ── shared bits ── */
function Card({ title, icon, children, className = '' }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`hud-glass rounded-xl p-3 ${className}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-cyan-300">{icon}</span>
        <h3 className="font-mono text-[11px] font-bold tracking-widest text-slate-300">{title}</h3>
      </div>
      {children}
    </div>
  );
}
function StatRow({ label, value, accent = 'text-slate-100', bar, barColor = 'bg-cyan-400' }: { label: string; value: string; accent?: string; bar?: number; barColor?: string }) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between font-mono text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className={`font-bold ${accent}`}>{value}</span>
      </div>
      {bar !== undefined && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${clamp(bar, 0, 100)}%` }} />
        </div>
      )}
    </div>
  );
}
function PowerGauge({ power }: { power: number }) {
  const pct = clamp(power / 20, 0, 1);
  const arc = 2 * Math.PI * 44;
  return (
    <div className="relative mx-auto h-32 w-32">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle cx="50" cy="50" r="44" fill="none" stroke={power > 12 ? '#a3e635' : power > 4 ? '#fbbf24' : '#38bdf8'}
          strokeWidth="9" strokeLinecap="round" strokeDasharray={arc} strokeDashoffset={arc * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .3s, stroke .3s', filter: `drop-shadow(0 0 6px ${power > 12 ? '#a3e635' : power > 4 ? '#fbbf24' : '#38bdf8'})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold text-white">{power.toFixed(1)}</span>
        <span className="font-mono text-[10px] tracking-widest text-slate-400">WATTS · 20W MAX</span>
      </div>
    </div>
  );
}
function ServoDial({ panel, sun }: { panel: number; sun: number }) {
  const toXY = (deg: number, r: number) => {
    const rad = ((deg + 90) / 180) * Math.PI;
    return { x: 60 + Math.cos(rad) * r, y: 58 - Math.sin(rad) * r };
  };
  const pPt = toXY(panel, 40); const sPt = toXY(sun, 40);
  return (
    <svg viewBox="0 0 120 66" className="w-full">
      <path d="M 14 58 A 46 46 0 0 1 106 58" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round" />
      {[-90, -45, 0, 45, 90].map(d => {
        const a = toXY(d, 46); const b = toXY(d, 40);
        return <line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />;
      })}
      <line x1="60" y1="58" x2={sPt.x} y2={sPt.y} stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="4 2" />
      <circle cx={sPt.x} cy={sPt.y} r="5" fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 5px #fbbf24)' }} />
      <line x1="60" y1="58" x2={pPt.x} y2={pPt.y} stroke="#22d3ee" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="60" cy="58" r="6" fill="#1e293b" stroke="#22d3ee" strokeWidth="2" />
      <text x="8" y="64" fontSize="7" fill="#94a3b8" fontFamily="monospace">E·6h</text>
      <text x="98" y="64" fontSize="7" fill="#94a3b8" fontFamily="monospace">20h·O</text>
    </svg>
  );
}

/* ═══ LEFT : telemetry ═══ */
export interface LeftProps {
  power: number; voltage: number; current: number; irradiance: number;
  totalEff: number; alignEff: number; temp: number; angleError: number;
  panelAngle: number; sunAngle: number; batteryPct: number;
  energyToday: number; occlusion: number; dust: number; charging: boolean;
}
export function LeftPanel(s: LeftProps) {
  return (
    <div className="flex flex-col gap-3">
      <Card title="POTENCIA FOTOVOLTAICA" icon={<Zap className="h-3.5 w-3.5" />}>
        <PowerGauge power={s.power} />
        <div className="mt-1 grid grid-cols-2 gap-x-3">
          <StatRow label="Voltaje" value={`${s.voltage.toFixed(1)} V`} accent="text-amber-300" />
          <StatRow label="Corriente" value={`${s.current.toFixed(2)} A`} accent="text-amber-300" />
          <StatRow label="Irradiancia" value={`${Math.round(s.irradiance)} W/m²`} accent="text-orange-300" />
          <StatRow label="Temperatura" value={`${s.temp.toFixed(1)}°C`} accent={s.temp > 45 ? 'text-red-400' : 'text-slate-100'} />
        </div>
      </Card>
      <Card title="SEGUIMIENTO SOLAR · SERVO 180°" icon={<Sun className="h-3.5 w-3.5" />}>
        <ServoDial panel={s.panelAngle} sun={s.sunAngle} />
        <StatRow label="Error de apunte" value={`${s.angleError > 0 ? '+' : ''}${s.angleError.toFixed(1)}°`} accent={Math.abs(s.angleError) < 8 ? 'text-lime-300' : 'text-red-400'} />
        <StatRow label="Eficiencia de apunte" value={`${Math.round(s.alignEff * 100)}%`} bar={s.alignEff * 100} barColor="bg-cyan-400" />
        <StatRow label="Eficiencia total" value={`${Math.round(s.totalEff * 100)}%`} bar={s.totalEff * 100} barColor="bg-lime-400" />
      </Card>
      <Card title="BATERÍA Li-ion 12V · 10Ah" icon={<BatteryCharging className="h-3.5 w-3.5" />}>
        <div className="flex items-center gap-2">
          <div className="relative h-6 flex-1 overflow-hidden rounded-md border border-slate-500 bg-black/50 p-[3px]">
            <div className="h-full rounded-sm bg-gradient-to-r from-lime-500 via-lime-400 to-emerald-300 transition-all" style={{ width: `${s.batteryPct}%`, boxShadow: s.charging ? '0 0 12px rgba(163,230,53,0.8)' : 'none' }} />
            {s.charging && <div className="absolute inset-y-0 w-10 bg-white/25 blur-sm" style={{ animation: 'shimmer 1.6s linear infinite' }} />}
          </div>
          <span className="font-mono text-sm font-bold text-lime-300">{Math.round(s.batteryPct)}%</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-x-3">
          <StatRow label="Energía hoy" value={`${s.energyToday.toFixed(1)} Wh`} accent="text-amber-300" />
          <StatRow label="Nubes bloq." value={`${Math.round(s.occlusion * 100)}%`} accent={s.occlusion > 0.5 ? 'text-slate-100' : 'text-slate-400'} />
          <StatRow label="Polvo panel" value={`${Math.round(s.dust)}%`} accent={s.dust > 40 ? 'text-amber-400' : 'text-slate-400'} bar={s.dust} barColor="bg-amber-500" />
          <StatRow label="Estado" value={s.charging ? 'CARGANDO' : 'EN ESPERA'} accent={s.charging ? 'text-emerald-300' : 'text-slate-400'} />
        </div>
      </Card>
    </div>
  );
}

/* ═══ RIGHT : controls ═══ */
export interface RightProps {
  mode: 'auto' | 'manual'; panelAngle: number; timeH: number; playing: boolean; speed: number;
  cloudCover: number; phones: PhoneState[]; missions: Mission[];
  mrActive: boolean; arLabels: boolean; muted: boolean;
  onMode: (m: 'auto' | 'manual') => void; onPanel: (a: number) => void;
  onPlay: (v: boolean) => void; onSpeed: (n: number) => void; onTime: (h: number) => void;
  onClouds: (n: number) => void; onEvent: (k: 'clouds' | 'dust' | 'heat') => void; onClean: () => void;
  onTogglePhone: (id: number) => void; onMR: () => void; onAR: () => void; onMute: () => void; onReset: () => void;
}
const missionIcon = (id: string) => {
  const c = 'h-4 w-4';
  if (id === 'target') return <Target className={c} />; if (id === 'zap') return <Zap className={c} />;
  if (id === 'phone') return <Smartphone className={c} />; if (id === 'cloud') return <Cloud className={c} />;
  return <Cpu className={c} />;
};
export function RightPanel(r: RightProps) {
  return (
    <div className="flex flex-col gap-3">
      <Card title="MODO SERVO" icon={<Bot className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => r.onMode('auto')} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 font-mono text-xs font-bold transition ${r.mode === 'auto' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.3)]' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25'}`}>
            <Bot className="h-4 w-4" /> AUTO
          </button>
          <button onClick={() => r.onMode('manual')} className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 font-mono text-xs font-bold transition ${r.mode === 'manual' ? 'border-amber-400 bg-amber-400/15 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.3)]' : 'border-white/10 bg-white/5 text-slate-400 hover:border-white/25'}`}>
            <Hand className="h-4 w-4" /> MANUAL
          </button>
        </div>
        {r.mode === 'manual' ? (
          <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2">
            <div className="mb-1 flex justify-between font-mono text-[11px]"><span className="text-amber-200">Ángulo servo</span><span className="font-bold text-amber-300">{Math.round(r.panelAngle)}°</span></div>
            <input type="range" min={-90} max={90} step={1} value={r.panelAngle} onChange={e => r.onPanel(Number(e.target.value))} className="amber w-full" />
            <p className="mt-1 font-mono text-[10px] text-amber-200/70">Arrastra el panel en la escena o usa el deslizador. ¡Sigue al sol!</p>
          </div>
        ) : (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-slate-400">El servo persigue al sol solo. Cambia a <b className="text-amber-300">MANUAL</b> para jugar tú y ganar la misión Servo Master.</p>
        )}
      </Card>

      <Card title="TIEMPO SOLAR" icon={<Sun className="h-3.5 w-3.5" />}>
        <div className="mb-2 flex items-center gap-2">
          <button onClick={() => r.onPlay(!r.playing)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/35">
            {r.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          {[1, 4, 12].map(s => (
            <button key={s} onClick={() => { r.onSpeed(s); r.onPlay(true); }} className={`flex-1 rounded-lg border px-1 py-2 font-mono text-xs font-bold transition ${r.speed === s ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/10 bg-white/5 text-slate-400'}`}>{s}x</button>
          ))}
        </div>
        <div className="flex justify-between font-mono text-[11px]"><span className="text-slate-400">06:00</span><span className="font-bold text-amber-300">{fmtHour(r.timeH)}</span><span className="text-slate-400">20:00</span></div>
        <input type="range" min={6} max={20} step={0.02} value={r.timeH} onChange={e => r.onTime(Number(e.target.value))} className="amber w-full" />
        <p className="font-mono text-[10px] text-slate-500">Tip: arrastra el ☀️ en la escena para viajar en el tiempo.</p>
      </Card>

      <Card title="ENTORNO · CLIMA" icon={<Activity className="h-3.5 w-3.5" />}>
        <div className="mb-1 flex justify-between font-mono text-[11px]"><span className="text-slate-300">Nubosidad</span><span className="font-bold text-slate-100">{Math.round(r.cloudCover)}%</span></div>
        <input type="range" min={0} max={100} value={r.cloudCover} onChange={e => r.onClouds(Number(e.target.value))} className="w-full" />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          <button onClick={() => r.onEvent('clouds')} title="Invocar racha de nubes" className="flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 py-2 text-slate-300 transition hover:border-sky-400/60 hover:text-sky-300"><Cloud className="h-4 w-4" /><span className="font-mono text-[8px]">NUBES</span></button>
          <button onClick={() => r.onEvent('dust')} title="Tormenta de polvo" className="flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 py-2 text-slate-300 transition hover:border-amber-400/60 hover:text-amber-300"><Wind className="h-4 w-4" /><span className="font-mono text-[8px]">POLVO</span></button>
          <button onClick={() => r.onEvent('heat')} title="Ola de calor" className="flex flex-col items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 py-2 text-slate-300 transition hover:border-red-400/60 hover:text-red-300"><Flame className="h-4 w-4" /><span className="font-mono text-[8px]">CALOR</span></button>
          <button onClick={r.onClean} title="Limpiar panel" className="flex flex-col items-center gap-0.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 py-2 text-emerald-300 transition hover:bg-emerald-400/20"><Sparkles className="h-4 w-4" /><span className="font-mono text-[8px]">LIMPIAR</span></button>
        </div>
      </Card>

      <Card title="SALIDAS USB ×3 · CELULARES" icon={<Smartphone className="h-3.5 w-3.5" />}>
        <div className="flex flex-col gap-1.5">
          {r.phones.map(ph => (
            <button key={ph.id} onClick={() => r.onTogglePhone(ph.id)} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${ph.plugged ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-white/10 bg-white/[0.02] opacity-70'}`}>
              {ph.plugged ? <PlugZap className="h-4 w-4 shrink-0 text-emerald-300" /> : <Plug className="h-4 w-4 shrink-0 text-slate-500" />}
              <div className="min-w-0 flex-1">
                <div className="flex justify-between font-mono text-[11px]"><span className="font-bold text-slate-200">{ph.name}</span><span className={ph.pct >= 100 ? 'font-bold text-lime-300' : 'text-slate-300'}>{Math.round(ph.pct)}%</span></div>
                <div className="h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-300" style={{ width: `${ph.pct}%` }} /></div>
              </div>
              <span className={`font-mono text-[9px] font-bold ${ph.plugged ? 'text-emerald-300' : 'text-slate-500'}`}>{ph.plugged ? 'ON' : 'OFF'}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="MISIONES · GANA XP" icon={<Trophy className="h-3.5 w-3.5" />}>
        <div className="flex flex-col gap-2">
          {r.missions.map(m => (
            <motion.div key={m.id} layout className={`rounded-lg border p-2 ${m.done ? 'border-lime-400/50 bg-lime-400/10' : 'border-white/10 bg-white/[0.03]'}`}>
              <div className="flex items-center gap-2">
                <span className={m.done ? 'text-lime-300' : 'text-cyan-300'}>{m.done ? <CheckCircle2 className="h-4 w-4" /> : missionIcon(m.icon)}</span>
                <span className="flex-1 font-mono text-[11px] font-bold text-slate-100">{m.title}</span>
                <span className="font-mono text-[10px] font-bold text-amber-300">+{m.xp} XP</span>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-slate-400">{m.desc}</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                <div className={`h-full rounded-full transition-all ${m.done ? 'bg-lime-400' : 'bg-cyan-400'}`} style={{ width: `${clamp((m.progress / m.target) * 100, 0, 100)}%` }} />
              </div>
              <div className="mt-0.5 text-right font-mono text-[9px] text-slate-500">{m.done ? 'COMPLETADA ✓' : `${Math.floor(m.progress)}/${m.target}`}</div>
            </motion.div>
          ))}
        </div>
      </Card>

      <Card title="REALIDAD MIXTA" icon={<Gauge className="h-3.5 w-3.5" />}>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={r.onMR} className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 font-mono text-[11px] font-bold transition ${r.mrActive ? 'border-red-400 bg-red-400/15 text-red-200' : 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'}`}>
            {r.mrActive ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />} {r.mrActive ? 'MR OFF' : 'MR CÁMARA'}
          </button>
          <button onClick={r.onAR} className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 font-mono text-[11px] font-bold transition ${r.arLabels ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/10 text-slate-400'}`}>
            <Tags className="h-3.5 w-3.5" /> ETIQUETAS
          </button>
          <button onClick={r.onMute} className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2 font-mono text-[11px] font-bold text-slate-300 transition hover:border-white/25">
            {r.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />} {r.muted ? 'SILENCIO' : 'SONIDO'}
          </button>
          <button onClick={r.onReset} className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2 font-mono text-[11px] font-bold text-slate-300 transition hover:border-white/25">
            <RotateCcw className="h-3.5 w-3.5" /> NUEVO DÍA
          </button>
        </div>
      </Card>
    </div>
  );
}
