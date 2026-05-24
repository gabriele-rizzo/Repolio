import type { Report } from "@/generated/prisma/browser";
import { cn } from "@/lib/utils";
import { Typo } from "../typography";
import { SCORE_COLORS } from "./score-badge";

interface RatingScaleProps {
    report?: Report;
}

export function RatingScale({ report }: RatingScaleProps) {
    return (
        <div className="flex flex-col w-full gap-2">
            <div className="flex flex-row items-center justify-between">
                <Typo as="normal">Rating scale</Typo>

                <div className="flex flex-row gap-2 shrink-0">
                    <div className="flex flex-row gap-1 items-center">
                        <div className="size-2 rounded-full bg-red-500"></div>
                        <Typo as="normal" className="text-red-500">
                            0-40
                        </Typo>
                    </div>

                    <div className="flex flex-row gap-1 items-center">
                        <div className="size-2 rounded-full bg-amber-500"></div>
                        <Typo as="normal" className="text-amber-500">
                            40-70
                        </Typo>
                    </div>

                    <div className="flex flex-row gap-1 items-center">
                        <div className="size-2 rounded-full bg-green-500"></div>
                        <Typo as="normal" className="text-green-500">
                            70-100
                        </Typo>
                    </div>
                </div>
            </div>

            <div className="w-full h-4 relative flex flex-row">
                <div className="absolute h-4 w-full bg-linear-to-r from-red-500 via-amber-500 to-green-500 opacity-25" />

                {report && <div style={{ width: `${report.performance_score}%` }} />}
                {report && (
                    <div
                        className={cn(
                            SCORE_COLORS[report.score_label],
                            "-translate-x-1/2 size-4 border-2 border-foreground",
                        )}
                    />
                )}
            </div>

            <div className="flex flex-row items-center justify-between">
                <Typo as="muted" className="text-xs">
                    0
                </Typo>
                <Typo as="muted" className="text-xs">
                    40
                </Typo>
                <Typo as="muted" className="text-xs">
                    70
                </Typo>
                <Typo as="muted" className="text-xs">
                    100
                </Typo>
            </div>
        </div>
    );
}
