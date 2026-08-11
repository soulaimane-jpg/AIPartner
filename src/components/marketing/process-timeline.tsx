"use client";

import { m } from "framer-motion";

export function ProcessTimeline({
  steps,
}: {
  steps: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <ol className="home-process-timeline">
      <m.div
        aria-hidden
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="home-process-line"
      />
      {steps.map(([title, body], index) => (
        <m.li
          key={title}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{
            duration: 0.65,
            delay: index * 0.07,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="home-process-step"
        >
          <span className="home-process-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="home-process-card">
            <h3 className="text-[17px] font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-[13px] leading-[1.65] text-muted-foreground">
              {body}
            </p>
          </div>
        </m.li>
      ))}
    </ol>
  );
}
