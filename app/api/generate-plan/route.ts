import { NextResponse } from "next/server";
import { buildDemoPlan } from "@/lib/demo-data";
import { planGeneratorPrompt } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ExperimentPlan, HypothesisQuality, LiteratureQc, Paper, ScientistFeedback } from "@/lib/types";
import { callOpenAiJson, isGutHealthDemo, parseJsonBody } from "@/lib/utils";

export async function POST(request: Request) {
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

  const fallback = isGutHealthDemo(body.hypothesis)
    ? buildDemoPlan(body.prior_feedback)
    : {
        ...buildDemoPlan(body.prior_feedback),
        experiment_title: "Runnable experiment plan draft",
        hypothesis: body.hypothesis,
        novelty_positioning: body.literature_qc.one_sentence_summary,
        experiment_domain: "general_science",
        experiment_type: "exploratory_experiment",
        hypothesis_quality: {
          is_testable: body.hypothesis_quality.is_testable,
          intervention: body.hypothesis_quality.intervention,
          measurable_outcome: body.hypothesis_quality.measurable_outcome,
          success_threshold: body.hypothesis_quality.success_threshold,
          model_system: body.hypothesis_quality.model_system
        }
      };

  const result = await callOpenAiJson<ExperimentPlan>({
    systemPrompt: planGeneratorPrompt,
    userPrompt: `Hypothesis:\n${body.hypothesis}\n\nHypothesis quality:\n${JSON.stringify(body.hypothesis_quality, null, 2)}\n\nLiterature QC:\n${JSON.stringify(body.literature_qc, null, 2)}\n\nRetrieved papers:\n${JSON.stringify(body.papers, null, 2)}\n\nPrior expert feedback:\n${JSON.stringify(body.prior_feedback, null, 2)}\n\nReturn the exact LabMind JSON contract for the experiment plan.`,
    fallback
  });

  const supabase = getSupabaseAdmin();

  if (supabase) {
    await supabase.from("generated_plans").insert({
      hypothesis: body.hypothesis,
      literature_qc: body.literature_qc,
      plan: result
    });
  }

  return NextResponse.json(result);
}
