import "dotenv/config";

import { defineConfig } from "prisma/config";
import { checkEnv } from "./lib/env";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: checkEnv("DIRECT_URL"),
    },
});
