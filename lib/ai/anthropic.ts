import { checkEnv } from "@/lib/env";
import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | undefined;

/**
 * Lazily-constructed Anthropic client. `checkEnv` only runs on first use, so
 * importing this module never throws — a route that never reaches the AI step
 * (e.g. no due clients) keeps working even if ANTHROPIC_API_KEY is unset.
 */
export function getAnthropic(): Anthropic {
    return (client ??= new Anthropic({ apiKey: checkEnv("ANTHROPIC_API_KEY") }));
}
