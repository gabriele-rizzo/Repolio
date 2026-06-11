import type { Platform } from "@/generated/prisma/browser";
import { FaGoogle, FaLinkedin, FaMeta, FaPinterest, FaTiktok, FaXTwitter } from "react-icons/fa6";

// Display metadata for each ad platform (label + brand icon). Only META is wired through Zernio
// today; the rest are declared so the lookup stays total over the Platform enum.
export const PLATFORM_META: Record<Platform, { label: string; icon: React.ElementType }> = {
    META: { label: "Meta", icon: FaMeta },
    GOOGLE: { label: "Google", icon: FaGoogle },
    TIKTOK: { label: "TikTok", icon: FaTiktok },
    LINKEDIN: { label: "LinkedIn", icon: FaLinkedin },
    PINTEREST: { label: "Pinterest", icon: FaPinterest },
    X: { label: "X", icon: FaXTwitter },
};
