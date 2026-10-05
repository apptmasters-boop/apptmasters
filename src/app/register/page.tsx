import { redirect } from "next/navigation";

// Sign-up lives at /signup (the open account flow). This path is kept
// so old links and bookmarks still land on the sign-up form.
export default function RegisterPage() {
  redirect("/signup");
}
