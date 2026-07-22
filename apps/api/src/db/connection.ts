// The Postgres connection settings, resolved identically for the running app
// (app.module.ts) and the standalone migration CLI (data-source.ts). Keeping
// this in one place means the app and the migration tool can never drift onto
// different databases — a classic cause of "works locally, migrations hit the
// wrong DB" incidents.

export interface EnvSource {
  get(key: string): string | undefined;
}

/** Wrap a plain record (e.g. process.env) as an EnvSource. */
export function envFrom(source: Record<string, string | undefined>): EnvSource {
  return { get: (key) => source[key] };
}

export interface DbConnectionOptions {
  type: "postgres";
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

/**
 * DATABASE_URL wins when present; otherwise fall back to the discrete PG* vars
 * with the same defaults the app has always used.
 */
export function buildDbConnectionOptions(env: EnvSource): DbConnectionOptions {
  const url = env.get("DATABASE_URL");
  if (url) return { type: "postgres", url };
  return {
    type: "postgres",
    host: env.get("PGHOST") || "localhost",
    port: Number(env.get("PGPORT") || 5432),
    username: env.get("PGUSER") || process.env.USER,
    password: env.get("PGPASSWORD") || undefined,
    database: env.get("PGDATABASE") || "naija_brief",
  };
}
