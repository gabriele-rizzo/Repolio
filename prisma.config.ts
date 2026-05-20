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
    },
});
