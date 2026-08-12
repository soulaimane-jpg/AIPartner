/**
 * Partner-side Q&A section.
 *
 * Shows public partner Q&A on the brief plus any private threads
 * this partner has started. Partners can ask a new anonymous
 * question from this card.
 *
 * Anonymity contract (partner side):
 *   - The customer's identity is masked everywhere on the partner
 *     portal anyway. The Q&A list never shows answerer identity —
 *     answers are attributed to "Customer" generically.
 *   - Other partners' questions are visible (when `all-partners`)
 *     but never attributed to a partner name.
 */

import { MessageCircleQuestion, MessageCircleReply, Clock, Lock } from "lucide-react";
import { listQaQuestionsForPartner } from "@/lib/actions/qa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QaAskForm } from "./qa-ask-form";

export async function QaSectionPartner({
  briefId,
  partnerCompanyId,
}: {
  briefId: string;
  partnerCompanyId: string;
}) {
  const questions = await listQaQuestionsForPartner(briefId, partnerCompanyId);

  return (
    <Card className="relative overflow-hidden border-line bg-card shadow-elev-1">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary"></div>
      <CardHeader className="border-b border-line bg-card p-6">
        <CardTitle className="flex items-center gap-3 text-[16px] font-semibold tracking-tight text-foreground">
          <MessageCircleQuestion className="h-5 w-5 text-primary" />
          Anonymous Q&amp;A
          <Badge variant="outline" className="ml-auto text-[10px]">
            {questions.length}{" "}
            {questions.length === 1 ? "thread" : "threads"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <p className="text-xs text-muted-foreground">
          Ask the customer for clarifications before submitting your SOW.
          Your name and company are never disclosed. Public questions are
          visible to all matched partners — pick &ldquo;Keep private&rdquo;
          for sensitive asks.
        </p>

        <QaAskForm briefId={briefId} />

        {questions.length > 0 && (
          <ul className="space-y-3">
            {questions.map((q) => {
              const isMine = q.mine === true;
              return (
                <li
                  key={q.id}
                  className="space-y-2 rounded-lg border border-border bg-surface-sunk p-3"
                >
                  <div className="flex items-start gap-2">
                    <MessageCircleQuestion className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                        {q.questionPublic}
                      </p>
                      <p className="mt-1 text-[10.5px] text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(q.createdAt).toLocaleString()}
                        {isMine && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] ml-1"
                          >
                            yours
                          </Badge>
                        )}
                        {q.visibility === "asker-only" && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" />
                            private
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {q.answer ? (
                    <div className="flex items-start gap-2 pl-5">
                      <MessageCircleReply className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {q.answer}
                        </p>
                        {q.answeredAt && (
                          <p className="mt-1 text-[10.5px] text-muted-foreground">
                            customer answered{" "}
                            {new Date(q.answeredAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="pl-5 text-[11.5px] italic text-muted-foreground">
                      Awaiting customer response.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
