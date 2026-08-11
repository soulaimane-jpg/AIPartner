import { redirect } from "next/navigation";

export default function PartnerLoginRedirect() {
  redirect("/auth/sign-in");
}
