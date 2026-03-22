// ============================================================
// 测试：工具函数
// ============================================================

import { createQueryProductTool } from '../src/tools/queryProduct';
import { createRefundTool } from '../src/tools/refund';
import { createSentimentTool } from '../src/tools/sentiment';
import { ConversationContext } from '../src/agent/types';

function makeCtx(): ConversationContext {
  return {
    userId: 'user_001',
    sessionId: 'test-session',
    messages: [],
    metadata: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('Tools', () => {
  describe('queryProduct', () => {
    const tool = createQueryProductTool();

    test('query by keyword returns results', async () => {
      const result = await tool.handler({ keyword: '手表' }, makeCtx());
      expect(result.success).toBe(true);
      expect((result.data as { results: unknown[] }).results.length).toBeGreaterThan(0);
    });

    test('query by productId returns single product', async () => {
      const result = await tool.handler({ productId: 'PROD001' }, makeCtx());
      expect(result.success).toBe(true);
      expect((result.data as { product: { name: string } }).product.name).toContain('智能手表');
    });

    test('list all products', async () => {
      const result = await tool.handler({ action: 'list' }, makeCtx());
      expect(result.success).toBe(true);
      expect((result.data as { count: number }).count).toBeGreaterThan(0);
    });

    test('invalid productId returns not found', async () => {
      const result = await tool.handler({ productId: 'INVALID' }, makeCtx());
      expect(result.success).toBe(true);
      expect((result.data as { found: boolean }).found).toBe(false);
    });
  });

  describe('applyRefund', () => {
    const tool = createRefundTool();

    test('query without identity returns error', async () => {
      const ctx = makeCtx();
      const result = await tool.handler({ action: 'query' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('身份');
    });

    test('query with verified identity succeeds', async () => {
      const ctx = makeCtx();
      ctx.metadata['identityVerified'] = true;
      const result = await tool.handler({ action: 'query' }, ctx);
      expect(result.success).toBe(true);
    });

    test('apply without reason returns error', async () => {
      const ctx = makeCtx();
      ctx.metadata['identityVerified'] = true;
      const result = await tool.handler({ action: 'apply', orderId: 'ORD001' }, ctx);
      expect(result.success).toBe(false);
      expect(result.error).toContain('必填');
    });

    test('apply with valid params succeeds', async () => {
      const ctx = makeCtx();
      ctx.metadata['identityVerified'] = true;
      const result = await tool.handler({
        action: 'apply',
        orderId: 'ORD001',
        reason: '买错了/不想要了',
        remark: '测试备注',
      }, ctx);
      expect(result.success).toBe(true);
      expect((result.data as { refundId: string }).refundId).toBeTruthy();
    });
  });

  describe('sentimentAnalysis', () => {
    const tool = createSentimentTool();

    test('negative text detected', async () => {
      const result = await tool.handler({ text: '你们产品质量太差了，非常不满，严重投诉' }, makeCtx());
      expect(result.success).toBe(true);
      expect((result.data as { sentiment: string }).sentiment).toBe('negative');
    });

    test('positive text detected', async () => {
      const result = await tool.handler({ text: '产品很好，非常满意，赞一个' }, makeCtx());
      expect(result.success).toBe(true);
      expect((result.data as { sentiment: string }).sentiment).toBe('positive');
    });

    test('neutral text detected', async () => {
      const result = await tool.handler({ text: '请问这个订单什么时候发货' }, makeCtx());
      expect(result.success).toBe(true);
      expect((result.data as { escalation: boolean }).escalation).toBe(false);
    });

    test('escalation triggered for strong negative', async () => {
      const result = await tool.handler({ text: '垃圾产品，要投诉到315曝光你们' }, makeCtx());
      expect(result.success).toBe(true);
      expect((result.data as { escalation: boolean }).escalation).toBe(true);
    });

    test('missing text returns error', async () => {
      const result = await tool.handler({}, makeCtx());
      expect(result.success).toBe(false);
    });
  });
});
