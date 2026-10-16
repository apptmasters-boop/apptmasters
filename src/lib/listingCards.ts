/**
 * What search results, Saved and the home page send for each listing (Sprint
 * 12): everything public, a few photos, the advertiser's first name and profile
 * photo (Sprint 13c, owner's decision 2026-10-16). Never their email, never
 * the street address (shared in the conversation, owner's decision 2026-10-16)
 * or the review fields.
 */
export const PRIVATE_LISTING_FIELDS = { address: true, rejectionReason: true, reviewedById: true, reviewedAt: true } as const;

export const listingCardQuery = {
  omit: PRIVATE_LISTING_FIELDS,
  include: {
    photos: { orderBy: { position: "asc" as const }, take: 5, select: { url: true } },
    owner: { select: { id: true, name: true, createdAt: true, photo: true } },
  },
};
