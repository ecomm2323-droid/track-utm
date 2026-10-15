import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

type Param = string | number | null;
interface Stmt {
  run(...p: Param[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  get(...p: Param[]): Record<string, unknown> | undefined;
  all(...p: Param[]): Record<string, unknown>[];
}
interface Db {
  exec(sql: string): void;
  prepare(sql: string): Stmt;
}

const SCHEMA = `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS project(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, public_key TEXT NOT NULL UNIQUE,
  attribution_window_days INTEGER NOT NULL DEFAULT 30, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS visitor(
  project_id INTEGER NOT NULL, id TEXT NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
  PRIMARY KEY(project_id, id));
CREATE TABLE IF NOT EXISTS touch(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, visitor_id TEXT NOT NULL, ts INTEGER NOT NULL,
  source TEXT, medium TEXT, campaign TEXT, content TEXT, term TEXT,
  ca_id TEXT, as_id TEXT, ad_id TEXT, placement TEXT, fbclid TEXT, fbc TEXT, fbp TEXT,
  referrer TEXT, landing_url TEXT, channel TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS touch_v ON touch(project_id, visitor_id, ts);
CREATE INDEX IF NOT EXISTS touch_ts ON touch(project_id, ts);
CREATE TABLE IF NOT EXISTS event(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, visitor_id TEXT, event_id TEXT NOT NULL, name TEXT NOT NULL,
  value REAL, currency TEXT, order_id TEXT, url TEXT, ts INTEGER NOT NULL,
  UNIQUE(project_id, event_id));
CREATE INDEX IF NOT EXISTS event_ts ON event(project_id, ts);
CREATE TABLE IF NOT EXISTS conversion(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, order_id TEXT NOT NULL, name TEXT NOT NULL,
  status TEXT NOT NULL, value REAL NOT NULL DEFAULT 0, currency TEXT, platform TEXT, product TEXT,
  payment_method TEXT, email TEXT, visitor_id TEXT, ts INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  UNIQUE(project_id, order_id));
CREATE INDEX IF NOT EXISTS conv_ts ON conversion(project_id, ts);
CREATE TABLE IF NOT EXISTS attribution(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, conversion_id INTEGER NOT NULL, model TEXT NOT NULL,
  touch_id INTEGER, channel TEXT NOT NULL, source TEXT, medium TEXT, campaign TEXT, adset_name TEXT, ad_name TEXT,
  ca_id TEXT, as_id TEXT, ad_id TEXT, confidence TEXT NOT NULL,
  UNIQUE(conversion_id, model));
CREATE TABLE IF NOT EXISTS webhook(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, platform TEXT NOT NULL, name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_log(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, webhook_id INTEGER, platform TEXT, ts INTEGER NOT NULL,
  ok INTEGER NOT NULL, note TEXT, body TEXT);
CREATE TABLE IF NOT EXISTS meta_ad_day(
  project_id INTEGER NOT NULL, ad_account_id TEXT NOT NULL, ad_id TEXT NOT NULL, date TEXT NOT NULL,
  campaign_id TEXT, campaign_name TEXT, adset_id TEXT, adset_name TEXT, ad_name TEXT,
  spend REAL NOT NULL DEFAULT 0, clicks INTEGER NOT NULL DEFAULT 0, impressions INTEGER NOT NULL DEFAULT 0,
  ic INTEGER NOT NULL DEFAULT 0, synced_at INTEGER NOT NULL, PRIMARY KEY(project_id, ad_id, date));
CREATE INDEX IF NOT EXISTS meta_date ON meta_ad_day(project_id, ad_account_id, date);
CREATE TABLE IF NOT EXISTS meta_connection(
  project_id INTEGER PRIMARY KEY, access_token TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS meta_entity(
  project_id INTEGER NOT NULL, ad_account_id TEXT NOT NULL, level TEXT NOT NULL, id TEXT NOT NULL, name TEXT,
  status TEXT, parent_id TEXT, daily_budget REAL, lifetime_budget REAL, bid_amount REAL, min_spend REAL, max_spend REAL,
  updated_time INTEGER, synced_at INTEGER NOT NULL, PRIMARY KEY(project_id, level, id));
CREATE INDEX IF NOT EXISTS meta_entity_acc ON meta_entity(project_id, ad_account_id, level);
CREATE TABLE IF NOT EXISTS setting(
  project_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(project_id, key));
CREATE TABLE IF NOT EXISTS product_net(
  project_id INTEGER NOT NULL, product TEXT NOT NULL, net_ars REAL NOT NULL, PRIMARY KEY(project_id, product));
CREATE TABLE IF NOT EXISTS dashboard(
  id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, name TEXT NOT NULL, ad_account_id TEXT NOT NULL,
  created_at INTEGER NOT NULL, UNIQUE(project_id, ad_account_id));
`;

const g = globalThis as unknown as { __utdb?: Db };

// node:sqlite via getBuiltinModule so the bundler never tries to resolve it.
// shortcut: single local SQLite file, no migrations; move to Postgres (Neon) when it goes multi-user.
export function db(): Db {
  if (g.__utdb) return g.__utdb;
  const dir = process.env.DATA_DIR ?? join(process.cwd(), "data"); // DATA_DIR = mounted volume path in production
  mkdirSync(dir, { recursive: true });
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as {
    DatabaseSync: new (path: string) => Db;
  };
  const d = new DatabaseSync(join(dir, "utmify.db"));
  // meta_ad_day gained ad_account_id and ic; it is re-synced from Meta, so rebuilding it is safe.
  const cols = d.prepare("pragma table_info(meta_ad_day)").all() as { name: string }[];
  if (cols.length && !(cols.some((c) => c.name === "ad_account_id") && cols.some((c) => c.name === "ic"))) d.exec("drop table meta_ad_day");
  d.exec(SCHEMA);
  g.__utdb = d;
  return d;
}

const norm = (p: unknown[]): Param[] => p.map((v) => (v === undefined ? null : (v as Param)));

export const q = <T>(sql: string, ...p: unknown[]): T[] => db().prepare(sql).all(...norm(p)) as T[];
export const q1 = <T>(sql: string, ...p: unknown[]): T | undefined =>
  db().prepare(sql).get(...norm(p)) as T | undefined;
export const run = (sql: string, ...p: unknown[]) => db().prepare(sql).run(...norm(p));

export type Project = { id: number; name: string; public_key: string; attribution_window_days: number };

// Single-tenant for now: one default project. Every table already carries project_id for later.
export function getProject(): Project {
  const p = q1<Project>("select * from project order by id limit 1");
  if (p) return p;
  run(
    "insert into project(name, public_key, created_at) values(?,?,?)",
    "Mi proyecto",
    "pk_" + randomBytes(12).toString("hex"),
    Date.now(),
  );
  return q1<Project>("select * from project order by id limit 1")!;
}
