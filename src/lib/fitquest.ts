export type Goal = "Build strength" | "Improve endurance" | "Improve general fitness" | "Develop a consistent workout habit";
export type Experience = "Beginner" | "Intermediate" | "Advanced";
export type PrefTime = 10 | 20 | 30 | 45;
export type Style = "Full body" | "Strength" | "Cardio" | "Low-impact workout";

export interface Preferences {
  goal: Goal;
  level: Experience;
  time: PrefTime;
  style: Style;
  frequency: string;
  ability: string;
}

export interface Exercise { name: string; target: string; instruction: string; }
export interface Workout {
  id: string; name: string; duration: number; difficulty: Experience; type: string;
  category: Style; description: string; xp: number; image: string; accent: string;
  exercises: Exercise[];
}

export interface HistoryEntry {
  id: string; workoutId: string; workoutName: string; date: string; // yyyy-mm-dd
  minutes: number; xp: number; exercises: number; demo?: boolean;
}

export interface FitState {
  loggedIn: boolean; onboarded: boolean; name: string;
  preferences: Preferences;
  totalXP: number; totalWorkouts: number; totalMinutes: number; streak: number;
  lastWorkoutDate: string | null;
  history: HistoryEntry[];
  rewardedChallenges: string[];
  distinctWorkoutIds: string[];
  workoutsThisWeek: number;
  today: { date: string; workouts: number; exercises: number; minutes: number };
  weekendDone: boolean;
  settings: { notifications: boolean; sound: boolean; };
}

export const LEVELS = [
  { level: 1, name: "Rookie", threshold: 0, reward: "Starter workout pack unlocked" },
  { level: 2, name: "Fighter", threshold: 100, reward: "Quick Morning Workout challenge" },
  { level: 3, name: "Warrior", threshold: 250, reward: "“Warrior” profile title" },
  { level: 4, name: "Champion", threshold: 500, reward: "Advanced Fitness Challenge" },
  { level: 5, name: "Legend", threshold: 800, reward: "“Legend” title + gold profile frame" },
];

export function getLevel(totalXP: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) if (totalXP >= l.threshold) current = l;
  const idx = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1] || null;
  const progress = next ? Math.min(100, Math.round(((totalXP - current.threshold) / (next.threshold - current.threshold)) * 100)) : 100;
  return { current, next, progress, intoLevel: totalXP - current.threshold, needed: next ? next.threshold - current.threshold : 0 };
}

export const WORKOUTS: Workout[] = [
  {
    id: "beginner-full-body", name: "Beginner Full Body", duration: 20, difficulty: "Beginner", type: "Full Body", category: "Full body",
    description: "A gentle, complete session that builds confidence with foundational movements — no equipment needed.",
    xp: 50, accent: "#a78bfa", image: "https://images.pexels.com/photos/6443520/pexels-photo-6443520.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    exercises: [
      { name: "Squats", target: "12 reps", instruction: "Feet shoulder-width apart. Sit your hips back, keep your chest tall, then stand tall." },
      { name: "Modified Push-ups", target: "8 reps", instruction: "Hands under shoulders, knees on the floor if needed. Lower with control and press back up." },
      { name: "Glute Bridges", target: "12 reps", instruction: "Lie on your back, feet flat. Lift your hips, squeeze your glutes for a second, then lower slowly." },
      { name: "Plank", target: "20 seconds", instruction: "Forearms down, body in one straight line. Breathe steadily and keep your core braced." },
    ],
  },
  {
    id: "quick-morning", name: "Quick Morning Workout", duration: 10, difficulty: "Beginner", type: "Full Body", category: "Full body",
    description: "Wake up your body in ten minutes. Perfect before college, work, or a busy day.",
    xp: 30, accent: "#38bdf8", image: "https://images.pexels.com/photos/6870414/pexels-photo-6870414.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    exercises: [
      { name: "Jumping Jacks", target: "30 seconds", instruction: "Jump feet wide while raising your arms overhead. Land softly and keep a steady rhythm." },
      { name: "Squats", target: "10 reps", instruction: "Sit back into an imaginary chair, then drive through your heels to stand." },
      { name: "Standing Knee Raises", target: "12 reps", instruction: "Lift each knee toward your chest, alternating sides. Stay tall through your torso." },
      { name: "Glute Bridges", target: "10 reps", instruction: "Lift and lower your hips slowly, squeezing at the top." },
    ],
  },
  {
    id: "strength-builder", name: "Strength Builder", duration: 30, difficulty: "Intermediate", type: "Strength", category: "Strength",
    description: "Progressive bodyweight strength for legs, chest, and core. Add dumbbells if you have them.",
    xp: 70, accent: "#f472b6", image: "https://images.pexels.com/photos/32695892/pexels-photo-32695892.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    exercises: [
      { name: "Squats", target: "15 reps", instruction: "Go a little deeper than usual while keeping knees tracking over toes." },
      { name: "Push-ups", target: "12 reps", instruction: "Full or modified. Keep elbows ~45° from your body and a straight line head-to-heels." },
      { name: "Lunges", target: "10 / leg", instruction: "Step forward, lower until both knees bend, then push back to standing. Alternate legs." },
      { name: "Glute Bridges", target: "15 reps", instruction: "Pause two seconds at the top of every rep." },
      { name: "Plank", target: "40 seconds", instruction: "Brace hard, ribs down, and breathe behind the brace." },
    ],
  },
  {
    id: "cardio-challenge", name: "Cardio Challenge", duration: 20, difficulty: "Intermediate", type: "Cardio", category: "Cardio",
    description: "Raise your heart rate and build endurance with energetic, low-equipment intervals.",
    xp: 60, accent: "#34d399", image: "https://images.pexels.com/photos/31028213/pexels-photo-31028213.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    exercises: [
      { name: "Jumping Jacks", target: "45 seconds", instruction: "Fast but controlled. Land quietly on the balls of your feet." },
      { name: "Standing Knee Raises", target: "40 seconds", instruction: "Drive knees up quickly, pumping your arms like a sprint." },
      { name: "Squats", target: "15 reps", instruction: "Keep the tempo up while maintaining good depth." },
      { name: "Lunges", target: "10 / leg", instruction: "Alternating lunges — stay light on your feet." },
      { name: "Plank", target: "30 seconds", instruction: "Finish strong with a steady, braced core." },
    ],
  },
  {
    id: "advanced-fitness", name: "Advanced Fitness Challenge", duration: 30, difficulty: "Advanced", type: "Full Body", category: "Full body",
    description: "A demanding full-body test of strength, power, and stamina for experienced trainees.",
    xp: 90, accent: "#fbbf24", image: "https://images.pexels.com/photos/17956264/pexels-photo-17956264.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    exercises: [
      { name: "Jump Squats", target: "12 reps", instruction: "Squat, then explode upward. Land softly straight into the next rep." },
      { name: "Push-ups", target: "15 reps", instruction: "Strict reps, chest to a fist-height from the floor." },
      { name: "Lunges", target: "12 / leg", instruction: "Long stride, torso tall, powerful drive back up." },
      { name: "Jumping Jacks", target: "60 seconds", instruction: "Maximum sustainable pace for the full minute." },
      { name: "Plank", target: "60 seconds", instruction: "One straight line. No sagging — quality over survival." },
    ],
  },
  {
    id: "low-impact-mobility", name: "Low-Impact Mobility Flow", duration: 15, difficulty: "Beginner", type: "Low-Impact", category: "Low-impact workout",
    description: "Joint-friendly movement to build the habit on easy days. Great for recovery and beginners.",
    xp: 40, accent: "#2dd4bf", image: "https://images.pexels.com/photos/6453391/pexels-photo-6453391.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
    exercises: [
      { name: "Gentle Squats", target: "10 reps", instruction: "Use a chair behind you as a guide. Move slowly and pain-free." },
      { name: "Wall Push-ups", target: "10 reps", instruction: "Hands on a wall, step back, bend elbows to lean in, then press away." },
      { name: "Glute Bridges", target: "12 reps", instruction: "Slow lift, two-second squeeze, slow lower." },
      { name: "Standing Knee Raises", target: "10 / side", instruction: "Hold a chair for balance if needed. Lift, pause, lower." },
    ],
  },
];

export interface ChallengeDef { id: string; title: string; description: string; reward: number; target: number; metric: "todayWorkouts" | "weekWorkouts" | "distinct" | "weekend" | "totalXP" | "totalMinutes"; icon: string; }
export const CHALLENGES: ChallengeDef[] = [
  { id: "daily-starter", title: "Daily Starter", description: "Complete one workout today.", reward: 30, target: 1, metric: "todayWorkouts", icon: "zap" },
  { id: "consistency-quest", title: "Consistency Quest", description: "Complete three workouts in a week.", reward: 75, target: 3, metric: "weekWorkouts", icon: "calendar" },
  { id: "exercise-explorer", title: "Exercise Explorer", description: "Try two different workout plans.", reward: 50, target: 2, metric: "distinct", icon: "compass" },
  { id: "weekend-warrior", title: "Weekend Warrior", description: "Complete a workout on a Saturday or Sunday.", reward: 40, target: 1, metric: "weekend", icon: "sun" },
  { id: "xp-collector", title: "XP Collector", description: "Reach 600 total XP.", reward: 60, target: 600, metric: "totalXP", icon: "gem" },
  { id: "time-warrior", title: "Time Warrior", description: "Accumulate 450 total minutes of training.", reward: 50, target: 450, metric: "totalMinutes", icon: "clock" },
];

export interface BadgeDef { id: string; name: string; description: string; target: number; metric: "totalWorkouts" | "level" | "streak" | "challenges" | "distinct"; icon: string; }
export const BADGES: BadgeDef[] = [
  { id: "first-step", name: "First Step", description: "Complete your first workout.", target: 1, metric: "totalWorkouts", icon: "footprints" },
  { id: "rising-warrior", name: "Rising Warrior", description: "Reach Level 3 — Warrior.", target: 3, metric: "level", icon: "swords" },
  { id: "consistency-champion", name: "Consistency Champion", description: "Complete workouts on 7 consecutive days.", target: 7, metric: "streak", icon: "flame" },
  { id: "challenge-hunter", name: "Challenge Hunter", description: "Complete five challenges.", target: 5, metric: "challenges", icon: "target" },
  { id: "fitness-explorer", name: "Fitness Explorer", description: "Try three different workout plans.", target: 3, metric: "distinct", icon: "map" },
];

export function dateStr(d: Date) { return d.toISOString().slice(0, 10); }
export function addDays(base: Date, n: number) { const d = new Date(base); d.setDate(d.getDate() + n); return d; }

export function seedState(): FitState {
  const now = new Date();
  const seedPlan: Array<[number, string]> = [
    [-20, "beginner-full-body"], [-18, "quick-morning"], [-16, "beginner-full-body"], [-15, "low-impact-mobility"],
    [-13, "beginner-full-body"], [-12, "quick-morning"], [-11, "beginner-full-body"], [-9, "low-impact-mobility"],
    [-8, "beginner-full-body"], [-7, "quick-morning"], [-6, "beginner-full-body"], [-5, "quick-morning"],
    [-4, "beginner-full-body"], [-3, "low-impact-mobility"], [-2, "beginner-full-body"], [-1, "quick-morning"],
    [-13, "beginner-full-body"], [-9, "quick-morning"],
  ];
  const history: HistoryEntry[] = seedPlan.map(([offset, wid], i) => {
    const w = WORKOUTS.find(x => x.id === wid)!;
    return { id: `seed-${i}`, workoutId: wid, workoutName: w.name, date: dateStr(addDays(now, offset)), minutes: w.duration, xp: w.xp, exercises: w.exercises.length, demo: true };
  }).sort((a, b) => b.date.localeCompare(a.date));

  return {
    loggedIn: false, onboarded: false, name: "Mohani",
    preferences: { goal: "Improve general fitness", level: "Beginner", time: 20, style: "Full body", frequency: "3–4 days / week", ability: "Can do a few modified push-ups" },
    totalXP: 420, totalWorkouts: 18, totalMinutes: 400, streak: 5,
    lastWorkoutDate: dateStr(addDays(now, -1)),
    history,
    rewardedChallenges: ["exercise-explorer", "consistency-quest"],
    distinctWorkoutIds: ["beginner-full-body", "quick-morning", "low-impact-mobility"],
    workoutsThisWeek: 6,
    today: { date: dateStr(now), workouts: 0, exercises: 0, minutes: 0 },
    weekendDone: false,
    settings: { notifications: true, sound: false },
  };
}

export function challengeValue(c: ChallengeDef, s: FitState): number {
  switch (c.metric) {
    case "todayWorkouts": return s.today.workouts;
    case "weekWorkouts": return s.workoutsThisWeek;
    case "distinct": return s.distinctWorkoutIds.length;
    case "weekend": return s.weekendDone ? 1 : 0;
    case "totalXP": return s.totalXP;
    case "totalMinutes": return s.totalMinutes;
  }
}
export function badgeValue(b: BadgeDef, s: FitState): number {
  switch (b.metric) {
    case "totalWorkouts": return s.totalWorkouts;
    case "level": return getLevel(s.totalXP).current.level;
    case "streak": return s.streak;
    case "challenges": return s.rewardedChallenges.length;
    case "distinct": return s.distinctWorkoutIds.length;
  }
}

export interface ScoredWorkout { workout: Workout; score: number; reasons: string[]; }
export function recommend(prefs: Preferences, excludeId?: string): ScoredWorkout[] {
  const scored = WORKOUTS.map(w => {
    let score = 0; const reasons: string[] = [];
    if (w.difficulty === prefs.level) { score += 40; reasons.push(`Matches your ${prefs.level.toLowerCase()} experience level`); }
    else if (prefs.level === "Beginner" && w.difficulty === "Intermediate") { score += 8; reasons.push("A gentle stretch goal just above beginner"); }
    else if (prefs.level === "Intermediate" && w.difficulty === "Beginner") { score += 12; reasons.push("An easier option for lighter days"); }
    else if (prefs.level === "Advanced" && w.difficulty === "Intermediate") { score += 15; }

    const diff = Math.abs(w.duration - prefs.time);
    if (diff === 0) { score += 30; reasons.push(`Fits your ${prefs.time}-minute time slot exactly`); }
    else if (diff <= 5) { score += 22; reasons.push(`Close to your preferred ${prefs.time} minutes`); }
    else if (diff <= 10) { score += 12; }
    else { score += 2; }

    if (w.category === prefs.style) { score += 25; reasons.push(`Matches your preferred ${prefs.style.toLowerCase()} style`); }
    if (prefs.goal === "Build strength" && w.type === "Strength") { score += 15; reasons.push("Directly supports your goal: build strength"); }
    if (prefs.goal === "Improve endurance" && w.type === "Cardio") { score += 15; reasons.push("Directly supports your goal: improve endurance"); }
    if (prefs.goal === "Improve general fitness" && w.type === "Full Body") { score += 12; reasons.push("Full-body work suits general fitness"); }
    if (prefs.goal === "Develop a consistent workout habit" && w.duration <= 20) { score += 12; reasons.push("Short enough to keep the habit streak alive"); }
    if ((prefs.ability.toLowerCase().includes("knee") || prefs.ability.toLowerCase().includes("low-impact") || prefs.ability.toLowerCase().includes("joint")) && w.category === "Low-impact workout") { score += 10; reasons.push("Low-impact, based on your self-reported ability notes"); }

    if (reasons.length === 0) reasons.push("A solid variety option based on your profile");
    return { workout: w, score, reasons: reasons.slice(0, 3) };
  }).filter(s => s.workout.id !== excludeId).sort((a, b) => b.score - a.score);
  return scored;
}

export function weeklyData(s: FitState) {
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, i - 6);
    const ds = dateStr(d);
    const count = s.history.filter(h => h.date === ds).length;
    const minutes = s.history.filter(h => h.date === ds).reduce((a, h) => a + h.minutes, 0);
    return { label: days[d.getDay()], date: ds, count, minutes, isToday: i === 6 };
  });
}

export function formatMinutes(m: number) {
  const h = Math.floor(m / 60); const rest = m % 60;
  return h ? `${h}h ${rest}m` : `${rest} min`;
}
