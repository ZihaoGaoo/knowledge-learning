/** 简单中文分词（基于规则 + 词典） */
export declare function tokenize(text: string): string[];
/** TF-IDF 向量 */
export interface TFIDFVector {
    tf: Record<string, number>;
    idf: Record<string, number>;
    vocab: string[];
    dimension: number;
}
/** 简易 TF-IDF 模型 */
export declare class TFIDFModel {
    private docs;
    private vocab;
    private idf;
    private dimension;
    /** 训练：构建 IDF 表 */
    train(documents: string[]): void;
    /** 将文档转为 TF-IDF 向量 */
    encode(doc: string): number[];
    /** 计算余弦相似度 */
    cosineSim(a: number[], b: number[]): number;
}
/** BM25 排序（可选的备用排序算法） */
export declare class BM25 {
    private k1;
    private b;
    private avgdl;
    private docLens;
    private docs;
    private idf;
    train(documents: string[]): void;
    score(query: string, docIdx: number): number;
    rank(query: string): number[];
}
//# sourceMappingURL=embed.d.ts.map