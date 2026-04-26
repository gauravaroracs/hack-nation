import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ScientistFeedback } from "@/lib/types";
import { normalizeText, parseJsonBody } from "@/lib/utils";

export async function POST(request: Request) {
  const { hypothesis, experiment_domain, experiment_type } = await parseJsonBody<{
    hypothesis: string;
    experiment_domain: string;
    experiment_type: string;
  }>(request);

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client is not configured." }, { status: 503 });
  }

  try {
    const { data, error } = await supabase
      .from("scientist_feedback")
      .select(
        "experiment_domain, experiment_type, section, original_text, corrected_text, user_note, hypothesis, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to fetch scientist feedback." }, { status: 502 });
    }

    const input = normalizeText(hypothesis);
    const ranked = data
      .map((item) => {
        let score = 0;

        if (item.experiment_domain === experiment_domain) score += 5;
        if (item.experiment_type === experiment_type) score += 5;
        if (item.hypothesis && input.includes(normalizeText(item.hypothesis).slice(0, 24))) score += 3;
        if (item.corrected_text && input.includes("fitc-dextran") && item.corrected_text.toLowerCase().includes("fitc-dextran")) {
          score += 4;
        }

        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(
        (entry) =>
          ({
            experiment_domain: entry.item.experiment_domain,
            experiment_type: entry.item.experiment_type,
            section: entry.item.section,
            original_text: entry.item.original_text,
            corrected_text: entry.item.corrected_text,
            user_note: entry.item.user_note
          }) satisfies ScientistFeedback
      );

    return NextResponse.json({ feedback: ranked });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch scientist feedback.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
