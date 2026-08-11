import { redirect } from "next/navigation";

/**
 * Partner entry point. Redirects into the `/auth` group so the shared auth
 * layout applies, carrying `kind=partner` so the form opens on the partner tab
 * — otherwise partner traffic landed on the customer default and the Google
 * button signed them up as a customer.
 */
export default function PartnerRegisterRedirect() {
  redirect("/auth/sign-up?kind=partner");
}
