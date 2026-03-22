// ============================================================
// Tool: applyRefund - 退款申请工具
// ============================================================

import { ToolDefinition, ToolHandler, ToolResult, ConversationContext } from '../agent/types';

// 退款原因选项
const REFUND_REASONS = [
  '商品损坏',
  '与描述不符',
  '买错了/不想要了',
  '质量问题',
  '物流太慢',
  '其他',
];

// 模拟退款记录
const REFUND_RECORDS: Record<string, unknown>[] = [];

let refundSeq = 1;
function genRefundId(): string {
  return `REF${Date.now()}${String(refundSeq++).padStart(4, '0')}`;
}

export function createRefundTool(): ToolDefinition {
  const handler: ToolHandler = async (args, ctx): Promise<ToolResult> => {
    const action = args['action'] as string;

    // 身份验证
    const verified = ctx.metadata['identityVerified'] as boolean;
    if (!verified) {
      return { success: false, error: '【身份未核实】请先核验身份后再申请退款' };
    }

    // 查询退款记录
    if (action === 'query') {
      const userId = ctx.userId;
      const userRecords = REFUND_RECORDS.filter(r => (r as { userId: string }).userId === userId);
      return {
        success: true,
        data: {
          records: userRecords,
          count: userRecords.length,
          reasons: REFUND_REASONS,
        },
      };
    }

    // 申请退款
    if (action === 'apply') {
      const orderId = args['orderId'] as string;
      const reason = args['reason'] as string;
      const amount = args['amount'] as number | undefined;
      const remark = args['remark'] as string | undefined;

      if (!orderId || !reason) {
        return { success: false, error: 'orderId 和 reason 为必填项' };
      }

      if (!REFUND_REASONS.includes(reason)) {
        return { success: false, error: `退款原因必须是以下之一：${REFUND_REASONS.join('、')}` };
      }

      // 生成退款单号
      const refundId = genRefundId();
      const record = {
        refundId,
        orderId,
        userId: ctx.userId,
        reason,
        amount,
        remark: remark || '',
        status: 'pending',      // pending / approved / rejected / completed
        createdAt: new Date().toISOString(),
        estimatedDays: 3,       // 预计3个工作日到账
      };

      REFUND_RECORDS.push(record);

      return {
        success: true,
        data: {
          message: `退款申请已提交，退款单号：${refundId}`,
          refundId,
          status: 'pending',
          estimatedDays: 3,
          note: '退款将原路返回，预计1-3个工作日到账',
        },
      };
    }

    return { success: false, error: `未知操作：${action}，可用值：query / apply` };
  };

  return {
    name: 'applyRefund',
    description: '处理退款申请和查询。需要先核实用户身份。支持查询退款记录和提交退款申请。涉及退货、退款、钱款问题时使用。',
    parameters: [
      { name: 'action', type: 'string', description: '操作类型：query（查询退款记录）/ apply（申请退款）', required: true, enum: ['query', 'apply'] },
      { name: 'orderId', type: 'string', description: '订单号（apply时必填）', required: false },
      { name: 'reason', type: 'string', description: `退款原因（apply时必填），可选值：${REFUND_REASONS.join('、')}`, required: false },
      { name: 'amount', type: 'number', description: '退款金额（可选，不填则按订单全款退）', required: false },
      { name: 'remark', type: 'string', description: '备注说明（可选）', required: false },
    ],
    handler,
  };
}
