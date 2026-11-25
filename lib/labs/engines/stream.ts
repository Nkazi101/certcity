// Server-sent events decoding across network chunk boundaries (lifted from lib/claude/fieldwork.ts).
// "chunks" parses each chunk on its own (drops events split across chunks), "frames" keeps the incomplete
// trailing frame until the rest arrives, and "buffer" waits for the whole response before parsing.
export type SseDecoder = "chunks" | "frames" | "buffer";

export function decodeSse(chunks: readonly string[], decoder: SseDecoder) {
  let text = "";
  let pending = "";
  let stopped = false;
  let failure = "";
  const emitted: { chunk: number; text: string }[] = [];
  for (const [position, chunk] of chunks.entries()) {
    pending += chunk;
    if (decoder === "buffer" && position < chunks.length - 1) continue;
    const frames = pending.split("\n\n");
    pending = decoder === "chunks" ? "" : frames.pop() ?? "";
    for (const frame of frames) {
      const data = frame.split("\n").find((line) => line.startsWith("data: "));
      if (!data) continue;
      try {
        const event = JSON.parse(data.slice(6));
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          text += event.delta.text;
          emitted.push({ chunk: position + 1, text: event.delta.text });
        } else if (event.type === "message_stop") {
          stopped = true;
        } else if (event.type === "error") {
          failure = event.error.type;
        }
      } catch {
        // A partial event is unusable until its complete frame has arrived.
      }
    }
  }
  return { text, stopped, failure, emitted };
}
