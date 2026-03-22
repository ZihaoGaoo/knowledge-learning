// ============================================================
// 测试：Agent 工具调用
// ============================================================

import { CustomerServiceAgent } from '../src/agent/Agent';
import { MCP } from '../src/mcp/MCP';
import { KnowledgeBase } from '../src/knowledge/KnowledgeBase';
import { ALL_SKILLS } from '../src/skills/registry';
import { createSearchKnowledgeTool } from '../src/tools/searchKnowledge';
import { createQueryProductTool } from '../src/tools/queryProduct';
import { createQueryOrderTool } from '../src/tools/queryOrder';
import { createRefundTool } from '../src/tools/refund';
import { createSentimentTool } from '../src/tools/sentiment';

function createTestAgent(): CustomerServiceAgent {
  const kb = new KnowledgeBase({ topK: 3, minScore: 0.01 });
  kb.addBatch([
    {
      id: 'kb1',
      content: '退货政策：7天内可申请退货',
      chunk: '退货政策：7天内可申请退货，15天内可换货',
      metadata: { category: 'policy', tags: ['退货', '7天'], source: 'test' },
    },
    {
      id: 'kb2',
      content: '智能手表Pro支持NFC和防水',
      chunk: '智能手表Pro支持NFC和防水，防水50米',
      metadata: { category: 'product', tags: ['手表', 'NFC', '防水'], source: 'test' },
    },
  ]);
  kb.buildIndex();

  const mcp = new MCP(kb);

  const agent = new CustomerServiceAgent(mcp, { debug: false });
  agent.registerTools([
    createSearchKnowledgeTool(kb),
    createQueryProductTool(),
    createQueryOrderTool(),
    createRefundTool(),
    createSentimentTool(),
  ]);
  agent.registerSkills(ALL_SKILLS);
  mcp.registerTools(agent instanceof CustomerServiceAgent ? [] : []);

  return agent;
}

describe('Agent', () => {
  let agent: CustomerServiceAgent;
  let mcp: MCP;

  beforeEach(() => {
    const kb = new KnowledgeBase({ topK: 3, minScore: 0.01 });
    kb.addBatch([
      {
        id: 'kb1',
        content: '退货政策：7天内可申请退货',
        chunk: '退货政策：7天内可申请退货，15天内可换货',
        metadata: { category: 'policy', tags: ['退货', '7天'], source: 'test' },
      },
      {
        id: 'kb2',
        content: '智能手表Pro支持NFC和防水',
        chunk: '智能手表Pro支持NFC和防水，防水50米',
        metadata: { category: 'product', tags: ['手表', 'NFC', '防水'], source: 'test' },
      },
    ]);
    kb.buildIndex();

    mcp = new MCP(kb, { maxHistoryMessages: 10 });
    agent = new CustomerServiceAgent(mcp, { debug: false });
    agent.registerTools([
      createSearchKnowledgeTool(kb),
      createQueryProductTool(),
      createQueryOrderTool(),
      createRefundTool(),
      createSentimentTool(),
    ]);
    agent.registerSkills(ALL_SKILLS);
    (mcp as unknown as { tools: unknown[] }).tools = [
      createSearchKnowledgeTool(kb),
      createQueryProductTool(),
      createQueryOrderTool(),
      createRefundTool(),
      createSentimentTool(),
    ];
  });

  test('process handles knowledge base query', async () => {
    const reply = await agent.process('退货政策是什么', 's1', 'u1');
    // "退货政策"是知识库问题，不触发退款（触发词已精确化）
    expect(reply.length).toBeGreaterThan(0);
  });

  test('process handles product query', async () => {
    const reply = await agent.process('这款手表支持NFC吗', 's1', 'u1');
    expect(reply.length).toBeGreaterThan(0);
  });

  test('process handles sentiment analysis', async () => {
    const reply = await agent.process('你们产品质量太差了，严重不满', 's1', 'u1');
    expect(reply.length).toBeGreaterThan(0);
    // 情绪偏负面但不触发升级(escalation=false)，走知识库路线
  });

  test('process handles order query with orderId', async () => {
    const reply = await agent.process('ORD20260315001这个订单到哪了', 's1', 'u1');
    expect(reply.length).toBeGreaterThan(0);
    // 未核实身份时应提示身份验证
    expect(reply).toMatch(/身份|核实/);
  });

  test('process handles escalate request', async () => {
    const reply = await agent.process('转人工', 's1', 'u1');
    expect(reply).toMatch(/人工|转接|稍等/);
  });
});
