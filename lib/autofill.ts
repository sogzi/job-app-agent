import path from "path";
import { existsSync } from "fs";
import { z } from "zod";
import type { BrowserContext, Frame, Page } from "playwright";
import { getApplicantContact, getCvPath } from "./applicant";
import { generateStructured } from "./claude";
import { CANDIDATE_PROFILE } from "./profile";
import type { Application, AutofillResult } from "./types";

// A form control found on the page, as described to Claude.
interface FormField {
  id: string; // "<frame index>:<field id>"
  kind: string;
  label: string;
  required: boolean;
  options?: string[];
  max_length?: number;
}

const AutofillPlanSchema = z.object({
  fills: z.array(z.object({ field_id: z.string(), value: z.string() })),
  needs_you: z.array(z.object({ field_id: z.string(), reason: z.string() })),
});

const PLAN_PROMPT = `You fill in a job application form for one candidate. You receive the form's fields, the candidate's contact details, their profile, and drafted application material. Decide what goes in each field.

Return fills (field_id and value) for fields you can complete, and needs_you (field_id and a short reason) for fields the candidate must handle themselves.

Values:
- text, email, tel, url, textarea, number, date: the text to enter. Respect max_length.
- select, radio_group, combobox: one option copied exactly from the field's options (for combobox, the text to type).
- checkbox_group: the chosen options copied exactly, separated by " | ".
- checkbox: "yes" or "no".
- file: "CV" for a résumé or CV upload when a CV file is available. Put any other upload in needs_you.

Rules:
- Use only facts from the contact details, profile and drafts. An empty contact value means unknown: put that field in needs_you.
- A cover letter text field gets the drafted cover letter. A question that matches a drafted answer gets that answer verbatim.
- For any other free-text question, write a concise answer from the profile, fill it, and also add it to needs_you with the reason "Written on the fly: review".
- Always leave to the candidate (needs_you, never fill): equal opportunities and demographic questions (gender, ethnicity, sexuality, disability, veteran status, age), criminal record, salary expectations, notice period, right to work, visa or sponsorship, security clearance, and any consent, declaration, privacy or terms checkbox.
- Skip optional fields that nothing in the inputs answers. Do not list them anywhere.`;

const g = globalThis as unknown as { __jaaBrowser?: Promise<BrowserContext> };

// One persistent browser, so site logins survive between runs.
async function getBrowser(): Promise<BrowserContext> {
  if (!g.__jaaBrowser) {
    g.__jaaBrowser = (async () => {
      const { chromium } = await import("playwright");
      const userDataDir = path.join(process.cwd(), ".data", "browser-profile");
      const options = { headless: process.env.AUTOFILL_HEADLESS === "1", viewport: null };
      let context: BrowserContext;
      try {
        // Prefer the installed Google Chrome; fall back to Playwright's bundled Chromium.
        context = await chromium.launchPersistentContext(userDataDir, { ...options, channel: "chrome" });
      } catch {
        context = await chromium.launchPersistentContext(userDataDir, options);
      }
      context.on("close", () => {
        g.__jaaBrowser = undefined;
      });
      return context;
    })();
    g.__jaaBrowser.catch(() => {
      g.__jaaBrowser = undefined;
    });
  }
  return g.__jaaBrowser;
}

// Runs inside the page: tags every fillable control with data-jaa-id and describes it.
function scanFrame() {
  const clean = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const questionText = (el: Element) =>
    clean(
      (el.closest("fieldset")?.querySelector("legend") as HTMLElement | null)?.innerText ||
        (el.closest('[class*="question"], [class*="field"], li') as HTMLElement | null)?.innerText,
    );
  const labelFor = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
    if (el.labels && el.labels.length) return clean([...el.labels].map((l) => l.innerText).join(" "));
    const aria = el.getAttribute("aria-label");
    if (aria) return clean(aria);
    const by = el.getAttribute("aria-labelledby");
    if (by) return clean(by.split(" ").map((id) => document.getElementById(id)?.innerText || "").join(" "));
    return questionText(el) || clean(el.getAttribute("placeholder") || el.name || el.id);
  };
  const optionLabel = (el: HTMLInputElement) =>
    clean(el.labels?.[0]?.innerText || (el.closest("label") as HTMLElement | null)?.innerText || el.value);

  const fields: { id: string; kind: string; label: string; required: boolean; options?: string[]; max_length?: number }[] = [];
  const groups = new Set<string>();
  let n = 0;
  for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    "input, textarea, select",
  )) {
    const type = el instanceof HTMLInputElement ? (el.type || "text").toLowerCase() : el.tagName.toLowerCase();
    if (["hidden", "submit", "button", "image", "reset", "search"].includes(type)) continue;
    if (el.disabled || (el as HTMLInputElement).readOnly) continue;
    if (type !== "file" && !visible(el)) continue; // upload inputs are often visually hidden

    if (el instanceof HTMLInputElement && (type === "radio" || type === "checkbox")) {
      const group = el.name
        ? [...document.querySelectorAll<HTMLInputElement>(`input[type="${type}"][name="${CSS.escape(el.name)}"]`)]
        : [el];
      if (type === "radio" || group.length > 1) {
        const key = `${type}:${el.name}`;
        if (groups.has(key)) continue;
        groups.add(key);
        const id = `f${++n}`;
        group.forEach((opt, i) => {
          opt.dataset.jaaId = id;
          opt.dataset.jaaOption = String(i);
        });
        // The question is the nearest ancestor holding every option plus some text of its own.
        const optionText = group.map(optionLabel).join(" ");
        let container: HTMLElement | null = el.parentElement;
        while (container && !group.every((opt) => container!.contains(opt))) container = container.parentElement;
        while (container && clean(container.innerText) === clean(optionText)) container = container.parentElement;
        const legend = (el.closest("fieldset")?.querySelector("legend") as HTMLElement | null)?.innerText;
        let question = clean(legend || container?.innerText);
        // Drop the option labels that trail the question text.
        for (const o of group.map(optionLabel).reverse()) {
          if (o && question.endsWith(o)) question = question.slice(0, -o.length).trim();
        }
        fields.push({
          id,
          kind: `${type}_group`,
          label: clean(question) || el.name,
          required: group.some((opt) => opt.required),
          options: group.map(optionLabel),
        });
        continue;
      }
    }

    const id = `f${++n}`;
    el.dataset.jaaId = id;
    const field: (typeof fields)[number] = {
      id,
      kind: el.getAttribute("role") === "combobox" ? "combobox" : type,
      label: labelFor(el),
      required: el.required || el.getAttribute("aria-required") === "true",
    };
    if (el instanceof HTMLSelectElement) {
      field.options = [...el.options].map((o) => clean(o.text)).filter(Boolean).slice(0, 100);
    }
    if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.maxLength > 0) {
      field.max_length = el.maxLength;
    }
    fields.push(field);
  }
  return fields;
}

async function scanPage(page: Page): Promise<FormField[]> {
  const all: FormField[] = [];
  for (const [i, frame] of page.frames().entries()) {
    const fields = await frame.evaluate(scanFrame).catch(() => []);
    all.push(...fields.map((f) => ({ ...f, id: `${i}:${f.id}` })));
  }
  return all;
}

// Many job pages show the description first, with the form behind an "Apply" link.
async function openFormIfNeeded(page: Page, fields: FormField[]): Promise<FormField[]> {
  if (fields.filter((f) => f.kind !== "file").length >= 3) return fields;
  const apply = page
    .locator('a, button:not([type="submit"])')
    .filter({ hasText: /apply/i })
    .filter({ hasNotText: /submit|send/i });
  const target = apply.first();
  if (!(await target.isVisible().catch(() => false))) return fields;
  await target.click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(2000);
  return scanPage(page);
}

function frameFor(page: Page, fieldId: string): { frame: Frame; id: string } {
  const [frameIndex, id] = fieldId.split(":");
  return { frame: page.frames()[Number(frameIndex)], id };
}

function closestIndex(options: string[], value: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const v = norm(value);
  const exact = options.findIndex((o) => norm(o) === v);
  if (exact >= 0) return exact;
  return options.findIndex((o) => norm(o).includes(v) || v.includes(norm(o)));
}

async function fillField(page: Page, field: FormField, value: string, cvPath: string | null) {
  const { frame, id } = frameFor(page, field.id);
  const el = frame.locator(`[data-jaa-id="${id}"]`);
  const opts = { timeout: 5000 };

  switch (field.kind) {
    case "file":
      if (value !== "CV" || !cvPath) throw new Error("No CV file to upload");
      await el.setInputFiles(cvPath, opts);
      return;
    case "select":
      await el.selectOption({ label: value }, opts).catch(() => el.selectOption(value, opts));
      return;
    case "checkbox":
      await el.setChecked(/^(yes|true)$/i.test(value), { ...opts, force: true });
      return;
    case "radio_group":
    case "checkbox_group": {
      const wanted = field.kind === "radio_group" ? [value] : value.split(" | ");
      for (const w of wanted) {
        const i = closestIndex(field.options ?? [], w);
        if (i < 0) throw new Error(`No option matching "${w}"`);
        await frame.locator(`[data-jaa-id="${id}"][data-jaa-option="${i}"]`).check({ ...opts, force: true });
      }
      return;
    }
    case "combobox":
      // Custom dropdowns: type the option, then pick the highlighted match.
      await el.click(opts);
      await el.fill(value, opts);
      await page.waitForTimeout(600);
      await el.press("Enter", opts);
      return;
    default:
      await el.fill(value, opts);
  }
}

// Outline what was filled (green) and what needs attention (amber), and add a reminder banner.
async function annotate(page: Page, filled: string[], flagged: string[]) {
  for (const [i, frame] of page.frames().entries()) {
    const local = (ids: string[]) => ids.filter((id) => id.startsWith(`${i}:`)).map((id) => id.split(":")[1]);
    await frame
      .evaluate(
        ({ ok, warn, top }) => {
          const mark = (ids: string[], color: string) =>
            ids.forEach((id) =>
              document.querySelectorAll<HTMLElement>(`[data-jaa-id="${id}"]`).forEach((el) => {
                el.style.outline = `3px solid ${color}`;
                el.style.outlineOffset = "2px";
              }),
            );
          mark(ok, "#16a34a");
          mark(warn, "#f59e0b");
          if (top && !document.getElementById("jaa-banner")) {
            const b = document.createElement("div");
            b.id = "jaa-banner";
            b.textContent =
              "Filled by Job Application Agent. Green = filled, amber = needs you. Check every field, then submit it yourself.";
            b.style.cssText =
              "position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:10px 16px;background:#1e3a8a;color:#fff;font:14px/1.4 system-ui,sans-serif;text-align:center";
            document.body.appendChild(b);
          }
        },
        { ok: local(filled), warn: local(flagged), top: i === 0 },
      )
      .catch(() => {});
  }
}

export async function autofillApplication(application: Application, url: string): Promise<AutofillResult> {
  const cvPath = getCvPath();
  const cvAvailable = !!cvPath && existsSync(cvPath);

  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  const fields = await openFormIfNeeded(page, await scanPage(page));
  if (fields.length === 0) {
    return {
      url: page.url(),
      filled: [],
      needs_you: [{ label: "Whole form", reason: "No form found on this page. Open the application form and try again with its URL." }],
    };
  }

  const draft = application.draft;
  const plan = await generateStructured({
    schema: AutofillPlanSchema,
    system: PLAN_PROMPT,
    content: [
      `<form_fields>\n${JSON.stringify(fields, null, 2)}\n</form_fields>`,
      `<contact>\n${JSON.stringify(getApplicantContact(), null, 2)}\nCV file available: ${cvAvailable ? "yes" : "no"}\n</contact>`,
      `<candidate_profile>\n${CANDIDATE_PROFILE}\n</candidate_profile>`,
      `<role>${application.role_title} at ${application.company || "unknown company"}</role>`,
      draft
        ? `<drafted_cover_letter>\n${draft.cover_letter}\n</drafted_cover_letter>\n<drafted_answers>\n${JSON.stringify(draft.answers, null, 2)}\n</drafted_answers>`
        : "No drafts exist for this application yet.",
    ].join("\n\n"),
    refusalMessage: "Claude declined to fill this form.",
  });

  const byId = new Map(fields.map((f) => [f.id, f]));
  const filled: string[] = [];
  const needsYou = new Map(
    plan.needs_you.filter((n) => byId.has(n.field_id)).map((n) => [n.field_id, n.reason] as const),
  );

  for (const { field_id, value } of plan.fills) {
    const field = byId.get(field_id);
    if (!field || !value) continue;
    try {
      await fillField(page, field, value, cvAvailable ? cvPath : null);
      filled.push(field_id);
    } catch (err) {
      needsYou.set(field_id, `Couldn't fill automatically (${err instanceof Error ? err.message.split("\n")[0] : "error"})`);
    }
  }
  // Required fields nobody addressed still need the candidate.
  for (const f of fields) {
    if (f.required && !filled.includes(f.id) && !needsYou.has(f.id)) needsYou.set(f.id, "Required, left blank");
  }

  await annotate(page, filled.filter((id) => !needsYou.has(id)), [...needsYou.keys()]);
  await page.bringToFront().catch(() => {});

  const label = (id: string) => byId.get(id)?.label || id;
  return {
    url: page.url(),
    filled: filled.filter((id) => !needsYou.has(id)).map(label),
    needs_you: [...needsYou].map(([id, reason]) => ({ label: label(id), reason })),
  };
}
