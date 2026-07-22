"""
k-means from scratch — หลักการเดียวกับที่ใช้ใน production (cluster.ts)
แต่เขียนใหม่ทั้งหมดเป็น Python ล้วน + numpy เพื่อการวิจัย/ทดลอง

ครบทุกชิ้นที่ k-means "จริงจัง" ต้องมี:
    1) standardize (z-score)      -> ทุก feature เสียงเท่ากัน
    2) kmeans++ seeding           -> จุดเริ่มกระจายตัว ไม่ติดกัน
    3) assign / update loop       -> หัวใจของอัลกอริทึม
    4) multi-restart + best       -> กัน local minimum
    5) silhouette                 -> วัดว่ากลุ่มชัดแค่ไหน
    6) elbow (inertia vs k)       -> ช่วยเลือก k

ไม่พึ่ง scikit-learn เพื่อให้เห็นทุกบรรทัดว่าเกิดอะไรขึ้น
รันได้เลย:  python3 kmeans_from_scratch.py
"""

from __future__ import annotations
import numpy as np


# ----------------------------------------------------------------------
# 1) STANDARDIZE — z-score แต่ละคอลัมน์: (x - mean) / sd
#    กันไม่ให้ feature สเกลใหญ่ (เช่น rooms หลักพัน) กลบ feature 0-1
# ----------------------------------------------------------------------
def standardize(X: np.ndarray):
    mean = X.mean(axis=0)
    sd = X.std(axis=0)
    sd[sd == 0] = 1.0                      # กันหารศูนย์ (คอลัมน์ค่าคงที่)
    Z = (X - mean) / sd
    return Z, mean, sd


# ----------------------------------------------------------------------
# 2) KMEANS++ SEEDING — เลือก centroid เริ่มต้นแบบถ่วงน้ำหนักด้วยระยะ²
#    จุดที่ไกลจาก centroid ที่เลือกไปแล้ว มีโอกาสถูกเลือกสูง
# ----------------------------------------------------------------------
def _kpp_init(Z: np.ndarray, k: int, rng: np.random.Generator) -> np.ndarray:
    n = len(Z)
    centroids = [Z[rng.integers(n)]]
    for _ in range(1, k):
        # ระยะ² ของแต่ละจุด ไปยัง centroid ที่ใกล้สุด "ที่มีอยู่แล้ว"
        d2 = np.min([((Z - c) ** 2).sum(axis=1) for c in centroids], axis=0)
        probs = d2 / d2.sum()              # ยิ่งไกล ยิ่งน่าเลือก
        centroids.append(Z[rng.choice(n, p=probs)])
    return np.array(centroids)


# ----------------------------------------------------------------------
# 3+4) KMEANS — assign/update loop + หลาย restart เก็บอันดีสุด
# ----------------------------------------------------------------------
def kmeans(Z: np.ndarray, k: int, restarts: int = 12, max_iter: int = 100, seed: int = 42):
    rng = np.random.default_rng(seed)      # seed ตายตัว -> ผลซ้ำได้ (reproducible)
    n = len(Z)
    best = None

    for _ in range(restarts):
        C = _kpp_init(Z, k, rng)
        labels = np.full(n, -1)

        for _ in range(max_iter):
            # --- ASSIGN: จุดวิ่งเข้าหา centroid ใกล้สุด ---
            #     dists[i, c] = ระยะ² จากจุด i ถึง centroid c   (broadcasting)
            dists = ((Z[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)
            new_labels = dists.argmin(axis=1)
            if np.array_equal(new_labels, labels):
                break                       # ไม่มีใครย้ายกลุ่ม = ลู่เข้า
            labels = new_labels

            # --- UPDATE: centroid ย้ายไปที่ค่าเฉลี่ยของสมาชิก ---
            for c in range(k):
                members = Z[labels == c]
                if len(members):
                    C[c] = members.mean(axis=0)

        inertia = float(((Z - C[labels]) ** 2).sum())   # ผลรวมระยะ² ในกลุ่ม
        if best is None or inertia < best["inertia"]:
            best = {"labels": labels, "centroids": C, "inertia": inertia}

    return best


# ----------------------------------------------------------------------
# 5) SILHOUETTE — วัดคุณภาพการแยกกลุ่ม (เฉลี่ยทั้งชุด, -1 ถึง 1)
#    ต่อจุด:  s = (b - a) / max(a, b)
#      a = ระยะเฉลี่ยไปเพื่อนร่วมกลุ่ม   (ยิ่งน้อย = กลุ่มกระชับ)
#      b = ระยะเฉลี่ยไปกลุ่มข้างบ้านที่ใกล้สุด (ยิ่งมาก = แยกขาด)
# ----------------------------------------------------------------------
def silhouette(Z: np.ndarray, labels: np.ndarray) -> float:
    n = len(Z)
    uniq = np.unique(labels)
    if len(uniq) < 2:
        return 0.0
    # ตารางระยะทางเต็ม (ยุคลิด)
    D = np.sqrt(((Z[:, None, :] - Z[None, :, :]) ** 2).sum(axis=2))
    s = np.zeros(n)
    for i in range(n):
        same = labels == labels[i]
        same[i] = False
        a = D[i, same].mean() if same.any() else 0.0
        b = min(D[i, labels == c].mean() for c in uniq if c != labels[i])
        s[i] = (b - a) / max(a, b) if max(a, b) > 0 else 0.0
    return float(s.mean())


# ----------------------------------------------------------------------
# 6) ELBOW — inertia ที่ k ต่างๆ (หา "จุดหักศอก")
# ----------------------------------------------------------------------
def elbow(Z: np.ndarray, k_range=range(1, 8), **kw):
    return {k: kmeans(Z, k, **kw)["inertia"] for k in k_range}


# ======================================================================
# DEMO — ข้อมูลสังเคราะห์ 4 ก้อน 3 มิติ (ไม่เกี่ยวกับโปรเจกต์ใดๆ)
# ======================================================================
def make_blobs(rng, centers, spread=0.6, per=60):
    X = []
    for cx in centers:
        X.append(rng.normal(cx, spread, size=(per, len(cx))))
    return np.vstack(X)


def main():
    rng = np.random.default_rng(0)
    true_centers = [(0, 0, 0), (6, 6, 0), (0, 6, 6), (6, 0, 6)]
    X = make_blobs(rng, true_centers, spread=0.9, per=60)   # 240 จุด, 3 มิติ

    Z, mean, sd = standardize(X)
    print(f"ข้อมูล: {X.shape[0]} จุด · {X.shape[1]} มิติ · ซ่อนไว้ {len(true_centers)} ก้อนจริง\n")

    # --- elbow + silhouette ตาราง หา k ที่ดี ---
    print(f"{'k':>2} {'inertia':>10} {'silhouette':>11}   quality")
    inertias = elbow(Z, range(1, 8))
    best_k, best_sil = None, -1
    for k in range(2, 8):
        res = kmeans(Z, k)
        sil = silhouette(Z, res["labels"])
        q = ("strong" if sil > .5 else "reasonable" if sil > .35
             else "weak" if sil > .25 else "poor")
        star = ""
        if sil > best_sil:
            best_sil, best_k = sil, k
        print(f"{k:>2} {inertias[k]:>10.1f} {sil:>11.3f}   {q}")

    print(f"\n>> silhouette เลือก k = {best_k}  (sil = {best_sil:.3f})")

    # --- รันตัวเต็มที่ k ที่ดีที่สุด ---
    final = kmeans(Z, best_k)
    labels, C = final["labels"], final["centroids"]
    sizes = np.bincount(labels)
    print(f">> ขนาดกลุ่ม: {sizes.tolist()}   inertia = {final['inertia']:.1f}")

    # centroid กลับสู่หน่วยจริง (ย้อน z-score)  =  C * sd + mean
    print("\ncentroid (หน่วยจริง, ย้อน z-score):")
    for c in range(best_k):
        real = C[c] * sd + mean
        print(f"  กลุ่ม {c}: [{', '.join(f'{v:5.2f}' for v in real)}]  ({sizes[c]} จุด)")

    # --- พยายามวาดรูป (ถ้ามี matplotlib) ---
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        # PCA ง่ายๆ ยุบ 3 มิติ -> 2 มิติ ด้วย SVD
        Zc = Z - Z.mean(0)
        _, _, Vt = np.linalg.svd(Zc, full_matrices=False)
        P = Zc @ Vt[:2].T
        cols = plt.cm.tab10(np.linspace(0, 1, best_k))
        fig, ax = plt.subplots(figsize=(7, 5.5), dpi=130)
        for c in range(best_k):
            m = labels == c
            ax.scatter(P[m, 0], P[m, 1], s=30, color=cols[c],
                       edgecolors="white", linewidths=.5, label=f"cluster {c} (n={m.sum()})")
        # centroid ใน PCA space
        Cp = (C - Z.mean(0)) @ Vt[:2].T
        ax.scatter(Cp[:, 0], Cp[:, 1], marker="X", s=200, c="black",
                   edgecolors="white", linewidths=1.5, zorder=5, label="centroids")
        ax.set_title(f"k-means from scratch · k={best_k} · silhouette {best_sil:.2f}")
        ax.set_xlabel("PC1"); ax.set_ylabel("PC2"); ax.legend(fontsize=8)
        ax.grid(alpha=.15)
        out = "kmeans_result.png"
        plt.tight_layout(); plt.savefig(out)
        print(f"\nวาดรูปแล้ว -> {out}")
    except ImportError:
        print("\n(ไม่มี matplotlib — ข้ามการวาดรูป ผลตัวเลขด้านบนใช้ได้ปกติ)")


if __name__ == "__main__":
    main()
