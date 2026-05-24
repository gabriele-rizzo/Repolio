import type { ReportCreateManyInput } from "@/generated/prisma/models";

declare global {
    namespace Repolio {
        type AdapterResult = Result<ReportCreateManyInput, string>;
        type Adapter = (snapshots: Snapshot[]) => AdapterResult;
    }
}
