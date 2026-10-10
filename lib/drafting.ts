import { generateStructured } from "./claude";
import { CANDIDATE_PROFILE } from "./profile";
import { ApplicationDraftSchema, type ApplicationDraft, type JobAnalysis } from "./types";

const SYSTEM_PROMPT = `You write job application material for one candidate, in their voice (first person).

You receive the candidate's profile, a job posting, an analysis of their fit for it, and optionally the application form's screening questions and extra guidance from the candidate.

Cover letter:
- 250-400 words. Address it to the hiring manager unless the posting names someone.
- Open with why this role at this company, not with "I am writing to apply".
- Build the middle on the analysis's talking points and strongest matches, using specific outcomes and numbers from the profile.
- Address the most important gap briefly and honestly, framed around transferable evidence, only if it would obviously come up.
- Use British English unless the posting is clearly for a US employer.

Screening answers:
- Answer every question given, in order, copying each question exactly.
- Respect any word or character limit stated in the question. Without one, keep answers under 200 words.
- For competency or behaviour questions, use a STAR structure with a real example from the profile.

Rules for everything you write:
- Use only facts in the profile. Never invent employers, dates, numbers, certifications, clearances, salary expectations or right-to-work status.
- When a question needs a fact the profile lacks, write the best answer you can with a clearly marked placeholder like [CONFIRM: notice period], and list it in to_check.
- Plain, confident, specific prose. No cliches like "passionate", "dynamic", "hit the ground running".

<candidate_profile>
${CANDIDATE_PROFILE}
</candidate_profile>`;

export async function draftApplication(input: {
  jobDescription: string;
  analysis: JobAnalysis;
  questions: string[];
  guidance?: string;
}): Promise<ApplicationDraft> {
  const parts = [
    `<job_posting>\n${input.jobDescription}\n</job_posting>`,
    `<fit_analysis>\n${JSON.stringify(input.analysis, null, 2)}\n</fit_analysis>`,
    input.questions.length
      ? `<screening_questions>\n${input.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n</screening_questions>`
      : "There are no screening questions. Return an empty answers list.",
  ];
  if (input.guidance) parts.push(`<candidate_guidance>\n${input.guidance}\n</candidate_guidance>`);

  return generateStructured({
    schema: ApplicationDraftSchema,
    system: SYSTEM_PROMPT,
    content: parts.join("\n\n"),
    refusalMessage: "Claude declined to draft this application.",
  });
}
