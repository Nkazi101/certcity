// Capstone graders that were module-private and are now exported for the lab engines and future migrations.
// They still take the capstone case shapes; the city lab engines (messages, batches, claude-code) generalize the same rules.
export { errorProblems, followupParse, prefixBlocks } from "../../claude/capstones/developer";
export type { Block as PrefixBlock, DeveloperCase } from "../../claude/capstones/developer";
export { hookSimulation } from "../../claude/capstones/architect";
export type { ArchitectCase } from "../../claude/capstones/architect";
