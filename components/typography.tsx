import { cn } from "@/lib/utils";
import { createElement } from "react";

type TypographyElement = keyof typeof classes;
type TypographyComponent<C extends TypographyElement> = (typeof components)[C];
type IntrinsicElement = keyof React.JSX.IntrinsicElements;

type TypoProps<C extends TypographyElement> = React.ComponentPropsWithoutRef<TypographyComponent<C>> & {
    as: C;
};

const components: Record<TypographyElement, IntrinsicElement> = {
    quote: "blockquote",
    code: "code",
    lead: "p",
    muted: "p",
    title: "h3",
    large: "div",
    normal: "p",
    small: "small",
};

const classes = {
    quote: "mt-6 border-l-2 pl-6 italic",
    code: "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
    lead: "text-xl text-muted-foreground",
    muted: "text-sm text-muted-foreground",
    title: "scroll-m-20 text-2xl font-semibold tracking-tight",
    large: "text-lg font-semibold",
    normal: "",
    small: "text-sm leading-none font-medium",
} as const;

export function Typo<C extends TypographyElement>({ as, className, ...props }: TypoProps<C>) {
    return createElement(components[as], { ...props, className: cn(classes[as], className) });
}
