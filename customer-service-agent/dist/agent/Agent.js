"use strict";
// ============================================================
// Agent - 核心 Agent 类（模拟 LLM 决策 + 工具执行循环）
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerServiceAgent = void 0;
const uuid_1 = require("./uuid");
const prompts_1 = require("./prompts");
const DEFAULT_CONFIG = {
    modelName: 'mock-gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    debug: false,
    sessionTTL: 30 * 60 * 1000,
    maxHistoryLength: 20,
};
class CustomerServiceAgent {
    constructor(mcp, config = {}) {
        this.tools = new Map();
        this.skills = [];
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.mcp = mcp;
    }
    /** 注册工具 */
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        this.log(`[Tool] Registered: ${tool.name}`);
    }
    /** 注册多个工具 */
    registerTools(tools) {
        tools.forEach(t => this.registerTool(t));
    }
    /** 注册技能 */
    registerSkills(skills) {
        this.skills = skills;
        this.mcp.registerSkills(skills);
    }
    /** 处理用户消息 */
    async process(userMessage, sessionId, userId) {
        const userMsg = {
            id: (0, uuid_1.v4)(),
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
        };
        const ctx = this.mcp.getContext(sessionId, userId);
        this.mcp.appendMessage(ctx, userMsg);
        // 构建 MCP 上下文
        const mcpCtx = this.mcp.buildContext(sessionId, userId, userMessage);
        // 构造系统提示词
        const toolDefs = Array.from(this.tools.values());
        const mcpInstructions = this.mcp.buildMCPInstructions(mcpCtx);
        const systemPrompt = (0, prompts_1.buildSystemPrompt)(toolDefs, this.skills, mcpInstructions);
        // 模拟 LLM 决策：解析用户意图 → 判断是否调用工具/技能
        const decision = this.mockLLMDecision(userMessage, mcpCtx, toolDefs);
        let reply = '';
        // 技能触发放最优先（即使没有工具调用）
        if (decision.triggeredSkill) {
            reply = this.generateSkillReply(decision.triggeredSkill);
        }
        else if (decision.toolCalls.length > 0) {
            // 执行工具调用链
            const toolResults = await this.executeToolCalls(decision.toolCalls, ctx);
            // 汇总工具执行结果，生成最终回复
            reply = this.generateReply(decision, toolResults, mcpCtx);
        }
        else {
            // 无工具调用，直接回复
            reply = decision.directReply || '抱歉，我没理解您的意思，请您换个方式描述一下？';
        }
        // 记录 AI 回复
        const aiMsg = {
            id: (0, uuid_1.v4)(),
            role: 'assistant',
            content: reply,
            timestamp: Date.now(),
            toolCalls: decision.toolCalls.length > 0 ? decision.toolCalls : undefined,
        };
        this.mcp.appendMessage(ctx, aiMsg);
        return reply;
    }
    /** 模拟 LLM 决策过程（实际项目中替换为真实的模型调用）*/
    mockLLMDecision(userMessage, mcpCtx, tools) {
        const lower = userMessage.toLowerCase();
        const toolCalls = [];
        // === 意图路由 ===
        // 1. 转人工
        if (['转人工', '人工客服', '真人', '活人'].some(k => lower.includes(k))) {
            return {
                toolCalls: [],
                directReply: null,
                triggeredSkill: this.skills.find(s => s.name === 'escalateToHuman') || null,
            };
        }
        // 2. 订单查询
        if (['订单', '物流', '发货', '快递', '到了', 'ord'].some(k => lower.includes(k))) {
            const orderId = this.extractOrderId(userMessage);
            toolCalls.push({
                id: (0, uuid_1.v4)(),
                name: 'queryOrder',
                arguments: orderId ? { orderId } : { queryType: 'all' },
            });
            return { toolCalls, directReply: null, triggeredSkill: null };
        }
        // 3. 投诉/情绪分析
        if (['投诉', '不满', '差', '坏了', '质量', '虚假', '欺骗'].some(k => lower.includes(k))) {
            toolCalls.push({ id: (0, uuid_1.v4)(), name: 'sentimentAnalysis', arguments: { text: userMessage } });
            // 继续查知识库
            toolCalls.push({ id: (0, uuid_1.v4)(), name: 'searchKnowledge', arguments: { query: userMessage, category: 'service' } });
            return { toolCalls, directReply: null, triggeredSkill: null };
        }
        // 4. 退款/退货（需要明确的退款意图，不只是出现"退货"两个字）
        const refundIntentPatterns = ['申请退款', '要退货', '退款申请', '办退款', '办退货', '办取消', '取消订单', '钱能退吗', '可以退吗'];
        const hasRefundIntent = refundIntentPatterns.some(p => lower.includes(p));
        if (hasRefundIntent) {
            const orderId = this.extractOrderId(userMessage);
            toolCalls.push({ id: (0, uuid_1.v4)(), name: 'applyRefund', arguments: { action: 'query' } });
            if (orderId) {
                toolCalls.push({ id: (0, uuid_1.v4)(), name: 'applyRefund', arguments: { action: 'apply', orderId, reason: '其他' } });
            }
            return { toolCalls, directReply: null, triggeredSkill: null };
        }
        // 5. 产品查询
        if (['价格', '多少钱', '有货', '参数', '规格', '产品', '推荐', '买哪个', '对比'].some(k => lower.includes(k))) {
            const productId = this.extractProductId(userMessage);
            if (productId) {
                toolCalls.push({ id: (0, uuid_1.v4)(), name: 'queryProduct', arguments: { productId } });
            }
            else {
                toolCalls.push({ id: (0, uuid_1.v4)(), name: 'queryProduct', arguments: { action: 'list' } });
            }
            return { toolCalls, directReply: null, triggeredSkill: null };
        }
        // 6. 知识库检索（兜底）
        toolCalls.push({ id: (0, uuid_1.v4)(), name: 'searchKnowledge', arguments: { query: userMessage } });
        return { toolCalls, directReply: null, triggeredSkill: null };
    }
    /** 执行工具调用 */
    async executeToolCalls(toolCalls, ctx) {
        const results = new Map();
        for (const tc of toolCalls) {
            const tool = this.tools.get(tc.name);
            if (!tool) {
                results.set(tc.id, { success: false, error: `工具 ${tc.name} 不存在` });
                continue;
            }
            this.log(`[ToolCall] ${tool.name} args=${JSON.stringify(tc.arguments)}`);
            try {
                const result = await tool.handler(tc.arguments, ctx);
                results.set(tc.id, result);
                tc.result = result;
                this.log(`[ToolResult] ${tool.name} → ${result.success ? 'OK' : 'ERR:' + result.error}`);
            }
            catch (err) {
                const errResult = { success: false, error: err.message };
                results.set(tc.id, errResult);
                tc.result = errResult;
                this.log(`[ToolError] ${tool.name} → ${err.message}`);
            }
        }
        return results;
    }
    /** 根据工具执行结果生成回复 */
    generateReply(decision, toolResults, mcpCtx) {
        const { triggeredSkill, toolCalls } = decision;
        // 转人工
        if (triggeredSkill?.name === 'escalateToHuman') {
            return '好的，正在为您转接人工客服，请稍等（约3-5分钟）。\n\n为了更快为您服务，能否先简单描述一下您的问题？';
        }
        // 订单查询结果
        if (toolCalls.some(t => t.name === 'queryOrder')) {
            const orderResult = this.findResult('queryOrder', toolCalls, toolResults);
            if (orderResult?.success && orderResult.data) {
                const data = orderResult.data;
                if ('orders' in data && Array.isArray(data.orders)) {
                    if (data.orders.length === 0)
                        return '您目前没有查到订单记录，请核对一下订单信息或联系方式。';
                    const lines = data.orders.map((o, i) => `${i + 1}. 【${o.statusText}】${o.product} - ¥${o.amount}（${o.createdAt}）`);
                    return `为您查到以下订单：\n${lines.join('\n')}\n\n请问您想了解哪个订单的详情？`;
                }
                if ('order' in data && data.found) {
                    const o = data.order;
                    return [
                        `📦 订单信息`,
                        `订单号：${o.orderId}`,
                        `状态：${o.statusText}`,
                        `商品：${o.product}`,
                        `金额：¥${o.amount}`,
                        o.shippedAt ? `发货时间：${o.shippedAt}` : '',
                        o.expressNo ? `快递：${o.expressCompany} ${o.expressNo}` : '',
                        o.estimatedDelivery ? `预计送达：${o.estimatedDelivery}` : '',
                    ].filter(Boolean).join('\n');
                }
            }
            if (orderResult?.error?.includes('身份'))
                return orderResult.error;
        }
        // 情绪分析结果
        if (toolCalls.some(t => t.name === 'sentimentAnalysis')) {
            const sentResult = this.findResult('sentimentAnalysis', toolCalls, toolResults);
            if (sentResult?.success) {
                const sent = sentResult.data;
                if (sent.escalation) {
                    return `非常抱歉给您带来了不好的体验，我们非常重视您的问题。\n\n请问可以告诉我具体的情况吗？我会尽快为您处理或转接相关人员。`;
                }
            }
        }
        // 知识库检索结果
        if (toolCalls.some(t => t.name === 'searchKnowledge')) {
            const kbResult = this.findResult('searchKnowledge', toolCalls, toolResults);
            if (kbResult?.success && kbResult.data.found) {
                const data = kbResult.data;
                if (data.results.length > 0) {
                    const top = data.results[0];
                    return `根据您的问题，我查到了相关信息：\n\n📖 ${top.content}\n\n希望对您有帮助！如果还有其他问题，随时告诉我。`;
                }
            }
        }
        // 产品查询结果
        if (toolCalls.some(t => t.name === 'queryProduct')) {
            const prodResult = this.findResult('queryProduct', toolCalls, toolResults);
            if (prodResult?.success && prodResult.data) {
                const data = prodResult.data;
                if ('products' in data && Array.isArray(data.products)) {
                    const lines = data.products.map((p, i) => `${i + 1}. ${p.name} - ¥${p.price}（${p.stockText}）`);
                    return `当前在售产品：\n${lines.join('\n')}\n\n请问您对哪款产品感兴趣？`;
                }
                if ('product' in data && data.found) {
                    const p = data.product;
                    return [
                        `🛍️ ${p.name}`,
                        `💰 价格：¥${p.price}`,
                        `📦 库存：${p.stockText}`,
                        `🏷️ 分类：${p.category}`,
                        `📝 ${p.description}`,
                        `🔧 规格：${JSON.stringify(p.specs || {})}`,
                    ].join('\n');
                }
            }
        }
        // 退款查询
        if (toolCalls.some(t => t.name === 'applyRefund') && !toolCalls.some(t => t.arguments['action'] === 'apply')) {
            const refundResult = this.findResult('applyRefund', toolCalls, toolResults);
            if (refundResult?.error?.includes('身份'))
                return refundResult.error;
            if (refundResult?.success) {
                const data = refundResult.data;
                if (data.message)
                    return data.message;
            }
        }
        return '已为您查询到相关信息，请稍等，我正在整理结果...';
    }
    /** 根据触发的技能生成回复 */
    generateSkillReply(skill) {
        switch (skill.name) {
            case 'escalateToHuman':
                return '好的，正在为您转接人工客服，请稍等（约3-5分钟）。\n\n为了更快为您服务，能否先简单描述一下您的问题？';
            case 'complaintHandling':
                return '非常抱歉给您带来了不好的体验，我们非常重视您的问题。\n\n请问可以告诉我具体的情况吗？我会尽快为您处理或转接相关人员。';
            case 'refundApplication':
                return '好的，我来帮您处理退款申请。请问是什么原因需要退款呢？（商品损坏/与描述不符/买错了/质量问题/其他）';
            case 'orderInquiry':
                return '好的，我来帮您查询订单。请稍等...';
            case 'productConsult':
                return '好的，我来帮您查询产品信息。';
            default:
                return '好的，让我来帮您处理这个问题。';
        }
    }
    findResult(toolName, toolCalls, results) {
        const tc = toolCalls.find(t => t.name === toolName);
        if (!tc)
            return undefined;
        return results.get(tc.id);
    }
    extractOrderId(text) {
        const match = text.match(/ORD\d{11}/);
        return match ? match[0] : null;
    }
    extractProductId(text) {
        const match = text.match(/PROD\d{3,}/);
        return match ? match[0] : null;
    }
    log(msg) {
        if (this.config.debug) {
            console.log(`[Agent] ${msg}`);
        }
    }
}
exports.CustomerServiceAgent = CustomerServiceAgent;
//# sourceMappingURL=Agent.js.map