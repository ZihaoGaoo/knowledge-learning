"use strict";
// ============================================================
// Skills - 复合任务技能定义
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_SKILLS = exports.escalateSkill = exports.productConsultSkill = exports.refundSkill = exports.complaintSkill = exports.orderInquirySkill = void 0;
/** 订单查询技能 */
exports.orderInquirySkill = {
    name: 'orderInquiry',
    description: '当用户询问订单状态、物流进度、发货时间、签收情况时触发此技能。',
    instructions: `【订单查询技能】执行步骤：
1. 调用 queryOrder 工具查询订单（需要先确认用户身份）
2. 若身份未核实，要求用户提供下单手机号后4位
3. 若查到订单，明确告知：订单状态、发货时间、物流公司、快递单号、预计送达时间
4. 若未查到订单，提示用户核实订单号或联系方式
5. 如有异常（如快递丢失），主动记录并承诺跟进`,
    triggerKeywords: ['订单', '物流', '发货', '快递', '签收', '到了吗', '发货了吗', 'order', '快递单号'],
    tools: ['queryOrder'],
    examples: [
        '我的订单到哪了',
        '查一下ORD20260315001',
        '为什么还没发货',
        '快递一般几天到',
    ],
    enabled: true,
};
/** 投诉处理技能 */
exports.complaintSkill = {
    name: 'complaintHandling',
    description: '当用户表达不满、投诉、抱怨产品质量或服务时触发此技能。需先做情感分析，再按流程处理。',
    instructions: `【投诉处理技能】执行步骤：
1. 调用 sentimentAnalysis 分析用户情绪
2. 若 escalation=true，优先表达歉意并说明会升级处理
3. 引导用户提供更多信息（订单号、问题描述、证据）
4. 调用 searchKnowledge 检索相关政策和解决方案
5. 若知识库有解决方案，主动提供；若没有，记录并承诺回复
6. 结束时总结已记录的问题和后续跟进方式`,
    triggerKeywords: ['投诉', '不满', '差评', '质量', '坏了', '有问题', '坑', '虚假', '欺骗'],
    tools: ['sentimentAnalysis', 'searchKnowledge'],
    examples: [
        '你们的产品质量太差了',
        '我要投诉',
        '和描述完全不一样',
        '东西坏了怎么处理',
    ],
    enabled: true,
};
/** 退款申请技能 */
exports.refundSkill = {
    name: 'refundApplication',
    description: '当用户申请退款、取消订单、退货退款时触发此技能。需核实身份并按规范流程处理。',
    instructions: `【退款申请技能】执行步骤：
1. 确认用户身份（下单手机号后4位）
2. 调用 applyRefund query 查看退款记录
3. 询问退款原因（商品损坏/与描述不符/买错了/质量问题/其他）
4. 确认退款金额和退款方式
5. 调用 applyRefund apply 提交退款申请
6. 告知退款单号和预计到账时间
7. 若订单已发货，需说明需等商品寄回后才可退款`,
    triggerKeywords: ['退款', '退货', '取消订单', '钱', 'refund', '取消', '退货退款'],
    tools: ['applyRefund'],
    examples: [
        '我要申请退款',
        '订单不想要了能退吗',
        '怎么退货',
        '退款多久到账',
    ],
    enabled: true,
};
/** 产品咨询技能 */
exports.productConsultSkill = {
    name: 'productConsult',
    description: '当用户查询产品信息、价格、库存、规格参数、对比产品时触发此技能。',
    instructions: `【产品咨询技能】执行步骤：
1. 理解用户想了解哪款产品或哪类产品
2. 调用 queryProduct 工具检索（按关键词或ID）
3. 返回产品名称、价格、库存状态、核心参数
4. 若无库存，主动推荐同类替代品
5. 若价格有活动，提醒用户优惠信息
6. 适度引导购买（如：目前有货/性价比高）`,
    triggerKeywords: ['价格', '多少钱', '有货吗', '参数', '规格', '对比', '推荐', '买哪个', 'product'],
    tools: ['queryProduct'],
    examples: [
        '这款手表多少钱',
        '有没有续航久一点的耳机',
        '充电宝可以带上飞机吗',
        '推荐一款护眼台灯',
    ],
    enabled: true,
};
/** 转人工技能 */
exports.escalateSkill = {
    name: 'escalateToHuman',
    description: '当用户明确要求转人工、反馈复杂问题、或当前技能无法解决时触发此技能。',
    instructions: `【转人工技能】执行步骤：
1. 感谢用户来电，表达理解
2. 记录用户的问题要点（内容、订单号、诉求）
3. 告知转接等待时间（预计3-5分钟）
4. 发送转接指令（集成时调用转人工API）
5. 若暂时无法转接，记录用户联系方式承诺回拨`,
    triggerKeywords: ['转人工', '人工客服', '客服', '真人', '活人', 'speaking', 'human', 'agent'],
    tools: [],
    examples: [
        '转人工',
        '我要和真人说话',
        '叫你们领导来',
        '这个解决不了，叫客服',
    ],
    enabled: true,
};
/** 全部技能列表 */
exports.ALL_SKILLS = [
    exports.orderInquirySkill,
    exports.complaintSkill,
    exports.refundSkill,
    exports.productConsultSkill,
    exports.escalateSkill,
];
//# sourceMappingURL=registry.js.map