/** 用户消息 */
export interface UserMessage {
    id: string;
    role: 'user';
    content: string;
    timestamp: number;
}
/** AI 回复 */
export interface AIMessage {
    id: string;
    role: 'assistant';
    content: string;
    timestamp: number;
    toolCalls?: ToolCall[];
}
/** 工具调用 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
}
/** 会话历史 */
export interface ConversationContext {
    userId: string;
    sessionId: string;
    messages: (UserMessage | AIMessage)[];
    metadata: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
}
/** 知识库条目 */
export interface KnowledgeEntry {
    id: string;
    content: string;
    chunk: string;
    embedding: number[];
    metadata: {
        category: string;
        tags: string[];
        source: string;
        confidence?: number;
    };
}
/** 检索结果 */
export interface RetrievalResult {
    entry: KnowledgeEntry;
    score: number;
    rank: number;
}
/** 工具定义 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: ToolParameter[];
    handler: ToolHandler;
}
export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    description: string;
    required: boolean;
    enum?: string[];
}
export type ToolHandler = (args: Record<string, unknown>, context: ConversationContext) => Promise<ToolResult>;
export interface ToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
}
/** Skill 定义 */
export interface SkillDefinition {
    name: string;
    description: string;
    instructions: string;
    triggerKeywords: string[];
    tools: string[];
    examples: string[];
    enabled: boolean;
}
/** MCP 上下文 */
export interface MCPContext {
    knowledgeResults: RetrievalResult[];
    activeSkills: SkillDefinition[];
    recentHistory: (UserMessage | AIMessage)[];
    userProfile?: UserProfile;
    sessionVars: Record<string, unknown>;
}
export interface UserProfile {
    userId: string;
    name?: string;
    tier?: 'normal' | 'vip' | 'svip';
    orderHistory?: string[];
}
/** Agent 配置 */
export interface AgentConfig {
    modelName: string;
    temperature: number;
    maxTokens: number;
    debug: boolean;
    sessionTTL: number;
    maxHistoryLength: number;
}
//# sourceMappingURL=types.d.ts.map