import { NextResponse } from "next/server";
import { demoHypothesisQuality } from "@/lib/demo-data";
import { hypothesisValidatorPrompt } from "@/lib/prompts";
import type { HypothesisQuality } from "@/lib/types";
import { callOpenAiJson, parseJsonBody } from "@/lib/utils";

export async function POST(request: Request) {
  const { hypothesis } = await parseJsonBody<{ hypothesis: string }>(request);

  if (!hypothesis?.trim()) {
    return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
  }

  const fallback: HypothesisQuality = hypothesis.toLowerCase().includes("will")
    ? demoHypothesisQuality
    : {
        is_testable: false,
        intervention: "",
        measurable_outcome: "",
        success_threshold: "",
        model_system: "",
        mechanistic_rationale: "",
        clarifying_suggestions: [
          "Name a specific intervention or change you want to test.",
          "Define a measurable endpoint and target threshold.",
          "Specify the model system or experimental context."
        ],
        quality_score: 42
      };

  const result = await callOpenAiJson<HypothesisQuality>({
    systemPrompt: hypothesisValidatorPrompt,
    userPrompt: `Hypothesis: ${hypothesis}\n\nReturn the fields: is_testable, intervention, measurable_outcome, success_threshold, model_system, mechanistic_rationale, clarifying_suggestions, quality_score.`,
    fallback
  });

  return NextResponse.json(result);
}
