import { redirect } from "next/navigation";

// Sign-up moved to /signup (outside the listings layout and its nav bar).
// Kept so existing links still work; forwards ?returnTo.
export default async function ListingsSignupRedirect({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { returnTo } = await searchParams;
  redirect(typeof returnTo === "string" ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup");
}
