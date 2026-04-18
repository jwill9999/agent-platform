'use client';

/**
 * Shown while an assistant message exists but no tokens have arrived yet (streaming).
 */
export function StreamingAssistantPlaceholder() {
  return (
    <div
      className="flex flex-col gap-2.5 py-0.5 min-h-[2.75rem]"
      aria-busy="true"
      aria-live="polite"
      aria-label="Assistant is responding"
    >
      <div className="flex items-center gap-1.5 h-5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 rounded-full bg-primary/40 motion-safe:animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <div className="space-y-2 max-w-[min(18rem,85%)]">
        <div className="h-2.5 rounded-full bg-muted motion-safe:animate-pulse w-full" />
        <div className="h-2.5 rounded-full bg-muted/80 motion-safe:animate-pulse w-4/5 motion-safe:[animation-delay:75ms]" />
      </div>
    </div>
  );
}
