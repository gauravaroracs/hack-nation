import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseJsonBody } from "@/lib/utils";

export async function POST(request: Request) {
  const body = await parseJsonBody<{
    plan_id: string;
    hypothesis: string;
    experiment_domain: string;
    experiment_type: string;
    section: string;
    original_text: string;
    corrected_text: string;
    user_note: string;
    rating: "good" | "needs_correction";
  }>(request);

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 503 });
  }

  const { error } = await supabase.from("scientist_feedback").insert(body);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
