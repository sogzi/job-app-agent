import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ClaudeRefusedError } from "./claude";

// Turns a failed Claude call into a JSON response the UI can show as-is.
export function claudeErrorResponse(err: unknown, fallback: string) {
  if (err instanceof ClaudeRefusedError) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is invalid. Check the key in .env.local." }, { status: 500 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: "Rate limited by the Claude API. Try again shortly." }, { status: 429 });
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Claude API error", err.status, err.message);
    return NextResponse.json({ error: `Claude API error: ${err.message}` }, { status: 502 });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  if (/Could not resolve authentication method/i.test(message)) {
    return NextResponse.json(
      { error: "No ANTHROPIC_API_KEY found. Add it to .env.local, then restart npm run dev." },
      { status: 500 },
    );
  }
  return NextResponse.json({ error: `${fallback}: ${message.split("\n")[0]}` }, { status: 500 });
}
