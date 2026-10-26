import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Sun, Zap, Trophy, CalendarDays, HelpCircle, Rocket, X,
  Smartphone, BatteryCharging, Bot, MoveHorizontal, Cloud, MousePointerClick, Video,
} from 'lucide-react';
import Scene from './components/Scene';
import { LeftPanel, RightPanel } from './components/HudPanels';
import {
  Cloud as CloudT, PhoneState, Mission, FloatMsg, LogEntry,
  sunAzimuth, sunElevation, sunXY, cloudOcclusion, initialMissions, initialClouds,
  clamp, lerp, fmtHour, setMuted as setAudioMuted, sfx, DAY_END, BAT_WH, PHONE_WH,
} from './game/engine';

interface Stats { power: number; voltage: number; current: number; irradiance: number; alignEff: number; totalEff: number; temp: number; angleError: number; occlusion: number; servoMoving: boolean; charging: boolean; }

const initialPhones = (): PhoneState[] => [
  { id: 1, name: 'Pixel Nova', pct: 18 + Math.random() * 20, plugged: true, color: '#4ade80', done: false },
  { id: 2, name: 'iPhone Aura', pct: 30 + Math.random() * 25, plugged: true, color: '#60a5fa', done: false },
  { id: 3, name: 'Galaxy Pulso', pct: 8 + Math.random() * 18, plugged: false, color: '#f472b6', done: false },
];

export default function App() {
  // ── core state ──
  const [timeH, setTimeH] = useState(8.4);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [panelAngle, setPanelAngle] = useState(-55);
  const [clouds, setClouds] = useState<CloudT[]>(() => initialClouds(4));
  const [cloudCover, setCloudCover] = useState(35);
  const [dust, setDust] = useState(12);
  const [batteryPct, setBatteryPct] = useState(38);
  const [phones, setPhones] = useState<PhoneState[]>(initialPhones);
  const [energyToday, setEnergyToday] = useState(0);
  const [energyTotal, setEnergyTotal] = useState(0);
  const [xp, setXp] = useState(0);
  const [missions, setMissions] = useState<Mission[]>(() => {
    const m = initialMissions();
    m.find(x => x.id === 'wh')!.desc = 'Genera 60 Wh de energía acumulada';
    m.find(x => x.id === 'phones')!.desc = 'Carga celulares al 100% (×3 acumulado)';
    return m;
  });
  const [stats, setStats] = useState<Stats>({ power: 0, voltage: 0, current: 0, irradiance: 0, alignEff: 0, totalEff: 0, temp: 25, angleError: 0, occlusion: 0, servoMoving: false, charging: false });
  const [mrActive, setMrActive] = useState(false);
  const [arLabels, setArLabels] = useState(true);
  const [muted, setMut] = useState(false);
  const [day, setDay] = useState(1);
  const [floatMsgs, setFloatMsgs] = useState<FloatMsg[]>([]);
  const [log, setLog] = useState<LogEntry[]>([{ id: 1, t: fmtHour(8.4), msg: 'Sistema HELIOS-1 en línea. Servo calibrado a 180°.', kind: 'good' }]);
  const [showIntro, setShowIntro] = useState(true);
  const [showDayEnd, setShowDayEnd] = useState(false);
  const [dayStats, setDayStats] = useState({ energy: 0, peak: 0, full: 0 });

  // ── refs ──
  const R = useRef({ timeH, playing, speed, mode, panelAngle, clouds, dust, batteryPct, phones, energyToday, energyTotal, xp, missions, powerSm: 0, peak: 0, streak: 0, popped: 0, fullEver: 0, fullToday: 0, dustUntil: 0, heatUntil: 0, level: 1, tick: 0, cloudCoverRef: 35 });
  R.current = { ...R.current, timeH, playing, speed, mode, panelAngle, clouds, dust, batteryPct, phones, energyToday, energyTotal, xp, missions };
  const idC = useRef(100);

  const addLog = useCallback((msg: string, kind: LogEntry['kind'] = 'info') => {
    const id = ++idC.current;
    setLog(prev => [{ id, t: fmtHour(R.current.timeH), msg, kind }, ...prev].slice(0, 24));
  }, []);
  const addFloat = useCallback((text: string, kind: FloatMsg['kind'], x = 50, y = 30, sub?: string) => {
    const id = ++idC.current;
    setFloatMsgs(prev => [...prev.slice(-5), { id, text, kind, x, y, sub }]);
    setTimeout(() => setFloatMsgs(prev => prev.filter(m => m.id !== id)), 1600);
  }, []);

  const completeMission = useCallback((id: string) => {
    const m = R.current.missions.find(x => x.id === id);
    if (!m || m.done) return;
    setMissions(prev => prev.map(x => x.id === id ? { ...x, done: true, progress: x.target } : x));
    setXp(v => v + m.xp);
    addFloat(`MISIÓN ✓ ${m.title}`, 'good', 50, 26, `+${m.xp} XP`);
    addLog(`Misión completada: ${m.title} (+${m.xp} XP)`, 'good');
    sfx.good();
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.55 }, colors: ['#22d3ee', '#a3e635', '#fbbf24', '#ffffff'] });
  }, [addFloat, addLog]);

  // ── main loop ──
  useEffect(() => {
    const id = setInterval(() => {
      const s = R.current;
      if (!s.playing || showIntro || showDayEnd) return;
      const dt = 0.1;
      s.tick++;
      const minPerSec = s.speed === 1 ? 6 : s.speed === 4 ? 24 : 72;
      const gH = ((dt * minPerSec) / 60);

      // time
      let nt = s.timeH + gH;
      if (nt >= DAY_END) {
        nt = DAY_END;
        setTimeH(nt);
        setPlaying(false);
        setDayStats({ energy: s.energyToday, peak: s.peak, full: s.fullToday });
        setShowDayEnd(true);
        sfx.full();
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.5 } });
        return;
      }
      setTimeH(nt);

      const elev = sunElevation(nt);
      const az = sunAzimuth(nt);
      const sun = sunXY(nt);
      const night = elev <= 0.5;

      // clouds drift + auto spawn
      const drift = dt * (0.35 + s.speed * 0.12);
      let cl = s.clouds.map(c => ({ ...c, x: c.x + c.speed * drift }));
      cl = cl.filter(c => c.x < 112);
      const target = Math.round((R.current.cloudCoverRef) / 100 * 6);
      if (cl.length < target && Math.random() < 0.06) {
        cl.push({ id: Date.now() + Math.random(), x: -10, y: 5 + Math.random() * 32, scale: 0.7 + Math.random() * 0.9, speed: 0.6 + Math.random() * 1.4, opacity: 0.8 + Math.random() * 0.2, dark: Math.random() * 0.8 });
      }
      setClouds(cl);

      // dust
      const dustStorm = Date.now() < s.dustUntil;
      const heat = Date.now() < s.heatUntil;
      setDust(d => clamp(d + gH * 1.1 + (dustStorm ? dt * 2.2 : 0), 0, 100));

      // servo
      const goal = s.mode === 'auto' ? (night ? 0 : az) : s.panelAngle;
      const cur = s.mode === 'auto' ? s.panelAngle : s.panelAngle;
      const diff = goal - cur;
      const maxStep = 26 * dt;
      const next = s.mode === 'auto' ? cur + clamp(diff, -maxStep, maxStep) : cur;
      if (s.mode === 'auto' && Math.abs(diff) > 0.05) setPanelAngle(next);
      const moving = Math.abs((s.mode === 'auto' ? goal : az) - cur) > 0.6;
      if (moving && s.tick % 12 === 0) sfx.servo();

      // physics
      const occ = night ? 0 : cloudOcclusion(cl, sun.x);
      const irr = night ? 0 : Math.sin((elev / 68) * Math.PI / 2) * 1000 * (1 - occ);
      const err = cur - az;
      const align = night ? 0 : Math.pow(Math.max(0, Math.cos((err * Math.PI) / 180)), 1.15);
      const temp = (night ? 20 : 24) + (irr / 1000) * 16 + (heat ? 11 : 0);
      const thermal = 1 - Math.max(0, temp - 25) * 0.004;
      const dustF = 1 - (s.dust / 100) * 0.35;
      const pTarget = 20 * (irr / 1000) * align * thermal * dustF;
      s.powerSm = lerp(s.powerSm, pTarget, 0.25);
      const power = Math.max(0, s.powerSm);
      s.peak = Math.max(s.peak, power);
      const voltage = night ? 0.3 : 18.4 * clamp((irr / 1000) * 0.65 + align * 0.35, 0.03, 1);
      const current = voltage > 0.5 ? power / voltage : 0;
      const totalEff = clamp((power / 20) * (night ? 0 : 1), 0, 1);

      const dWh = power * gH;
      setEnergyToday(v => v + dWh);
      setEnergyTotal(v => v + dWh);

      // phones + battery
      const active = s.phones.filter(ph => ph.plugged && ph.pct < 100);
      const canDraw = power > 0.25 || s.batteryPct > 2;
      const chargingNow = active.length > 0 && canDraw;
      let perPhone = 0;
      if (chargingNow) {
        const supply = power + (s.batteryPct > 2 ? 10 : 0);
        perPhone = Math.min(3.2, supply / active.length);
        setPhones(prev => prev.map(ph => {
          if (!ph.plugged || ph.pct >= 100) return ph;
          const np = clamp(ph.pct + ((perPhone * gH) / PHONE_WH) * 100, 0, 100);
          if (np >= 100 && !ph.done) {
            queueMicrotask(() => {
              setXp(v => v + 60);
              s.fullEver++; s.fullToday++;
              addFloat(`¡${ph.name} 100%!`, 'good', 68, 72, '+60 XP · USB libre');
              addLog(`${ph.name} cargado al 100% (+60 XP)`, 'good');
              sfx.full();
              confetti({ particleCount: 50, spread: 60, origin: { x: 0.72, y: 0.75 }, colors: ['#4ade80', '#a3e635', '#ffffff'] });
              setMissions(pm => pm.map(m => m.id === 'phones' ? { ...m, progress: s.fullEver } : m));
              if (s.fullEver >= 3) completeMission('phones');
            });
            return { ...ph, pct: 100, done: true };
          }
          return { ...ph, pct: np };
        }));
      }
      const consumption = perPhone * active.length;
      setBatteryPct(b => clamp(b + ((power - consumption) * gH / BAT_WH) * 100, 0, 100));

      setStats({ power, voltage, current, irradiance: irr, alignEff: align, totalEff, temp, angleError: err, occlusion: occ, servoMoving: moving, charging: chargingNow });

      // missions
      setMissions(prev => prev.map(m => {
        if (m.done) return m;
        if (m.id === 'eff') return { ...m, progress: Math.max(m.progress, align * 100) };
        if (m.id === 'wh') return { ...m, progress: s.energyTotal + dWh };
        return m;
      }));
      const effM = s.missions.find(m => m.id === 'eff');
      if (effM && !effM.done && align * 100 >= 90 && !night) completeMission('eff');
      const whM = s.missions.find(m => m.id === 'wh');
      if (whM && !whM.done && s.energyTotal + dWh >= 60) completeMission('wh');

      if (s.mode === 'manual' && Math.abs(err) < 6 && !night && irr > 180) {
        s.streak += dt;
        setMissions(prev => prev.map(m => (m.id === 'track' && !m.done ? { ...m, progress: Math.max(m.progress, s.streak) } : m)));
        if (s.streak >= 45) {
          const t = s.missions.find(m => m.id === 'track');
          if (t && !t.done) completeMission('track');
        }
      } else {
        s.streak = Math.max(0, s.streak - dt * 2);
      }

      // level
      const lv = Math.floor(Math.sqrt(s.xp / 120)) + 1;
      if (lv > s.level) {
        s.level = lv;
        addFloat(`NIVEL ${lv}`, 'info', 50, 40, 'Operador solar ascendido');
        addLog(`Subiste a nivel ${lv}. ¡El sol te respeta!`, 'good');
        sfx.good();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showIntro, showDayEnd, cloudCover, completeMission]);

  // cloudCover mirror for loop
  (R.current as any).cloudCoverRef = cloudCover;

  // keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); setPlaying(v => !v); }
      if (e.key === 'ArrowRight') setTimeH(t => clamp(t + 0.25, 6, 20));
      if (e.key === 'ArrowLeft') setTimeH(t => clamp(t - 0.25, 6, 20));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // ── actions ──
  const onCloudCover = (v: number) => {
    setCloudCover(v);
    setClouds(prev => {
      const target = Math.round((v / 100) * 6);
      if (prev.length < target) {
        const add = Array.from({ length: target - prev.length }, () => ({
          id: Date.now() + Math.random(), x: Math.random() * 100, y: 5 + Math.random() * 32,
          scale: 0.7 + Math.random() * 0.9, speed: 0.6 + Math.random() * 1.4, opacity: 0.8 + Math.random() * 0.2, dark: Math.random() * 0.8,
        }));
        return [...prev, ...add];
      }
      return prev.slice(0, Math.max(0, target));
    });
  };
  const popCloud = (id: number) => {
    const c = clouds.find(x => x.id === id);
    if (!c) return;
    setClouds(prev => prev.filter(x => x.id !== id));
    R.current.popped++;
    setXp(v => v + 8);
    setMissions(prev => prev.map(m => (m.id === 'clouds' && !m.done ? { ...m, progress: R.current.popped } : m)));
    addFloat('NUBE DISIPADA', 'info', clamp(c.x, 10, 90), c.y + 8, '+8 XP');
    addLog('Nube disipada manualmente (+8 XP)', 'info');
    sfx.pop();
    if (R.current.popped >= 5) {
      const m = R.current.missions.find(x => x.id === 'clouds');
      if (m && !m.done) completeMission('clouds');
    }
  };
  const fireEvent = (k: 'clouds' | 'dust' | 'heat') => {
    if (k === 'clouds') {
      const sx = sunXY(timeH).x;
      setClouds(prev => [...prev, ...Array.from({ length: 3 }, (_, i) => ({
        id: Date.now() + i, x: sx - 14 + i * 12, y: 8 + Math.random() * 18, scale: 1 + Math.random() * 0.5,
        speed: 1 + Math.random(), opacity: 0.95, dark: 0.8,
      }))].slice(-9));
      addLog('Racha de nubes densas sobre el sol. ¡Tócalas para disiparlas!', 'warn');
      addFloat('RACHA DE NUBES', 'bad', 50, 18);
      sfx.warn();
    }
    if (k === 'dust') {
      R.current.dustUntil = Date.now() + 12000;
      setDust(d => clamp(d + 12, 0, 100));
      addLog('Tormenta de polvo: el panel se ensucia rápido', 'warn');
      sfx.warn();
    }
    if (k === 'heat') {
      R.current.heatUntil = Date.now() + 20000;
      addLog('Ola de calor: eficiencia térmica reducida', 'warn');
      sfx.warn();
    }
  };
  const clean = () => {
    if (dust < 3) { addFloat('PANEL YA LIMPIO', 'info', 42, 40); return; }
    setDust(0); setXp(v => v + 5);
    addFloat('PANEL LIMPIO ✨', 'good', 42, 38, '+5 XP · η restaurada');
    addLog('Panel limpiado. Eficiencia restaurada (+5 XP)', 'good');
    sfx.good();
  };
  const togglePhone = (id: number) => {
    setPhones(prev => prev.map(p => (p.id === id ? { ...p, plugged: !p.plugged } : p)));
    const ph = phones.find(p => p.id === id);
    addLog(`${ph?.name} ${ph?.plugged ? 'desconectado de' : 'conectado a'} USB${id}`, 'info');
    sfx.toggle();
  };
  const newDay = (next: number) => {
    setDay(next);
    setTimeH(6.15);
    setEnergyToday(0);
    R.current.peak = 0; R.current.fullToday = 0; R.current.streak = 0;
    setPhones(initialPhones());
    setClouds(initialClouds(Math.round((cloudCover / 100) * 5) + 1));
    setDust(d => Math.max(4, d - 12));
    setPanelAngle(-80);
    setPlaying(true);
    setShowDayEnd(false);
    addLog(`Día ${next} iniciado. Panel orientado al este. ¡A cazar fotones!`, 'good');
  };

  const level = Math.floor(Math.sqrt(xp / 120)) + 1;
  const score = Math.round(energyTotal * 10 + xp);
  const elev = sunElevation(timeH);
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setNowTick(Date.now()), 500); return () => clearInterval(i); }, []);
  const stormOn = nowTick < R.current.dustUntil;
  const heatOn = nowTick < R.current.heatUntil;

  return (
    <div className="flex min-h-screen flex-col bg-[#04060c]">
      {/* ══ HEADER ══ */}
      <header className="hud-glass z-30 flex flex-wrap items-center gap-2 border-x-0 border-t-0 px-3 py-2 md:gap-4 md:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-orange-500 to-rose-500 shadow-[0_0_24px_rgba(251,146,60,0.5)]">
            <Sun className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none tracking-wide text-white md:text-base">HELIOS <span className="text-cyan-300">TRACKER</span></h1>
            <p className="font-mono text-[9px] tracking-widest text-slate-400 md:text-[10px]">MIXED REALITY SOLAR LAB · 20W + SERVO 180°</p>
          </div>
        </div>
        <div className="mx-auto flex flex-wrap items-center justify-center gap-1.5 md:gap-2">
          <span className="hud-chip flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-bold text-slate-200"><CalendarDays className="h-3.5 w-3.5 text-cyan-300" /> DÍA {day} · {fmtHour(timeH)}</span>
          <span className="hud-chip flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-bold text-amber-200"><Zap className="h-3.5 w-3.5 text-amber-300" /> {energyToday.toFixed(1)} Wh hoy</span>
          <span className="hud-chip flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-bold text-lime-200"><Trophy className="h-3.5 w-3.5 text-lime-300" /> {score} PTS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            <div className="w-28">
              <div className="flex justify-between font-mono text-[9px]"><span className="text-slate-400">NIVEL {level}</span><span className="text-cyan-300">{xp} XP</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-lime-300 transition-all" style={{ width: `${((xp % 120) / 120) * 100 + 8}%` }} /></div>
            </div>
          </div>
          <button onClick={() => setShowIntro(true)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300"><HelpCircle className="h-4 w-4" /></button>
        </div>
      </header>

      {/* ══ MAIN ══ */}
      <main className="mx-auto grid w-full max-w-[1720px] flex-1 gap-3 p-3 md:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)_300px]">
        {/* left */}
        <aside className="order-2 md:order-1 md:max-h-[calc(100vh-130px)] md:overflow-y-auto md:pr-1">
          <LeftPanel
            power={stats.power} voltage={stats.voltage} current={stats.current} irradiance={stats.irradiance}
            totalEff={stats.totalEff} alignEff={stats.alignEff} temp={stats.temp} angleError={stats.angleError}
            panelAngle={panelAngle} sunAngle={sunAzimuth(timeH)} batteryPct={batteryPct}
            energyToday={energyToday} occlusion={stats.occlusion} dust={dust} charging={stats.charging}
          />
        </aside>

        {/* center scene */}
        <section className="order-1 md:order-2 flex min-h-[560px] flex-col gap-2">
          <div className="flex-1">
            <Scene
              timeH={timeH} panelAngle={panelAngle} mode={mode} clouds={clouds} dust={dust}
              power={stats.power} alignEff={stats.alignEff} angleError={stats.angleError} occlusion={stats.occlusion}
              phones={phones} batteryPct={batteryPct} mrActive={mrActive} arLabels={arLabels}
              charging={stats.charging} heatWave={heatOn} dustStorm={stormOn} floatMsgs={floatMsgs}
              onScrubTime={setTimeH} onPanelAngle={setPanelAngle} onPopCloud={popCloud}
              onTogglePhone={togglePhone} servoMoving={stats.servoMoving}
            />
          </div>
          {/* log ticker */}
          <div className="hud-glass flex items-center gap-2 overflow-hidden rounded-xl px-3 py-1.5">
            <span className="shrink-0 font-mono text-[10px] font-bold tracking-widest text-cyan-300">◉ LOG</span>
            <div className="flex gap-4 overflow-x-auto whitespace-nowrap py-0.5">
              {log.slice(0, 8).map(l => (
                <span key={l.id} className={`font-mono text-[11px] ${l.kind === 'good' ? 'text-lime-300' : l.kind === 'warn' ? 'text-amber-300' : l.kind === 'bad' ? 'text-red-300' : 'text-slate-300'}`}>
                  <span className="text-slate-500">[{l.t}]</span> {l.msg}
                </span>
              ))}
            </div>
          </div>
          {/* quick tips */}
          <div className="hidden gap-2 md:flex">
            {[
              { icon: <MoveHorizontal className="h-3.5 w-3.5" />, t: 'Arrastra el sol o el panel' },
              { icon: <MousePointerClick className="h-3.5 w-3.5" />, t: 'Toca nubes para disiparlas' },
              { icon: <Smartphone className="h-3.5 w-3.5" />, t: 'Clic en celulares = ON/OFF USB' },
              { icon: <Video className="h-3.5 w-3.5" />, t: 'Activa MR Cámara y mezcla tu mundo' },
            ].map((x, i) => (
              <div key={i} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 font-mono text-[10px] text-slate-400">
                <span className="text-cyan-400">{x.icon}</span> {x.t}
              </div>
            ))}
          </div>
        </section>

        {/* right */}
        <aside className="order-3 md:col-span-2 md:max-h-none xl:col-span-1 xl:max-h-[calc(100vh-130px)] xl:overflow-y-auto xl:pl-1">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <RightPanel
              mode={mode} panelAngle={panelAngle} timeH={timeH} playing={playing} speed={speed}
              cloudCover={cloudCover} phones={phones} missions={missions}
              mrActive={mrActive} arLabels={arLabels} muted={muted}
              onMode={(m) => { setMode(m); addLog(m === 'auto' ? 'Servo en AUTO: persigue al sol' : 'Servo en MANUAL: ¡tú controlas!', 'info'); sfx.toggle(); }}
              onPanel={setPanelAngle}
              onPlay={setPlaying} onSpeed={setSpeed} onTime={setTimeH}
              onClouds={onCloudCover} onEvent={fireEvent} onClean={clean}
              onTogglePhone={togglePhone}
              onMR={() => { setMrActive(v => !v); sfx.toggle(); addLog(mrActive ? 'MR desactivado' : 'Merged Reality activado: fusionando cámara + holograma', 'info'); }}
              onAR={() => setArLabels(v => !v)}
              onMute={() => { const n = !muted; setMut(n); setAudioMuted(n); }}
              onReset={() => newDay(day + 1)}
            />
          </div>
        </aside>
      </main>

      {/* ══ INTRO MODAL ══ */}
      <AnimatePresence>
        {showIntro && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94 }} className="hud-glass w-full max-w-2xl rounded-2xl p-5 md:p-7">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-orange-500 to-rose-500 shadow-[0_0_30px_rgba(251,146,60,0.6)]"><Sun className="h-6 w-6 text-white" /></div>
                  <div>
                    <h2 className="text-xl font-bold text-white md:text-2xl">HELIOS TRACKER <span className="text-cyan-300">· Mixed Reality</span></h2>
                    <p className="font-mono text-[11px] text-slate-400">Panel 20W · 18V — Servo 180° — Batería Li-ion 10Ah — USB ×3</p>
                  </div>
                </div>
                <button onClick={() => setShowIntro(false)} className="rounded-lg p-1 text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <div className="mb-4 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-3 font-mono text-[12px] leading-relaxed text-slate-300">
                El sol cruza el cielo de <b className="text-amber-300">06:00 a 20:00</b>. Tu servo lo persigue, el panel genera hasta <b className="text-amber-300">20W</b>, la energía llena la batería de <b className="text-lime-300">120 Wh</b> y los <b className="text-emerald-300">3 celulares se cargan por USB</b>. Si te desalineas, hay nubes o polvo… la potencia se desploma. <b className="text-cyan-300">Tú decides el clima y el servo.</b>
              </div>
              <div className="mb-4 grid gap-2 md:grid-cols-2">
                {[
                  { icon: <Bot className="h-4 w-4 text-cyan-300" />, t: 'AUTO o MANUAL', d: 'En MANUAL tú orientas el panel. Mantén el error < 6°.' },
                  { icon: <Sun className="h-4 w-4 text-amber-300" />, t: 'Sol arrastrable', d: 'Arrastra el sol para viajar en el tiempo solar.' },
                  { icon: <Cloud className="h-4 w-4 text-sky-300" />, t: 'Clima vivo', d: 'Nubes, polvo y calor afectan la potencia. ¡Toca las nubes!' },
                  { icon: <Video className="h-4 w-4 text-rose-300" />, t: 'Merged Reality', d: 'Activa tu cámara y el laboratorio flota sobre tu mundo real.' },
                  { icon: <BatteryCharging className="h-4 w-4 text-lime-300" />, t: 'Carga USB ×3', d: 'Conecta/desconecta celulares. Al 100% ganas +60 XP.' },
                  { icon: <Trophy className="h-4 w-4 text-amber-300" />, t: 'Misiones + XP', d: 'Completa 5 misiones, sube de nivel y haz récord de Wh.' },
                ].map((c, i) => (
                  <div key={i} className="flex gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                    <span className="mt-0.5 shrink-0">{c.icon}</span>
                    <div><div className="font-mono text-[12px] font-bold text-slate-100">{c.t}</div><div className="font-mono text-[11px] text-slate-400">{c.d}</div></div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setShowIntro(false); setPlaying(true); sfx.good(); addLog('Misión solar iniciada. ¡Que empiece la cacería de fotones!', 'good'); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 px-4 py-3 font-mono text-sm font-bold text-black shadow-[0_0_36px_rgba(251,146,60,0.45)] transition hover:brightness-110">
                <Rocket className="h-5 w-5" /> INICIAR MISIÓN SOLAR · DÍA {day}
              </button>
              <p className="mt-2 text-center font-mono text-[10px] text-slate-500">Espacio = pausa · ←/→ = viajar en el tiempo · Funciona mejor en pantalla grande</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ DAY END MODAL ══ */}
      <AnimatePresence>
        {showDayEnd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="hud-glass w-full max-w-md rounded-2xl p-6 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-2xl">🌇</div>
              <h2 className="text-xl font-bold text-white">Día {day} completado</h2>
              <p className="mb-4 font-mono text-[11px] text-slate-400">El sol se ocultó. La batería guarda tu cosecha.</p>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-2"><div className="font-mono text-lg font-bold text-amber-300">{dayStats.energy.toFixed(1)}</div><div className="font-mono text-[9px] text-slate-400">Wh HOY</div></div>
                <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-2"><div className="font-mono text-lg font-bold text-cyan-300">{dayStats.peak.toFixed(1)}W</div><div className="font-mono text-[9px] text-slate-400">PICO</div></div>
                <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 p-2"><div className="font-mono text-lg font-bold text-lime-300">{dayStats.full}/3</div><div className="font-mono text-[9px] text-slate-400">CELULARES</div></div>
              </div>
              <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-2 font-mono text-[11px] text-slate-300">Total acumulado: <b className="text-amber-300">{energyTotal.toFixed(1)} Wh</b> · <b className="text-cyan-300">{xp} XP</b> · Nivel {level}</div>
              <button onClick={() => { newDay(day + 1); sfx.good(); }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-3 font-mono text-sm font-bold text-black transition hover:brightness-110">
                <Sun className="h-5 w-5" /> AMANECER · DÍA {day + 1}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* footer */}
      <footer className="border-t border-white/5 px-4 py-2 text-center font-mono text-[10px] text-slate-600">
        HELIOS TRACKER · Simulación educativa — Panel 20W/18V · Servo seguimiento 180° · Batería 12V 10Ah · {elev > 0.5 ? `Elevación solar ${Math.round(elev)}°` : 'Modo nocturno'} · Hecho con fotones ☀️
      </footer>
    </div>
  );
}
