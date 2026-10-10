import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Application, ApplicationUpdate, NewApplication } from "./types";

export { APPLICATION_STATUSES } from "./types";

interface Store {
  list(): Promise<Application[]>;
  create(input: NewApplication): Promise<Application>;
  update(id: string, patch: ApplicationUpdate): Promise<Application | null>;
  remove(id: string): Promise<boolean>;
}

function fromAnalysis(input: NewApplication): Omit<Application, "id" | "created_at"> {
  return {
    role_title: input.analysis.role_title,
    company: input.analysis.company,
    job_url: input.job_url,
    job_description: input.job_description,
    relevance_score: input.analysis.relevance_score,
    analysis: input.analysis,
    status: "saved",
    applied_on: null,
    follow_up_on: null,
    notes: "",
  };
}

class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}

  async list() {
    const { data, error } = await this.db
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Application[];
  }

  async create(input: NewApplication) {
    const { data, error } = await this.db
      .from("applications")
      .insert(fromAnalysis(input))
      .select()
      .single();
    if (error) throw error;
    return data as Application;
  }

  async update(id: string, patch: ApplicationUpdate) {
    const { data, error } = await this.db
      .from("applications")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return (data as Application) ?? null;
  }

  async remove(id: string) {
    const { error, count } = await this.db
      .from("applications")
      .delete({ count: "exact" })
      .eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }
}

// Local fallback for development without Supabase. Not suitable for serverless deploys.
class FileStore implements Store {
  private file = path.join(process.cwd(), ".data", "applications.json");

  private async read(): Promise<Application[]> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  private async write(apps: Application[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(apps, null, 2));
  }

  async list() {
    return (await this.read()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async create(input: NewApplication) {
    const app: Application = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...fromAnalysis(input),
    };
    await this.write([app, ...(await this.read())]);
    return app;
  }

  async update(id: string, patch: ApplicationUpdate) {
    const apps = await this.read();
    const i = apps.findIndex((a) => a.id === id);
    if (i === -1) return null;
    apps[i] = { ...apps[i], ...patch };
    await this.write(apps);
    return apps[i];
  }

  async remove(id: string) {
    const apps = await this.read();
    const next = apps.filter((a) => a.id !== id);
    await this.write(next);
    return next.length !== apps.length;
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (!store) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    store =
      url && key
        ? new SupabaseStore(createClient(url, key, { auth: { persistSession: false } }))
        : new FileStore();
  }
  return store;
}
