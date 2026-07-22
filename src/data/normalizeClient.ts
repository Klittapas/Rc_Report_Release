/**
 * Entry point the UI uses to turn uploaded files into a Dataset.
 *
 * Prefers a Web Worker so parsing never freezes the page. If a worker can't be
 * created (older browser, blocked module worker), it falls back to the main
 * thread — still reading files one at a time to keep peak memory low.
 */
import { createNormalizer, type NormalizeResult } from "./normalize.ts";

export type Progress = { index: number; total: number; name: string };

/** Sequential main-thread path — used as the fallback. */
async function normalizeOnMainThread(files: File[], onProgress?: (p: Progress) => void): Promise<NormalizeResult> {
  const n = createNormalizer();
  for (let i = 0; i < files.length; i++) {
    onProgress?.({ index: i, total: files.length, name: files[i].name });
    // stream the file in chunks so its full text is never held at once
    n.beginFile();
    if (typeof TextDecoderStream === "function" && typeof files[i].stream === "function") {
      const reader = files[i].stream().pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        n.pushChunk(value);
      }
    } else {
      n.pushChunk(await files[i].text());
    }
    n.endFile();
    // yield so the message under the button can actually repaint between files
    await new Promise((r) => setTimeout(r, 0));
  }
  return n.finish();
}

export function normalizeFiles(files: File[], onProgress?: (p: Progress) => void): Promise<NormalizeResult> {
  let worker: Worker;
  try {
    worker = new Worker(new URL("./normalize.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return normalizeOnMainThread(files, onProgress); // worker unsupported
  }

  return new Promise<NormalizeResult>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      fn();
    };

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg?.type === "progress") onProgress?.(msg as Progress);
      else if (msg?.type === "done") done(() => resolve(msg.result as NormalizeResult));
      else if (msg?.type === "error") done(() => reject(new Error(msg.message)));
    };
    // worker failed to boot (e.g. bundling issue) -> retry on the main thread
    worker.onerror = () => done(() => normalizeOnMainThread(files, onProgress).then(resolve, reject));

    worker.postMessage({ files });
  });
}
