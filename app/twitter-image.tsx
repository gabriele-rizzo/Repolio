import { renderSocialCard, SOCIAL_CARD } from "@/lib/og/social-card";

// The same card as `opengraph-image.tsx`. X reads `twitter:image` and does not fall back to `og:image`,
// so the file has to exist separately for the card to carry any media at all.
export const alt = SOCIAL_CARD.alt;
export const size = SOCIAL_CARD.size;
export const contentType = SOCIAL_CARD.contentType;

export default function TwitterImage() {
    return renderSocialCard();
}
