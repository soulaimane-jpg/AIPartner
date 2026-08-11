import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { insertRow, updateRows } from "@/lib/db";

/**
 * "Do this later" — quick POST endpoint so the wizard can mark the
 * survey as complete without a full server action round-trip.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  await updateRows(
    "User",
    { id: session.user.id },
    { surveyCompletedAt: new Date() },
  );
  await insertRow("Notification", {
    userId: session.user.id,
    type: "onboarding.survey_skipped",
    title: "Finish your profile when you have a minute",
    message:
      "Telling us your focus area helps us match you with the right partners faster.",
    link: "/onboarding/survey",
  });
  return NextResponse.json({ ok: true });
}
