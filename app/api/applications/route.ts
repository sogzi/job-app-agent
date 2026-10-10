import { NextResponse } from "next/server";
import { z } from "zod";
import { JobAnalysisSchema } from "@/lib/types";
import { getStore } from "@/lib/store";

export async function GET() {
  try {
    return NextResponse.json({ applications: await getStore().list() });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not load applications." }, { status: 500 });
  }
}

const Body = z.object({
  jobDescription: z.string().min(1),
  jobUrl: z.string().nullable().optional(),
  analysis: JobAnalysisSchema,
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid application payload." }, { status: 400 });
  }
  try {
    const application = await getStore().create({
      job_description: parsed.data.jobDescription,
      job_url: parsed.data.jobUrl || null,
      analysis: parsed.data.analysis,
    });
    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not save application." }, { status: 500 });
  }
}
