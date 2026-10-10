import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { analyzeJob } from "@/lib/analysis";
import { ClaudeRefusedError } from "@/lib/claude";

// Analyses can take a while with thinking on.
export const maxDuration = 120;

const Body = z.object({
  jobDescription: z.string().trim().min(50, "Paste the full job description (at least 50 characters)."),
  jobUrl: z.string().trim().url().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const analysis = await analyzeJob(parsed.data.jobDescription, parsed.data.jobUrl || undefined);
    return NextResponse.json({ analysis });
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
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}
