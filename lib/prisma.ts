import "dotenv/config";

import { checkEnv } from "@/lib/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client/extension";

export const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: checkEnv("DATABASE_URL"),
    }),
});
