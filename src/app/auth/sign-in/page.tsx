import { Suspense } from "react";
import { SignInForm } from "@/components/auth-form";

export const metadata = { title: "Sign in · AI Partner" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm
        title="Welcome back"
        subtitle="Pick up where you left off — your briefs, proposals, and matches are waiting."
        signUpHref="/auth/sign-up"
        signUpLabel="Don't have an account?"
      />
    </Suspense>
  );
}
