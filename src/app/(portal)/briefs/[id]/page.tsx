import { redirect } from "next/navigation";

/**
 * `/briefs/[id]` is the brief workspace entry point. We canonicalise it
 * onto `/briefs/[id]/preview` which renders the unified workspace; the
 * Preview canvas is the most info‑dense surface and is the right home
 * for both first‑time visits and deep links from notifications.
 */
export default async function BriefIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/briefs/${id}/preview`);
}
