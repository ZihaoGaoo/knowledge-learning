// ============================================================
// Core Types - 核心类型定义
// ============================================================

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
  content: string;          // 原始文本
  chunk: string;            // 切分后的chunk
  embedding: number[];      // 向量化后的向量
  metadata: {
    category: string;       // 产品/政策/售后/订单
    tags: string[];
    source: string;
    confidence?: number;    // 检索时的置信度
  };
}

/** 检索结果 */
export interface RetrievalResult {
  entry: KnowledgeEntry;
  score: number;            // 相似度分数
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
  description: string;         // 触发条件描述
  instructions: string;        // 执行步骤（注入给模型）
  triggerKeywords: string[];   // 触发关键词
  tools: string[];             // 需要用到的工具列表
  examples: string[];          // 示例问句
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
  sessionTTL: number;        // ms
  maxHistoryLength: number;  // 保留历史消息条数
}
