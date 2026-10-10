"use client";

import { useState } from "react";
import type { Application, ApplicationDraft, ApplicationUpdate, AutofillResult } from "@/lib/types";

const fieldClass =
  "w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const buttonClass =
  "rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
const secondaryClass =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
      className="text-xs text-blue-600 hover:underline"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ApplicationPrep({
  application,
  onUpdate,
}: {
  application: Application;
  onUpdate: (patch: ApplicationUpdate) => Promise<void>;
}) {
  const [questions, setQuestions] = useState(application.draft?.answers.map((a) => a.question).join("\n") ?? "");
  const [guidance, setGuidance] = useState("");
  const [draft, setDraft] = useState<ApplicationDraft | null>(application.draft);
  const [drafting, setDrafting] = useState(false);
  const [formUrl, setFormUrl] = useState(application.job_url ?? "");
  const [filling, setFilling] = useState(false);
  const [result, setResult] = useState<AutofillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createDraft() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/draft-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: application.job_description,
          analysis: application.analysis,
          questions: questions.split("\n").map((q) => q.trim()).filter(Boolean),
          guidance: guidance.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drafting failed");
      setDraft(data.draft);
      await onUpdate({ draft: data.draft });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed");
    } finally {
      setDrafting(false);
    }
  }

  async function autofill() {
    setFilling(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id, url: formUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Autofill failed");
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autofill failed");
    } finally {
      setFilling(false);
    }
  }

  const saveDraft = () => draft && onUpdate({ draft });

  return (
    <div className="space-y-5 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">1. Draft your application</h3>
        <label className="block text-xs text-zinc-500">
          Screening questions from the form, one per line (optional)
          <textarea
            value={questions}
            onChange={(e) => setQuestions(e.target.value)}
            rows={3}
            className={`mt-1 ${fieldClass}`}
            placeholder="Why do you want to work here? (250 words)"
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Anything to emphasise or avoid (optional)
          <input value={guidance} onChange={(e) => setGuidance(e.target.value)} className={`mt-1 ${fieldClass}`} />
        </label>
        <button onClick={createDraft} disabled={drafting} className={buttonClass}>
          {drafting ? "Drafting… (up to a minute)" : draft ? "Redraft" : "Draft cover letter and answers"}
        </button>
      </section>

      {draft && (
        <section className="space-y-3">
          {draft.to_check.length > 0 && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium">Check before you submit:</p>
              <ul className="list-disc pl-5">
                {draft.to_check.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Cover letter</span>
              <CopyButton text={draft.cover_letter} />
            </div>
            <textarea
              value={draft.cover_letter}
              onChange={(e) => setDraft({ ...draft, cover_letter: e.target.value })}
              onBlur={saveDraft}
              rows={12}
              className={fieldClass}
            />
          </div>
          {draft.answers.map((a, i) => (
            <div key={i}>
              <div className="mb-1 flex items-start justify-between gap-3">
                <span className="text-sm font-medium">{a.question}</span>
                <CopyButton text={a.answer} />
              </div>
              <textarea
                value={a.answer}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    answers: draft.answers.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)),
                  })
                }
                onBlur={saveDraft}
                rows={5}
                className={fieldClass}
              />
            </div>
          ))}
          <p className="text-xs text-zinc-500">Edits save automatically when you click away.</p>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">2. Fill the form</h3>
        <p className="text-xs text-zinc-500">
          Opens the form in a browser on this computer and fills it in. It never submits: you review it and click
          Submit yourself. Sign in to the site in that window first if it asks.
        </p>
        <input
          type="url"
          value={formUrl}
          onChange={(e) => setFormUrl(e.target.value)}
          placeholder="Application form URL"
          className={fieldClass}
        />
        <button onClick={autofill} disabled={filling || !formUrl} className={buttonClass}>
          {filling ? "Filling… (watch the browser window)" : "Open and fill the form"}
        </button>
        {result && (
          <div className="space-y-2 text-sm">
            <p className="text-green-700 dark:text-green-400">
              Filled {result.filled.length} field{result.filled.length === 1 ? "" : "s"} (outlined green in the form).
            </p>
            {result.needs_you.length > 0 && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <p className="font-medium">Needs you (outlined amber):</p>
                <ul className="list-disc pl-5">
                  {result.needs_you.map((n, i) => (
                    <li key={i}>
                      <span className="font-medium">{n.label}</span>: {n.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">3. After you submit</h3>
        <button
          onClick={() => onUpdate({ status: "applied", applied_on: addDays(0), follow_up_on: addDays(7) })}
          disabled={application.status === "applied"}
          className={secondaryClass}
        >
          {application.status === "applied" ? "Marked as applied" : "I submitted it (follow up in 7 days)"}
        </button>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
