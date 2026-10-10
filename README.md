# Job Application Agent

A personal tool for job applications. Paste a job posting and Claude:

- pulls out the role, seniority, required and nice-to-have skills, and tech stack
- scores your fit (0-100) against your profile and explains the score
- lists where you match, with evidence from your profile
- lists gaps, with an honest way to address each one
- writes 5 talking points specific to that role

Save an analysis to the **Applications** tab to track its status, the date you applied, a follow-up date and notes. Follow-ups that are due show up at the top.

From an application, **Prepare application** lets you:

1. **Draft** a tailored cover letter and answers to the form's screening questions (paste them in, one per line). Anything Claude can't know from your profile, such as notice period or salary, is marked `[CONFIRM: ...]` and listed under "Check before you submit". Edits save automatically.
2. **Fill the form.** This opens the application page in a browser on your computer, finds the form (clicking "Apply" if needed), and fills in your details, CV upload, cover letter and answers. Filled fields are outlined green and fields that need you are outlined amber. **It never submits.** You review it and click Submit yourself. It deliberately leaves equal-opportunities questions, right to work, salary, notice period and consent boxes for you.
3. Click **I submitted it** to mark the application as applied and set a follow-up date 7 days out.

## Setup

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

For form filling, also set the `APPLICANT_*` values in `.env.local` (name, email, phone, LinkedIn, and the full path to your CV file). It uses your installed Google Chrome. Without Chrome, run `npx playwright install chromium` once. The browser keeps its own profile in `.data/browser-profile`, so if a site needs you to sign in, do it once in that window and it will stay signed in.

Then edit `lib/profile.ts` with your real background. The analysis is only as specific as that profile: add role titles, numbers, tools and outcomes.

## Storage

- **No Supabase configured:** applications are saved to `.data/applications.json`. That's fine for local use, but it won't persist on Vercel.
- **Supabase:** create a project, run `supabase/schema.sql` in the SQL editor (re-run it after updates; it only adds what is missing), then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The key is only used server-side.

## Deploy (Vercel)

Import the repo in Vercel and set `ANTHROPIC_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Form filling only works when you run the app on your own computer, not on Vercel. There is no login yet, so anyone with the URL can use it and see your applications. Add auth (Supabase Auth or Vercel password protection) before sharing the link.

## How it works

| Path | What it does |
| --- | --- |
| `lib/profile.ts` | Your background, sent with every analysis |
| `lib/types.ts` | The analysis schema (Zod) and application types |
| `lib/analysis.ts` | Calls Claude (`claude-opus-5-5` with structured output) and returns a validated analysis |
| `lib/drafting.ts` | Writes the cover letter and screening answers |
| `lib/autofill.ts` | Opens the form with Playwright, asks Claude which value goes in which field, fills it, and stops before submitting |
| `lib/store.ts` | Application storage: Supabase, or a local JSON file as a fallback |
| `app/api/analyze-job` | `POST { jobDescription, jobUrl? }` returns `{ analysis }` |
| `app/api/applications` | `GET` lists applications, `POST` saves one |
| `app/api/applications/[id]` | `PATCH` updates status, dates, notes or the draft, `DELETE` removes one |
| `app/api/draft-application` | `POST { jobDescription, analysis, questions, guidance? }` returns `{ draft }` |
| `app/api/autofill` | `POST { applicationId, url }` fills the form in a local browser and returns what was filled and what needs you |

Set `CLAUDE_MODEL` to use a different model. If the model declines a request, the API retries it on a fallback model automatically (`fallbacks: "default"`).

## Roadmap

- Fetch the posting from a URL instead of pasting it
- Company research (web search) to sharpen the talking points
- Interview prep from the gaps and talking points
- Auth and multiple profiles, before opening it to other users
