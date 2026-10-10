import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { autofillApplication } from "@/lib/autofill";
import { ClaudeRefusedError } from "@/lib/claude";
import { getStore } from "@/lib/store";

export const maxDuration = 300;

const Body = z.object({
  applicationId: z.string().min(1),
  url: z.string().trim().url("Enter the application form's URL."),
});

export async function POST(request: Request) {
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: "Autofill opens a browser on your computer, so it only works when you run the app locally." },
      { status: 400 },
    );
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    const application = await getStore().get(parsed.data.applicationId);
    if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    const result = await autofillApplication(application, parsed.data.url);
    return NextResponse.json({ result });
  } catch (err) {
    if (err instanceof ClaudeRefusedError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      return NextResponse.json({ error: `Claude API error: ${err.message}` }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(err);
    if (/Executable doesn't exist|browserType\.launch/i.test(message)) {
      return NextResponse.json(
        { error: "No browser found. Install Google Chrome, or run `npx playwright install chromium`, then try again." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: `Autofill failed: ${message.split("\n")[0]}` }, { status: 500 });
  }
}
