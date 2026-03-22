"use strict";
// ============================================================
// Tool: sentimentAnalysis - 情感分析工具
// 简易规则-based 情感分析，无外部依赖
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSentimentTool = createSentimentTool;
const NEGATIVE_WORDS = [
    '差', '烂', '垃圾', '失望', '不满', '愤怒', '投诉', '坑',
    '退货', '退款', '垃圾', '恶劣', '虚假', '欺骗', '诈骗',
    '非常', '特别', '极其', '彻底', '完全', '根本',
    '坏', '破', '烂', '假', '骗',
    'worst', 'terrible', 'horrible', 'angry', 'refund',
];
const POSITIVE_WORDS = [
    '好', '棒', '赞', '优秀', '满意', '喜欢', '感谢', '谢谢',
    '不错', '挺好', '可以', '喜欢', '超赞',
    'great', 'excellent', 'amazing', 'wonderful', 'love',
];
const ESCALATION_KEYWORDS = [
    '投诉', '举报', '曝光', '律师', '法院', '起诉',
    '要自杀', '投诉到', '315', '媒体',
    'refund now', 'lawsuit', 'report',
];
function createSentimentTool() {
    const handler = async (args) => {
        const text = args['text'];
        if (!text || typeof text !== 'string') {
            return { success: false, error: 'text 参数缺失' };
        }
        const result = analyzeSentiment(text);
        return { success: true, data: result };
    };
    return {
        name: 'sentimentAnalysis',
        description: '分析用户文本的情感倾向（正面/中性/负面）和紧急程度，返回是否建议转人工。用于判断用户情绪状态，辅助决定是否需要升级处理。',
        parameters: [
            { name: 'text', type: 'string', description: '待分析的文本内容', required: true },
        ],
        handler,
    };
}
function analyzeSentiment(text) {
    const lower = text.toLowerCase();
    const words = lower.split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    const foundKeywords = [];
    // 统计负面词
    for (const w of NEGATIVE_WORDS) {
        if (lower.includes(w)) {
            negativeCount++;
            foundKeywords.push(`[负]${w}`);
        }
    }
    // 统计正面词
    for (const w of POSITIVE_WORDS) {
        if (lower.includes(w)) {
            positiveCount++;
            foundKeywords.push(`[正]${w}`);
        }
    }
    // 计算情感得分 (-1 到 1)
    const total = positiveCount + negativeCount;
    const rawScore = total > 0 ? (positiveCount - negativeCount) / total : 0;
    const score = Math.max(-1, Math.min(1, rawScore));
    // 判断情感
    let sentiment;
    if (score > 0.2)
        sentiment = 'positive';
    else if (score < -0.2)
        sentiment = 'negative';
    else
        sentiment = 'neutral';
    // 判断是否需要转人工
    const escalation = ESCALATION_KEYWORDS.some(k => lower.includes(k)) || negativeCount >= 3;
    return {
        sentiment,
        score,
        keywords: foundKeywords.slice(0, 10),
        escalation,
    };
}
//# sourceMappingURL=sentiment.js.map