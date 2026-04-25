import { NextResponse } from "next/server";
import { demoLiteratureQc } from "@/lib/demo-data";
import { noveltyClassifierPrompt } from "@/lib/prompts";
import type { LiteratureQc, Paper } from "@/lib/types";
import { callOpenAiJson, isGutHealthDemo, parseJsonBody } from "@/lib/utils";

export async function POST(request: Request) {
  const { hypothesis, papers } = await parseJsonBody<{ hypothesis: string; papers: Paper[] }>(request);

  if (!hypothesis?.trim()) {
    return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
  }

  const fallback: LiteratureQc = isGutHealthDemo(hypothesis)
    ? demoLiteratureQc
    : {
        novelty_signal: papers.length ? "similar_work_exists" : "not_found",
        confidence: papers.length ? 0.58 : 0.44,
        one_sentence_summary: papers.length
          ? "Retrieved papers suggest adjacent work, but this is not yet a deep novelty review."
          : "No close papers were retrieved from the quick search, so the novelty signal is weakly positive.",
        reasoning: "This classification is based only on the retrieved titles and abstracts.",
        top_references: papers.slice(0, 3).map((paper) => ({
          title: paper.title,
          year: paper.year ? String(paper.year) : "Unknown",
          venue: paper.venue ?? "Unknown venue",
          url: paper.url ?? "",
          relevance: "Potentially related prior work."
        })),
        missing_information: ["A deeper literature pass may change this signal."],
        recommendation_for_experiment_planning:
          "Proceed with planning, but treat this novelty classification as a fast heuristic."
      };

  const result = await callOpenAiJson<LiteratureQc>({
    systemPrompt: noveltyClassifierPrompt,
    userPrompt: `Hypothesis: ${hypothesis}\n\nRetrieved papers:\n${JSON.stringify(papers, null, 2)}\n\nReturn novelty_signal, confidence, one_sentence_summary, reasoning, top_references, missing_information, recommendation_for_experiment_planning.`,
    fallback
  });

  return NextResponse.json(result);
}
