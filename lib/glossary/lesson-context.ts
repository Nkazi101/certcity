import type { Lesson } from "../claude/lessons/types";

const codeLike = /[_./<>$:-]|[a-z][A-Z]|^[A-Z0-9_]{2,}$/;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function lessonSentences(lesson: Lesson) {
  const parts = lesson.blocks.flatMap((block) => {
    switch (block.kind) {
      case "text": return [block.text];
      case "callout": return [block.text];
      case "list": return [...block.items];
      case "table": return block.rows.map((row) => row.map((cell, index) => index === 0 ? cell : cell).join(": "));
      case "code": return [];
    }
  });
  return [lesson.takeaway, ...parts]
    .flatMap((part) => part.split(/(?<=[.!?])\s+(?=[A-Z`"(*])/))
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * The first sentence in a lesson that mentions a term, as plain text. Used on lesson pages for terms the glossary
 * doesn't define: the lesson's own wording is already checked against the docs, so nothing new is invented.
 */
export function termInLesson(lesson: Lesson, term: string): string | null {
  const exact = codeLike.test(term);
  const pattern = new RegExp(`${/^\w/.test(term) ? "(?<![\\w-])" : ""}${escape(term)}${/\w$/.test(term) ? "(?![\\w])" : ""}`, exact ? "" : "i");
  const sentence = lessonSentences(lesson).find((entry) => pattern.test(entry.replace(/`/g, "")));
  if (!sentence) return null;
  const plain = sentence.replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1");
  const words = plain.split(/\s+/);
  return words.length > 60 ? `${words.slice(0, 60).join(" ")}…` : plain;
}
