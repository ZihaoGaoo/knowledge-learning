# 🤖 智能客服 Agent 项目

基于 TypeScript 的智能客服系统，涵盖知识库检索、MCP 上下文管理、Tool 调用、Skill 技能等核心概念。

## 架构概览

```
用户消息
    ↓
Agent（意图识别 + 决策）
    ↓
MCP（上下文管理）
    ├── 知识库检索（TF-IDF + BM25 混合）
    ├── 技能匹配（Skill Registry）
    └── 历史会话管理
    ↓
工具层（Tool Executor）
    ├── searchKnowledge   知识库检索
    ├── queryOrder       订单查询
    ├── queryProduct      产品查询
    ├── applyRefund       退款申请
    └── sentimentAnalysis 情感分析
    ↓
回复生成
```

## 目录结构

```
customer-service-agent/
├── package.json
├── tsconfig.json
├── jest.config.js
├── src/
│   ├── index.ts              # 入口（Demo + CLI）
│   ├── agent/
│   │   ├── Agent.ts          # 核心 Agent 类（意图识别 + 工具调用）
│   │   ├── types.ts          # 核心类型定义
│   │   ├── prompts.ts        # System Prompt 构造器
│   │   └── uuid.ts           # UUID 生成
│   ├── knowledge/
│   │   ├── KnowledgeBase.ts  # 知识库（向量检索 + BM25）
│   │   └── embed.ts          # TF-IDF 向量化 + BM25
│   ├── mcp/
│   │   └── MCP.ts             # Model Context Protocol（上下文管理）
│   ├── tools/
│   │   ├── searchKnowledge.ts # 知识库检索工具
│   │   ├── queryOrder.ts      # 订单查询工具
│   │   ├── queryProduct.ts    # 产品查询工具
│   │   ├── refund.ts          # 退款申请工具
│   │   └── sentiment.ts       # 情感分析工具
│   └── skills/
│       └── registry.ts        # 技能定义（订单/投诉/退款/产品/转人工）
├── tests/
│   ├── KnowledgeBase.test.ts
│   ├── Agent.test.ts
│   ├── MCP.test.ts
│   └── Tools.test.ts
└── data/                     # 知识库数据（可扩展）
```

## 快速开始

```bash
cd customer-service-agent

# 安装依赖
npm install

# 构建
npm run build

# 运行 Demo（无需真实 LLM API）
npm start

# 运行 CLI 交互模式
npm run dev

# 运行测试
npm test
```

## 核心概念

### 1. Tool（工具）

Tool 是 Agent 可以调用的原子操作。每个 Tool 由以下部分组成：

```typescript
interface ToolDefinition {
  name: string;           // 工具名（唯一标识）
  description: string;    // 描述（供模型判断何时调用）
  parameters: Parameter[]; // 参数 schema
  handler: Handler;       // 实际执行函数
}
```

当前已实现的工具：

| 工具名 | 功能 | 触发场景 |
|--------|------|---------|
| `searchKnowledge` | 知识库检索 | 政策/使用/售后类问题 |
| `queryOrder` | 订单状态查询 | 订单/物流/快递问题 |
| `queryProduct` | 产品信息查询 | 产品/价格/库存问题 |
| `applyRefund` | 退款申请 | 退款/退货/取消订单 |
| `sentimentAnalysis` | 情感分析 | 判断情绪和紧急程度 |

### 2. Skill（技能）

Skill 是复合任务模式，将多个 Tool 按特定顺序组合，并提供完整的执行步骤说明：

```typescript
interface SkillDefinition {
  name: string;
  description: string;   // 触发条件（注入 System Prompt）
  instructions: string;   // 执行步骤
  triggerKeywords: string[]; // 触发关键词
  tools: string[];        // 需要用到的工具列表
  enabled: boolean;
}
```

当前已实现的技能：

| 技能名 | 触发关键词 | 涉及工具 |
|--------|-----------|---------|
| `orderInquiry` | 订单/物流/发货/快递 | queryOrder |
| `complaintHandling` | 投诉/不满/质量/差评 | sentimentAnalysis + searchKnowledge |
| `refundApplication` | 退款/退货/取消订单 | applyRefund |
| `productConsult` | 价格/参数/规格/推荐 | queryProduct |
| `escalateToHuman` | 转人工/真人/客服 | 无工具，直接转接 |

### 3. Knowledge Base（知识库）

采用 **TF-IDF 向量检索 + BM25 混合排序**：

- 无外部向量数据库依赖，纯 TypeScript 实现
- 支持按分类过滤检索结果
- 配置参数：`topK`、`minScore`、`hybridAlpha`

### 4. MCP（Model Context Protocol）

负责任务：
- 构建完整上下文（知识库检索 + 技能匹配 + 历史记录）
- 上下文压缩（超过 `maxHistoryMessages` 时自动截断）
- 会话元数据管理（身份验证状态等）

## 如何扩展

### 添加新工具

1. 在 `src/tools/` 下新建文件，实现 `ToolDefinition` 接口
2. 在 `src/index.ts` 中注册到 Agent
3. 在测试文件中添加单元测试

示例：
```typescript
// src/tools/myTool.ts
export function createMyTool(): ToolDefinition {
  return {
    name: 'myTool',
    description: '当用户...时使用',
    parameters: [
      { name: 'param1', type: 'string', description: '...', required: true }
    ],
    handler: async (args, ctx) => {
      // 执行逻辑
      return { success: true, data: { ... } };
    }
  };
}
```

### 添加新技能

在 `src/skills/registry.ts` 中追加 `SkillDefinition` 对象：

```typescript
{
  name: 'mySkill',
  description: '当用户...时触发',
  instructions: '【我的技能】执行步骤：1...2...',
  triggerKeywords: ['关键词1', '关键词2'],
  tools: ['myTool'],
  examples: ['用户可能的问法'],
  enabled: true,
}
```

### 替换为真实 LLM

将 `Agent.ts` 中的 `mockLLMDecision()` 方法替换为真实的模型调用：

```typescript
// 真实 LLM 调用示例（伪代码）
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ],
  tools: toolDefsAsOpenAIFunctions,
});
// 解析 response.choices[0].message.tool_calls 并执行
```

## 测试说明

```bash
npm test           # 运行全部测试
npm test -- --watch  # 监听模式
```

测试覆盖：
- `KnowledgeBase.test.ts` — 向量检索、BM25 排序、分类过滤
- `Agent.test.ts` — 意图路由、工具调用、回复生成
- `MCP.test.ts` — 上下文构建、技能匹配、历史管理
- `Tools.test.ts` — 各工具的参数校验、边界条件

## 技术栈

- **TypeScript** — 类型安全
- **无外部 AI 依赖** — 向量检索和 BM25 均为自实现
- **Jest + ts-jest** — 单元测试
- **纯 Node.js** — 无浏览器依赖，可直接跑在服务器

---

*本项目仅供学习参考，不构成生产环境使用建议。*
