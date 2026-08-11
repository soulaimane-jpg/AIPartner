import { redirect } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { auth } from "@/lib/auth";
import { BookCallForm } from "./book-call-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book a scoping call · AI Partner" };

/**
 * M3 Path B — instead of the AI chat, the customer books a call with
 * the AIPartner team. After the call, the transcript becomes a
 * structured brief which the customer reviews and confirms.
 */
export default async function NewCallBriefPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in?next=/briefs/new-call");

  return (
    <div className="page-container portal-page max-w-3xl py-6 sm:py-8 lg:py-10">
      <header className="portal-page-header">
        <div className="flex items-start gap-3">
          <span className="portal-icon-box bg-primary/10 text-primary ring-1 ring-primary/15" aria-hidden>
            <PhoneCall className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="eyebrow text-primary">Assisted scoping</div>
            <h1 className="portal-page-title">Book a scoping call</h1>
            <p className="portal-page-description">
              Prefer talking to typing? Share the project and your availability. We&apos;ll run a 30-minute call and turn it into a structured brief for your review.
            </p>
          </div>
        </div>
      </header>
      <BookCallForm />
    </div>
  );
}
