import { renderSocialCard, SOCIAL_CARD } from "@/lib/og/social-card";

export const alt = SOCIAL_CARD.alt;
export const size = SOCIAL_CARD.size;
export const contentType = SOCIAL_CARD.contentType;

export default function OpengraphImage() {
    return renderSocialCard();
}
