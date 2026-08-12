"use client";

import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Lightbulb,
  WandSparkles,
  Loader2,
  User as UserIcon,
  Star,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExampleAnswerCard } from "@/components/brief/example-answer-card";
import { findExampleForAssistantMessage } from "@/lib/example-answers";
import { BriefAttachments } from "@/components/brief/brief-attachments";

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  meta?: string | null;
};

type AnswerRating = {
  score: number;
  strengths: string[];
  suggestion: string;
};

export type BriefChatHandle = {
  /** Prefill the composer with a suggested question the user can edit/send. */
  prefill: (text: string) => void;
};

const STARTER_PROMPTS = [
  "I need to migrate a legacy app to GCP",
  "We want to build a data warehouse on BigQuery",
  "Modernize our analytics with Vertex AI",
  "Move our SAP workload to Google Cloud",
];

type Section = {
  key: string;
  label: string;
  score: number;
  weight: number;
  missing: string[];
};

export const BriefChat = forwardRef<
  BriefChatHandle,
  {
    briefId: string;
    initialMessages: Message[];
    sections?: Section[];
    completion?: number;
    /** Slot rendered at the right edge of the chat header (toolbar). */
    headerActions?: React.ReactNode;
  }
>(function BriefChat(
  { briefId, initialMessages, sections = [], completion = 0, headerActions },
  ref,
) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      prefill: (text: string) => {
        setDraft(text);
        // Focus the textarea so the user can edit/send
        requestAnimationFrame(() => {
          textareaRef.current?.focus();
          textareaRef.current?.setSelectionRange(text.length, text.length);
          textareaRef.current?.scrollIntoView({ block: "end" });
        });
      },
    }),
    [],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  const send = async (text?: string) => {
    const body = (text ?? draft).trim();
    if (!body || streaming) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: body,
      createdAt: new Date(),
    };
    setMessages((m) => [...m, userMsg]);
    setDraft("");
    setStreaming(true);
    setStreamingText("");
    setLastFailedMessage(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId, message: body }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Chat failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreamingText(acc);
      }

      const finalReply = acc.trim();
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: finalReply,
          createdAt: new Date(),
        },
      ]);
      setStreamingText("");
      setStreaming(false);

      // Refresh server components so brief fields/completion update in the sidebar
      router.refresh();
    } catch (err) {
      console.error(err);
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "I'm having trouble connecting right now. Please try your message again in a moment.",
          createdAt: new Date(),
        },
      ]);
      setStreaming(false);
      setStreamingText("");
      setLastFailedMessage(body);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex h-full min-h-[640px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elev-2">
      {/* Header */}
      <div className="z-10 flex shrink-0 flex-col gap-3 border-b border-border bg-[linear-gradient(120deg,hsl(var(--primary)/0.055),hsl(var(--card))_42%)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2 min-w-0">
          <AssistantMark size="md" />
          <div className="min-w-0">
            <h2 className="truncate text-[13.5px] font-semibold text-foreground">AI scoping assistant</h2>
            <p className="hidden text-[11px] text-muted-foreground sm:block">Turn project context into a partner-ready brief</p>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto sm:shrink-0">
          {headerActions}
          {headerActions && (
            <span className="hidden md:inline-block h-4 w-px bg-border mx-1" aria-hidden />
          )}
          <div className="hidden md:flex items-center gap-2.5">
            <SectionProgressStrip sections={sections} />
            <span className="text-[11.5px] font-mono text-muted-foreground tabular-nums">
              {completion}%
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-smooth bg-[linear-gradient(180deg,hsl(var(--surface-sunk)/0.65),hsl(var(--card))_24%)] px-4 pb-6 pt-5 sm:px-6 sm:pt-6 lg:px-7">
        <div className="mx-auto max-w-3xl w-full">
          {isEmpty ? (
            <EmptyState onPick={(t) => send(t)} />
          ) : (
            <div className="space-y-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {streaming && <StreamingBubble text={streamingText} />}
              <div ref={endRef} className="h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border bg-card px-4 py-4 shadow-[0_-10px_30px_-28px_hsl(218_45%_18%/0.6)] sm:px-6 lg:px-7">
        <div className="mx-auto max-w-3xl">
          {!isEmpty && !streaming && completion < 100 && (
            <div className="mb-2">
              <SuggestionChips
                sections={sections}
                onPick={(q) => {
                  setDraft(q);
                  requestAnimationFrame(() => textareaRef.current?.focus());
                }}
              />
            </div>
          )}
          {/* Uploaded documents feed straight into the assistant's context on
              the next turn, so keep them visible right above the input. */}
          <BriefAttachments
            briefId={briefId}
            canEdit={!streaming}
            onChanged={() => router.refresh()}
          />
          {lastFailedMessage && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-[12px] text-danger">
              <span>Your message was not sent. Check your connection and try again.</span>
              <button type="button" onClick={() => send(lastFailedMessage)} className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline">
                <RotateCcw className="h-3 w-3" /> Retry
              </button>
            </div>
          )}
          <div
            className={cn(
              "flex items-end gap-2 rounded-2xl border border-border bg-card shadow-elev-1",
              "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/15",
            )}
          >
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Tell me about your project…"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none bg-transparent border-0 focus:outline-none text-[14px] text-foreground placeholder:text-muted-foreground px-3 py-2.5 min-h-[40px] max-h-44 leading-relaxed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={streaming || !draft.trim()}
              className={cn(
                "m-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                streaming || !draft.trim()
                  ? "cursor-not-allowed bg-secondary text-muted-foreground"
                  : "bg-primary text-white shadow-elev-1 hover:bg-primary/90",
              )}
              aria-label="Send"
            >
              {streaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground">
            Press <kbd className="mx-0.5 rounded border border-border bg-secondary px-1 py-0.5 font-mono text-[10px] text-muted-foreground">Return</kbd> to send
          </div>
        </div>
      </div>
    </div>
  );
});

/* ── Sub-components ─────────────────────────────────────── */

function EmptyState({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-12">
      <div className="mb-5"><AssistantMark size="lg" /></div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-primary">Guided scoping</div>
      <h2 className="mt-2.5 text-[22px] font-semibold tracking-[-0.015em] text-foreground">
        What are you trying to deliver?
      </h2>
      <p className="mb-8 mt-2.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
        Start with the business problem, desired outcome, and urgency. I&apos;ll ask focused follow-up questions and structure your answers into a partner-ready Statement of Work.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="group rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-elev-1 transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-primary/30 hover:shadow-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="text-[13.5px] text-foreground leading-snug">
              {p}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const rating = parseRating(message.meta);
  // For assistant messages, surface an inline "show me a great answer"
  // affordance whenever the question matches a known topic.
  const example = !isUser ? findExampleForAssistantMessage(message.content) : null;
  return (
    <div
      className={cn(
        "flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500",
        isUser && "flex-row-reverse",
      )}
    >
      <Avatar isUser={isUser} />
      <div
        className={cn(
          "flex flex-col max-w-[85%] min-w-0",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "text-[14px] leading-relaxed",
            isUser
              ? "rounded-xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-white shadow-elev-1"
              : "rounded-xl rounded-tl-sm border border-border bg-card px-3.5 py-2.5 text-foreground shadow-elev-1",
          )}
        >
          <FormattedContent text={message.content} />
        </div>
        {isUser && rating && <AnswerRatingChip rating={rating} />}
        {example && <ExampleAnswerCard example={example} />}
      </div>
    </div>
  );
}

function parseRating(meta?: string | null): AnswerRating | null {
  if (!meta) return null;
  try {
    const raw = JSON.parse(meta);
    if (typeof raw?.score !== "number") return null;
    return {
      score: raw.score,
      strengths: Array.isArray(raw.strengths) ? raw.strengths : [],
      suggestion: typeof raw.suggestion === "string" ? raw.suggestion : "",
    };
  } catch {
    return null;
  }
}

function AnswerRatingChip({ rating }: { rating: AnswerRating }) {
  const tone =
    rating.score >= 80
      ? "success"
      : rating.score >= 55
        ? "warning"
        : "muted";
  const toneBg = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    muted: "bg-muted text-muted-foreground border-border",
  }[tone];

  return (
    <div className="mt-1.5 space-y-1 max-w-full">
      <div
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md border",
          toneBg,
        )}
        title={rating.strengths.join(" · ")}
      >
        <Star className="h-3 w-3 fill-current" />
        {rating.score}/100
        {rating.strengths.length > 0 && (
          <span className="font-normal text-[10px] opacity-80 truncate max-w-[200px]">
            · {rating.strengths[0]}
          </span>
        )}
      </div>
      {rating.suggestion && (
        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground max-w-sm">
          <Lightbulb className="h-3 w-3 text-warning shrink-0 mt-0.5" />
          <span>{rating.suggestion}</span>
        </div>
      )}
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 animate-in fade-in duration-300">
      <Avatar isUser={false} />
      <div className="min-w-0 max-w-[85%] rounded-xl rounded-tl-sm border border-border bg-card px-4 py-3 text-[14px] leading-relaxed text-foreground shadow-elev-1">
        {text ? (
          <FormattedContent text={text} />
        ) : (
          <div className="flex items-center h-6">
            <span className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        )}
        {text && <span className="inline-block w-1.5 h-4 ml-1 bg-primary rounded-sm align-middle animate-pulse" />}
      </div>
    </div>
  );
}

function AssistantMark({ size }: { size: "sm" | "md" | "lg" }) {
  const dimensions = {
    sm: "h-7 w-7 rounded-lg",
    md: "h-8 w-8 rounded-[10px]",
    lg: "h-11 w-11 rounded-xl",
  }[size];
  const iconSize = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden bg-gradient-to-br from-[hsl(var(--brand-2))] via-primary to-[hsl(var(--brand-3))] text-white shadow-elev-1 ring-1 ring-primary/30",
        dimensions,
      )}
      aria-hidden
    >
      <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-white/20 blur-sm" />
      <WandSparkles className={cn("relative", iconSize)} strokeWidth={1.9} />
    </span>
  );
}

function Avatar({ isUser }: { isUser: boolean }) {
  if (isUser) {
    return (
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground border border-border mt-1">
        <UserIcon className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <AssistantMark size="sm" />
  );
}

/**
 * Minimal markdown-ish formatting: **bold**, line breaks, and bullet lists.
 * Kept dependency-free for safety.
 */
function FormattedContent({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const isList = lines.every(
          (l) => l.trim().startsWith("- ") || l.trim().startsWith("• "),
        );
        if (isList && lines.length > 1) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.map((l, j) => (
                <li key={j}>
                  <InlineFormat text={l.replace(/^[-•]\s*/, "")} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            <InlineFormat text={block} />
          </p>
        );
      })}
    </div>
  );
}

function InlineFormat({ text }: { text: string }) {
  // Split on **bold** preserving the delimiters
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {p.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

/**
 * 6-dot progress strip shown in the header. Each dot = one SoW section,
 * weighted by its completion score.
 */
function SectionProgressStrip({ sections }: { sections: Section[] }) {
  if (sections.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {sections.map((s) => {
        const pct = s.weight ? s.score / s.weight : 0;
        const tone =
          pct >= 0.99
            ? "bg-success"
            : pct >= 0.5
              ? "bg-warning"
              : pct > 0
                ? "bg-primary/40"
                : "bg-border";
        return (
          <div
            key={s.key}
            title={`${s.label} · ${s.score}/${s.weight}`}
            className={cn("h-1.5 w-6 rounded-full transition-colors", tone)}
          />
        );
      })}
    </div>
  );
}

const SECTION_SUGGESTIONS: Record<string, { label: string; prompt: string }[]> = {
  business: [
    {
      label: "Business impact",
      prompt:
        "Here's the business impact we're expecting — revenue, cost savings, or risk reduction: ",
    },
    {
      label: "Problem urgency",
      prompt: "Why we need this now (trigger events, deadlines, blockers): ",
    },
  ],
  scope: [
    {
      label: "Scope detail",
      prompt: "Here's the concrete scope we need delivered: ",
    },
    {
      label: "Data sources",
      prompt: "The data sources involved and their volumes are: ",
    },
    {
      label: "Integrations",
      prompt: "The systems this has to integrate with are: ",
    },
  ],
  timing: [
    {
      label: "Timeline",
      prompt: "Our target go-live is ",
    },
    {
      label: "Milestones",
      prompt: "Key milestones we need to hit: ",
    },
  ],
  constraints: [
    {
      label: "Budget range",
      prompt: "Our budget range is approximately ",
    },
    {
      label: "Region / data residency",
      prompt: "Preferred region and any data-residency constraints: ",
    },
    {
      label: "Compliance",
      prompt: "Compliance we need (ISO, SOC2, HIPAA, etc.): ",
    },
  ],
  stakeholders: [
    {
      label: "Decision makers",
      prompt: "Key decision makers on our side are: ",
    },
    {
      label: "Users served",
      prompt: "The teams/roles that will use this solution are: ",
    },
    {
      label: "Selection criteria",
      prompt: "What matters most when picking a partner: ",
    },
  ],
  procurement: [
    {
      label: "Procurement path",
      prompt:
        "Our procurement path will be (direct Google, via reseller, or still deciding): ",
    },
  ],
};

/**
 * Surfaces 3 contextual prompt chips based on the weakest sections first.
 * Clicking one prefills the composer — the user edits and sends.
 */
function SuggestionChips({
  sections,
  onPick,
}: {
  sections: Section[];
  onPick: (prompt: string) => void;
}) {
  // Rank sections weakest-first (lowest ratio), then pick top 3 suggestions
  const ranked = [...sections]
    .map((s) => ({ ...s, ratio: s.weight ? s.score / s.weight : 1 }))
    .filter((s) => s.ratio < 1)
    .sort((a, b) => a.ratio - b.ratio);

  const chips: { label: string; prompt: string; section: string }[] = [];
  for (const s of ranked) {
    const options = SECTION_SUGGESTIONS[s.key] ?? [];
    for (const o of options) {
      chips.push({ ...o, section: s.label });
      if (chips.length >= 3) break;
    }
    if (chips.length >= 3) break;
  }
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {chips.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(c.prompt)}
          className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:border-primary/35 hover:bg-primary/15"
          title={c.section}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
