import { ConversationContext, MCPContext, SkillDefinition, ToolDefinition, UserMessage, AIMessage } from '../agent/types';
import { KnowledgeBase } from '../knowledge/KnowledgeBase';
/** MCP 配置 */
export interface MCPConfig {
    maxHistoryMessages: number;
    maxContextEntries: number;
    enableContextCompression: boolean;
    contextWindowTokens: number;
}
/** MCP 上下文管理器 */
export declare class MCP {
    private config;
    private knowledgeBase;
    private sessionContexts;
    private toolDefinitions;
    private skillDefinitions;
    constructor(knowledgeBase: KnowledgeBase, config?: Partial<MCPConfig>);
    /** 注册工具列表 */
    registerTools(tools: ToolDefinition[]): void;
    /** 注册技能列表 */
    registerSkills(skills: SkillDefinition[]): void;
    /** 获取或创建会话上下文 */
    getContext(sessionId: string, userId: string): ConversationContext;
    /** 追加消息到历史 */
    appendMessage(ctx: ConversationContext, msg: UserMessage | AIMessage): void;
    /** 构建完整的 MCP 上下文（给 Agent 用） */
    buildContext(sessionId: string, userId: string, userMessage: string): MCPContext;
    /** 构造 MCP 指令片段（注入到 System Prompt） */
    buildMCPInstructions(mcpCtx: MCPContext): string;
    /** 匹配技能（基于关键词 + 语义） */
    private matchSkills;
    /** 更新会话元数据 */
    setSessionMeta(sessionId: string, key: string, value: unknown): void;
    /** 清除会话 */
    clearSession(sessionId: string): void;
}
//# sourceMappingURL=MCP.d.ts.map