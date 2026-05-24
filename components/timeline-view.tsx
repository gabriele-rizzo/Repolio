import { useEffect, useState } from "react";

interface TimelineViewProps {
    interval?: number;
    render: (now: Date) => React.ReactNode;
}

export function TimelineView({ interval = 60000, render }: TimelineViewProps) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const subscription = setInterval(() => setNow(new Date()), interval);
        return () => clearInterval(subscription);
    }, [interval]);

    return render(now);
}
