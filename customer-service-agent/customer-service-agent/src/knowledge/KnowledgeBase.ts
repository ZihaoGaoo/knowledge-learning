// ============================================================
// Knowledge Base - 知识库（向量检索 + BM25 混合）
// ============================================================

import { KnowledgeEntry, RetrievalResult } from '../agent/types';
import { TFIDFModel, BM25 } from './embed';

/** 知识库配置 */
export interface KnowledgeBaseConfig {
  topK?: number;           // 最多返回 K 条（默认 5）
  minScore?: number;       // 最低相似度阈值（默认 0.05）
  hybridAlpha?: number;    // 向量检索和 BM25 的权重（默认 0.7）
}

const DEFAULT_CONFIG: Required<KnowledgeBaseConfig> = {
  topK: 5,
  minScore: 0.05,
  hybridAlpha: 0.7,
};

/** 知识库 */
export class KnowledgeBase {
  private entries: KnowledgeEntry[] = [];
  private tfidf = new TFIDFModel();
  private bm25 = new BM25();
  private config: Required<KnowledgeBaseConfig>;

  constructor(config: KnowledgeBaseConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** 添加知识条目 */
  add(entry: Omit<KnowledgeEntry, 'embedding'>): void {
    const embedding = this.tfidf.encode(entry.chunk);
    this.entries.push({ ...entry, embedding });
  }

  /** 批量添加 */
  addBatch(entries: Omit<KnowledgeEntry, 'embedding'>[]): void {
    for (const e of entries) this.add(e);
  }

  /** 构建索引（所有数据添加完成后调用一次）*/
  buildIndex(): void {
    if (this.entries.length === 0) return;
    // 重新为所有 entry 编码（因为添加时 vocab 可能还不完整）
    const allChunks = this.entries.map(e => e.chunk);
    this.tfidf.train(allChunks);
    this.bm25.train(allChunks);
    // 重新编码
    for (const entry of this.entries) {
      entry.embedding = this.tfidf.encode(entry.chunk);
    }
  }

  /** 检索最相关的知识 */
  retrieve(query: string): RetrievalResult[] {
    if (this.entries.length === 0) return [];

    const queryVec = this.tfidf.encode(query);
    const results: { entry: KnowledgeEntry; hybridScore: number }[] = [];

    for (const entry of this.entries) {
      // 向量相似度（余弦）
      const vecSim = this.cosineSim(queryVec, entry.embedding);

      // BM25 分数
      const entryIdx = this.entries.indexOf(entry);
      const bm25Score = this.bm25.score(query, entryIdx);

      // 混合评分
      const hybridScore = this.config.hybridAlpha * vecSim + (1 - this.config.hybridAlpha) * (bm25Score / 10);

      if (hybridScore >= this.config.minScore) {
        results.push({ entry, hybridScore });
      }
    }

    // 排序取 topK
    return results
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, this.config.topK)
      .map(({ entry, hybridScore }, rank) => ({
        entry: { ...entry, metadata: { ...entry.metadata, confidence: hybridScore } },
        score: hybridScore,
        rank: rank + 1,
      }));
  }

  /** 按分类检索 */
  retrieveByCategory(query: string, category: string): RetrievalResult[] {
    const filtered = this.entries.filter(e => e.metadata.category === category);
    if (filtered.length === 0) return [];

    const fakeKb = new KnowledgeBase({ topK: this.config.topK });
    // 注意：这里复用时会丢失原始索引，只能按内容重检索
    return this.retrieve(query).filter(r => r.entry.metadata.category === category);
  }

  /** 统计信息 */
  stats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    for (const e of this.entries) {
      byCategory[e.metadata.category] = (byCategory[e.metadata.category] || 0) + 1;
    }
    return { total: this.entries.length, byCategory };
  }

  private cosineSim(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
  }
}
