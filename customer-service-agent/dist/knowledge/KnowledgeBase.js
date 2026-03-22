"use strict";
// ============================================================
// Knowledge Base - 知识库（向量检索 + BM25 混合）
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeBase = void 0;
const embed_1 = require("./embed");
const DEFAULT_CONFIG = {
    topK: 5,
    minScore: 0.05,
    hybridAlpha: 0.7,
};
/** 知识库 */
class KnowledgeBase {
    constructor(config = {}) {
        this.entries = [];
        this.tfidf = new embed_1.TFIDFModel();
        this.bm25 = new embed_1.BM25();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /** 添加知识条目 */
    add(entry) {
        const embedding = this.tfidf.encode(entry.chunk);
        this.entries.push({ ...entry, embedding });
    }
    /** 批量添加 */
    addBatch(entries) {
        for (const e of entries)
            this.add(e);
    }
    /** 构建索引（所有数据添加完成后调用一次）*/
    buildIndex() {
        if (this.entries.length === 0)
            return;
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
    retrieve(query) {
        if (this.entries.length === 0)
            return [];
        const queryVec = this.tfidf.encode(query);
        const results = [];
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
    retrieveByCategory(query, category) {
        const filtered = this.entries.filter(e => e.metadata.category === category);
        if (filtered.length === 0)
            return [];
        const fakeKb = new KnowledgeBase({ topK: this.config.topK });
        // 注意：这里复用时会丢失原始索引，只能按内容重检索
        return this.retrieve(query).filter(r => r.entry.metadata.category === category);
    }
    /** 统计信息 */
    stats() {
        const byCategory = {};
        for (const e of this.entries) {
            byCategory[e.metadata.category] = (byCategory[e.metadata.category] || 0) + 1;
        }
        return { total: this.entries.length, byCategory };
    }
    cosineSim(a, b) {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
    }
}
exports.KnowledgeBase = KnowledgeBase;
//# sourceMappingURL=KnowledgeBase.js.map