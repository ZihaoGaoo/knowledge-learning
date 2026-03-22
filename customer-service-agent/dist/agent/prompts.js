"use strict";
// ============================================================
// System Prompts - 系统提示词
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSkillsXML = buildSkillsXML;
exports.buildToolsXML = buildToolsXML;
exports.buildSystemPrompt = buildSystemPrompt;
exports.buildKnowledgeContext = buildKnowledgeContext;
/** 构造 Skill XML 列表（OpenClaw 风格） */
function buildSkillsXML(skills) {
    const enabled = skills.filter(s => s.enabled);
    let xml = '<available_skills>\n';
    for (const skill of enabled) {
        xml += `  <skill>\n`;
        xml += `    <name>${escapeXml(skill.name)}</name>\n`;
        xml += `    <description>${escapeXml(skill.description)}</description>\n`;
        xml += `    <location>skill://${skill.name}</location>\n`;
        xml += `  </skill>\n`;
    }
    xml += '</available_skills>';
    return xml;
}
/** 构造工具 XML 列表 */
function buildToolsXML(tools) {
    let xml = '<available_tools>\n';
    for (const tool of tools) {
        const params = tool.parameters.map(p => `      <parameter name="${p.name}" type="${p.type}" required="${p.required}">${escapeXml(p.description)}</parameter>`).join('\n');
        xml += `  <tool>\n`;
        xml += `    <name>${escapeXml(tool.name)}</name>\n`;
        xml += `    <description>${escapeXml(tool.description)}</description>\n`;
        xml += `    <parameters>\n${params}\n      </parameters>\n`;
        xml += `  </tool>\n`;
    }
    xml += '</available_tools>';
    return xml;
}
/** 完整的系统提示词 */
function buildSystemPrompt(tools, skills, mcpInstructions) {
    const toolsXML = buildToolsXML(tools);
    const skillsXML = buildSkillsXML(skills);
    return `你是智能客服助手「小服」，为用户提供专业、高效、友好的客户服务。

## 核心原则
- 有礼貌、有耐心，语气亲切自然
- 回答精准，不确定时主动说"帮您查一下"
- 涉及订单/退款等敏感操作，必须先核实用户身份
- 遇到无法解决的问题，引导转人工

## 可用工具
${toolsXML}

## 可用技能（复合任务模式）
${skillsXML}

## MCP 上下文指引
${mcpInstructions}

## 输出格式规范
1. 通用问答：直接回复，语言简洁友好
2. 调用工具：先说明意图，再执行，最后呈现结果
3. 技能触发：先说明技能名称，再按技能步骤执行
4. 需要确认：清晰列出选项，让用户选择
`;
}
/** 知识库检索结果的提示词片段 */
function buildKnowledgeContext(results) {
    if (results.length === 0)
        return '（未从知识库检索到相关内容）';
    const lines = results.map((r, i) => `[知识库#${i + 1}]（${r.category}，置信度${(r.score * 100).toFixed(0)}%）\n${r.content}`);
    return `## 知识库检索结果\n${lines.join('\n\n')}`;
}
/** XML 转义 */
function escapeXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
//# sourceMappingURL=prompts.js.map