import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeJob } from "@/lib/analysis";
import { claudeErrorResponse } from "@/lib/api-errors";

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
    return claudeErrorResponse(err, "Analysis failed");
  }
}
