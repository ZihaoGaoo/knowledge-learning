// ============================================================
// Tokenizer & Embedder - 简易分词 + TF-IDF 向量化（无外部依赖）
// ============================================================

/** 简单中文分词（基于规则 + 词典） */
export function tokenize(text: string): string[] {
  // 全部小写
  const lower = text.toLowerCase();
  // 标点符号替换为空格
  const clean = lower.replace(/[，,。.！!？?；;：:""''（）()【】[\]、\/-]/g, ' ');
  // 按空格和常见分隔符切分
  const words = clean.split(/\s+/).filter(w => w.length > 1);
  return words;
}

/** TF-IDF 向量 */
export interface TFIDFVector {
  tf: Record<string, number>;  // term frequency
  idf: Record<string, number>; // inverse document frequency
  vocab: string[];
  dimension: number;
}

/** 简易 TF-IDF 模型 */
export class TFIDFModel {
  private docs: string[][] = [];       // 训练文档集合
  private vocab: Set<string> = new Set();
  private idf: Record<string, number> = {};
  private dimension = 0;

  /** 训练：构建 IDF 表 */
  train(documents: string[]): void {
    this.docs = documents.map(d => tokenize(d));
    const N = documents.length;

    // 构建词表
    const docFreq: Record<string, number> = {};
    for (const doc of this.docs) {
      const seen = new Set<string>();
      for (const word of doc) {
        this.vocab.add(word);
        if (!seen.has(word)) {
          docFreq[word] = (docFreq[word] || 0) + 1;
          seen.add(word);
        }
      }
    }

    // 计算 IDF
    for (const [word, df] of Object.entries(docFreq)) {
      this.idf[word] = Math.log((N + 1) / (df + 1)) + 1;
    }

    this.dimension = this.vocab.size;
  }

  /** 将文档转为 TF-IDF 向量 */
  encode(doc: string): number[] {
    const tokens = tokenize(doc);
    const tf: Record<string, number> = {};
    for (const word of tokens) {
      tf[word] = (tf[word] || 0) + 1;
    }
    // 归一化 TF
    const tfSum = Object.values(tf).reduce((a, b) => a + b, 0);

    const vec: number[] = new Array(this.dimension).fill(0);
    let i = 0;
    for (const word of this.vocab) {
      const tfVal = tf[word] || 0;
      const tfNorm = tfSum > 0 ? tfVal / tfSum : 0;
      vec[i] = tfNorm * (this.idf[word] || 0);
      i++;
    }

    // L2 归一化
    const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0));
    return norm > 0 ? vec.map(v => v / norm) : vec;
  }

  /** 计算余弦相似度 */
  cosineSim(a: number[], b: number[]): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return dot;
  }
}

/** BM25 排序（可选的备用排序算法） */
export class BM25 {
  private k1 = 1.5;
  private b = 0.75;
  private avgdl = 0;
  private docLens: number[] = [];
  private docs: string[][] = [];
  private idf: Record<string, number> = {};

  train(documents: string[]): void {
    this.docs = documents.map(d => tokenize(d));
    const N = documents.length;
    this.docLens = this.docs.map(d => d.length);
    this.avgdl = this.docLens.reduce((a, b) => a + b, 0) / N;

    const docFreq: Record<string, number> = {};
    for (const doc of this.docs) {
      const seen = new Set<string>();
      for (const word of doc) {
        if (!seen.has(word)) {
          docFreq[word] = (docFreq[word] || 0) + 1;
          seen.add(word);
        }
      }
    }
    for (const [word, df] of Object.entries(docFreq)) {
      this.idf[word] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    }
  }

  score(query: string, docIdx: number): number {
    const queryTokens = tokenize(query);
    const doc = this.docs[docIdx];
    const dl = this.docLens[docIdx];
    const tf: Record<string, number> = {};
    for (const word of doc) tf[word] = (tf[word] || 0) + 1;

    let score = 0;
    for (const term of queryTokens) {
      if (!(term in this.idf)) continue;
      const tfVal = tf[term] || 0;
      const idfVal = this.idf[term];
      const numerator = tfVal * (this.k1 + 1);
      const denominator = tfVal + this.k1 * (1 - this.b + this.b * dl / this.avgdl);
      score += idfVal * numerator / denominator;
    }
    return score;
  }

  rank(query: string): number[] {
    return this.docs
      .map((_, idx) => ({ idx, score: this.score(query, idx) }))
      .sort((a, b) => b.score - a.score)
      .map(r => r.idx);
  }
}
