import { KnowledgeEntry, RetrievalResult } from '../agent/types';
/** 知识库配置 */
export interface KnowledgeBaseConfig {
    topK?: number;
    minScore?: number;
    hybridAlpha?: number;
}
/** 知识库 */
export declare class KnowledgeBase {
    private entries;
    private tfidf;
    private bm25;
    private config;
    constructor(config?: KnowledgeBaseConfig);
    /** 添加知识条目 */
    add(entry: Omit<KnowledgeEntry, 'embedding'>): void;
    /** 批量添加 */
    addBatch(entries: Omit<KnowledgeEntry, 'embedding'>[]): void;
    /** 构建索引（所有数据添加完成后调用一次）*/
    buildIndex(): void;
    /** 检索最相关的知识 */
    retrieve(query: string): RetrievalResult[];
    /** 按分类检索 */
    retrieveByCategory(query: string, category: string): RetrievalResult[];
    /** 统计信息 */
    stats(): {
        total: number;
        byCategory: Record<string, number>;
    };
    private cosineSim;
}
//# sourceMappingURL=KnowledgeBase.d.ts.map