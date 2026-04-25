import { NextResponse } from "next/server";
import { demoPapers } from "@/lib/demo-data";
import type { Paper } from "@/lib/types";
import { isGutHealthDemo, parseJsonBody } from "@/lib/utils";

type SemanticScholarResponse = {
  data?: Array<{
    title?: string;
    abstract?: string | null;
    year?: number | null;
    venue?: string | null;
    citationCount?: number | null;
    url?: string | null;
    externalIds?: { DOI?: string | null };
    authors?: Array<{ name?: string }>;
  }>;
};

export async function POST(request: Request) {
  const { hypothesis } = await parseJsonBody<{ hypothesis: string }>(request);

  if (!hypothesis?.trim()) {
    return NextResponse.json({ error: "Hypothesis is required." }, { status: 400 });
  }

  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;

  if (!apiKey && isGutHealthDemo(hypothesis)) {
    return NextResponse.json({ papers: demoPapers });
  }

  if (!apiKey) {
    return NextResponse.json({ papers: [] });
  }

  try {
    const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
    url.searchParams.set("query", hypothesis);
    url.searchParams.set("limit", "5");
    url.searchParams.set(
      "fields",
      "title,abstract,year,authors,url,venue,citationCount,externalIds,openAccessPdf"
    );

    const response = await fetch(url.toString(), {
      headers: {
        "x-api-key": apiKey
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return NextResponse.json({ papers: isGutHealthDemo(hypothesis) ? demoPapers : [] });
    }

    const json = (await response.json()) as SemanticScholarResponse;
    const papers: Paper[] = (json.data ?? []).map((paper) => ({
      title: paper.title ?? "Untitled paper",
      abstract: paper.abstract ?? null,
      year: paper.year ?? null,
      venue: paper.venue ?? null,
      citationCount: paper.citationCount ?? null,
      url: paper.url ?? null,
      doi: paper.externalIds?.DOI ?? null,
      authors: (paper.authors ?? []).map((author) => author.name ?? "Unknown author")
    }));

    return NextResponse.json({ papers: papers.length > 0 ? papers : isGutHealthDemo(hypothesis) ? demoPapers : [] });
  } catch {
    return NextResponse.json({ papers: isGutHealthDemo(hypothesis) ? demoPapers : [] });
  }
}
