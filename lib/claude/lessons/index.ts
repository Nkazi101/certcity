import type { TrackId } from "../blueprints";
import type { Lesson, LessonSet } from "./types";
import { associateFoundationsLessons } from "./associate-foundations";
import { developerFoundationsLessons } from "./developer-foundations";
import { architectFoundationsLessons } from "./architect-foundations";
import { architectProfessionalLessons } from "./architect-professional";
import { developerProfessionalLessons } from "./developer-professional";

// Server-only in practice: lesson text is rendered into static pages, not shipped to the practice workspace.
export const lessonSets: Record<TrackId, LessonSet> = {
  "associate-foundations": associateFoundationsLessons,
  "developer-foundations": developerFoundationsLessons,
  "architect-foundations": architectFoundationsLessons,
  "architect-professional": architectProfessionalLessons,
  "developer-professional": developerProfessionalLessons,
};

export function findLesson(track: TrackId, objective: string): Lesson | undefined {
  return lessonSets[track].lessons.find((lesson) => lesson.objective === objective);
}

export function lessonWords(lesson: Lesson) {
  const text = lesson.blocks.map((block) => {
    switch (block.kind) {
      case "text": return block.text;
      case "code": return block.caption;
      case "list": return block.items.join(" ");
      case "table": return [...block.headers, ...block.rows.flat()].join(" ");
      case "callout": return `${block.title} ${block.text}`;
    }
  }).join(" ");
  return `${lesson.takeaway} ${text}`.split(/\s+/).filter(Boolean).length;
}
