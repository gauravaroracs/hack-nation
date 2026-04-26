import { NextResponse } from "next/server";
import { normalizePapers } from "@/lib/normalizers";
import type { Paper } from "@/lib/types";
import { parseJsonBody } from "@/lib/utils";

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

  if (!apiKey) {
    return NextResponse.json({ error: "SEMANTIC_SCHOLAR_API_KEY is not configured." }, { status: 503 });
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
      const body = await response.text();
      return NextResponse.json(
        { error: `Semantic Scholar request failed: ${response.status} ${body || response.statusText}` },
        { status: 502 }
      );
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

    return NextResponse.json({ papers: normalizePapers(papers) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Literature search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
