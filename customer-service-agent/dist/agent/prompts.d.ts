import { ToolDefinition, SkillDefinition } from './types';
/** 构造 Skill XML 列表（OpenClaw 风格） */
export declare function buildSkillsXML(skills: SkillDefinition[]): string;
/** 构造工具 XML 列表 */
export declare function buildToolsXML(tools: ToolDefinition[]): string;
/** 完整的系统提示词 */
export declare function buildSystemPrompt(tools: ToolDefinition[], skills: SkillDefinition[], mcpInstructions: string): string;
/** 知识库检索结果的提示词片段 */
export declare function buildKnowledgeContext(results: {
    content: string;
    category: string;
    score: number;
}[]): string;
//# sourceMappingURL=prompts.d.ts.map