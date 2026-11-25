import { AlertTriangle, Lightbulb, Target } from "lucide-react";
import type { ReactNode } from "react";
import type { Lesson, LessonBlock } from "../../lib/claude/lessons/types";
import type { TrackId } from "../../lib/claude/blueprints";
import { GlossaryScope, Term } from "../glossary/peek";
import { defineTerm } from "../../lib/glossary";
import { termInLesson } from "../../lib/glossary/lesson-context";
import styles from "./lesson.module.css";

/** Renders `code` spans and **bold** inside lesson text without accepting HTML. */
export function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(match[1] !== undefined
      ? <code key={match.index} className={styles.inlineCode}>{match[1]}</code>
      : <strong key={match.index}>{match[2]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const calloutIcons = { exam: Target, pitfall: AlertTriangle, tip: Lightbulb };
const calloutLabels = { exam: "How the exam frames it", pitfall: "Common mistake", tip: "Tip" };

function Block({ block }: { block: LessonBlock }) {
  switch (block.kind) {
    case "text":
      return <p><InlineText text={block.text} /></p>;
    case "code":
      return <figure className={styles.code}>
        <figcaption><span>{block.caption}</span><small>{block.language}</small></figcaption>
        <pre tabIndex={0}><code>{block.code}</code></pre>
      </figure>;
    case "list":
      return <ul className={styles.list}>{block.items.map((entry, index) => <li key={index}><InlineText text={entry} /></li>)}</ul>;
    case "table":
      return <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={block.headers.join(" vs ")}>
        <table className={styles.table}>
          <thead><tr>{block.headers.map((header) => <th key={header} scope="col"><InlineText text={header} /></th>)}</tr></thead>
          <tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0
            ? <th key={column} scope="row"><InlineText text={cell} /></th>
            : <td key={column}><InlineText text={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>;
    case "callout": {
      const Icon = calloutIcons[block.tone];
      return <aside className={styles.callout} data-tone={block.tone}>
        <Icon size={18} aria-hidden="true" />
        <div><strong>{calloutLabels[block.tone]} · {block.title}</strong><p><InlineText text={block.text} /></p></div>
      </aside>;
    }
  }
}

export function LessonArticle({ lesson, track }: { lesson: Lesson; track: TrackId }) {
  return <div className={styles.article}>
    <p className={styles.takeaway}><strong>Key decision rule</strong><span><InlineText text={lesson.takeaway} /></span></p>
    {lesson.blocks.map((block, index) => <Block key={index} block={block} />)}
    {lesson.terms.length > 0 && <section className={styles.terms} aria-label="Terms in this lesson">
      <h2>Terms to recognize on the exam</h2>
      {/* Underlined terms open a short definition on hover or tap, with a link when another lesson teaches it. */}
      <GlossaryScope track={track} current={lesson.objective}>
        <ul>{lesson.terms.map((term) => {
          // Glossary definition first; otherwise the lesson's own sentence about the term (nothing invented).
          const context = defineTerm(term) ? null : termInLesson(lesson, term);
          const found = defineTerm(term) ?? (context ? { id: `lesson:${term}`, term, plain: context, text: term, note: "From this lesson" } : null);
          return <li key={term}><code>{found ? <Term found={found} /> : term}</code></li>;
        })}</ul>
      </GlossaryScope>
    </section>}
    <section className={styles.sources} aria-label="Sources">
      <h2>Checked against</h2>
      <ul>{lesson.sources.map(([label, url]) => <li key={url}><a href={url} target="_blank" rel="noreferrer">{label}</a></li>)}</ul>
    </section>
  </div>;
}
