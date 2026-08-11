/**
 * Customer-side Q&A section.
 *
 * Reads anonymous questions partners have posted about this brief and
 * lets the brief owner answer each one inline. The component is a
 * server component — the answer form is the only client island.
 *
 * Anonymity contract:
 *   - We never display the asker's identity (company, name, email).
 *   - We render the bracketed `questionPublic` field, which is the
 *     moderated copy of the raw question (today they're identical;
 *     a future moderation pass can diverge them).
 */

import { MessageCircleQuestion, MessageCircleReply, Clock } from "lucide-react";
import { listQaQuestionsForCustomer } from "@/lib/actions/qa";
import { Badge } from "@/components/ui/badge";
import { QaAnswerForm } from "./qa-answer-form";

export async function QaSectionCustomer({ briefId }: { briefId: string }) {
  const questions = await listQaQuestionsForCustomer(briefId);

  return (
    <section
      id="qa"
      className="rounded-2xl bg-card border border-border p-5 shadow-elev-1 scroll-mt-[160px]"
    >
      <header className="flex items-center gap-2 mb-3">
        <MessageCircleQuestion className="h-4 w-4 text-muted-foreground/85" />
        <h2 className="text-[13.5px] font-medium text-foreground">
          Partner Q&amp;A
        </h2>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {questions.length} {questions.length === 1 ? "question" : "questions"}
        </Badge>
      </header>

      {questions.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">
          No questions yet. Partners may post anonymous clarifications
          here while reviewing your brief — we&rsquo;ll route them to you
          for an answer.
        </p>
      ) : (
        <ul className="space-y-4">
          {questions.map((q) => {
            const isPending = q.status === "pending";
            return (
              <li
                key={q.id}
                className="rounded-md border border-border/70 bg-muted/20 p-3 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <MessageCircleQuestion className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] text-foreground whitespace-pre-wrap break-words">
                      {q.questionPublic}
                    </p>
                    <p className="mt-1 text-[10.5px] text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(q.createdAt).toLocaleString()}
                      {q.visibility === "asker-only" && (
                        <Badge variant="secondary" className="text-[9px] ml-1">
                          private
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>

                {q.answer ? (
                  <div className="flex items-start gap-2 pl-5">
                    <MessageCircleReply className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] text-foreground/90 whitespace-pre-wrap break-words">
                        {q.answer}
                      </p>
                      {q.answeredAt && (
                        <p className="mt-1 text-[10.5px] text-muted-foreground">
                          answered{" "}
                          {new Date(q.answeredAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                ) : isPending ? (
                  <div className="pl-5">
                    <QaAnswerForm briefId={briefId} questionId={q.id} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
