import type { NextConfig } from "next";

export default {
    reactCompiler: true,
    experimental: {
        serverActions: {
            // Allow avatar uploads through server actions (default is 1mb).
            bodySizeLimit: "5mb",
        },
    },
} satisfies NextConfig;
