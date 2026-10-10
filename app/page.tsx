"use client";

import { useState } from "react";
import JobAnalysis from "./components/JobAnalysis";
import ApplicationTracker from "./components/ApplicationTracker";

type Tab = "analyze" | "history";

export default function Home() {
  const [tab, setTab] = useState<Tab>("analyze");
  // Bumped after a save so the tracker refetches when opened.
  const [savedCount, setSavedCount] = useState(0);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Job Application Agent</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Paste a job posting to see how well you fit, where the gaps are, and what to lead with.
        </p>
      </header>

      <nav className="mb-6 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {(
          [
            ["analyze", "Analyze job"],
            ["history", "Applications"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "analyze" ? (
        <JobAnalysis onSaved={() => setSavedCount((n) => n + 1)} />
      ) : (
        <ApplicationTracker key={savedCount} />
      )}
    </main>
  );
}
