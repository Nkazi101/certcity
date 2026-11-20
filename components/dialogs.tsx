import { BookOpen, X } from "lucide-react";
import type { FormEvent, RefObject } from "react";
import { useState } from "react";
import type { PracticeItem } from "../lib/claude/items";
import { sources } from "../lib/claude/items";
type DialogRef = RefObject<HTMLDialogElement | null>;

const lensChoices = [
  ["empty", "Return a successful empty result when the catalog completes the scoped search with zero rows."],
  ["verify", "Keep the current response shape and verify every empty result with a second catalog request."],
  ["cache", "Serve the last known exhibit list on a timeout and use it to answer whether an exhibit is currently available."],
  ["timeout", "For an upstream timeout, allow one safe retry within the deadline and return an unavailable tool error if it fails."],
  ["prompt", "Add an agent instruction to infer catalog availability from elapsed time whenever a search returns empty."],
] as const;

export function ExamLens({ dialog, onPractice, question }: { dialog: DialogRef; onPractice: () => void; question?: PracticeItem }) {
  const [feedback, setFeedback] = useState("");
  const [correct, setCorrect] = useState(false);
  const [review, setReview] = useState<string[]>([]);
  const expected = question?.correct ?? ["empty", "timeout"];
  const count = expected.length;

  function checkAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const answers = new FormData(event.currentTarget).getAll("answer");
    const matches = answers.length === count && expected.every((id) => answers.includes(id));
    setCorrect(matches);
    if (answers.length !== count) {
      setFeedback(count === 1 ? "Select one response." : "Select two responses.");
      setReview([]);
    } else {
      onPractice();
      setReview(answers.map(String));
      setFeedback(question ? `${matches ? "Correct." : "Review the distinction."} ${question.explanation}`
        : matches ? "Correct. An empty result establishes absence. A timeout establishes unavailability."
        : "Look at what each result tells you. An unreachable catalog never completed the query.");
    }
  }

  return (
    <dialog className="game-dialog exam-dialog" ref={dialog} aria-labelledby="lens-title">
      <div className="dialog-header">
        <BookOpen size={22} aria-hidden="true" />
        <h2 id="lens-title">Exam Lens</h2>
        <button className="icon-button" type="button" onClick={() => dialog.current?.close()} aria-label="Close Exam Lens">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <form className="dialog-body lens-form" onSubmit={checkAnswer} onChange={() => { setFeedback(""); setReview([]); }}>
        <fieldset>
          <legend>{question ? <><strong>{question.scenario}</strong><br />{question.prompt} {count === 2 ? "Select two responses." : "Select one response."}</> : <>A museum’s Claude assistant uses a read-only MCP catalog tool. Logs show that its adapter returns an empty list both for completed searches with zero rows and for upstream timeouts. The interactive lookup budget has room for one safe retry, and answers must reflect current catalog results. Which changes meet these requirements? Select two responses.</>}</legend>
          {(question?.options ?? lensChoices).map(([id, label]) => (
            <label className="answer-option" key={id}><input type={count === 1 ? "radio" : "checkbox"} name="answer" value={id} /><span>{label}</span></label>
          ))}
        </fieldset>
        <button type="submit" className="button button-primary">Check answer</button>
        {feedback && <p className="lens-feedback" data-correct={correct} role="status">{feedback}</p>}
        {question && review.length > 0 && <>
          <ul className="assignment-lens-rationales">
            {question.options.filter(([id]) => review.includes(id) || question.correct.includes(id)).map(([id, label]) =>
              <li key={id}><strong>{label}</strong><p>{question.rationales[id]}</p></li>)}
          </ul>
          <a href={sources[question.source][1]} target="_blank" rel="noreferrer">{sources[question.source][0]}</a>
        </>}
      </form>
    </dialog>
  );
}
