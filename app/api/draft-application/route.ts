import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ClaudeRefusedError } from "@/lib/claude";
import { draftApplication } from "@/lib/drafting";
import { JobAnalysisSchema } from "@/lib/types";

export const maxDuration = 180;

const Body = z.object({
  jobDescription: z.string().trim().min(1),
  analysis: JobAnalysisSchema,
  questions: z.array(z.string().trim().min(1)).max(30).default([]),
  guidance: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const draft = await draftApplication({ ...parsed.data, guidance: parsed.data.guidance || undefined });
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof ClaudeRefusedError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is missing or invalid." }, { status: 500 });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Rate limited by the Claude API. Try again shortly." }, { status: 429 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      return NextResponse.json({ error: `Claude API error: ${err.message}` }, { status: 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Drafting failed." }, { status: 500 });
  }
}
