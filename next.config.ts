import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const config = {
    reactCompiler: true,
    experimental: {
        serverActions: {
            // Allow avatar uploads through server actions (default is 1mb).
            bodySizeLimit: "5mb",
        },
    },
} satisfies NextConfig;

export default withNextIntl(config);
