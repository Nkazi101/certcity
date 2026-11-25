"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import styles from "./lab-bench.module.css";

/**
 * Row-by-row editing for markdown-table files (a claim checklist, a test table). On a phone, typing `|` separators on a
 * symbol keyboard is the hard part, not the thinking; here the learner still writes every claim, source and verdict,
 * and the file they produce is the same markdown table. The text editor stays one tap away.
 */

type Table = { before: string[]; header: string[]; rows: string[][]; after: string[] };

const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const isRow = (line: string) => line.trim().startsWith("|");
const isSeparator = (line: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());

export function parseTable(text: string): Table | null {
  const lines = text.split("\n");
  const start = lines.findIndex(isRow);
  if (start < 0 || !lines[start + 1] || !isSeparator(lines[start + 1])) return null;
  let end = start + 2;
  while (end < lines.length && isRow(lines[end])) end++;
  const header = cells(lines[start]);
  const rows = lines.slice(start + 2, end).map((line) => {
    const values = cells(line);
    return header.map((_, index) => values[index] ?? "");
  });
  return { before: lines.slice(0, start), header, rows, after: lines.slice(end) };
}

export function formatTable(table: Table) {
  const clean = (value: string) => value.replace(/\|/g, "/").replace(/\n/g, " ").trim();
  const line = (values: readonly string[]) => `| ${values.map(clean).join(" | ")} |`;
  return [...table.before, line(table.header), `|${table.header.map(() => "---").join("|")}|`,
    ...table.rows.map(line), ...table.after].join("\n");
}

/** Allowed values for a column, read from the file's own instruction (e.g. "Verdict: supported, incorrect, …"). */
export function columnChoices(instruction: string, column: string) {
  const match = instruction.match(new RegExp(`${column}\\s*:\\s*([^.]+)\\.`, "i"));
  if (!match) return null;
  const values = match[1].split(/,\s*|\s+or\s+/).map((value) => value.replace(/^or\s+/, "").trim()).filter(Boolean);
  return values.length >= 2 && values.length <= 8 ? values.map((value) => value[0].toUpperCase() + value.slice(1)) : null;
}

export function TableRows({ value, instruction, onChange }: { value: string; instruction: string; onChange: (value: string) => void }) {
  const id = useId();
  const table = parseTable(value);
  if (!table) return null;
  const update = (rows: string[][]) => onChange(formatTable({ ...table, rows }));
  const choices = table.header.map((column) => columnChoices(instruction, column));

  return <div className={styles.rows} aria-label="Edit the table row by row">
    {table.rows.map((row, rowIndex) => <fieldset key={rowIndex} className={styles.rowCard}>
      <legend>Row {rowIndex + 1}</legend>
      {table.header.map((column, columnIndex) => {
        const field = `${id}-${rowIndex}-${columnIndex}`;
        const options = choices[columnIndex];
        const set = (next: string) => update(table.rows.map((entry, index) => index === rowIndex ? entry.map((cell, at) => at === columnIndex ? next : cell) : entry));
        return <label key={column} htmlFor={field}>
          <span>{column}</span>
          {options
            ? <select id={field} value={options.find((option) => option.toLowerCase() === row[columnIndex].toLowerCase()) ?? ""} onChange={(event) => set(event.target.value)}>
                <option value="">Choose…</option>
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            : <input id={field} type="text" value={row[columnIndex]} autoCapitalize="sentences" onChange={(event) => set(event.target.value)} />}
        </label>;
      })}
      <button type="button" className="button button-text" onClick={() => update(table.rows.filter((_, index) => index !== rowIndex))}>
        <Trash2 size={14} aria-hidden="true" />Remove row {rowIndex + 1}
      </button>
    </fieldset>)}
    <button type="button" className="button button-outline" onClick={() => update([...table.rows, table.header.map(() => "")])}>
      <Plus size={15} aria-hidden="true" />Add a row
    </button>
  </div>;
}
