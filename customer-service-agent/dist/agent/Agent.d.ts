import { AgentConfig, ToolDefinition, SkillDefinition } from './types';
import { MCP } from '../mcp/MCP';
export declare class CustomerServiceAgent {
    private config;
    private mcp;
    private tools;
    private skills;
    constructor(mcp: MCP, config?: Partial<AgentConfig>);
    /** 注册工具 */
    registerTool(tool: ToolDefinition): void;
    /** 注册多个工具 */
    registerTools(tools: ToolDefinition[]): void;
    /** 注册技能 */
    registerSkills(skills: SkillDefinition[]): void;
    /** 处理用户消息 */
    process(userMessage: string, sessionId: string, userId: string): Promise<string>;
    /** 模拟 LLM 决策过程（实际项目中替换为真实的模型调用）*/
    private mockLLMDecision;
    /** 执行工具调用 */
    private executeToolCalls;
    /** 根据工具执行结果生成回复 */
    private generateReply;
    /** 根据触发的技能生成回复 */
    private generateSkillReply;
    private findResult;
    private extractOrderId;
    private extractProductId;
    private log;
}
//# sourceMappingURL=Agent.d.ts.map