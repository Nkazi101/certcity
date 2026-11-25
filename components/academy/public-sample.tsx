"use client";

import { Check, CircleHelp } from "lucide-react";
import { useId, useRef, useState } from "react";
import styles from "./public-track-guide.module.css";

export function PublicSample({ question, options, answer, explanation }: {
  question: string;
  options: readonly string[];
  answer: number;
  explanation: string;
}) {
  const formId = useId();
  const solution = useRef<HTMLDetailsElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const correct = selected === answer;

  return <form className={styles.sample} onSubmit={(event) => {
    event.preventDefault();
    if (selected === null) return;
    setChecked(true);
    if (solution.current) solution.current.open = true;
  }}>
    <fieldset>
      <legend><h3>{question}</h3></legend>
      <div className={styles.options}>
        {options.map((option, index) => <label key={option} className={styles.option} data-selected={selected === index}>
          <input type="radio" name={formId} checked={selected === index} onChange={() => {
            if (checked && solution.current) solution.current.open = false;
            setSelected(index);
            setChecked(false);
          }} />
          <span>{option}</span>
        </label>)}
      </div>
    </fieldset>
    <div className={styles.actions}>
      <button className="academy-button secondary" type="submit" disabled={selected === null}>Check answer</button>
      <p className={styles.result} role="status" data-correct={checked ? correct : undefined}>
        {checked && (correct ? <><Check size={16} aria-hidden="true" /> Correct</> : <><CircleHelp size={16} aria-hidden="true" /> Review the explanation</>)}
      </p>
    </div>
    <details ref={solution} className={styles.solution}>
      <summary>Answer and explanation</summary>
      <div><p><strong>{options[answer]}</strong></p><p>{explanation}</p></div>
    </details>
  </form>;
}
