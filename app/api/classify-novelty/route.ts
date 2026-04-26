import { NextResponse } from "next/server";
import { normalizeLiteratureQc } from "@/lib/normalizers";
import { noveltyClassifierPrompt } from "@/lib/prompts";
import type { Paper } from "@/lib/types";
import { callOpenAiJson, isGutHealthDemo, parseJsonBody } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { hypothesis, papers } = await parseJsonBody<{ hypothesis: string; papers: Paper[] }>(request);

    if (!hypothesis?.trim()) {
      return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
    }

    const result = await callOpenAiJson<unknown>({
      systemPrompt: noveltyClassifierPrompt,
      userPrompt: `Hypothesis: ${hypothesis}\n\nRetrieved papers:\n${JSON.stringify(papers, null, 2)}`
    });

    return NextResponse.json(normalizeLiteratureQc(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Novelty classification failed.";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
