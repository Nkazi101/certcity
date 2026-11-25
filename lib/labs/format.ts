// Readable JSON for starters, references and documents: pretty-printed, with short objects and arrays kept on one line.
function flat(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(flat).join(", ")}]`;
  return `{ ${Object.entries(value as Record<string, unknown>).map(([key, item]) => `${JSON.stringify(key)}: ${flat(item)}`).join(", ")} }`
    .replace(/^\{ {2}\}$/, "{}");
}

export function compactJson(value: unknown, width = 100, indent = ""): string {
  const line = flat(value);
  if (value === null || typeof value !== "object" || indent.length + line.length <= width) return line;
  const inner = indent + "  ";
  if (Array.isArray(value)) return `[\n${value.map((item) => inner + compactJson(item, width, inner)).join(",\n")}\n${indent}]`;
  const entries = Object.entries(value as Record<string, unknown>);
  return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${compactJson(item, width - JSON.stringify(key).length - 2, inner)}`).join(",\n")}\n${indent}}`;
}
