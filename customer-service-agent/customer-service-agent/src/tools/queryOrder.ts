// ============================================================
// Tool: queryOrder - 订单查询工具
// ============================================================

import { ToolDefinition, ToolHandler, ToolResult, ConversationContext } from '../agent/types';

// 模拟订单数据
const MOCK_ORDERS: Record<string, Record<string, unknown>> = {
  'ORD20260315001': {
    orderId: 'ORD20260315001',
    userId: 'user_001',
    status: 'shipped',
    product: '智能手表 Pro',
    amount: 2999.00,
    createdAt: '2026-03-15 10:30:00',
    shippedAt: '2026-03-16 14:00:00',
    expressNo: 'SF1089234567890',
    expressCompany: '顺丰速运',
    estimatedDelivery: '2026-03-18',
    recipient: '张三',
    phone: '138****1234',
    address: '北京市朝阳区某某街道',
  },
  'ORD20260318002': {
    orderId: 'ORD20260318002',
    userId: 'user_001',
    status: 'processing',
    product: '无线蓝牙耳机',
    amount: 599.00,
    createdAt: '2026-03-18 16:20:00',
    shippedAt: null,
    expressNo: null,
    expressCompany: null,
    estimatedDelivery: null,
    recipient: '张三',
    phone: '138****1234',
    address: '北京市朝阳区某某街道',
  },
};

const STATUS_MAP: Record<string, string> = {
  pending: '待支付',
  paid: '已支付，待发货',
  processing: '处理中',
  shipped: '已发货',
  delivered: '已收货',
  cancelled: '已取消',
  refunded: '已退款',
};

export function createQueryOrderTool(): ToolDefinition {
  const handler: ToolHandler = async (args, ctx): Promise<ToolResult> => {
    const orderId = args['orderId'] as string | undefined;
    const queryType = args['queryType'] as string | undefined; // all / byId

    // 身份验证（简化版：检查 ctx 元数据）
    const verified = ctx.metadata['identityVerified'] as boolean;
    if (!verified) {
      return {
        success: false,
        error: '【身份未核实】请先提供订单手机号后4位以核验身份',
      };
    }

    try {
      // 查询单个订单
      if (orderId) {
        const order = MOCK_ORDERS[orderId];
        if (!order) {
          return { success: true, data: { found: false, message: `未找到订单 ${orderId}` } };
        }
        const statusText = STATUS_MAP[(order as { status: string }).status] || (order as { status: string }).status;
        return {
          success: true,
          data: {
            found: true,
            order: {
              ...order,
              statusText,
              phone: (order as { phone: string }).phone,
            },
          },
        };
      }

      // 查询全部订单
      if (queryType === 'all') {
        const userId = ctx.userId;
        const userOrders = Object.values(MOCK_ORDERS)
          .filter(o => (o as { userId: string }).userId === userId)
          .map(o => ({
            orderId: (o as { orderId: string }).orderId,
            product: (o as { product: string }).product,
            amount: (o as { amount: number }).amount,
            statusText: STATUS_MAP[(o as { status: string }).status] || (o as { status: string }).status,
            createdAt: (o as { createdAt: string }).createdAt,
          }));
        return { success: true, data: { found: true, orders: userOrders, count: userOrders.length } };
      }

      return { success: false, error: '请提供 orderId 或设置 queryType=all' };
    } catch (err) {
      return { success: false, error: `查询失败：${(err as Error).message}` };
    }
  };

  return {
    name: 'queryOrder',
    description: '查询用户订单状态和物流信息。需要先核实用户身份（手机号后4位）。支持按订单号精确查询和查询全部订单。涉及物流、发货、收货状态问题时使用。',
    parameters: [
      { name: 'orderId', type: 'string', description: '订单号，如 ORD20260315001', required: false },
      { name: 'queryType', type: 'string', description: '查询类型：all（全部订单）', required: false, enum: ['all'] },
    ],
    handler,
  };
}
