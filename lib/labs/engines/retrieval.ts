// Lexical / dense / hybrid candidate retrieval with optional rerank and latency accounting (lifted from lib/claude/fieldwork.ts).
export type RetrievalDocument = {
  id: string; revision: string; collection: string; title: string;
  words: readonly string[]; concepts: readonly string[]; body: string; active: boolean;
};
export type RetrievalQuery = { id: string; text: string; match: string; term: string; kind: string; rerank: boolean };
export type RetrievalConfig = { match: "dense" | "lexical" | "hybrid"; activeOnly: boolean; rerank: "all" | "flagged" | "off" };

export function retrieve<D extends RetrievalDocument, Q extends RetrievalQuery>(documents: readonly D[], query: Q, config: RetrievalConfig) {
  const candidates = documents.filter((doc) => (!config.activeOnly || doc.active) && (
    (config.match !== "dense" && [doc.id.toLowerCase(), ...doc.words].some((term) => term === query.term)) ||
    (config.match !== "lexical" && doc.concepts.some((term) => term === query.term))
  ));
  const rerank = config.rerank === "all" || (config.rerank === "flagged" && query.rerank);
  if (rerank) {
    const terms = new Set(query.text.toLowerCase().split(/\W+/).filter((term) => term.length > 3));
    const overlap = (body: string) => body.toLowerCase().split(/\W+/).filter((term) => terms.has(term)).length;
    candidates.sort((left, right) => overlap(right.body) - overlap(left.body));
  }
  const selected = candidates[0];
  const indexMs = config.match === "hybrid" ? 61 : 44;
  const rerankMs = rerank ? query.rerank ? 56 : 112 : 0;
  const composeMs = 32;
  const latency = indexMs + rerankMs + composeMs;
  return { ...query, candidates, selected, rerank, indexMs, rerankMs, composeMs, latency,
    correct: !!selected && selected.id === query.match && selected.active };
}
