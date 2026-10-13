import { NextResponse } from "next/server";
import { recommend, type Preferences } from "@/lib/fitquest";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prefs = body.preferences as Preferences;
    if (!prefs?.level || !prefs?.time || !prefs?.style) {
      return NextResponse.json({ error: "Missing preferences" }, { status: 400 });
    }
    const results = recommend(prefs).map(r => ({
      workoutId: r.workout.id, name: r.workout.name, duration: r.workout.duration,
      difficulty: r.workout.difficulty, type: r.workout.type, xp: r.workout.xp,
      score: r.score, reasons: r.reasons,
    }));
    return NextResponse.json({
      engine: "rule-based-demo",
      notice: "Demo recommendation rules — no trained ML model is connected yet. Planned: Flask + scikit-learn API.",
      recommendations: results,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
