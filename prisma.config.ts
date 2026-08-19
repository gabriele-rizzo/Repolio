import { configDotenv } from "dotenv";
import { defineConfig } from "prisma/config";
import { checkEnv } from "./lib/env";

configDotenv({ path: ".env.local" });

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: checkEnv("DIRECT_URL"),

        // Shadow database for `prisma migrate diff --from-migrations`, which replays every migration into
        // a throwaway database to compute the schema they produce. CI sets this to a disposable Postgres
        // service container; see .github/workflows/ci.yml.
        //
        // DANGER: that command WRITES to whatever it uses as a shadow. Locally this is unset, and
        // `.env.local` points at PRODUCTION — so never run `migrate diff --from-migrations` on this
        // machine. Unset is the safe state: the command fails instead of finding somewhere to write.
        ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL } : {}),
    },
});
