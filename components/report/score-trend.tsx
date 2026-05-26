"use client";

import { useEffect, useRef, useState } from "react";
import { Typo } from "../typography";
import { Skeleton } from "../ui/skeleton";

interface ScoreTrendPoint {
    created_at: Date;
    performance_score: number;
}

interface ScoreTrendProps {
    history?: ScoreTrendPoint[];
}

const PAD_X = 12;
const PAD_TOP = 18;
const PAD_BOT = 22;
const SCORE_MIN = 50;
const SCORE_MAX = 100;

const formatLabel = (d: Date) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function ScoreTrend({ history }: ScoreTrendProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [{ w, h }, setSize] = useState({ w: 320, h: 160 });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) setSize({ w: rect.width, h: rect.height });
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    if (!history) return <Skeleton className="grow w-full min-h-20" />;

    if (history.length < 2) {
        return (
            <div className="grow w-full min-h-20 rounded-md border border-dashed flex items-center justify-center">
                <Typo as="muted" className="text-xs">
                    Not enough history to render a trend yet.
                </Typo>
            </div>
        );
    }

    const points = history.map((p) => ({ score: p.performance_score, label: formatLabel(p.created_at) }));

    const last = points[points.length - 1].score;
    const prev = points[points.length - 2].score;
    const trendUp = last >= prev;
    const lineColor = trendUp ? "var(--color-green-500)" : "var(--color-red-500)";

    const x = (i: number) => PAD_X + (i / (points.length - 1)) * (w - 2 * PAD_X);
    const y = (val: number) => PAD_TOP + (h - PAD_TOP - PAD_BOT) * (1 - (val - SCORE_MIN) / (SCORE_MAX - SCORE_MIN));

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.score)}`).join(" ");
    const areaD = `${pathD} L ${x(points.length - 1)} ${h - PAD_BOT} L ${x(0)} ${h - PAD_BOT} Z`;

    return (
        <div ref={ref} className="grow relative w-full min-h-40">
            {w > 0 && (
                <svg
                    viewBox={`0 0 ${w} ${h}`}
                    width={w}
                    height={h}
                    preserveAspectRatio="xMidYMid meet"
                    className="block"
                >
                    <defs>
                        <linearGradient id="scoreTrendFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
                            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    <path d={areaD} fill="url(#scoreTrendFill)" />
                    <path
                        d={pathD}
                        stroke={lineColor}
                        strokeWidth={2}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {points.map((p, i) => (
                        <circle
                            key={i}
                            cx={x(i)}
                            cy={y(p.score)}
                            r={3}
                            fill={lineColor}
                            stroke="var(--color-background)"
                            strokeWidth={1.5}
                        />
                    ))}
                </svg>
            )}

            <div className="absolute inset-0 pointer-events-none">
                {points.map((p, i) => (
                    <span
                        key={`x-${i}`}
                        className="absolute text-[10px] text-muted-foreground tabular-nums -translate-x-1/2 whitespace-nowrap"
                        style={{ left: x(i), top: h - PAD_BOT + 4 }}
                    >
                        {p.label}
                    </span>
                ))}

                <span
                    className="absolute text-[11px] font-semibold tabular-nums -translate-x-1/2 whitespace-nowrap"
                    style={{
                        left: x(points.length - 1),
                        top: y(last) - 20,
                        color: lineColor,
                    }}
                >
                    {last}
                </span>
            </div>
        </div>
    );
}
