/** The sealed original text, with an optional highlighted span (the exact words an answer quotes). */
export default function SourceText({ text, span, className = '' }: { text: string; span?: { start: number; end: number } | null; className?: string }) {
  const valid = span && span.start >= 0 && span.end <= text.length && span.end > span.start
  return (
    <p className={`font-serif text-xl leading-relaxed whitespace-pre-wrap ${className}`}>
      {valid ? (
        <>
          {text.slice(0, span!.start)}
          <mark className="rounded bg-emerald/25 px-0.5 text-ivory ring-1 ring-emerald/50">{text.slice(span!.start, span!.end)}</mark>
          {text.slice(span!.end)}
        </>
      ) : text}
    </p>
  )
}
