import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { isCorrect } from "../../lib/certification-progress";
import { cityChecks } from "../../lib/claude/city-checks";
import { sources } from "../../lib/claude/items";
import type { CityAssignmentId } from "../../lib/claude/assignments";
import { readCityCheck, saveCityCheck } from "../../lib/claude/city-progress";
import { ExternalLink } from "./chrome";

export function CitySkillCheck({ trackId, practiceHref, onSaved }: { trackId: CityAssignmentId; practiceHref: string; onSaved: () => void }) {
  const questions = cityChecks[trackId];
  const [attempt, setAttempt] = useState(() => readCityCheck(trackId, questions));
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [shown, setShown] = useState(false);
  const [error, setError] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const complete = questions.every(({ id, correct }) => answers[id]?.length === correct.length);

  function reveal() {
    setShown(true);
    requestAnimationFrame(() => title.current?.focus());
  }

  if (!shown) return (
    <button className="academy-button primary" type="button" onClick={reveal}>
      {attempt ? "Review practice questions" : "Try a new scenario"} <ArrowRight size={16} aria-hidden="true" />
    </button>
  );

  return (
    <section className="academy-panel city-skill-check" aria-labelledby="city-skill-title">
      <h3 id="city-skill-title" ref={title} tabIndex={-1}>Skill check</h3>
      {attempt ? <>
        <p className="academy-positive"><Check size={16} aria-hidden="true" /> {questions.filter((question) => isCorrect(question, attempt[question.id])).length} of {questions.length} correct</p>
        {questions.map((question) => {
          const [label, url] = sources[question.source];
          return (
            <details className="academy-review-item" key={question.id}>
              <summary><span>{question.scenario}</span><span>{isCorrect(question, attempt[question.id]) ? "Correct" : "Needs review"}</span></summary>
              <div className="academy-review-body">
                <p><strong>{question.prompt}</strong></p>
                <p>{question.explanation}</p>
                <ul className="academy-review-options">
                  {question.options.map(([value, text]) => (
                    <li key={value} data-correct={question.correct.includes(value)}>
                      <strong>{text}</strong>
                      {question.correct.includes(value) && <span className="academy-option-status">Correct answer</span>}
                      {attempt[question.id].includes(value) && <span className="academy-option-status">Your response</span>}
                      <p>{question.rationales[value]}</p>
                    </li>
                  ))}
                </ul>
                <ExternalLink href={url}>{label}</ExternalLink>
              </div>
            </details>
          );
        })}
        <Link className="academy-button secondary" href={practiceHref}>More practice on this skill <ArrowRight size={16} aria-hidden="true" /></Link>
        {error && <p role="status">The browser could not save this check.</p>}
      </> : (
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!complete) return;
          const result = saveCityCheck(trackId, questions, answers);
          setError(!result.saved);
          setAttempt(result.answers);
          if (result.saved) onSaved();
          requestAnimationFrame(() => title.current?.focus());
        }}>
          <p>Apply the same decision in a different setting.</p>
          {questions.map(({ id, scenario, prompt, correct, options }) => (
            <fieldset className="academy-fieldset" key={id}>
              <legend><strong>{scenario}</strong><span>{prompt}</span><small>{correct.length === 1 ? "Select one response" : "Select two responses"}</small></legend>
              {options.map(([value, label]) => {
                const picks = answers[id] ?? [];
                return <label className="academy-option" key={value}>
                  <input type={correct.length === 1 ? "radio" : "checkbox"} name={id}
                    checked={picks.includes(value)} disabled={correct.length > 1 && picks.length >= correct.length && !picks.includes(value)}
                    onChange={() => setAnswers((current) => {
                      const selected = current[id] ?? [];
                      const next = correct.length === 1 ? [value] : selected.includes(value)
                        ? selected.filter((pick) => pick !== value) : [...selected, value];
                      return { ...current, [id]: next };
                    })} />
                  <span>{label}</span>
                </label>;
              })}
            </fieldset>
          ))}
          <button type="submit" className="academy-button primary" disabled={!complete}>Submit practice questions <ArrowRight size={16} aria-hidden="true" /></button>
        </form>
      )}
    </section>
  );
}
