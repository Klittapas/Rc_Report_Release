/**
 * Tiny dependency-free k-means for in-browser clustering.
 *
 * Deterministic: a fixed seed + k-means++ init + N restarts means the same
 * input always yields the same clusters (no flicker on re-render).
 */

/** Seeded PRNG (mulberry32) — deterministic across runs. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Z-score each column so no single feature (e.g. revenue) dominates distance. */
export function standardize(data: number[][]): { z: number[][]; means: number[]; sds: number[] } {
  const n = data.length, d = data[0]?.length ?? 0;
  const means = Array(d).fill(0), sds = Array(d).fill(0);
  for (const row of data) for (let j = 0; j < d; j++) means[j] += row[j];
  for (let j = 0; j < d; j++) means[j] /= n || 1;
  for (const row of data) for (let j = 0; j < d; j++) sds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < d; j++) sds[j] = Math.sqrt(sds[j] / (n || 1)) || 1;
  const z = data.map((row) => row.map((v, j) => (v - means[j]) / sds[j]));
  return { z, means, sds };
}

const dist2 = (a: number[], b: number[]) => {
  let s = 0;
  for (let j = 0; j < a.length; j++) s += (a[j] - b[j]) ** 2;
  return s;
};

export type ClusterResult = { assignments: number[]; centroids: number[][]; inertia: number };

/** k-means++ seeding for one restart. */
function seedPP(z: number[][], k: number, rand: () => number): number[][] {
  const centroids: number[][] = [z[Math.floor(rand() * z.length)]];
  while (centroids.length < k) {
    const d2 = z.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const total = d2.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    let idx = 0;
    for (; idx < d2.length; idx++) { r -= d2[idx]; if (r <= 0) break; }
    centroids.push(z[Math.min(idx, z.length - 1)]);
  }
  return centroids.map((c) => c.slice());
}

/** k-means on already-standardized rows. Runs several restarts, keeps the best (lowest inertia). */
export function kmeans(z: number[][], k: number, restarts = 12, iters = 60, seed = 42): ClusterResult {
  const n = z.length;
  if (n === 0) return { assignments: [], centroids: [], inertia: 0 };
  const kk = Math.min(k, n);
  const rand = rng(seed);
  let best: ClusterResult | null = null;

  for (let r = 0; r < restarts; r++) {
    let centroids = seedPP(z, kk, rand);
    const assign = new Array(n).fill(0);
    for (let it = 0; it < iters; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) {
        let bi = 0, bd = Infinity;
        for (let c = 0; c < kk; c++) { const dd = dist2(z[i], centroids[c]); if (dd < bd) { bd = dd; bi = c; } }
        if (assign[i] !== bi) { assign[i] = bi; moved = true; }
      }
      const sums = Array.from({ length: kk }, () => new Array(z[0].length).fill(0));
      const counts = new Array(kk).fill(0);
      for (let i = 0; i < n; i++) { counts[assign[i]]++; const s = sums[assign[i]]; for (let j = 0; j < z[i].length; j++) s[j] += z[i][j]; }
      centroids = sums.map((s, c) => (counts[c] ? s.map((v) => v / counts[c]) : centroids[c]));
      if (!moved && it > 0) break;
    }
    const inertia = z.reduce((acc, p, i) => acc + dist2(p, centroids[assign[i]]), 0);
    if (!best || inertia < best.inertia) best = { assignments: assign.slice(), centroids, inertia };
  }
  return best!;
}
