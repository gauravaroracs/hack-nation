import { NextResponse } from "next/server";
import { normalizePlanInput } from "@/lib/normalizers";
import { planGeneratorPrompt } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ExperimentPlan, HypothesisQuality, LiteratureQc, Paper, ScientistFeedback } from "@/lib/types";
import { callOpenAiJson, parseJsonBody } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{
      hypothesis: string;
      hypothesis_quality: HypothesisQuality;
      literature_qc: LiteratureQc;
      papers: Paper[];
      prior_feedback: ScientistFeedback[];
    }>(request);

    if (!body.hypothesis?.trim()) {
      return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
    }

    const result = await callOpenAiJson<unknown>({
      systemPrompt: planGeneratorPrompt,
      userPrompt: `Hypothesis:\n${body.hypothesis}\n\nHypothesis quality:\n${JSON.stringify(body.hypothesis_quality, null, 2)}\n\nLiterature QC:\n${JSON.stringify(body.literature_qc, null, 2)}\n\nRetrieved papers:\n${JSON.stringify(body.papers, null, 2)}\n\nPrior expert feedback:\n${JSON.stringify(body.prior_feedback, null, 2)}`
    });
    const normalized = normalizePlanInput({
      raw: result,
      hypothesis: body.hypothesis,
      hypothesisQuality: body.hypothesis_quality,
      literatureQc: body.literature_qc,
      priorFeedback: body.prior_feedback
    });

    const supabase = getSupabaseAdmin();

    if (supabase) {
      await supabase.from("generated_plans").insert({
        hypothesis: body.hypothesis,
        literature_qc: body.literature_qc,
        plan: normalized
      });
    }

    return NextResponse.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Plan generation failed.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
