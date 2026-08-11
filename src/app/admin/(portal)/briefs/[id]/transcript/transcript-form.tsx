"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminAttachTranscriptAction } from "@/lib/actions/brief-call";
import { mapErrorToToast } from "@/lib/schemas/errors";

export function TranscriptForm({
  briefId,
  existingTranscript,
  existingRecordingRef,
}: {
  briefId: string;
  existingTranscript: string;
  existingRecordingRef: string;
}) {
  const router = useRouter();
  const [transcript, setTranscript] = React.useState(existingTranscript);
  const [recordingRef, setRecordingRef] = React.useState(existingRecordingRef);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    sectionsWritten: number;
    openQuestions: string[];
    confidence: number;
  } | null>(null);

  const run = () => {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await adminAttachTranscriptAction({
        briefId,
        transcript,
        recordingRef: recordingRef || undefined,
      });
      if (res.ok) {
        setResult(res.data);
        router.refresh();
      } else {
        setError(mapErrorToToast(res.error));
      }
    });
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-[13px] font-medium text-foreground">
          Recording link{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </span>
        <input
          type="text"
          value={recordingRef}
          onChange={(e) => setRecordingRef(e.target.value)}
          placeholder="Drive / Meet recording URL"
          className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="block">
        <span className="text-[13px] font-medium text-foreground">
          Transcript
        </span>
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={16}
          placeholder="Paste the full call transcript here…"
          className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="mt-1 block text-[11.5px] text-muted-foreground">
          {transcript.length.toLocaleString()} characters — minimum 100.
        </span>
      </label>

      {error && (
        <p className="text-[13px] text-red-600" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-2">
          <p className="flex items-center gap-2 text-[13px] font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {result.sectionsWritten} sections generated (confidence{" "}
            {result.confidence}%) — customer notified to review.
          </p>
          {result.openQuestions.length > 0 && (
            <div className="text-[12.5px] text-emerald-900">
              <span className="font-medium">Open questions for triage:</span>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {result.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Button onClick={run} disabled={pending || transcript.length < 100}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {pending ? "Extracting…" : "Generate brief from transcript"}
      </Button>
    </div>
  );
}
