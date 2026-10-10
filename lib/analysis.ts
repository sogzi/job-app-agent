import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CANDIDATE_PROFILE } from "./profile";
import { JobAnalysisSchema, type JobAnalysis } from "./types";

const SYSTEM_PROMPT = `You help one candidate decide how to position themselves for a specific job.

You will receive the candidate's profile and a job posting. Extract what the role actually requires, then compare it honestly against the profile.

Scoring guide for relevance_score (0-100): 80+ means they meet nearly every must-have; 60-79 means a credible application with a few gaps; 40-59 means a stretch; below 40 means a poor fit.

Only cite evidence that appears in the profile. Never invent experience, employers, numbers or certifications. If the profile is vague on something, say what detail would strengthen the claim.

Talking points must be specific to this role and company, not generic advice. Give exactly 5.

<candidate_profile>
${CANDIDATE_PROFILE}
</candidate_profile>`;

let client: Anthropic | null = null;

export class AnalysisRefusedError extends Error {}

export async function analyzeJob(jobDescription: string, jobUrl?: string): Promise<JobAnalysis> {
  const posting = jobUrl ? `Source URL: ${jobUrl}\n\n${jobDescription}` : jobDescription;

  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(JobAnalysisSchema) },
    // Retry on a fallback model if the primary model declines the request.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `<job_posting>\n${posting}\n</job_posting>` }],
  });

  if (response.stop_reason === "refusal") {
    throw new AnalysisRefusedError("Claude declined to analyse this posting.");
  }
  if (!response.parsed_output) {
    throw new Error(`Analysis did not return valid output (stop_reason: ${response.stop_reason}).`);
  }
  return response.parsed_output;
}
