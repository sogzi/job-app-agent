import { NextResponse } from "next/server";
import { z } from "zod";
import { claudeErrorResponse } from "@/lib/api-errors";
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
    return claudeErrorResponse(err, "Drafting failed");
  }
}
