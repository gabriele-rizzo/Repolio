import type { Platform } from "@/generated/prisma/browser";
import { FaMeta } from "react-icons/fa6";

// Display metadata for each ad platform (label + brand icon).
export const PLATFORM_META: Record<Platform, { label: string; icon: React.ElementType }> = {
    META: { label: "Meta", icon: FaMeta },
};
