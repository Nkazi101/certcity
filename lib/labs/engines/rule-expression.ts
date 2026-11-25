// A tiny, safe expression language for importer and gate rules written by the learner, e.g.
//   total_status == "printed" && total_cents == sum(lines[].amount_cents)
// Paths read fields from a JSON value (a[].b collects b from every item of a); functions: sum, abs, count, min, max.
// Operators: ! && || == != < <= > >= + - *; literals: numbers, "strings", true, false, null. No loops, no side effects.

export type Value = number | string | boolean | null | readonly unknown[];

type Node =
  | { kind: "literal"; value: Value }
  | { kind: "path"; path: string; parts: readonly string[] }
  | { kind: "call"; name: string; args: readonly Node[]; text: string }
  | { kind: "unary"; op: "!" | "-"; arg: Node }
  | { kind: "binary"; op: string; left: Node; right: Node };

export type Compiled = { source: string; node: Node; paths: readonly string[] };
export type Evaluation = { value: Value; seen: readonly { label: string; value: Value }[] };

const functions = new Set(["sum", "abs", "count", "min", "max"]);

type Token = { type: "num" | "str" | "id" | "op" | "punct"; text: string; value?: string | number };

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const space = /^\s+/.exec(rest);
    if (space) { index += space[0].length; continue; }
    const number = /^\d+(?:\.\d+)?/.exec(rest);
    if (number) { tokens.push({ type: "num", text: number[0], value: Number(number[0]) }); index += number[0].length; continue; }
    if (rest[0] === "\"" || rest[0] === "'") {
      const close = rest.indexOf(rest[0], 1);
      if (close < 0) throw new Error(`a string starting at “${rest.slice(0, 12)}” is never closed`);
      tokens.push({ type: "str", text: rest.slice(0, close + 1), value: rest.slice(1, close) });
      index += close + 1;
      continue;
    }
    const path = /^[A-Za-z_][A-Za-z0-9_]*(?:(?:\.[A-Za-z_][A-Za-z0-9_]*)|\[\])*/.exec(rest);
    if (path) { tokens.push({ type: "id", text: path[0] }); index += path[0].length; continue; }
    const op = /^(==|!=|<=|>=|&&|\|\||[<>!+\-*])/.exec(rest);
    if (op) { tokens.push({ type: "op", text: op[0] }); index += op[0].length; continue; }
    if ("(),".includes(rest[0])) { tokens.push({ type: "punct", text: rest[0] }); index++; continue; }
    if (rest[0] === "=") throw new Error("a single = is not a comparison; compare with ==");
    throw new Error(`unexpected character “${rest[0]}”`);
  }
  return tokens;
}

const precedence: Record<string, number> = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, "<=": 4, ">": 4, ">=": 4, "+": 5, "-": 5, "*": 6 };

/** Parses an expression. Throws an Error whose message is a teaching sentence. */
export function compileExpression(source: string): Compiled {
  const text = source.trim();
  if (!text) throw new Error("the expression is empty");
  const tokens = tokenize(text);
  let position = 0;
  const paths: string[] = [];
  const peek = () => tokens[position];
  const expect = (value: string) => {
    if (peek()?.text !== value) throw new Error(`expected “${value}”${peek() ? ` before “${peek().text}”` : " at the end"}`);
    position++;
  };
  const primary = (): Node => {
    const token = tokens[position++];
    if (!token) throw new Error("the expression ends too early");
    if (token.type === "num") return { kind: "literal", value: token.value as number };
    if (token.type === "str") return { kind: "literal", value: token.value as string };
    if (token.type === "op" && (token.text === "!" || token.text === "-")) return { kind: "unary", op: token.text, arg: unary() };
    if (token.text === "(") {
      const inner = expression(0);
      expect(")");
      return inner;
    }
    if (token.type === "id") {
      if (token.text === "true" || token.text === "false") return { kind: "literal", value: token.text === "true" };
      if (token.text === "null") return { kind: "literal", value: null };
      if (peek()?.text === "(") {
        if (!functions.has(token.text)) throw new Error(`${token.text}() is not available; use sum, abs, count, min or max`);
        const start = position - 1;
        position++;
        const args: Node[] = [];
        if (peek()?.text !== ")") {
          for (;;) {
            args.push(expression(0));
            if (peek()?.text === ",") { position++; continue; }
            break;
          }
        }
        expect(")");
        return { kind: "call", name: token.text, args, text: tokens.slice(start, position).map(({ text: part }) => part).join("").replace(/,/g, ", ") };
      }
      paths.push(token.text);
      return { kind: "path", path: token.text, parts: token.text.replace(/\[\]/g, ".[]").split(".").filter(Boolean) };
    }
    throw new Error(`unexpected “${token.text}”`);
  };
  const unary = (): Node => primary();
  const expression = (minimum: number): Node => {
    let left = unary();
    for (;;) {
      const token = peek();
      if (!token || token.type !== "op" || !(token.text in precedence) || precedence[token.text] < minimum) return left;
      position++;
      const right = expression(precedence[token.text] + 1);
      left = { kind: "binary", op: token.text, left, right };
    }
  };
  const node = expression(0);
  if (position < tokens.length) throw new Error(`unexpected “${tokens[position].text}” after a complete expression`);
  return { source: text, node, paths: [...new Set(paths)] };
}

function read(value: unknown, parts: readonly string[]): unknown {
  if (!parts.length) return value;
  const [head, ...tail] = parts;
  if (head === "[]") return Array.isArray(value) ? value.map((item) => read(item, tail)) : undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return read((value as Record<string, unknown>)[head], tail);
}

const numeric = (value: Value): value is number => typeof value === "number" && Number.isFinite(value);
const scalar = (value: unknown): Value => value === undefined ? null
  : Array.isArray(value) ? value : value !== null && typeof value === "object" ? null : value as Value;

export function show(value: Value): string {
  if (Array.isArray(value)) return `[${value.map((item) => show(scalar(item))).join(", ")}]`;
  return value === null ? "null" : typeof value === "string" ? JSON.stringify(value) : String(value);
}

/** Evaluates against a JSON value. Missing fields read as null; arithmetic or ordering with null gives null or false. */
export function evaluate(compiled: Compiled, data: unknown): Evaluation {
  const seen: { label: string; value: Value }[] = [];
  const note = (label: string, value: Value) => {
    if (!seen.some((entry) => entry.label === label)) seen.push({ label, value });
    return value;
  };
  const run = (node: Node): Value => {
    switch (node.kind) {
      case "literal": return node.value;
      case "path": return note(node.path, scalar(read(data, node.parts)));
      case "unary": {
        const value = run(node.arg);
        return node.op === "!" ? value !== true : numeric(value) ? -value : null;
      }
      case "call": {
        const args = node.args.map(run);
        const items = Array.isArray(args[0]) ? (args[0] as readonly unknown[]).map(scalar) : args;
        let value: Value = null;
        if (node.name === "count") value = Array.isArray(args[0]) ? (args[0] as unknown[]).length : null;
        else if (node.name === "abs") value = numeric(args[0]) ? Math.abs(args[0]) : null;
        else if (items.length && items.every(numeric)) {
          const numbers = items as number[];
          value = node.name === "sum" ? numbers.reduce((total, item) => total + item, 0) : node.name === "min" ? Math.min(...numbers) : Math.max(...numbers);
        } else if (node.name === "sum" && Array.isArray(args[0]) && !items.length) value = 0;
        return note(node.text, value);
      }
      case "binary": {
        if (node.op === "&&") return run(node.left) === true && run(node.right) === true;
        if (node.op === "||") return run(node.left) === true || run(node.right) === true;
        const left = run(node.left);
        const right = run(node.right);
        if (node.op === "==") return !Array.isArray(left) && left === right;
        if (node.op === "!=") return Array.isArray(left) || left !== right;
        if (!numeric(left) || !numeric(right)) return ["+", "-", "*"].includes(node.op) ? null : false;
        switch (node.op) {
          case "<": return left < right;
          case "<=": return left <= right;
          case ">": return left > right;
          case ">=": return left >= right;
          case "+": return left + right;
          case "-": return left - right;
          default: return left * right;
        }
      }
    }
  };
  return { value: run(compiled.node), seen };
}

/** A template with {expression} placeholders, e.g. "Printed {total_cents} · items {sum(lines[].amount_cents)}". */
export type CompiledTemplate = { source: string; parts: readonly (string | Compiled)[] };

export function compileTemplate(source: string): CompiledTemplate {
  const parts: (string | Compiled)[] = [];
  let rest = source;
  for (;;) {
    const open = rest.indexOf("{");
    if (open < 0) { parts.push(rest); break; }
    const close = rest.indexOf("}", open);
    if (close < 0) throw new Error("a { placeholder is never closed with }");
    parts.push(rest.slice(0, open), compileExpression(rest.slice(open + 1, close)));
    rest = rest.slice(close + 1);
  }
  return { source, parts: parts.filter((part) => part !== "") };
}

export function renderTemplate(template: CompiledTemplate, data: unknown) {
  return template.parts.map((part) => typeof part === "string" ? part : (() => {
    const { value } = evaluate(part, data);
    return typeof value === "string" ? value : show(value);
  })()).join("");
}
