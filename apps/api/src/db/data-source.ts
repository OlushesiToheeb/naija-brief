import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { extname, resolve } from "node:path";
import { DataSource } from "typeorm";
import { buildDbConnectionOptions, envFrom } from "./connection";

// The migration CLI runs outside Nest, so it loads .env itself — mirroring the
// order in app.module.ts: the monorepo-root .env first, then apps/api/.env as an
// override. Run the migration:* npm scripts from apps/api so these cwd-relative
// paths resolve the same way ConfigModule does.
loadEnv({ path: resolve(process.cwd(), "../../.env"), quiet: true });
loadEnv({ path: resolve(process.cwd(), ".env"), quiet: true });

// One source file serves both dev (ts-node → *.entity.ts) and prod (compiled →
// dist/**/*.js). The CLI runs this as .ts; `node dist/db/data-source.js` runs it
// as .js.
const isTs = extname(__filename) === ".ts";
const root = isTs ? "src" : "dist";
const ext = isTs ? "ts" : "js";

export default new DataSource({
  ...buildDbConnectionOptions(envFrom(process.env)),
  entities: [`${root}/entities/*.entity.${ext}`],
  migrations: [`${root}/migrations/*.${ext}`],
  // Schema changes come only from migrations here — never auto-sync.
  synchronize: false,
  migrationsRun: false,
});
