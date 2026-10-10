import { NextResponse } from "next/server";
import { z } from "zod";
import { APPLICATION_STATUSES, getStore } from "@/lib/store";
import { ApplicationDraftSchema } from "@/lib/types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const Patch = z
  .object({
    status: z.enum(APPLICATION_STATUSES),
    applied_on: isoDate,
    follow_up_on: isoDate,
    notes: z.string(),
    draft: ApplicationDraftSchema.nullable(),
  })
  .partial();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  try {
    const application = await getStore().update(id, parsed.data);
    if (!application) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return NextResponse.json({ application });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not update application." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const removed = await getStore().remove(id);
    if (!removed) return NextResponse.json({ error: "Not found." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not delete application." }, { status: 500 });
  }
}
