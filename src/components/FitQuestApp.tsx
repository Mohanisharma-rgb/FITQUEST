"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Award, BarChart3, Bell, Brain, CalendarDays, Check, ChevronLeft, ChevronRight,
  Clock, Compass, Dumbbell, Flame, Footprints, Gem, Home, Lock, LogOut, Map as MapIcon, Play,
  RotateCcw, Settings, Sparkles, Sun, Swords, Target, Trophy, User, Volume2, X, Zap,
  CheckCircle2, Timer, TrendingUp, Shield, Info, ArrowRight, Medal, Star,
} from "lucide-react";
import {
  BADGES, CHALLENGES, LEVELS, WORKOUTS, badgeValue, challengeValue, dateStr, formatMinutes,
  getLevel, recommend, seedState, weeklyData,
  type BadgeDef, type ChallengeDef, type Experience, type FitState, type Goal, type Preferences, type PrefTime, type Style, type Workout,
} from "@/lib/fitquest";

const LS_KEY = "fitquest-demo-v2";
type Tab = "dashboard" | "workouts" | "challenges" | "progress" | "profile" | "ai";
type Screen = { kind: "tab"; tab: Tab } | { kind: "detail"; workoutId: string } | { kind: "session"; workoutId: string } | { kind: "complete"; result: CompletionResult };

interface CompletionResult {
  workout: Workout; exercisesDone: number; workoutXP: number; bonusXP: number;
  bonuses: { title: string; reward: number }[]; totalXP: number; levelBefore: number; levelAfter: number; newBadges: string[];
}

function normalizeToday(s: FitState): FitState {
  const today = dateStr(new Date());
  if (s.today.date !== today) return { ...s, today: { date: today, workouts: 0, exercises: 0, minutes: 0 } };
  return s;
}
function freshZero(prev: FitState): FitState {
  const today = dateStr(new Date());
  return { ...prev, totalXP: 0, totalWorkouts: 0, totalMinutes: 0, streak: 0, lastWorkoutDate: null, history: [], rewardedChallenges: [], distinctWorkoutIds: [], workoutsThisWeek: 0, today: { date: today, workouts: 0, exercises: 0, minutes: 0 }, weekendDone: false };
}

function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 shadow-[0_0_28px_rgba(139,92,246,.45)]" style={{ width: size, height: size }}>
        <Dumbbell className="text-white" size={size * 0.52} strokeWidth={2.4} />
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-400 text-[9px] font-black text-emerald-950">▲</span>
      </div>
      <div>
        <p className="text-lg font-black tracking-[0.18em] leading-none text-white">FIT<span className="text-violet-400">QUEST</span></p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Train. Play. Level Up.</p>
      </div>
    </div>
  );
}

function XPBar({ xp, height = "h-3", showText = true }: { xp: number; height?: string; showText?: boolean }) {
  const lvl = getLevel(xp);
  return (
    <div>
      <div className={`relative w-full overflow-hidden rounded-full bg-slate-800 ${height}`}>
        <div className="progress-stripes h-full rounded-full transition-all duration-700" style={{ width: `${lvl.progress}%` }} />
      </div>
      {showText && (
        <div className="mt-2 flex justify-between text-xs text-slate-400">
          <span><b className="text-white">{xp} XP</b> total</span>
          <span>{lvl.next ? `${lvl.next.threshold - xp} XP to Level ${lvl.next.level} — ${lvl.next.name}` : "Max level reached"}</span>
          <span className="font-bold text-violet-300">{lvl.progress}%</span>
        </div>
      )}
    </div>
  );
}

function Ring({ value, size = 76, label }: { value: number; size?: number; label: string }) {
  const r = (size - 10) / 2; const c = 2 * Math.PI * r; const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#g1)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
        <defs><linearGradient id="g1"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#22d3ee" /></linearGradient></defs>
      </svg>
      <div className="absolute text-center"><p className="text-sm font-black text-white">{Math.round(pct)}%</p><p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p></div>
    </div>
  );
}

const iconMap: Record<string, React.ReactNode> = {
  zap: <Zap size={20} />, calendar: <CalendarDays size={20} />, compass: <Compass size={20} />, sun: <Sun size={20} />,
  gem: <Gem size={20} />, clock: <Clock size={20} />, footprints: <Footprints size={20} />, swords: <Swords size={20} />,
  flame: <Flame size={20} />, target: <Target size={20} />, map: <MapIcon size={20} />,
};
function badgeUnlocked(b: BadgeDef, s: FitState) { return badgeValue(b, s) >= b.target; }
function challengeStatus(c: ChallengeDef, s: FitState): "completed" | "active" { return s.rewardedChallenges.includes(c.id) ? "completed" : "active"; }

export default function FitQuestApp() {
  const [state, setState] = useState<FitState | null>(null);
  const [screen, setScreen] = useState<Screen>({ kind: "tab", tab: "dashboard" });
  const [toast, setToast] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sessionDone, setSessionDone] = useState<number[]>([]);
  const [currentEx, setCurrentEx] = useState(0);
  const [xpFloat, setXpFloat] = useState(0);
  const rewardedSessionRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setState(normalizeToday(JSON.parse(raw) as FitState));
      else setState(seedState());
    } catch { setState(seedState()); }
  }, []);

  useEffect(() => { if (state) localStorage.setItem(LS_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3600); return () => clearTimeout(t); }, [toast]);

  const lvl = useMemo(() => state ? getLevel(state.totalXP) : null, [state]);

  function go(tab: Tab) { setScreen({ kind: "tab", tab }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function showToast(msg: string) { setToast(msg); }

  function enterApp() {
    if (!state) return;
    const next = { ...state, loggedIn: true };
    setState(next);
    if (next.onboarded) go("dashboard");
  }

  function savePreferences(prefs: Preferences) {
    if (!state) return;
    setState({ ...state, preferences: prefs, onboarded: true, loggedIn: true });
    go("dashboard");
    showToast("Preferences saved — your recommendations have been updated.");
  }

  function startWorkout(workoutId: string) {
    sessionIdRef.current = `${workoutId}-${Date.now()}`;
    rewardedSessionRef.current = null;
    setSessionDone([]); setCurrentEx(0);
    setScreen({ kind: "session", workoutId });
    window.scrollTo({ top: 0 });
  }

  function finishWorkout(workout: Workout) {
    if (!state) return;
    if (rewardedSessionRef.current === sessionIdRef.current) return;
    if (sessionDone.length === 0) { showToast("Complete at least one exercise before finishing."); return; }
    rewardedSessionRef.current = sessionIdRef.current;

    const levelBefore = getLevel(state.totalXP).current.level;
    const badgesBefore = new Set(BADGES.filter(b => badgeUnlocked(b, state)).map(b => b.id));
    const now = new Date(); const today = dateStr(now); const day = now.getDay();
    const yesterday = dateStr(new Date(now.getTime() - 86400000));
    let streak = state.streak;
    if (state.lastWorkoutDate === today) streak = Math.max(1, state.streak);
    else if (state.lastWorkoutDate === yesterday) streak = state.streak + 1;
    else streak = 1;

    const isNewDay = state.today.date !== today;
    const baseToday = isNewDay ? { date: today, workouts: 0, exercises: 0, minutes: 0 } : state.today;

    let next: FitState = {
      ...state,
      totalXP: state.totalXP + workout.xp,
      totalWorkouts: state.totalWorkouts + 1,
      totalMinutes: state.totalMinutes + workout.duration,
      streak, lastWorkoutDate: today,
      distinctWorkoutIds: state.distinctWorkoutIds.includes(workout.id) ? state.distinctWorkoutIds : [...state.distinctWorkoutIds, workout.id],
      workoutsThisWeek: state.workoutsThisWeek + 1,
      weekendDone: state.weekendDone || day === 0 || day === 6,
      today: { date: today, workouts: baseToday.workouts + 1, exercises: baseToday.exercises + sessionDone.length, minutes: baseToday.minutes + workout.duration },
      history: [{ id: `h-${Date.now()}`, workoutId: workout.id, workoutName: workout.name, date: today, minutes: workout.duration, xp: workout.xp, exercises: sessionDone.length }, ...state.history],
    };

    const bonuses: { title: string; reward: number }[] = [];
    // Evaluate challenges repeatedly so XP-based challenges see updated totals
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of CHALLENGES) {
        if (!next.rewardedChallenges.includes(c.id) && challengeValue(c, next) >= c.target) {
          next = { ...next, rewardedChallenges: [...next.rewardedChallenges, c.id], totalXP: next.totalXP + c.reward };
          bonuses.push({ title: c.title, reward: c.reward }); changed = true;
        }
      }
    }
    const bonusXP = bonuses.reduce((a, b) => a + b.reward, 0);
    const newBadges = BADGES.filter(b => badgeUnlocked(b, next) && !badgesBefore.has(b.id)).map(b => b.id);
    const result: CompletionResult = {
      workout, exercisesDone: sessionDone.length, workoutXP: workout.xp, bonusXP, bonuses,
      totalXP: next.totalXP, levelBefore, levelAfter: getLevel(next.totalXP).current.level, newBadges,
    };
    setState(next);
    if (next.settings.sound && typeof window !== "undefined") {
      try {
        const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.frequency.value = 660; g.gain.setValueAtTime(0.08, ctx.currentTime);
        o.start(); o.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.18); o.stop(ctx.currentTime + 0.25);
      } catch { /* sound is optional */ }
    }
    setScreen({ kind: "complete", result });
    window.scrollTo({ top: 0 });
  }

  if (!state || !lvl) {
    return <div className="grid min-h-screen place-items-center bg-[#080b14]"><div className="text-center"><Logo /><p className="mt-6 animate-pulse text-sm text-slate-400">Loading your quest…</p></div></div>;
  }

  if (!state.loggedIn) return <><Welcome onEnter={enterApp} /><Toast msg={toast} /></>;
  if (!state.onboarded) return <><Onboarding initial={state.preferences} name={state.name} onSave={savePreferences} /><Toast msg={toast} /></>;

  const activeTab: Tab = screen.kind === "tab" ? screen.tab : "workouts";

  return (
    <div className="min-h-screen bg-[#080b14] text-slate-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-white/[0.06] bg-[#0b0f1c]/95 px-5 py-6 lg:flex">
        <Logo />
        <div className="mt-8 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/15 to-cyan-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-black text-white">M</div>
            <div><p className="font-bold text-white">{state.name}</p><p className="text-xs text-violet-300">Level {lvl.current.level} — {lvl.current.name}</p></div>
          </div>
          <div className="mt-4"><XPBar xp={state.totalXP} /></div>
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-300"><Flame size={14} /> {state.streak}-day streak</div>
        </div>
        <nav className="mt-8 space-y-1.5">
          <NavItem icon={<Home size={19} />} label="Dashboard" active={activeTab === "dashboard"} onClick={() => go("dashboard")} />
          <NavItem icon={<Dumbbell size={19} />} label="Workouts" active={activeTab === "workouts"} onClick={() => go("workouts")} />
          <NavItem icon={<Brain size={19} />} label="AI Coach" active={activeTab === "ai"} onClick={() => go("ai")} badge="Demo AI" />
          <NavItem icon={<Trophy size={19} />} label="Challenges" active={activeTab === "challenges"} onClick={() => go("challenges")} />
          <NavItem icon={<BarChart3 size={19} />} label="Progress" active={activeTab === "progress"} onClick={() => go("progress")} />
          <NavItem icon={<User size={19} />} label="Profile" active={activeTab === "profile"} onClick={() => go("profile")} />
        </nav>
        <div className="mt-auto rounded-2xl bg-white/[0.03] p-4 text-xs leading-relaxed text-slate-400">
          <p className="flex items-center gap-1.5 font-semibold text-slate-200"><Shield size={13} className="text-emerald-400" /> Student prototype</p>
          Progress is saved in this browser (localStorage). No real account or ML model is connected yet.
        </div>
        <button onClick={() => setState({ ...state, loggedIn: false })} className="mt-4 flex items-center gap-2 px-2 text-sm text-slate-400 transition hover:text-white"><LogOut size={16} /> Log out to welcome</button>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#080b14]/90 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo size={34} />
          <div className="flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-200"><Zap size={13} /> Lv {lvl.current.level} · {state.totalXP} XP</div>
        </div>
        <div className="px-4 pb-3"><XPBar xp={state.totalXP} showText={false} height="h-2" /></div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:ml-[260px] lg:max-w-none lg:px-10 lg:pb-12 lg:pt-8 xl:pr-14">
        {/* Desktop top bar */}
        <div className="mb-7 hidden items-center justify-between lg:flex">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p><h1 className="mt-1 text-2xl font-black text-white">{screenTitle(screen)}</h1></div>
          <div className="flex items-center gap-3">
            <div className="w-64 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <div className="mb-2 flex justify-between text-xs"><span className="font-bold text-violet-300">LEVEL {lvl.current.level} · {lvl.current.name.toUpperCase()}</span><span className="text-slate-400">{state.totalXP} XP</span></div>
              <XPBar xp={state.totalXP} showText={false} height="h-2" />
            </div>
            <button onClick={() => go("profile")} className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 font-black text-white">M</button>
          </div>
        </div>

        {screen.kind === "tab" && screen.tab === "dashboard" && <Dashboard state={state} go={go} startWorkout={startWorkout} openDetail={(id) => setScreen({ kind: "detail", workoutId: id })} />}
        {screen.kind === "tab" && screen.tab === "workouts" && <WorkoutLibrary openDetail={(id) => setScreen({ kind: "detail", workoutId: id })} startWorkout={startWorkout} state={state} />}
        {screen.kind === "tab" && screen.tab === "challenges" && <ChallengesPage state={state} go={go} />}
        {screen.kind === "tab" && screen.tab === "progress" && <ProgressPage state={state} />}
        {screen.kind === "tab" && screen.tab === "profile" && <ProfilePage state={state} onSavePrefs={savePreferences} onUpdate={(patch) => setState({ ...state, ...patch })} onResetRequest={() => setConfirmReset(true)} onLogout={() => setState({ ...state, loggedIn: false })} />}
        {screen.kind === "tab" && screen.tab === "ai" && <AICoachPage state={state} startWorkout={startWorkout} openDetail={(id) => setScreen({ kind: "detail", workoutId: id })} onSavePrefs={savePreferences} />}
        {screen.kind === "detail" && <WorkoutDetail id={screen.workoutId} back={() => go("workouts")} startWorkout={startWorkout} />}
        {screen.kind === "session" && <Session id={screen.workoutId} done={sessionDone} setDone={setSessionDone} current={currentEx} setCurrent={setCurrentEx} onFinish={finishWorkout} onExit={() => setScreen({ kind: "detail", workoutId: screen.workoutId })} onFloat={() => setXpFloat(x => x + 1)} />}
        {screen.kind === "complete" && <Complete result={screen.result} state={state} go={go} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-[#0b0f1c]/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-6 px-1 py-2">
          <MobileNav icon={<Home size={19} />} label="Home" active={activeTab === "dashboard"} onClick={() => go("dashboard")} />
          <MobileNav icon={<Dumbbell size={19} />} label="Workouts" active={activeTab === "workouts"} onClick={() => go("workouts")} />
          <MobileNav icon={<Brain size={19} />} label="AI Coach" active={activeTab === "ai"} onClick={() => go("ai")} />
          <MobileNav icon={<Trophy size={19} />} label="Quests" active={activeTab === "challenges"} onClick={() => go("challenges")} />
          <MobileNav icon={<BarChart3 size={19} />} label="Progress" active={activeTab === "progress"} onClick={() => go("progress")} />
          <MobileNav icon={<User size={19} />} label="Profile" active={activeTab === "profile"} onClick={() => go("profile")} />
        </div>
      </nav>

      {xpFloat > 0 && <div key={xpFloat} className="anim-xp pointer-events-none fixed bottom-32 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-violet-500 px-4 py-2 text-sm font-black text-white shadow-[0_0_30px_rgba(139,92,246,.6)]">+ Exercise complete!</div>}

      {confirmReset && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="anim-pop w-full max-w-md rounded-3xl border border-red-500/20 bg-[#12172a] p-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-red-400"><RotateCcw size={22} /></div>
            <h3 className="mt-4 text-xl font-black text-white">Reset demo progress?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">This removes the saved demo activity in this browser — XP, workouts, streak, history, challenges, and badges will return to zero. Your fitness preferences are kept. This cannot be undone.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmReset(false)} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-200">Cancel</button>
              <button onClick={() => { setState(freshZero(state)); setConfirmReset(false); go("dashboard"); showToast("Demo progress has been reset."); }} className="rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white hover:bg-red-400">Yes, reset</button>
            </div>
          </div>
        </div>
      )}
      <Toast msg={toast} />
    </div>
  );
}

function screenTitle(s: Screen) {
  if (s.kind === "detail") return "Workout Details";
  if (s.kind === "session") return "Workout Session";
  if (s.kind === "complete") return "Workout Complete";
  return { dashboard: "Dashboard", workouts: "Workout Library", challenges: "Challenges & Badges", progress: "Your Progress", profile: "Profile & Settings", ai: "AI Fitness Coach" }[s.tab];
}
function NavItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: string }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${active ? "bg-violet-500/15 text-white shadow-[inset_0_0_0_1px_rgba(139,92,246,.25)]" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><span className={active ? "text-violet-300" : ""}>{icon}</span>{label}{badge && <span className="ml-auto rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">{badge}</span>}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-violet-400" />}</button>;
}
function MobileNav({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold ${active ? "text-violet-300" : "text-slate-500"}`}>{icon}{label}</button>;
}
function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div className="anim-pop fixed bottom-24 left-1/2 z-[80] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-emerald-400/25 bg-[#0f1f1a] px-4 py-3 text-sm font-semibold text-emerald-200 shadow-2xl lg:bottom-8"><span className="mr-2">✓</span>{msg}</div>;
}

/* ---------------- WELCOME ---------------- */
function Welcome({ onEnter }: { onEnter: () => void }) {
  const [email, setEmail] = useState("mohani@demo.fitquest");
  const [password, setPassword] = useState("demo1234");
  const [notice, setNotice] = useState("");
  function enter(mode: string) { setNotice(""); onEnter(); if (mode === "create") setTimeout(() => {}, 0); }
  return (
    <div className="min-h-screen bg-[#080b14] lg:grid lg:grid-cols-[1.15fr_1fr]">
      <div className="relative hidden overflow-hidden lg:block">
        <img src="https://images.pexels.com/photos/32695892/pexels-photo-32695892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=1600" alt="Athletes training in a gym" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080b14]/70 via-[#080b14]/40 to-[#080b14]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080b14] via-transparent to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo size={48} />
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 backdrop-blur"><Sparkles size={13} /> Gamified fitness · AI-personalised · Student prototype</div>
            <h1 className="text-6xl font-black leading-[0.95] tracking-tight text-white">Every workout<br />is a <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">quest.</span></h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-300">FitQuest turns exercise into an RPG journey. Complete workouts, earn XP, level up from Rookie to Legend, unlock badges, and get workout recommendations shaped around your goals.</p>
            <div className="mt-8 flex gap-6 text-sm">
              <div><p className="text-2xl font-black text-white">5</p><p className="text-slate-400">Levels to climb</p></div>
              <div><p className="text-2xl font-black text-white">6</p><p className="text-slate-400">Workout plans</p></div>
              <div><p className="text-2xl font-black text-white">6</p><p className="text-slate-400">Live challenges</p></div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden"><Logo size={44} /></div>
          <h2 className="mt-8 text-3xl font-black text-white">Welcome back, hero.</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Log in to continue your journey — or jump straight into the fully working demo as Mohani.</p>
          <div className="mt-7 space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Email</span>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20" /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-400">Password</span>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="••••••••" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20" /></label>
          </div>
          {notice && <p className="mt-4 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{notice}</p>}
          <button onClick={() => email.trim() ? enter("login") : setNotice("Enter any email to continue — this prototype uses a demo profile, not real accounts.")} className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-3.5 text-sm font-black text-white shadow-[0_10px_30px_rgba(124,58,237,.35)] transition hover:brightness-110">Log In <ArrowRight className="ml-1 inline" size={16} /></button>
          <button onClick={() => { setNotice("Prototype: account creation uses the demo profile — no real sign-up or secure storage is implemented."); setTimeout(enter, 900); }} className="mt-3 w-full rounded-xl border border-white/12 bg-white/[0.03] py-3.5 text-sm font-bold text-white transition hover:bg-white/[0.06]">Create Account <span className="ml-1 text-xs font-medium text-slate-400">(prototype)</span></button>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-600"><span className="h-px flex-1 bg-white/[0.07]" />or<span className="h-px flex-1 bg-white/[0.07]" /></div>
          <button onClick={() => enter("demo")} className="w-full rounded-xl border border-emerald-400/25 bg-emerald-400/10 py-3.5 text-sm font-black text-emerald-300 transition hover:bg-emerald-400/15"><Play size={15} className="mr-1.5 inline" /> Continue as Demo User — Mohani</button>
          <p className="mt-5 flex gap-2 text-xs leading-relaxed text-slate-500"><Info size={14} className="mt-0.5 shrink-0" /> Demo login only. No real authentication, passwords are never sent anywhere, and progress is stored only in your browser.</p>
          <div className="mt-7 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
            {[["Earn XP", Zap], ["Unlock badges", Award], ["AI picks for you", Brain]].map(([t, Icon]: any) => <div key={t} className="rounded-2xl bg-white/[0.03] px-2 py-3"><Icon size={16} className="mx-auto mb-1.5 text-violet-300" />{t}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ONBOARDING / PREFS FORM ---------------- */
const GOALS: Goal[] = ["Build strength", "Improve endurance", "Improve general fitness", "Develop a consistent workout habit"];
const EXPS: Experience[] = ["Beginner", "Intermediate", "Advanced"];
const TIMES: PrefTime[] = [10, 20, 30, 45];
const STYLES: Style[] = ["Full body", "Strength", "Cardio", "Low-impact workout"];

function PrefsForm({ initial, onSave, submitLabel }: { initial: Preferences; onSave: (p: Preferences) => void; submitLabel: string }) {
  const [p, setP] = useState<Preferences>(initial);
  const group = (label: string, hint: string, children: React.ReactNode) => (
    <div><p className="text-sm font-bold text-white">{label}</p><p className="mb-3 mt-0.5 text-xs text-slate-500">{hint}</p><div className="flex flex-wrap gap-2">{children}</div></div>
  );
  const chip = (active: boolean, onClick: () => void, label: string) => (
    <button key={label} type="button" onClick={onClick} className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${active ? "bg-violet-500 text-white shadow-[0_6px_20px_rgba(124,58,237,.35)]" : "border border-white/10 bg-white/[0.03] text-slate-300 hover:border-violet-400/40 hover:text-white"}`}>{active && <Check size={13} className="mr-1 inline" />}{label}</button>
  );
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(p); }} className="space-y-7">
      {group("What's your fitness goal?", "This shapes which workouts the AI Coach puts first.", GOALS.map(g => chip(p.goal === g, () => setP({ ...p, goal: g }), g)))}
      {group("Experience level", "Be honest — you can level this up in your profile any time.", EXPS.map(g => chip(p.level === g, () => setP({ ...p, level: g }), g)))}
      {group("How much time do you have?", "Per workout session.", TIMES.map(t => chip(p.time === t, () => setP({ ...p, time: t }), `${t} minutes`)))}
      {group("Preferred workout style", "Your favourite way to train.", STYLES.map(g => chip(p.style === g, () => setP({ ...p, style: g }), g)))}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-white">Workout frequency</span>
          <select value={p.frequency} onChange={e => setP({ ...p, frequency: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#12172a] px-4 py-3 text-sm text-white outline-none focus:border-violet-400/60">
            <option>1–2 days / week</option><option>3–4 days / week</option><option>5+ days / week</option>
          </select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-bold text-white">Self-reported ability <span className="font-normal text-slate-500">(optional)</span></span>
          <select value={p.ability} onChange={e => setP({ ...p, ability: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#12172a] px-4 py-3 text-sm text-white outline-none focus:border-violet-400/60">
            <option>Just starting out</option><option>Can do a few modified push-ups</option><option>Comfortable with bodyweight basics</option><option>Training regularly for months</option><option>Joint-friendly / low-impact preferred</option>
          </select></label>
      </div>
      <button className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-3.5 text-sm font-black text-white shadow-[0_10px_30px_rgba(124,58,237,.35)] transition hover:brightness-110 sm:w-auto sm:px-8">{submitLabel} <ArrowRight size={15} className="ml-1 inline" /></button>
    </form>
  );
}

function Onboarding({ initial, name, onSave }: { initial: Preferences; name: string; onSave: (p: Preferences) => void }) {
  return (
    <div className="min-h-screen bg-[#080b14] px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <Logo />
        <div className="anim-pop mt-8 rounded-[28px] border border-white/[0.07] bg-[#0e1322] p-6 sm:p-9">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300"><Sparkles size={14} /> Step 1 of 1 · Personalise your quest</div>
          <h1 className="mt-3 text-3xl font-black text-white">Let's build your plan, {name}.</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Answer four quick questions. FitQuest's demo recommendation engine will use these to pick workouts for you — and you can change them later in Profile.</p>
          <div className="mt-8"><PrefsForm initial={initial} onSave={onSave} submitLabel="Save Preferences & Start" /></div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */
function Dashboard({ state, go, startWorkout, openDetail }: { state: FitState; go: (t: Tab) => void; startWorkout: (id: string) => void; openDetail: (id: string) => void }) {
  const lvl = getLevel(state.totalXP);
  const rec = recommend(state.preferences)[0];
  const week = weeklyData(state);
  const maxCount = Math.max(1, ...week.map(d => d.count));
  const nextBadge = BADGES.find(b => !badgeUnlocked(b, state));
  const latestBadge = [...BADGES].reverse().find(b => badgeUnlocked(b, state));
  const questTasks = [
    { label: "Complete one workout", done: state.today.workouts >= 1, detail: `${Math.min(1, state.today.workouts)}/1` },
    { label: "Complete at least 3 exercises", done: state.today.exercises >= 3, detail: `${Math.min(3, state.today.exercises)}/3` },
    { label: "Spend at least 15 minutes exercising", done: state.today.minutes >= 15, detail: `${state.today.minutes}/15 min` },
  ];
  const questDone = questTasks.filter(t => t.done).length;

  return (
    <div className="space-y-5">
      {/* Welcome hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/[0.07]">
        <img src="https://images.pexels.com/photos/31028213/pexels-photo-31028213.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0e1a]/95 via-[#0a0e1a]/80 to-[#0a0e1a]/30" />
        <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-cyan-200 backdrop-blur"><Flame size={13} className="text-amber-400" /> {state.streak}-day streak — keep it alive!</p>
            <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl">Welcome back, {state.name}!</h2>
            <p className="mt-2 max-w-md text-sm text-slate-300">Every workout takes you one step closer to your next level.</p>
            <div className="mt-6 max-w-md">
              <div className="mb-2 flex items-end justify-between"><p className="text-sm font-bold text-white">Level {lvl.current.level} — {lvl.current.name}</p><p className="text-xs text-slate-300">{state.totalXP}{lvl.next ? ` / ${lvl.next.threshold}` : ""} XP</p></div>
              <XPBar xp={state.totalXP} showText={false} height="h-3.5" />
              <p className="mt-2 text-xs text-violet-200">{lvl.next ? `${lvl.next.threshold - state.totalXP} XP until Level ${lvl.next.level} — ${lvl.next.name} · Reward: ${lvl.next.reward}` : "You've reached the highest level. Legend status!"}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => startWorkout(rec.workout.id)} className="anim-glow rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-3 text-sm font-black text-white"><Play size={15} className="mr-1.5 inline" /> Start Today's Workout</button>
              <button onClick={() => go("ai")} className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-white/15"><Brain size={15} className="mr-1.5 inline text-cyan-300" /> Ask AI Coach</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={<Dumbbell size={16} />} label="Workouts done" value={String(state.totalWorkouts)} />
            <MiniStat icon={<Clock size={16} />} label="Total training" value={formatMinutes(state.totalMinutes)} />
            <MiniStat icon={<Zap size={16} />} label="Total XP earned" value={String(state.totalXP)} />
            <MiniStat icon={<Flame size={16} />} label="Current streak" value={`${state.streak} days`} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Daily quest */}
        <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
          <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Today's Quest</p><h3 className="mt-1 text-lg font-black text-white">Daily Quest</h3></div><span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-black text-amber-300">+50 XP*</span></div>
          <div className="mt-5 space-y-3">
            {questTasks.map(t => (
              <div key={t.label} className="flex items-center gap-3">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${t.done ? "bg-emerald-400 text-emerald-950" : "border border-white/15 text-transparent"}`}><Check size={13} strokeWidth={3.5} /></span>
                <p className={`flex-1 text-sm ${t.done ? "text-slate-400 line-through" : "text-slate-200"}`}>{t.label}</p><span className="text-xs font-bold text-slate-500">{t.detail}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500" style={{ width: `${(questDone / 3) * 100}%` }} /></div>
          <p className="mt-2 text-xs text-slate-500">{questDone}/3 tasks · *Quest XP is awarded via the Daily Starter challenge (+30 XP) and workout XP.</p>
          <button onClick={() => go("challenges")} className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm font-bold text-white hover:bg-white/[0.06]">View Challenges <ChevronRight size={14} className="inline" /></button>
        </section>

        {/* Recommended */}
        <section className="overflow-hidden rounded-[24px] border border-violet-500/20 bg-[#0e1322]">
          <div className="relative h-28"><img src={rec.workout.image} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#0e1322] to-transparent" /><span className="absolute left-4 top-4 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-cyan-200 backdrop-blur"><Brain size={11} className="mr-1 inline" /> Recommended for You</span><span className="absolute right-4 top-4 rounded-full bg-violet-500 px-2.5 py-1 text-[11px] font-black text-white">{rec.score}% match</span></div>
          <div className="p-5 pt-3">
            <h3 className="text-lg font-black text-white">{rec.workout.name}</h3>
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{rec.reasons.join(" · ")}</p>
            <div className="mt-4 flex gap-4 text-xs text-slate-300"><span className="flex items-center gap-1"><Timer size={13} className="text-cyan-300" /> {rec.workout.duration} min</span><span className="flex items-center gap-1"><Activity size={13} className="text-violet-300" /> {rec.workout.difficulty}</span><span className="flex items-center gap-1"><Dumbbell size={13} className="text-emerald-300" /> {rec.workout.exercises.length} exercises</span><span className="flex items-center gap-1"><Zap size={13} className="text-amber-300" /> +{rec.workout.xp} XP</span></div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button onClick={() => startWorkout(rec.workout.id)} className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-2.5 text-sm font-black text-white">Start Workout</button>
              <button onClick={() => openDetail(rec.workout.id)} className="rounded-xl border border-white/10 py-2.5 text-sm font-bold text-slate-200">Details</button>
            </div>
            <p className="mt-3 text-[11px] text-slate-600">Based on your saved preferences ({state.preferences.level} · {state.preferences.time} min · {state.preferences.style}). Demo rule-based engine.</p>
          </div>
        </section>

        {/* Achievement */}
        <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Achievements</p>
          {latestBadge ? (
            <div className="mt-4 flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-violet-500/30 to-cyan-500/20 text-violet-300 shadow-[inset_0_0_0_1px_rgba(167,139,250,.35)]">{iconMap[latestBadge.icon]}</div>
              <div><p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Latest unlocked</p><p className="font-black text-white">{latestBadge.name}</p><p className="text-xs text-slate-400">{latestBadge.description}</p></div>
            </div>
          ) : <p className="mt-4 text-sm text-slate-400">Complete your first workout to unlock a badge.</p>}
          {nextBadge && (
            <div className="mt-5 rounded-2xl bg-white/[0.03] p-4">
              <div className="flex justify-between text-xs"><span className="font-bold text-slate-200">Next: {nextBadge.name}</span><span className="text-slate-500">{Math.min(badgeValue(nextBadge, state), nextBadge.target)}/{nextBadge.target}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${Math.min(100, (badgeValue(nextBadge, state) / nextBadge.target) * 100)}%` }} /></div>
              <p className="mt-2 text-xs text-slate-500">{nextBadge.description}</p>
            </div>
          )}
          <button onClick={() => go("challenges")} className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm font-bold text-white hover:bg-white/[0.06]">All Badges & Challenges</button>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Weekly chart */}
        <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
          <div className="flex items-center justify-between"><div><h3 className="font-black text-white">Weekly Activity</h3><p className="text-xs text-slate-500">Workouts completed · last 7 days {state.history.some(h => h.demo) && <span className="text-slate-600">(includes labelled demo history)</span>}</p></div><button onClick={() => go("progress")} className="text-xs font-bold text-violet-300 hover:text-violet-200">Full progress →</button></div>
          <div className="mt-6 flex h-36 items-end gap-2 sm:gap-3">
            {week.map(d => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <span className={`text-xs font-black ${d.count ? "text-white" : "text-slate-700"}`}>{d.count || ""}</span>
                <div className="flex w-full items-end justify-center rounded-t-xl bg-white/[0.02]" style={{ height: "96px" }}>
                  <div className={`w-full max-w-[38px] rounded-t-lg transition-all duration-500 ${d.isToday ? "bg-gradient-to-t from-violet-600 to-cyan-400" : "bg-gradient-to-t from-violet-600/70 to-violet-400/70"}`} style={{ height: `${Math.max(d.count ? 14 : 4, (d.count / maxCount) * 92)}px` }} />
                </div>
                <span className={`text-[11px] font-bold ${d.isToday ? "text-cyan-300" : "text-slate-500"}`}>{d.isToday ? "Today" : d.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Level roadmap mini */}
        <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
          <h3 className="font-black text-white">Your Journey</h3>
          <div className="mt-4 space-y-2.5">
            {LEVELS.map(l => {
              const unlocked = state.totalXP >= l.threshold; const isCurrent = lvl.current.level === l.level;
              return (
                <div key={l.level} className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${isCurrent ? "bg-violet-500/12 shadow-[inset_0_0_0_1px_rgba(139,92,246,.3)]" : "bg-white/[0.02]"}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-black ${unlocked ? "bg-gradient-to-br from-violet-500 to-indigo-500 text-white" : "bg-slate-800 text-slate-500"}`}>{unlocked ? l.level : <Lock size={12} />}</span>
                  <div className="flex-1"><p className={`text-sm font-bold ${unlocked ? "text-white" : "text-slate-500"}`}>Level {l.level} — {l.name}</p><p className="text-[11px] text-slate-500">{l.threshold} XP · {l.reward}</p></div>
                  {isCurrent && <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-black text-white">YOU</span>}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/35 p-3.5 backdrop-blur"><p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><span className="text-cyan-300">{icon}</span>{label}</p><p className="mt-1.5 text-xl font-black text-white">{value}</p></div>;
}

/* ---------------- WORKOUT LIBRARY ---------------- */
function WorkoutLibrary({ openDetail, startWorkout, state }: { openDetail: (id: string) => void; startWorkout: (id: string) => void; state: FitState }) {
  const [difficulty, setDifficulty] = useState("All");
  const [duration, setDuration] = useState("All");
  const [type, setType] = useState("All");
  const types = ["All", ...Array.from(new Set(WORKOUTS.map(w => w.type)))];
  const filtered = WORKOUTS.filter(w =>
    (difficulty === "All" || w.difficulty === difficulty) &&
    (duration === "All" || (duration === "≤10" ? w.duration <= 10 : duration === "15–20" ? w.duration >= 15 && w.duration <= 20 : w.duration >= 30)) &&
    (type === "All" || w.type === type));
  const recId = recommend(state.preferences)[0].workout.id;
  const sel = "rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 outline-none focus:border-violet-400/50 [&>option]:bg-[#12172a]";
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black text-white">Workout Library</h2><p className="mt-1 text-sm text-slate-400">Pick a plan, complete the exercises at your own pace, earn XP. No camera, no equipment needed.</p></div>
        <div className="flex flex-wrap gap-2">
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className={sel}><option>All</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select>
          <select value={duration} onChange={e => setDuration(e.target.value)} className={sel}><option>All</option><option>≤10</option><option>15–20</option><option>30</option></select>
          <select value={type} onChange={e => setType(e.target.value)} className={sel}>{types.map(t => <option key={t}>{t}</option>)}</select>
        </div>
      </div>
      {filtered.length === 0 && <div className="mt-10 rounded-3xl border border-dashed border-white/10 p-10 text-center text-slate-400">No workouts match those filters. <button className="font-bold text-violet-300" onClick={() => { setDifficulty("All"); setDuration("All"); setType("All"); }}>Clear filters</button></div>}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map(w => <WorkoutCard key={w.id} w={w} recommended={w.id === recId} onOpen={() => openDetail(w.id)} onStart={() => startWorkout(w.id)} doneBefore={state.distinctWorkoutIds.includes(w.id)} />)}
      </div>
    </div>
  );
}
function WorkoutCard({ w, recommended, onOpen, onStart, doneBefore }: { w: Workout; recommended?: boolean; onOpen: () => void; onStart: () => void; doneBefore?: boolean }) {
  const diffColor = w.difficulty === "Beginner" ? "text-emerald-300 bg-emerald-400/10" : w.difficulty === "Intermediate" ? "text-amber-300 bg-amber-400/10" : "text-red-300 bg-red-400/10";
  return (
    <article className="group overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0e1322] transition hover:border-violet-400/30 hover:shadow-[0_18px_40px_rgba(0,0,0,.35)]">
      <button onClick={onOpen} className="relative block h-40 w-full text-left">
        <img src={w.image} alt={w.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1322] via-transparent to-black/20" />
        <div className="absolute left-4 top-4 flex gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black backdrop-blur ${diffColor}`}>{w.difficulty}</span>{recommended && <span className="rounded-full bg-violet-500 px-2.5 py-1 text-[11px] font-black text-white">★ AI PICK</span>}{doneBefore && <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur">✓ Completed before</span>}</div>
        <span className="absolute bottom-3 right-4 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black text-amber-300 backdrop-blur"><Zap size={11} className="mr-0.5 inline" />+{w.xp} XP</span>
      </button>
      <div className="p-5">
        <button onClick={onOpen} className="text-left"><h3 className="text-lg font-black text-white hover:text-violet-200">{w.name}</h3></button>
        <p className="mt-1.5 line-clamp-2 min-h-[36px] text-xs leading-relaxed text-slate-400">{w.description}</p>
        <div className="mt-4 flex gap-4 text-xs text-slate-300"><span className="flex items-center gap-1"><Timer size={13} className="text-cyan-300" />{w.duration} min</span><span className="flex items-center gap-1"><Dumbbell size={13} className="text-violet-300" />{w.exercises.length} exercises</span><span className="flex items-center gap-1"><Activity size={13} className="text-emerald-300" />{w.type}</span></div>
        <div className="mt-5 grid grid-cols-[1fr_auto] gap-2.5">
          <button onClick={onStart} className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 py-2.5 text-sm font-black text-white transition hover:brightness-110"><Play size={14} className="mr-1 inline" />Start Workout</button>
          <button onClick={onOpen} className="rounded-xl border border-white/10 px-4 text-sm font-bold text-slate-200 hover:bg-white/[0.05]">Details</button>
        </div>
      </div>
    </article>
  );
}

/* ---------------- DETAIL + SESSION + COMPLETE ---------------- */
function WorkoutDetail({ id, back, startWorkout }: { id: string; back: () => void; startWorkout: (id: string) => void }) {
  const w = WORKOUTS.find(x => x.id === id) || WORKOUTS[0];
  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={back} className="mb-4 flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-white"><ChevronLeft size={16} /> Back to library</button>
      <div className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#0e1322]">
        <div className="relative h-56 sm:h-64"><img src={w.image} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#0e1322] via-[#0e1322]/30 to-transparent" />
          <div className="absolute bottom-5 left-6 right-6"><span className="rounded-full bg-violet-500 px-3 py-1 text-xs font-black text-white">{w.type} · {w.difficulty}</span><h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">{w.name}</h2><p className="mt-2 max-w-xl text-sm text-slate-300">{w.description}</p></div>
        </div>
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Duration", `${w.duration} min`, Timer], ["Difficulty", w.difficulty, Activity], ["Exercises", String(w.exercises.length), Dumbbell], ["Reward", `+${w.xp} XP`, Zap]].map(([l, v, Icon]: any) => (
              <div key={l} className="rounded-2xl bg-white/[0.03] p-4 text-center"><Icon size={18} className="mx-auto text-cyan-300" /><p className="mt-2 text-base font-black text-white">{v}</p><p className="text-[11px] uppercase tracking-wider text-slate-500">{l}</p></div>
            ))}
          </div>
          <h3 className="mt-8 text-lg font-black text-white">Exercises in this plan</h3>
          <div className="mt-4 space-y-3">
            {w.exercises.map((ex, i) => (
              <div key={ex.name} className="flex gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-sm font-black text-violet-300">{i + 1}</span>
                <div className="flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold text-white">{ex.name}</p><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-black text-cyan-300">{ex.target}</span></div><p className="mt-1 text-sm leading-relaxed text-slate-400">{ex.instruction}</p></div>
              </div>
            ))}
          </div>
          <button onClick={() => startWorkout(w.id)} className="anim-glow mt-8 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 py-4 text-base font-black text-white sm:w-auto sm:px-10"><Play size={17} className="mr-1.5 inline" /> Start Workout · Earn {w.xp} XP</button>
          <p className="mt-3 text-xs text-slate-500">You mark each exercise complete yourself — no camera or sensors needed.</p>
        </div>
      </div>
    </div>
  );
}

function Session({ id, done, setDone, current, setCurrent, onFinish, onExit, onFloat }: { id: string; done: number[]; setDone: (v: number[]) => void; current: number; setCurrent: (v: number) => void; onFinish: (w: Workout) => void; onExit: () => void; onFloat: () => void }) {
  const w = WORKOUTS.find(x => x.id === id) || WORKOUTS[0];
  const ex = w.exercises[current];
  const isDone = done.includes(current);
  const pct = Math.round((done.length / w.exercises.length) * 100);
  function mark() { if (!isDone) { setDone([...done, current]); onFloat(); } if (current < w.exercises.length - 1) setCurrent(current + 1); }
  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={onExit} className="mb-4 flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-white"><X size={16} /> Exit session</button>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#0e1322]">
          <div className="relative h-44"><img src={w.image} alt="" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#0e1322] to-black/20" />
            <div className="absolute bottom-4 left-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">{w.name}</p><p className="mt-1 text-sm text-slate-300">Exercise {current + 1} of {w.exercises.length}</p></div>
            <span className="absolute right-5 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-black text-amber-300 backdrop-blur">+{w.xp} XP on finish</span>
          </div>
          <div className="p-6 sm:p-8">
            <div className="mb-6"><div className="mb-2 flex justify-between text-xs text-slate-400"><span>{done.length}/{w.exercises.length} exercises completed</span><span className="font-bold text-violet-300">{pct}%</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className="progress-stripes h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div></div>
            <div key={current} className="anim-pop">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Now doing</p>
              <h2 className="mt-2 text-4xl font-black text-white">{ex.name}</h2>
              <span className="mt-4 inline-block rounded-full bg-cyan-400/10 px-4 py-1.5 text-sm font-black text-cyan-300">{ex.target}</span>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300">{ex.instruction}</p>
              <div className="mt-5 flex items-start gap-2 rounded-2xl bg-white/[0.03] p-4 text-xs leading-relaxed text-slate-400"><Info size={14} className="mt-0.5 shrink-0 text-cyan-300" /> Rest 20–30 seconds between exercises, sip water, and stop if anything hurts. FitQuest never diagnoses — listen to your body.</div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 disabled:opacity-40"><ChevronLeft size={15} className="inline" /> Prev</button>
              <button onClick={mark} className={`flex-1 rounded-xl py-3 text-sm font-black text-white sm:flex-none sm:px-7 ${isDone ? "bg-emerald-500" : "bg-gradient-to-r from-violet-500 to-indigo-500"}`}>{isDone ? <><Check size={16} className="mr-1 inline" />Completed</> : <><Check size={16} className="mr-1 inline" />Mark Exercise Complete</>}</button>
              <button onClick={() => setCurrent(Math.min(w.exercises.length - 1, current + 1))} disabled={current === w.exercises.length - 1} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-slate-300 disabled:opacity-40">Next <ChevronRight size={15} className="inline" /></button>
            </div>
            <button onClick={() => onFinish(w)} className="mt-4 w-full rounded-xl border border-emerald-400/30 bg-emerald-400/10 py-3.5 text-sm font-black text-emerald-300 transition hover:bg-emerald-400/15">Finish Workout & Claim {w.xp} XP {done.length < w.exercises.length && <span className="font-medium text-emerald-200/70">({done.length}/{w.exercises.length} done)</span>}</button>
          </div>
        </section>
        <aside className="h-fit rounded-[28px] border border-white/[0.07] bg-[#0e1322] p-5">
          <h3 className="font-black text-white">Session checklist</h3>
          <div className="mt-4 space-y-2">
            {w.exercises.map((e, i) => (
              <button key={e.name} onClick={() => setCurrent(i)} className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm transition ${i === current ? "bg-violet-500/12 shadow-[inset_0_0_0_1px_rgba(139,92,246,.3)]" : "bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${done.includes(i) ? "bg-emerald-400 text-emerald-950" : "bg-slate-800 text-slate-400"}`}>{done.includes(i) ? <Check size={13} strokeWidth={3.5} /> : i + 1}</span>
                <span className={done.includes(i) ? "text-slate-400 line-through" : "text-slate-200"}>{e.name}</span><span className="ml-auto text-xs text-slate-500">{e.target}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4 rounded-2xl bg-white/[0.03] p-4"><Ring value={pct} label="done" size={70} /><p className="text-xs leading-relaxed text-slate-400">Finish at any time — XP is awarded <b className="text-slate-200">once</b> per session when you finish.</p></div>
        </aside>
      </div>
    </div>
  );
}

function Complete({ result, state, go }: { result: CompletionResult; state: FitState; go: (t: Tab) => void }) {
  const lvl = getLevel(result.totalXP);
  const leveled = result.levelAfter > result.levelBefore;
  const pieces = useMemo(() => Array.from({ length: 26 }, (_, i) => ({ left: `${(i * 37) % 100}%`, delay: `${(i % 9) * 0.14}s`, color: ["#8b5cf6", "#22d3ee", "#34d399", "#fbbf24", "#f472b6"][i % 5], size: 6 + (i % 4) * 3, round: i % 3 === 0 })), []);
  return (
    <div className="relative mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-emerald-400/20 bg-[#0e1322] px-6 py-10 text-center sm:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">{pieces.map((p, i) => <span key={i} className="confetti-piece absolute top-0" style={{ left: p.left, animationDelay: p.delay, width: p.size, height: p.size * (p.round ? 1 : 0.45), borderRadius: p.round ? "50%" : "2px", background: p.color }} />)}</div>
      <div className="anim-pop relative">
        <div className="anim-glow mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white"><Trophy size={36} /></div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Workout Complete!</p>
        <h2 className="mt-2 text-3xl font-black text-white">{result.workout.name}</h2>
        <p className="mt-2 text-sm text-slate-400">Great job! You are building a stronger habit.</p>
        <div className="mx-auto mt-7 grid max-w-md grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/[0.03] p-4"><p className="text-2xl font-black text-white">{result.exercisesDone}</p><p className="text-[11px] uppercase tracking-wide text-slate-500">Exercises</p></div>
          <div className="rounded-2xl bg-white/[0.03] p-4"><p className="text-2xl font-black text-white">{result.workout.duration}m</p><p className="text-[11px] uppercase tracking-wide text-slate-500">Duration</p></div>
          <div className="rounded-2xl bg-violet-500/15 p-4"><p className="text-2xl font-black text-violet-300">+{result.workoutXP + result.bonusXP}</p><p className="text-[11px] uppercase tracking-wide text-violet-300/70">XP earned</p></div>
        </div>
        <div className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm">
          <p className="flex justify-between rounded-xl bg-white/[0.02] px-4 py-2.5 text-slate-300"><span>Workout reward</span><b className="text-white">+{result.workoutXP} XP</b></p>
          {result.bonuses.map(b => <p key={b.title} className="anim-pop flex justify-between rounded-xl bg-amber-400/[0.07] px-4 py-2.5 text-slate-300"><span className="flex items-center gap-1.5"><Trophy size={13} className="text-amber-300" /> Challenge: {b.title}</span><b className="text-amber-300">+{b.reward} XP</b></p>)}
          {result.newBadges.map(id => { const b = BADGES.find(x => x.id === id)!; return <p key={id} className="anim-pop flex justify-between rounded-xl bg-violet-400/[0.09] px-4 py-2.5 text-slate-200"><span className="flex items-center gap-1.5"><Medal size={13} className="text-violet-300" /> Badge unlocked: {b.name}</span><Star size={13} className="text-violet-300" /></p>; })}
        </div>
        {leveled && (
          <div className="anim-pop mx-auto mt-6 max-w-md rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-500/25 to-cyan-500/15 p-5">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Level Up!</p>
            <p className="mt-1 text-2xl font-black text-white">You reached Level {lvl.current.level} — {lvl.current.name}!</p>
            <p className="mt-1 text-sm text-slate-300">Unlocked: {lvl.current.reward}</p>
          </div>
        )}
        <div className="mx-auto mt-7 max-w-md text-left">
          <div className="mb-2 flex justify-between text-sm"><span className="font-bold text-white">Level {lvl.current.level} — {lvl.current.name}</span><span className="text-slate-400">{result.totalXP} XP total · Streak: {state.streak} days</span></div>
          <XPBar xp={result.totalXP} />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={() => go("dashboard")} className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-6 py-3 text-sm font-black text-white">Back to Dashboard</button>
          <button onClick={() => go("challenges")} className="rounded-xl border border-white/12 px-6 py-3 text-sm font-bold text-white">View Challenges</button>
          <button onClick={() => go("workouts")} className="rounded-xl border border-white/12 px-6 py-3 text-sm font-bold text-white">Another Workout</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- CHALLENGES & BADGES ---------------- */
function ChallengesPage({ state, go }: { state: FitState; go: (t: Tab) => void }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-black text-white">Challenges</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">Challenges update automatically when you finish workouts, and each XP reward is paid <b className="text-slate-200">exactly once</b>. Completed challenges stay completed.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CHALLENGES.map(c => {
            const val = challengeValue(c, state); const done = challengeStatus(c, state) === "completed";
            const pct = Math.min(100, (val / c.target) * 100);
            return (
              <article key={c.id} className={`rounded-[24px] border p-5 ${done ? "border-emerald-400/25 bg-emerald-400/[0.05]" : "border-white/[0.07] bg-[#0e1322]"}`}>
                <div className="flex items-start justify-between">
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl ${done ? "bg-emerald-400 text-emerald-950" : "bg-violet-500/15 text-violet-300"}`}>{done ? <Check size={20} strokeWidth={3} /> : iconMap[c.icon]}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${done ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}>{done ? "COMPLETED" : `+${c.reward} XP`}</span>
                </div>
                <h3 className="mt-4 font-black text-white">{c.title}</h3><p className="mt-1 min-h-[36px] text-xs leading-relaxed text-slate-400">{c.description}</p>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-all duration-500 ${done ? "bg-emerald-400" : "bg-gradient-to-r from-violet-500 to-cyan-400"}`} style={{ width: `${pct}%` }} /></div>
                <div className="mt-2 flex justify-between text-xs"><span className="text-slate-500">{Math.min(val, c.target)} / {c.target}{c.metric === "totalXP" ? " XP" : c.metric === "totalMinutes" ? " min" : ""}</span><span className={done ? "font-bold text-emerald-300" : "text-slate-500"}>{done ? `+${c.reward} XP claimed` : `${Math.round(pct)}%`}</span></div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black text-white">Badges & Achievements</h2><p className="mt-1 text-sm text-slate-400">{BADGES.filter(b => badgeUnlocked(b, state)).length} of {BADGES.length} unlocked · Badges unlock only when the recorded activity truly meets the condition.</p></div>
        <button onClick={() => go("workouts")} className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-2.5 text-sm font-black text-white">Earn More — Workouts</button></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {BADGES.map(b => {
            const unlocked = badgeUnlocked(b, state); const val = badgeValue(b, state);
            return (
              <article key={b.id} className={`rounded-[24px] border p-5 text-center ${unlocked ? "border-violet-400/30 bg-gradient-to-b from-violet-500/[0.12] to-[#0e1322]" : "border-white/[0.06] bg-[#0e1322] opacity-75"}`}>
                <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${unlocked ? "bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-[0_0_26px_rgba(139,92,246,.4)]" : "bg-slate-800 text-slate-600"}`}>{unlocked ? iconMap[b.icon] : <Lock size={20} />}</div>
                <h3 className="mt-4 text-sm font-black text-white">{b.name}</h3><p className="mt-1 min-h-[48px] text-xs leading-relaxed text-slate-400">{b.description}</p>
                <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-[11px] font-black ${unlocked ? "bg-emerald-400/12 text-emerald-300" : "bg-white/[0.04] text-slate-500"}`}>{unlocked ? "UNLOCKED" : `${Math.min(val, b.target)}/${b.target}`}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
        <h3 className="font-black text-white">Level Rewards</h3><p className="mt-1 text-xs text-slate-500">XP is cumulative — you never lose XP when you level up, and multi-level jumps are calculated automatically.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LEVELS.map(l => { const unlocked = state.totalXP >= l.threshold; return (
            <div key={l.level} className={`rounded-2xl p-4 ${unlocked ? "bg-violet-500/10 shadow-[inset_0_0_0_1px_rgba(139,92,246,.3)]" : "bg-white/[0.02]"}`}>
              <p className={`text-xs font-black ${unlocked ? "text-violet-300" : "text-slate-500"}`}>LEVEL {l.level}</p><p className="mt-1 font-black text-white">{l.name}</p><p className="mt-1 text-xs text-slate-400">{l.threshold} XP</p><p className="mt-2 flex gap-1 text-[11px] leading-snug text-slate-500">{unlocked ? <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400" /> : <Lock size={12} className="mt-0.5 shrink-0" />}{l.reward}</p>
            </div> ); })}
        </div>
      </section>
    </div>
  );
}

/* ---------------- PROGRESS ---------------- */
function ProgressPage({ state }: { state: FitState }) {
  const lvl = getLevel(state.totalXP);
  const week = weeklyData(state);
  const maxMinutes = Math.max(10, ...week.map(d => d.minutes));
  const typeCounts = useMemo(() => {
    const map = new Map<string, number>();
    state.history.forEach(h => { const w = WORKOUTS.find(x => x.id === h.workoutId); const t = w?.type || "Other"; map.set(t, (map.get(t) || 0) + 1); });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [state.history]);
  const totalExercises = state.history.reduce((a, h) => a + h.exercises, 0);
  const stats: [string, string, React.ReactNode][] = [
    ["Total workouts", String(state.totalWorkouts), <Dumbbell key="i" size={17} />],
    ["Total workout time", formatMinutes(state.totalMinutes), <Clock key="i" size={17} />],
    ["Total XP earned", String(state.totalXP), <Zap key="i" size={17} />],
    ["Current level", `Lv ${lvl.current.level} · ${lvl.current.name}`, <TrendingUp key="i" size={17} />],
    ["Current streak", `${state.streak} days`, <Flame key="i" size={17} />],
    ["Challenges completed", `${state.rewardedChallenges.length} / ${CHALLENGES.length}`, <Trophy key="i" size={17} />],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {stats.map(([l, v, icon]) => <div key={l} className="rounded-[22px] border border-white/[0.07] bg-[#0e1322] p-4"><p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><span className="text-violet-300">{icon}</span>{l}</p><p className="mt-2 text-lg font-black text-white">{v}</p></div>)}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
          <h3 className="font-black text-white">Weekly Activity — Minutes Trained</h3><p className="text-xs text-slate-500">Recorded workout activity only. This chart tracks consistency — it does not measure physical or medical improvement.</p>
          <div className="mt-6 flex h-44 items-end gap-2 sm:gap-3">
            {week.map(d => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-black text-white">{d.minutes ? `${d.minutes}m` : ""}</span>
                <div className="flex w-full items-end justify-center" style={{ height: "120px" }}><div className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ${d.isToday ? "bg-gradient-to-t from-emerald-600 to-emerald-400" : "bg-gradient-to-t from-violet-600/70 to-cyan-400/70"}`} style={{ height: `${Math.max(d.minutes ? 14 : 4, (d.minutes / maxMinutes) * 116)}px` }} /></div>
                <span className={`text-[11px] font-bold ${d.isToday ? "text-emerald-300" : "text-slate-500"}`}>{d.isToday ? "Today" : d.label}</span><span className="-mt-1.5 text-[10px] text-slate-600">{d.count} workout{d.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.05] pt-5 text-center">
            <div><p className="text-xl font-black text-white">{totalExercises}</p><p className="text-[11px] uppercase tracking-wide text-slate-500">Exercises logged</p></div>
            <div><p className="text-xl font-black text-white">{state.totalWorkouts ? Math.round(state.totalMinutes / state.totalWorkouts) : 0} min</p><p className="text-[11px] uppercase tracking-wide text-slate-500">Avg per workout</p></div>
            <div><p className="text-xl font-black text-white">{state.distinctWorkoutIds.length}</p><p className="text-[11px] uppercase tracking-wide text-slate-500">Plans tried</p></div>
          </div>
        </section>

        <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
          <h3 className="font-black text-white">Most Frequent Workout Type</h3>
          {typeCounts.length === 0 ? <p className="mt-4 text-sm text-slate-500">No workouts yet — finish one to see your mix.</p> : (
            <div className="mt-5 space-y-4">
              {typeCounts.map(([t, n]) => (
                <div key={t}><div className="mb-1.5 flex justify-between text-sm"><span className="font-bold text-slate-200">{t}</span><span className="text-slate-500">{n}× · {Math.round((n / state.history.length) * 100)}%</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${(n / typeCounts[0][1]) * 100}%` }} /></div></div>
              ))}
            </div>
          )}
          <div className="mt-6 rounded-2xl bg-white/[0.03] p-4"><p className="text-sm font-bold text-white">Level progress</p><div className="mt-3"><XPBar xp={state.totalXP} /></div></div>
        </section>
      </div>

      <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-black text-white">Workout History</h3><span className="text-xs text-slate-500">{state.history.length} entries shown · Entries marked <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-bold text-slate-400">DEMO</span> are sample history seeded for this prototype</span></div>
        {state.history.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No workouts recorded yet. Your completed sessions will appear here.</p> : (
          <div className="mt-4 divide-y divide-white/[0.05]">
            {state.history.slice(0, 14).map(h => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/12 text-violet-300"><Dumbbell size={16} /></span>
                <div className="min-w-[170px] flex-1"><p className="text-sm font-bold text-white">{h.workoutName} {h.demo && <span className="ml-1 rounded bg-white/[0.07] px-1.5 py-0.5 text-[9px] font-black tracking-wider text-slate-400">DEMO</span>}</p><p className="text-xs text-slate-500">{new Date(h.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} · {h.exercises} exercises</p></div>
                <span className="text-xs text-slate-400">{h.minutes} min</span><span className="rounded-full bg-violet-500/12 px-2.5 py-1 text-xs font-black text-violet-300">+{h.xp} XP</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- AI COACH ---------------- */
function AICoachPage({ state, startWorkout, openDetail, onSavePrefs }: { state: FitState; startWorkout: (id: string) => void; openDetail: (id: string) => void; onSavePrefs: (p: Preferences) => void }) {
  const [prefs, setPrefs] = useState<Preferences>(state.preferences);
  const [results, setResults] = useState(() => recommend(state.preferences));
  const [engineNote, setEngineNote] = useState("Rule-based demo engine running locally in your browser.");
  const [loading, setLoading] = useState(false);
  useEffect(() => { setPrefs(state.preferences); setResults(recommend(state.preferences)); }, [state.preferences]);

  async function generate() {
    setLoading(true);
    try {
      const res = await fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences: prefs }) });
      const data = await res.json();
      if (data.recommendations) {
        setResults(data.recommendations.map((r: any) => ({ workout: WORKOUTS.find(w => w.id === r.workoutId)!, score: r.score, reasons: r.reasons })));
        setEngineNote(data.notice);
      } else throw new Error();
    } catch { setResults(recommend(prefs)); setEngineNote("Rule-based demo engine (local fallback)."); }
    setLoading(false);
  }
  const top = results[0];
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-violet-600/25 via-[#12172e] to-cyan-500/10 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl"><p className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300"><Brain size={13} /> AI Fitness Recommendations · Demo engine</p>
          <h2 className="mt-3 text-3xl font-black text-white">Your personal workout coach</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">Tell FitQuest your goal, level, time, and style. The demo engine scores every plan and explains its pick in plain language — no black box.</p></div>
          <Ring value={top?.score || 0} label="top match" size={92} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr]">
        <section className="h-fit rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
          <h3 className="font-black text-white">Your inputs</h3>
          <div className="mt-5 space-y-5">
            <Field label="Fitness goal"><select value={prefs.goal} onChange={e => setPrefs({ ...prefs, goal: e.target.value as Goal })} className={selectCls}>{GOALS.map(g => <option key={g}>{g}</option>)}</select></Field>
            <Field label="Experience level"><div className="flex gap-2">{EXPS.map(x => <button key={x} type="button" onClick={() => setPrefs({ ...prefs, level: x })} className={`flex-1 rounded-xl px-2 py-2.5 text-xs font-bold ${prefs.level === x ? "bg-violet-500 text-white" : "border border-white/10 text-slate-300"}`}>{x}</button>)}</div></Field>
            <Field label="Available time"><div className="flex gap-2">{TIMES.map(t => <button key={t} type="button" onClick={() => setPrefs({ ...prefs, time: t })} className={`flex-1 rounded-xl px-2 py-2.5 text-xs font-bold ${prefs.time === t ? "bg-violet-500 text-white" : "border border-white/10 text-slate-300"}`}>{t}m</button>)}</div></Field>
            <Field label="Preferred style"><select value={prefs.style} onChange={e => setPrefs({ ...prefs, style: e.target.value as Style })} className={selectCls}>{STYLES.map(g => <option key={g}>{g}</option>)}</select></Field>
            <Field label="Workout frequency"><select value={prefs.frequency} onChange={e => setPrefs({ ...prefs, frequency: e.target.value })} className={selectCls}><option>1–2 days / week</option><option>3–4 days / week</option><option>5+ days / week</option></select></Field>
            <Field label="Self-reported ability (optional)"><select value={prefs.ability} onChange={e => setPrefs({ ...prefs, ability: e.target.value })} className={selectCls}><option>Just starting out</option><option>Can do a few modified push-ups</option><option>Comfortable with bodyweight basics</option><option>Training regularly for months</option><option>Joint-friendly / low-impact preferred</option></select></Field>
          </div>
          <button onClick={generate} disabled={loading} className="mt-6 w-full rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 py-3.5 text-sm font-black text-white disabled:opacity-60"><Sparkles size={15} className="mr-1.5 inline" />{loading ? "Scoring workouts…" : "Generate Recommendations"}</button>
          <button onClick={() => onSavePrefs(prefs)} className="mt-2.5 w-full rounded-xl border border-white/10 py-3 text-sm font-bold text-slate-200 hover:bg-white/[0.04]">Save as My Preferences</button>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-600">{engineNote}</p>
        </section>

        <div className="space-y-4">
          {results.slice(0, 3).map((r, i) => (
            <article key={r.workout.id} className={`overflow-hidden rounded-[24px] border ${i === 0 ? "border-violet-400/30 bg-[#0e1322]" : "border-white/[0.07] bg-[#0e1322]"}`}>
              <div className="flex flex-col sm:flex-row">
                <img src={r.workout.image} alt="" className="h-36 w-full object-cover sm:h-auto sm:w-44" />
                <div className="flex-1 p-5">
                  <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${i === 0 ? "bg-violet-500 text-white" : "bg-white/[0.06] text-slate-300"}`}>{i === 0 ? "★ TOP RECOMMENDATION" : `ALTERNATIVE ${i}`}</span><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] font-black text-cyan-300">{r.score}% match</span></div>
                  <h3 className="mt-3 text-xl font-black text-white">{r.workout.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-300"><span className="flex items-center gap-1"><Timer size={12} className="text-cyan-300" />{r.workout.duration} min</span><span>{r.workout.difficulty}</span><span>{r.workout.exercises.length} exercises</span><span className="text-amber-300">+{r.workout.xp} XP</span></div>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">Why this workout?</p>
                  <ul className="mt-1.5 space-y-1">{r.reasons.map(reason => <li key={reason} className="flex gap-2 text-sm text-slate-300"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />{reason}</li>)}</ul>
                  <div className="mt-4 flex gap-2.5"><button onClick={() => startWorkout(r.workout.id)} className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2.5 text-sm font-black text-white">Start Workout</button><button onClick={() => openDetail(r.workout.id)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-200">Details</button></div>
                </div>
              </div>
            </article>
          ))}

          <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
            <h3 className="flex items-center gap-2 font-black text-white"><Brain size={17} className="text-cyan-300" /> How FitQuest Uses AI</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">Today, this prototype uses <b className="text-slate-200">transparent demo rules</b> (goal + level + time + style scoring) so the full user flow can be tested. <b className="text-slate-200">No trained ML model is connected yet</b>, and no accuracy figures are claimed. The planned upgrade replaces the rule engine with a Python + scikit-learn classifier served by a Flask API — the screen and inputs stay exactly the same.</p>
            <div className="mt-5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              {["User Features", "Data Preprocessing", "Trained Classification Model", "Predicted Fitness Category", "Recommendation Logic", "Recommended Workout"].map((s, i, arr) => (
                <span key={s} className="flex items-center gap-1.5"><span className={`rounded-lg px-2.5 py-2 ${i < 2 ? "bg-cyan-400/10 text-cyan-200" : i < 4 ? "bg-amber-400/10 text-amber-200" : "bg-violet-500/15 text-violet-200"}`}>{s}{i >= 2 && i < 4 ? " · planned" : ""}</span>{i < arr.length - 1 && <ChevronRight size={12} className="text-slate-600" />}</span>
              ))}
            </div>
            <p className="mt-4 flex gap-2 text-xs leading-relaxed text-slate-500"><Shield size={14} className="mt-0.5 shrink-0 text-emerald-400" /> FitQuest only recommends workouts. It does not diagnose medical conditions, injuries, or predict health outcomes.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
const selectCls = "w-full rounded-xl border border-white/10 bg-[#12172a] px-3.5 py-3 text-sm text-white outline-none focus:border-violet-400/60";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>{children}</label>;
}

/* ---------------- PROFILE ---------------- */
function ProfilePage({ state, onSavePrefs, onUpdate, onResetRequest, onLogout }: { state: FitState; onSavePrefs: (p: Preferences) => void; onUpdate: (patch: Partial<FitState>) => void; onResetRequest: () => void; onLogout: () => void }) {
  const lvl = getLevel(state.totalXP);
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-5 rounded-[28px] border border-white/[0.07] bg-[#0e1322] p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="relative shrink-0"><div className="grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br from-violet-500 via-indigo-500 to-cyan-400 text-4xl font-black text-white">M</div><span className="absolute -bottom-2 -right-2 rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black text-amber-950">LV {lvl.current.level}</span></div>
        <div className="flex-1"><h2 className="text-3xl font-black text-white">{state.name}</h2><p className="mt-1 text-sm text-violet-300">Level {lvl.current.level} — {lvl.current.name} · “{lvl.current.name}” profile title equipped</p>
          <div className="mt-4 max-w-md"><XPBar xp={state.totalXP} /></div></div>
        <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-1 lg:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.03] px-4 py-3"><p className="text-xl font-black text-white">{state.totalWorkouts}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Workouts</p></div>
          <div className="rounded-2xl bg-white/[0.03] px-4 py-3"><p className="text-xl font-black text-white">{state.streak}d</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Streak</p></div>
          <div className="rounded-2xl bg-white/[0.03] px-4 py-3"><p className="text-xl font-black text-white">{BADGES.filter(b => badgeUnlocked(b, state)).length}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">Badges</p></div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
          <div className="flex items-center justify-between"><div><h3 className="font-black text-white">Fitness Preferences</h3><p className="text-xs text-slate-500">These drive your dashboard recommendation and AI Coach picks.</p></div>
          {!editing && <button onClick={() => setEditing(true)} className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-200">Edit Preferences</button>}</div>
          {editing ? <div className="mt-6"><PrefsForm initial={state.preferences} onSave={(p) => { onSavePrefs(p); setEditing(false); }} submitLabel="Save Preferences" /></div> : (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[["Fitness goal", state.preferences.goal], ["Experience level", state.preferences.level], ["Preferred duration", `${state.preferences.time} minutes`], ["Preferred style", state.preferences.style], ["Frequency", state.preferences.frequency], ["Self-reported ability", state.preferences.ability]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/[0.03] p-4"><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{k}</dt><dd className="mt-1 text-sm font-bold text-white">{v}</dd></div>
              ))}
            </dl>
          )}
        </section>

        <div className="space-y-5">
          <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
            <h3 className="flex items-center gap-2 font-black text-white"><Settings size={16} className="text-slate-400" /> Settings <span className="text-[10px] font-semibold normal-case text-slate-500">(prototype toggles)</span></h3>
            <div className="mt-5 space-y-4">
              <Toggle icon={<Bell size={16} />} label="Workout reminders" hint="Prototype only — no real notifications are sent." value={state.settings.notifications} onChange={v => onUpdate({ settings: { ...state.settings, notifications: v } })} />
              <Toggle icon={<Volume2 size={16} />} label="Sound effects" hint="Plays a short chime when you finish a workout." value={state.settings.sound} onChange={v => onUpdate({ settings: { ...state.settings, sound: v } })} />
              <div className="flex items-center gap-3 rounded-2xl bg-white/[0.02] p-3.5"><span className="text-slate-400"><Sparkles size={16} /></span><div className="flex-1"><p className="text-sm font-bold text-white">Theme</p><p className="text-xs text-slate-500">Dark quest theme is the only theme in this prototype.</p></div><span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-black text-violet-300">DARK</span></div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/[0.07] bg-[#0e1322] p-6">
            <h3 className="font-black text-white">Earned Badges</h3>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {BADGES.map(b => { const u = badgeUnlocked(b, state); return <span key={b.id} title={b.description} className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${u ? "bg-violet-500/15 text-violet-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,.3)]" : "bg-white/[0.03] text-slate-600"}`}>{u ? iconMap[b.icon] : <Lock size={13} />}{b.name}</span>; })}
            </div>
          </section>

          <section className="rounded-[24px] border border-red-500/15 bg-red-500/[0.04] p-6">
            <h3 className="font-black text-white">Demo Data</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Progress is stored only in this browser's localStorage. Resetting removes the saved demo activity (XP, history, streak, challenges, badges) and keeps your preferences.</p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button onClick={onResetRequest} className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-black text-white hover:bg-red-400"><RotateCcw size={14} className="mr-1 inline" />Reset Demo Progress</button>
              <button onClick={onLogout} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-slate-200"><LogOut size={14} className="mr-1 inline" />Log Out</button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
function Toggle({ icon, label, hint, value, onChange }: { icon: React.ReactNode; label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.02] p-3.5">
      <span className="text-slate-400">{icon}</span>
      <div className="flex-1"><p className="text-sm font-bold text-white">{label}</p><p className="text-xs text-slate-500">{hint}</p></div>
      <button role="switch" aria-checked={value} onClick={() => onChange(!value)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-violet-500" : "bg-slate-700"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-6" : "left-1"}`} /></button>
    </div>
  );
}
