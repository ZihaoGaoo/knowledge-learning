"use strict";
// ============================================================
// Tool: searchKnowledge - 知识库检索工具
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSearchKnowledgeTool = createSearchKnowledgeTool;
function createSearchKnowledgeTool(kb) {
    const handler = async (args, ctx) => {
        const query = args['query'];
        const category = args['category'];
        if (!query || typeof query !== 'string') {
            return { success: false, error: 'query 参数缺失或类型错误' };
        }
        try {
            let results;
            if (category) {
                results = kb.retrieveByCategory(query, category);
            }
            else {
                results = kb.retrieve(query);
            }
            if (results.length === 0) {
                return {
                    success: true,
                    data: {
                        found: false,
                        message: '未找到相关知识条目，建议转人工客服',
                        results: [],
                    },
                };
            }
            return {
                success: true,
                data: {
                    found: true,
                    count: results.length,
                    results: results.map(r => ({
                        content: r.entry.chunk,
                        category: r.entry.metadata.category,
                        source: r.entry.metadata.source,
                        confidence: (r.score * 100).toFixed(1) + '%',
                    })),
                },
            };
        }
        catch (err) {
            return { success: false, error: `检索失败：${err.message}` };
        }
    };
    return {
        name: 'searchKnowledge',
        description: '从知识库中检索与用户问题最相关的内容。适用于产品功能查询、政策解读、常见问题解答。当用户询问产品使用方法、政策条款、退款规则时使用。',
        parameters: [
            { name: 'query', type: 'string', description: '检索查询语句', required: true },
            { name: 'category', type: 'string', description: '限定知识库类别（product/policy/service/refund）', required: false },
        ],
        handler,
    };
}
//# sourceMappingURL=searchKnowledge.js.map