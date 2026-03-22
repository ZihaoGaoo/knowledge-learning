// ============================================================
// 主入口 - 智能客服 Agent
// ============================================================

import * as readline from 'readline';
import { KnowledgeBase } from './knowledge/KnowledgeBase';
import { MCP } from './mcp/MCP';
import { CustomerServiceAgent } from './agent/Agent';
import { createSearchKnowledgeTool } from './tools/searchKnowledge';
import { createQueryOrderTool } from './tools/queryOrder';
import { createQueryProductTool } from './tools/queryProduct';
import { createRefundTool } from './tools/refund';
import { createSentimentTool } from './tools/sentiment';
import { ALL_SKILLS } from './skills/registry';
import { KnowledgeEntry } from './agent/types';

// ===================== 初始化知识库数据 =====================
function initKnowledgeBase(): KnowledgeBase {
  const kb = new KnowledgeBase({ topK: 5, minScore: 0.03, hybridAlpha: 0.7 });

  const knowledgeData: Omit<KnowledgeEntry, 'embedding'>[] = [
    // 售后政策
    {
      id: 'kb001',
      content: '退货政策：自收到商品之日起7天内可申请退货，15天内可申请换货。退货需保持商品完好、附件齐全。',
      chunk: '退货政策：7天内可申请退货，15天内可换货。需保持商品完好附件齐全。退款将在收到退货后3-5个工作日内退回原支付方式。',
      metadata: { category: 'policy', tags: ['退货', '退款', '7天', '换货'], source: '售后政策手册' },
    },
    {
      id: 'kb002',
      content: '保修政策：全场产品享受国家三包政策。人为损坏不在保修范围内。具体保修期限见产品说明书。',
      chunk: '保修政策：全场产品享受国家三包政策，人为损坏不在保修范围。具体保修期限见产品说明书。',
      metadata: { category: 'policy', tags: ['保修', '三包', '人为损坏', '质保'], source: '售后政策手册' },
    },
    {
      id: 'kb003',
      content: '快递配送：正常情况下1-3个工作日发货，大促期间可能延长。顺丰/中通/EMS可选。偏远地区可能延迟1-2天。',
      chunk: '快递配送：1-3个工作日发货，大促期间可能延长。支持顺丰、中通、EMS。偏远地区延迟1-2天。',
      metadata: { category: 'logistics', tags: ['快递', '发货', '配送', '顺丰', '时效'], source: '物流说明' },
    },
    {
      id: 'kb004',
      content: '优惠活动：新人首单满100减10；会员日（每月15日）全品类9折；积分可抵扣现金（100积分=1元）。',
      chunk: '优惠活动：新人首单满100减10；会员日每月15日全品类9折；积分100抵1元。',
      metadata: { category: 'service', tags: ['优惠', '折扣', '新人', '会员', '积分'], source: '活动规则' },
    },
    {
      id: 'kb005',
      content: '支付方式：支持支付宝、微信支付、银行卡、信用卡。花呗、分期付款（3/6/12期免息）。',
      chunk: '支付方式：支付宝、微信、银行卡、信用卡。花呗、分期付款3/6/12期免息。',
      metadata: { category: 'service', tags: ['支付', '支付宝', '微信', '花呗', '分期'], source: '支付指南' },
    },
    // 产品使用
    {
      id: 'kb006',
      content: '智能手表Pro使用说明：长按电源键3秒开关机。下拉菜单连接蓝牙。App内同步数据。心率监测需紧贴手腕。',
      chunk: '智能手表Pro：长按3秒开关机，下拉连接蓝牙，App同步数据，心率监测需紧贴手腕。防水50米，可游泳佩戴。',
      metadata: { category: 'product', tags: ['手表', '连接', '蓝牙', '心率', '防水', '使用'], source: '产品说明书' },
    },
    {
      id: 'kb007',
      content: '无线蓝牙耳机使用说明：首次使用需充电2小时。打开充电盒即配对。长按2秒呼叫语音助手。敲击2次降噪切换。',
      chunk: '蓝牙耳机：充电2小时，配对打开充电盒即连接。长按2秒呼叫语音助手，敲击2次切换降噪。续航8+22小时。',
      metadata: { category: 'product', tags: ['耳机', '蓝牙', '配对', '降噪', '续航', '充电'], source: '产品说明书' },
    },
    // 投诉处理
    {
      id: 'kb008',
      content: '商品损坏处理流程：1. 拍照保留证据 2. 联系我方客服 3. 提供订单号和照片 4. 审核通过后补发或退款',
      chunk: '商品损坏处理：拍照保留证据，联系客服，提供订单号和照片，审核通过后补发或退款。',
      metadata: { category: 'service', tags: ['损坏', '补发', '退款', '处理流程', '投诉'], source: '售后手册' },
    },
    {
      id: 'kb009',
      content: '发票开具：订单完成后可在"我的订单"中申请电子发票，或联系客服开具纸质发票。电子发票1个工作日内开具。',
      chunk: '发票开具：订单完成后在"我的订单"申请电子发票，或联系客服开纸质发票。电子发票1个工作日内开具。',
      metadata: { category: 'service', tags: ['发票', '电子发票', '纸质发票', '订单'], source: '财务政策' },
    },
    {
      id: 'kb010',
      content: '会员积分规则：每消费1元积1分。积分不可转让。积分可兑换优惠券、礼品或抵扣现金。积分有效期2年。',
      chunk: '会员积分：每消费1元积1分，不可转让。积分可兑换优惠券、礼品或抵扣现金（100积分=1元），有效期2年。',
      metadata: { category: 'policy', tags: ['积分', '会员', '兑换', '抵扣', '有效期'], source: '会员规则' },
    },
  ];

  kb.addBatch(knowledgeData);
  kb.buildIndex();

  console.log(`[Init] 知识库已加载：${kb.stats().total} 条，分类：${JSON.stringify(kb.stats().byCategory)}`);
  return kb;
}

// ===================== 初始化 Agent =====================
function initAgent(kb: KnowledgeBase): CustomerServiceAgent {
  // MCP
  const mcp = new MCP(kb, {
    maxHistoryMessages: 20,
    maxContextEntries: 3,
    enableContextCompression: true,
    contextWindowTokens: 4000,
  });

  // 工具
  const tools = [
    createSearchKnowledgeTool(kb),
    createQueryOrderTool(),
    createQueryProductTool(),
    createRefundTool(),
    createSentimentTool(),
  ];

  // Agent
  const agent = new CustomerServiceAgent(mcp, {
    debug: true,
    modelName: 'mock-gpt-4',
  });

  agent.registerTools(tools);
  agent.registerSkills(ALL_SKILLS);
  mcp.registerTools(tools);

  return agent;
}

// ===================== 交互式 CLI =====================
async function startCLI(agent: CustomerServiceAgent) {
  const SESSION_ID = 'cli-session-001';
  const USER_ID = 'user_cli';

  console.log('\n========================================');
  console.log('  智能客服 Agent - 演示系统');
  console.log('  输入问题即可测试，输入 quit 退出');
  console.log('========================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    rl.question('\n🧑 您：', async (input) => {
      const text = input.trim();
      if (!text) { prompt(); return; }
      if (text === 'quit' || text === 'exit' || text === '退出') {
        console.log('再见！👋');
        rl.close();
        return;
      }

      try {
        const reply = await agent.process(text, SESSION_ID, USER_ID);
        console.log(`\n🤖 小服：${reply}`);
      } catch (err) {
        console.log(`[Error] ${(err as Error).message}`);
      }

      prompt();
    });
  };

  prompt();
}

// ===================== Demo 测试 =====================
async function runDemo(agent: CustomerServiceAgent) {
  const SESSION_ID = 'demo-session-001';
  const USER_ID = 'user_demo';

  // 模拟身份验证（简化版）
  const mcp = (agent as unknown as { mcp: MCP }).mcp;
  mcp.setSessionMeta(SESSION_ID, 'identityVerified', true);

  const questions = [
    '我的订单到哪了',
    'ORD20260315001',
    '这款手表多少钱，有货吗',
    '我要申请退款',
    '你们退货运费谁承担',
    '帮我推荐一款耳机',
    '充电宝可以带上飞机吗',
    '我不满意你们的产品质量',
  ];

  console.log('\n========== Demo 测试 ==========\n');

  for (const q of questions) {
    console.log(`🧑 用户：${q}`);
    const reply = await agent.process(q, SESSION_ID, USER_ID);
    console.log(`🤖 小服：${reply}`);
    console.log('---');
  }
}

// ===================== 启动 =====================
async function main() {
  const kb = initKnowledgeBase();
  const agent = initAgent(kb);

  const mode = process.argv[2] || 'demo';

  if (mode === 'cli') {
    await startCLI(agent);
  } else {
    await runDemo(agent);
  }
}

main().catch(console.error);
