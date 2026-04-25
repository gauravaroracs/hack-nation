import { GUT_HEALTH_HYPOTHESIS } from "@/lib/demo-data";

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isGutHealthDemo(value: string) {
  const input = normalizeText(value);
  const target = normalizeText(GUT_HEALTH_HYPOTHESIS);

  return input === target || (input.includes("fitc-dextran") && input.includes("lactobacillus"));
}

export function clampScore(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function buildJsonHeaders() {
  return {
    "Content-Type": "application/json"
  };
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function safeJsonParse<T>(value: string): T {
  const trimmed = value.trim();
  const cleaned = trimmed.replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned) as T;
}

export async function callOpenAiJson<T>({
  systemPrompt,
  userPrompt,
  fallback
}: {
  systemPrompt: string;
  userPrompt: string;
  fallback: T;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    return fallback;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      return fallback;
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = json.choices?.[0]?.message?.content;

    if (!content) {
      return fallback;
    }

    return safeJsonParse<T>(content);
  } catch {
    return fallback;
  }
}
