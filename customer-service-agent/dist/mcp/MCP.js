"use strict";
// ============================================================
// MCP - Model Context Protocol - 模型上下文协议
// 负责任务：上下文构建、检索、压缩、历史管理
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCP = void 0;
const prompts_1 = require("../agent/prompts");
const DEFAULT_MCP_CONFIG = {
    maxHistoryMessages: 20,
    maxContextEntries: 3,
    enableContextCompression: true,
    contextWindowTokens: 4000,
};
/** MCP 上下文管理器 */
class MCP {
    constructor(knowledgeBase, config = {}) {
        this.sessionContexts = new Map();
        this.toolDefinitions = [];
        this.skillDefinitions = [];
        this.config = { ...DEFAULT_MCP_CONFIG, ...config };
        this.knowledgeBase = knowledgeBase;
    }
    /** 注册工具列表 */
    registerTools(tools) {
        this.toolDefinitions = tools;
    }
    /** 注册技能列表 */
    registerSkills(skills) {
        this.skillDefinitions = skills;
    }
    /** 获取或创建会话上下文 */
    getContext(sessionId, userId) {
        if (!this.sessionContexts.has(sessionId)) {
            this.sessionContexts.set(sessionId, {
                userId,
                sessionId,
                messages: [],
                metadata: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
            });
        }
        return this.sessionContexts.get(sessionId);
    }
    /** 追加消息到历史 */
    appendMessage(ctx, msg) {
        ctx.messages.push(msg);
        ctx.updatedAt = Date.now();
        // 超过上限时做截断（保留首尾）
        if (ctx.messages.length > this.config.maxHistoryMessages * 2) {
            const keepFirst = ctx.messages.slice(0, 5); // 保留前5条（系统设定）
            const keepLast = ctx.messages.slice(-this.config.maxHistoryMessages);
            ctx.messages = [...keepFirst, ...keepLast];
        }
    }
    /** 构建完整的 MCP 上下文（给 Agent 用） */
    buildContext(sessionId, userId, userMessage) {
        const ctx = this.getContext(sessionId, userId);
        // 1. 知识库检索
        const knowledgeResults = this.knowledgeBase.retrieve(userMessage);
        const topResults = knowledgeResults.slice(0, this.config.maxContextEntries);
        // 2. 匹配活跃技能（按触发关键词）
        const activeSkills = this.matchSkills(userMessage);
        // 3. 历史消息（最近 N 条）
        const recentHistory = ctx.messages.slice(-this.config.maxHistoryMessages);
        // 4. 用户画像（从元数据恢复）
        const userProfile = ctx.metadata['userProfile'];
        // 5. 会话变量
        const sessionVars = ctx.metadata['sessionVars'] || {};
        return {
            knowledgeResults: topResults,
            activeSkills,
            recentHistory,
            userProfile,
            sessionVars,
        };
    }
    /** 构造 MCP 指令片段（注入到 System Prompt） */
    buildMCPInstructions(mcpCtx) {
        const parts = [];
        // 知识库结果
        if (mcpCtx.knowledgeResults.length > 0) {
            const formatted = mcpCtx.knowledgeResults.map(r => ({
                content: r.entry.chunk,
                category: r.entry.metadata.category,
                score: r.score,
            }));
            parts.push((0, prompts_1.buildKnowledgeContext)(formatted));
        }
        // 激活的技能
        if (mcpCtx.activeSkills.length > 0) {
            parts.push(`## 触发的技能\n` +
                mcpCtx.activeSkills.map(s => `- **${s.name}**：${s.instructions}`).join('\n'));
        }
        // 用户信息
        if (mcpCtx.userProfile) {
            const up = mcpCtx.userProfile;
            const tierStr = up.tier ? `（${up.tier}用户）` : '';
            parts.push(`## 用户信息\n- 用户ID：${up.userId}${tierStr}\n- 称呼：${up.name || '用户'}`);
        }
        // 历史摘要（如果太长）
        if (mcpCtx.recentHistory.length > 0 && this.config.enableContextCompression) {
            const last = mcpCtx.recentHistory[mcpCtx.recentHistory.length - 1];
            if (last.role === 'user') {
                parts.push(`## 最近对话\n用户：${last.content.slice(0, 100)}`);
            }
        }
        return parts.length > 0 ? parts.join('\n\n') : '（暂无特殊上下文）';
    }
    /** 匹配技能（基于关键词 + 语义） */
    matchSkills(message) {
        const lower = message.toLowerCase();
        const matched = [];
        for (const skill of this.skillDefinitions) {
            if (!skill.enabled)
                continue;
            // 关键词匹配得分
            let keywordScore = 0;
            for (const kw of skill.triggerKeywords) {
                if (lower.includes(kw.toLowerCase())) {
                    keywordScore += 1;
                }
            }
            if (keywordScore > 0) {
                matched.push({ skill, score: keywordScore });
            }
        }
        return matched
            .sort((a, b) => b.score - a.score)
            .slice(0, 2)
            .map(m => m.skill);
    }
    /** 更新会话元数据 */
    setSessionMeta(sessionId, key, value) {
        const ctx = this.sessionContexts.get(sessionId);
        if (ctx) {
            ctx.metadata[key] = value;
        }
    }
    /** 清除会话 */
    clearSession(sessionId) {
        this.sessionContexts.delete(sessionId);
    }
}
exports.MCP = MCP;
//# sourceMappingURL=MCP.js.map