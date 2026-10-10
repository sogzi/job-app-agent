// Shared between server and browser code: keep this file free of server-only imports.
import { z } from "zod";

export const JobAnalysisSchema = z.object({
  role_title: z.string().describe("Job title as written in the posting"),
  company: z.string().describe("Company name, or an empty string if not stated"),
  seniority: z.string().describe("e.g. Entry, Mid, Senior, Lead"),
  location: z.string().describe("Location and work pattern, or an empty string if not stated"),
  required_skills: z.array(z.string()).describe("Must-have skills and experience"),
  nice_to_have_skills: z.array(z.string()),
  tech_stack: z.array(z.string()),
  relevance_score: z.number().int().describe("0-100 fit between the candidate and this role"),
  score_rationale: z.string().describe("One or two sentences explaining the score"),
  matched_skills: z.array(
    z.object({
      skill: z.string(),
      evidence: z.string().describe("Specific evidence from the candidate profile"),
    }),
  ),
  gaps: z.array(
    z.object({
      requirement: z.string(),
      mitigation: z.string().describe("How to address or reframe this gap honestly"),
    }),
  ),
  talking_points: z.array(z.string()).describe("Exactly 5 role-specific angles to lead with"),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export const APPLICATION_STATUSES = [
  "saved",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: string;
  created_at: string;
  role_title: string;
  company: string;
  job_url: string | null;
  job_description: string;
  relevance_score: number;
  analysis: JobAnalysis;
  status: ApplicationStatus;
  applied_on: string | null;
  follow_up_on: string | null;
  notes: string;
}

export type NewApplication = Pick<Application, "job_url" | "job_description" | "analysis">;
export type ApplicationUpdate = Partial<
  Pick<Application, "status" | "applied_on" | "follow_up_on" | "notes">
>;
