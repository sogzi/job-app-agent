import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

let client: Anthropic | null = null;

export class ClaudeRefusedError extends Error {}

// One structured-output call: returns the model's answer parsed and validated against `schema`.
export async function generateStructured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  content: string;
  refusalMessage: string;
}): Promise<z.infer<T>> {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(opts.schema) },
    // Retry on a fallback model if the primary model declines the request.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
  });

  if (response.stop_reason === "refusal") {
    throw new ClaudeRefusedError(opts.refusalMessage);
  }
  if (!response.parsed_output) {
    throw new Error(`Claude did not return valid output (stop_reason: ${response.stop_reason}).`);
  }
  return response.parsed_output;
}
