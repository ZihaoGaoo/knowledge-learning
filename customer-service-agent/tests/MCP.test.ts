// ============================================================
// 测试：MCP 上下文管理
// ============================================================

import { MCP } from '../src/mcp/MCP';
import { KnowledgeBase } from '../src/knowledge/KnowledgeBase';
import { UserMessage, AIMessage } from '../src/agent/types';
import { ALL_SKILLS } from '../src/skills/registry';

function makeKb(): KnowledgeBase {
  // 中文按字符切分后TF-IDF得分偏低，降低阈值确保检索有效
  const kb = new KnowledgeBase({ topK: 5, minScore: 0.001 });
  kb.addBatch([
    {
      id: 'kb1',
      content: '退货政策',
      chunk: '退货政策：7天内可申请退货，15天内可换货',
      metadata: { category: 'policy', tags: ['退货'], source: 'test' },
    },
    {
      id: 'kb2',
      content: '产品信息',
      chunk: '智能手表Pro支持NFC和防水',
      metadata: { category: 'product', tags: ['手表'], source: 'test' },
    },
  ]);
  kb.buildIndex();
  return kb;
}

describe('MCP', () => {
  let mcp: MCP;

  beforeEach(() => {
    mcp = new MCP(makeKb());
    mcp.registerSkills(ALL_SKILLS);
  });

  test('getContext creates new session', () => {
    const ctx = mcp.getContext('s1', 'u1');
    expect(ctx.sessionId).toBe('s1');
    expect(ctx.userId).toBe('u1');
    expect(ctx.messages).toHaveLength(0);
  });

  test('getContext returns same session on repeated calls', () => {
    const ctx1 = mcp.getContext('s1', 'u1');
    const ctx2 = mcp.getContext('s1', 'u1');
    expect(ctx1).toBe(ctx2);
  });

  test('appendMessage adds message to history', () => {
    const ctx = mcp.getContext('s1', 'u1');
    const userMsg: UserMessage = { id: 'm1', role: 'user', content: '你好', timestamp: Date.now() };
    mcp.appendMessage(ctx, userMsg);
    expect(ctx.messages).toHaveLength(1);
    expect(ctx.messages[0].content).toBe('你好');
  });

  test('buildContext retrieves knowledge', () => {
    // "退货政策" 经 Node 验证得分 0.421，足以通过 minScore=0.001
    const mcpCtx = mcp.buildContext('s1', 'u1', '退货政策');
    expect(mcpCtx.knowledgeResults.length).toBeGreaterThan(0);
    expect(mcpCtx.knowledgeResults[0].entry.chunk).toContain('退货');
  });

  test('buildContext matches skills by keywords', () => {
    const mcpCtx = mcp.buildContext('s1', 'u1', '我要申请退款');
    expect(mcpCtx.activeSkills.length).toBeGreaterThan(0);
    expect(mcpCtx.activeSkills.some(s => s.name === 'refundApplication')).toBe(true);
  });

  test('setSessionMeta stores metadata', () => {
    const ctx = mcp.getContext('s1', 'u1');
    mcp.setSessionMeta('s1', 'identityVerified', true);
    expect(ctx.metadata['identityVerified']).toBe(true);
  });

  test('buildMCPInstructions generates context string', () => {
    const mcpCtx = mcp.buildContext('s1', 'u1', '你好');
    const instructions = mcp.buildMCPInstructions(mcpCtx);
    expect(typeof instructions).toBe('string');
    expect(instructions.length).toBeGreaterThan(0);
  });

  test('clearSession removes context', () => {
    mcp.getContext('s1', 'u1');
    mcp.clearSession('s1');
    const ctx = mcp.getContext('s1', 'u1');
    expect(ctx.messages).toHaveLength(0);
  });
});
