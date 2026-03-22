// ============================================================
// 测试：KnowledgeBase
// ============================================================

import { KnowledgeBase } from '../src/knowledge/KnowledgeBase';
import { KnowledgeEntry } from '../src/agent/types';

function makeEntry(id: string, chunk: string, category: string): Omit<KnowledgeEntry, 'embedding'> {
  return {
    id,
    content: chunk,
    chunk,
    metadata: { category, tags: [], source: 'test' },
  };
}

describe('KnowledgeBase', () => {
  let kb: KnowledgeBase;

  beforeEach(() => {
    // 中文按字符切分后TF-IDF得分偏低，降低阈值
    kb = new KnowledgeBase({ topK: 3, minScore: 0.001 });
    kb.addBatch([
      makeEntry('1', '退货政策：7天内可申请退货，15天内可换货', 'policy'),
      makeEntry('2', '智能手表Pro支持心率监测和NFC功能，防水50米', 'product'),
      makeEntry('3', '蓝牙耳机支持主动降噪，续航8小时', 'product'),
      makeEntry('4', '快递配送1-3个工作日，顺丰和中通可选', 'logistics'),
      makeEntry('5', '会员积分每消费1元积1分，100积分可抵扣1元', 'policy'),
    ]);
    kb.buildIndex();
  });

  test('retrieve returns top-K results', () => {
    const results = kb.retrieve('退货政策');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.chunk).toContain('退货');
  });

  test('retrieve filters by category', () => {
    const results = kb.retrieveByCategory('支持', 'product');
    expect(results.every(r => r.entry.metadata.category === 'product')).toBe(true);
  });

  test('stats returns correct counts', () => {
    const stats = kb.stats();
    expect(stats.total).toBe(5);
    expect(stats.byCategory['policy']).toBe(2);
    expect(stats.byCategory['product']).toBe(2);
  });

  test('retrieve returns empty for non-matching query', () => {
    const kb2 = new KnowledgeBase({ minScore: 0.5 });
    kb2.addBatch([makeEntry('1', '特定内容', 'policy')]);
    kb2.buildIndex();
    const results = kb2.retrieve('完全不相关的内容');
    expect(results.length).toBe(0);
  });
});
