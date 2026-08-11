import { Suspense } from "react";
import { SignUpForm } from "@/components/auth-form";

export const metadata = { title: "Create account · AI Partner" };

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm
        kind="customer"
        title="Create your account"
        subtitle="Takes under a minute. You can invite your team later."
        signInHref="/auth/sign-in"
      />
    </Suspense>
  );
}
