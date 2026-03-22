// ============================================================
// Tool: queryProduct - 产品信息查询工具
// ============================================================

import { ToolDefinition, ToolHandler, ToolResult } from '../agent/types';

// 模拟产品数据
const PRODUCTS: Record<string, Record<string, unknown>> = {
  'PROD001': {
    id: 'PROD001',
    name: '智能手表 Pro',
    price: 2999.00,
    stock: 58,
    category: '穿戴设备',
    tags: ['健康监测', 'NFC', '防水', '续航7天'],
    description: '支持心率/血氧/睡眠监测，NFC门禁卡，50米防水，日常续航7天',
    warranty: '2年官方质保',
    specs: { 屏幕: '1.4 AMOLED', 电池: '380mAh', 防水: '50米' },
  },
  'PROD002': {
    id: 'PROD002',
    name: '无线蓝牙耳机',
    price: 599.00,
    stock: 120,
    category: '音频设备',
    tags: ['降噪', '蓝牙5.3', '续航30h', 'Type-C'],
    description: '主动降噪，蓝牙5.3，耳机+充电盒续航30小时，Type-C快充',
    warranty: '1年官方质保',
    specs: { 降噪深度: '40dB', 续航: '8h+22h', 蓝牙: '5.3', 防水: 'IPX4' },
  },
  'PROD003': {
    id: 'PROD003',
    name: '便携式充电宝 20000mAh',
    price: 199.00,
    stock: 0,  // 无库存
    category: '配件',
    tags: ['20000mAh', '双向快充', 'Type-C', '可上飞机'],
    description: '20000mAh大容量，双向快充，支持多协议，可带上飞机',
    warranty: '1年官方质保',
    specs: { 容量: '20000mAh', 输入: 'Type-C 18W', 输出: 'Type-C/A 22.5W' },
  },
  'PROD004': {
    id: 'PROD004',
    name: '智能台灯护眼版',
    price: 399.00,
    stock: 35,
    category: '家居',
    tags: ['护眼', '无极调光', 'App控制', '定时'],
    description: 'AA级护眼认证，无极调光，支持手机App控制，定时开关',
    warranty: '1年官方质保',
    specs: { 光通量: '800lux', 色温: '3000K-6000K', 控制: 'App/触控' },
  },
};

export function createQueryProductTool(): ToolDefinition {
  const handler: ToolHandler = async (args): Promise<ToolResult> => {
    const productId = args['productId'] as string | undefined;
    const keyword = args['keyword'] as string | undefined;
    const action = args['action'] as string || 'query';

    try {
      // 按产品ID精确查询
      if (productId) {
        const product = PRODUCTS[productId];
        if (!product) {
          return { success: true, data: { found: false, message: `未找到产品 ${productId}` } };
        }
        const stockText = (product as { stock: number }).stock > 0
          ? `有货（${(product as { stock: number }).stock}件）`
          : '缺货';
        return {
          success: true,
          data: {
            found: true,
            product: { ...product, stockText },
          },
        };
      }

      // 按关键词搜索
      if (keyword) {
        const lower = keyword.toLowerCase();
        const results = Object.values(PRODUCTS).filter(p => {
          const name = (p as { name: string }).name.toLowerCase();
          const tags = (p as { tags: string[] }).tags.join(' ').toLowerCase();
          const desc = (p as { description: string }).description.toLowerCase();
          return name.includes(lower) || tags.includes(lower) || desc.includes(lower);
        }).map(p => ({
          id: (p as { id: string }).id,
          name: (p as { name: string }).name,
          price: (p as { price: number }).price,
          stockText: (p as { stock: number }).stock > 0 ? '有货' : '缺货',
          category: (p as { category: string }).category,
        }));

        return { success: true, data: { found: true, results, count: results.length } };
      }

      // 列出全部产品
      if (action === 'list') {
        const all = Object.values(PRODUCTS).map(p => ({
          id: (p as { id: string }).id,
          name: (p as { name: string }).name,
          price: (p as { price: number }).price,
          stockText: (p as { stock: number }).stock > 0 ? '有货' : '缺货',
        }));
        return { success: true, data: { found: true, products: all, count: all.length } };
      }

      return { success: false, error: '请提供 productId、keyword 或 action=list' };
    } catch (err) {
      return { success: false, error: `查询失败：${(err as Error).message}` };
    }
  };

  return {
    name: 'queryProduct',
    description: '查询产品信息、价格、库存、规格参数。适用于用户询问产品详情、价格、是否有货时使用。',
    parameters: [
      { name: 'productId', type: 'string', description: '产品ID，如 PROD001', required: false },
      { name: 'keyword', type: 'string', description: '关键词（名称/标签/描述）', required: false },
      { name: 'action', type: 'string', description: '操作类型：list（列出全部产品）', required: false, enum: ['list', 'query'] },
    ],
    handler,
  };
}
