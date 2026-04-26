import { NextResponse } from "next/server";
import { normalizeHypothesisQuality } from "@/lib/normalizers";
import { hypothesisValidatorPrompt } from "@/lib/prompts";
import { callOpenAiJson, parseJsonBody } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { hypothesis } = await parseJsonBody<{ hypothesis: string }>(request);

    if (!hypothesis?.trim()) {
      return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
    }

    const result = await callOpenAiJson<unknown>({
      systemPrompt: hypothesisValidatorPrompt,
      userPrompt: `Hypothesis: ${hypothesis}`
    });

    return NextResponse.json(normalizeHypothesisQuality(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hypothesis validation failed.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
