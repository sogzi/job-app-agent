# Job Application Agent

A personal tool for job applications. Paste a job posting and Claude:

- pulls out the role, seniority, required and nice-to-have skills, and tech stack
- scores your fit (0-100) against your profile and explains the score
- lists where you match, with evidence from your profile
- lists gaps, with an honest way to address each one
- writes 5 talking points specific to that role

Save an analysis to the **Applications** tab to track its status, the date you applied, a follow-up date and notes. Follow-ups that are due show up at the top.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Then edit `lib/profile.ts` with your real background. The analysis is only as specific as that profile: add role titles, numbers, tools and outcomes.

## Storage

- **No Supabase configured:** applications are saved to `.data/applications.json`. That's fine for local use, but it won't persist on Vercel.
- **Supabase:** create a project, run `supabase/schema.sql` in the SQL editor, then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The key is only used server-side.

## Deploy (Vercel)

Import the repo in Vercel and set `ANTHROPIC_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. There is no login yet, so anyone with the URL can use it and see your applications. Add auth (Supabase Auth or Vercel password protection) before sharing the link.

## How it works

| Path | What it does |
| --- | --- |
| `lib/profile.ts` | Your background, sent with every analysis |
| `lib/types.ts` | The analysis schema (Zod) and application types |
| `lib/analysis.ts` | Calls Claude (`claude-opus-5-5` with structured output) and returns a validated analysis |
| `lib/store.ts` | Application storage: Supabase, or a local JSON file as a fallback |
| `app/api/analyze-job` | `POST { jobDescription, jobUrl? }` returns `{ analysis }` |
| `app/api/applications` | `GET` lists applications, `POST` saves one |
| `app/api/applications/[id]` | `PATCH` updates status, dates or notes, `DELETE` removes one |

Set `CLAUDE_MODEL` to use a different model. If the model declines a request, the API retries it on a fallback model automatically (`fallbacks: "default"`).

## Roadmap

- Fetch the posting from a URL instead of pasting it
- Draft cover letters and application answers from the analysis
- Company research (web search) to sharpen the talking points
- Interview prep from the gaps and talking points
- Auth and multiple profiles, before opening it to other users
