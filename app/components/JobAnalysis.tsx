"use client";

import { useState } from "react";
import type { JobAnalysis as Analysis } from "@/lib/types";

export function scoreColor(score: number) {
  if (score >= 80) return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  if (score >= 60) return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  if (score >= 40) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900";

export default function JobAnalysis({ onSaved }: { onSaved: () => void }) {
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setSaveState("idle");
    try {
      const res = await fetch("/api/analyze-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, jobUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!analysis) return;
    setSaveState("saving");
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription, jobUrl: jobUrl || null, analysis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSaveState("saved");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveState("idle");
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={analyze} className="space-y-3">
        <input
          type="url"
          placeholder="Job posting URL (optional)"
          value={jobUrl}
          onChange={(e) => setJobUrl(e.target.value)}
          className={inputClass}
        />
        <textarea
          placeholder="Paste the full job description here"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={12}
          className={inputClass}
          required
        />
        <button
          type="submit"
          disabled={loading || jobDescription.trim().length < 50}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Analyzing… (this can take a minute)" : "Analyze"}
        </button>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {analysis && (
        <AnalysisView analysis={analysis}>
          <button
            onClick={save}
            disabled={saveState !== "idle"}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {saveState === "saved" ? "Saved to Applications" : saveState === "saving" ? "Saving…" : "Save to Applications"}
          </button>
        </AnalysisView>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-zinc-500">None listed</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
          {s}
        </span>
      ))}
    </div>
  );
}

export function AnalysisView({ analysis, children }: { analysis: Analysis; children?: React.ReactNode }) {
  const meta = [analysis.company, analysis.seniority, analysis.location].filter(Boolean).join(" · ");
  return (
    <div className="space-y-6 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{analysis.role_title}</h2>
          {meta && <p className="text-sm text-zinc-500">{meta}</p>}
        </div>
        <div className={`rounded-lg px-3 py-2 text-center ${scoreColor(analysis.relevance_score)}`}>
          <div className="text-2xl font-bold">{analysis.relevance_score}%</div>
          <div className="text-xs">fit</div>
        </div>
      </div>
      <p className="text-sm">{analysis.score_rationale}</p>

      <Section title="Talking points">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {analysis.talking_points.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      </Section>

      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Where you match">
          <ul className="space-y-2 text-sm">
            {analysis.matched_skills.map((m, i) => (
              <li key={i}>
                <span className="font-medium">{m.skill}</span>
                <span className="text-zinc-500">: {m.evidence}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Gaps and how to handle them">
          <ul className="space-y-2 text-sm">
            {analysis.gaps.map((g, i) => (
              <li key={i}>
                <span className="font-medium">{g.requirement}</span>
                <span className="text-zinc-500">: {g.mitigation}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Required skills">
        <Chips items={analysis.required_skills} />
      </Section>
      <Section title="Nice to have">
        <Chips items={analysis.nice_to_have_skills} />
      </Section>
      <Section title="Tech stack">
        <Chips items={analysis.tech_stack} />
      </Section>

      {children}
    </div>
  );
}
