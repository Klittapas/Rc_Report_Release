/**
 * Off-main-thread CSV normalizer.
 *
 * Files are read and folded in ONE AT A TIME, so peak memory is bounded by the
 * largest single file rather than the sum of all of them. Running here also
 * keeps the UI responsive while a large upload is parsed.
 */
import { createNormalizer } from "./normalize.ts";

type Req = { files: File[] };
type Normalizer = ReturnType<typeof createNormalizer>;

/**
 * Fold one file into the normalizer WITHOUT ever holding its full text: the
 * file is decoded and parsed in ~64KB chunks. Falls back to `.text()` only if
 * the browser lacks TextDecoderStream.
 */
async function foldFile(file: File, n: Normalizer): Promise<void> {
  n.beginFile();
  if (typeof TextDecoderStream === "function" && typeof file.stream === "function") {
    const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      n.pushChunk(value);
    }
  } else {
    n.pushChunk(await file.text());
  }
  n.endFile();
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
  try {
    const { files } = e.data;
    const n = createNormalizer();
    for (let i = 0; i < files.length; i++) {
      post({ type: "progress", index: i, total: files.length, name: files[i].name });
      await foldFile(files[i], n);
    }
    post({ type: "done", result: n.finish() });
  } catch (err) {
    post({ type: "error", message: (err as Error).message });
  }
};
