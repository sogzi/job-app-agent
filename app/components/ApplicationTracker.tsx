"use client";

import { useEffect, useState } from "react";
import { APPLICATION_STATUSES, type Application, type ApplicationUpdate } from "@/lib/types";
import ApplicationPrep from "./ApplicationPrep";
import { AnalysisView, scoreColor } from "./JobAnalysis";

const today = () => new Date().toISOString().slice(0, 10);

export default function ApplicationTracker() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ id: string; panel: "prep" | "analysis" } | null>(null);
  const toggle = (id: string, panel: "prep" | "analysis") =>
    setOpen(open?.id === id && open.panel === panel ? null : { id, panel });

  useEffect(() => {
    fetch("/api/applications")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load applications");
        setApps(data.applications);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function update(id: string, patch: ApplicationUpdate) {
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "Update failed");
    setApps((prev) => prev?.map((a) => (a.id === id ? data.application : a)) ?? null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this application?")) return;
    const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (!res.ok) return setError("Delete failed");
    setApps((prev) => prev?.filter((a) => a.id !== id) ?? null);
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!apps) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (apps.length === 0)
    return <p className="text-sm text-zinc-500">No applications yet. Analyze a job and save it to start tracking.</p>;

  const due = apps.filter((a) => a.follow_up_on && a.follow_up_on <= today() && !["rejected", "withdrawn", "offer"].includes(a.status));

  return (
    <div className="space-y-4">
      {due.length > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {due.length} follow-up{due.length > 1 ? "s" : ""} due: {due.map((a) => a.company || a.role_title).join(", ")}
        </p>
      )}
      <ul className="space-y-3">
        {apps.map((a) => (
          <li key={a.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{a.role_title}</p>
                <p className="text-sm text-zinc-500">
                  {a.company || "Unknown company"} · added {a.created_at.slice(0, 10)}
                  {a.job_url && (
                    <>
                      {" · "}
                      <a href={a.job_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        posting
                      </a>
                    </>
                  )}
                </p>
              </div>
              <span className={`rounded px-2 py-0.5 text-sm font-semibold ${scoreColor(a.relevance_score)}`}>
                {a.relevance_score}%
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Status</span>
                <select
                  value={a.status}
                  onChange={(e) => {
                    const status = e.target.value as Application["status"];
                    update(a.id, status === "applied" && !a.applied_on ? { status, applied_on: today() } : { status });
                  }}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {APPLICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Applied</span>
                <input
                  type="date"
                  value={a.applied_on ?? ""}
                  onChange={(e) => update(a.id, { applied_on: e.target.value || null })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">Follow up</span>
                <input
                  type="date"
                  value={a.follow_up_on ?? ""}
                  onChange={(e) => update(a.id, { follow_up_on: e.target.value || null })}
                  className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <button onClick={() => toggle(a.id, "prep")} className="font-medium text-blue-600 hover:underline">
                {open?.id === a.id && open.panel === "prep" ? "Hide" : "Prepare application"}
              </button>
              <button onClick={() => toggle(a.id, "analysis")} className="text-blue-600 hover:underline">
                {open?.id === a.id && open.panel === "analysis" ? "Hide analysis" : "View analysis"}
              </button>
              <button onClick={() => remove(a.id)} className="text-red-600 hover:underline">
                Delete
              </button>
            </div>

            <textarea
              defaultValue={a.notes}
              placeholder="Notes (contacts, referral, interview dates…)"
              onBlur={(e) => e.target.value !== a.notes && update(a.id, { notes: e.target.value })}
              rows={2}
              className="mt-3 w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />

            {open?.id === a.id && (
              <div className="mt-3">
                {open.panel === "prep" ? (
                  <ApplicationPrep application={a} onUpdate={(patch) => update(a.id, patch)} />
                ) : (
                  <AnalysisView analysis={a.analysis} />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
