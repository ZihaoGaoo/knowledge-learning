# Intent Classifier Fine-Tuning

这是一个适合入门学习的微调项目：用一个中文基础模型做电商客服意图分类。

为什么先做这个场景：

- 数据容易理解，也容易自己继续扩充
- 标签清晰，方便做基线对比和误差分析
- 微调后效果通常会比纯提示词更稳定
- 后面很容易接到 Agent 里当路由器

默认标签：

- `退款`
- `发票`
- `物流`
- `账号问题`
- `售后投诉`
- `商品咨询`

## 目录结构

```text
finetune/intent_classifier
├── common.py
├── data
│   ├── train.jsonl
│   ├── validation.jsonl
│   └── test.jsonl
├── evaluate.py
├── predict.py
├── README.md
├── requirements.txt
└── train.py
```

## 数据格式

每行一条 JSON，包含 `text` 和 `label` 两个字段：

```json
{"text":"订单刚下就想取消，能直接退款吗？","label":"退款"}
```

## 环境准备

```bash
cd finetune/intent_classifier
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

如果你是第一次跑，建议先用默认的小模型：

- `Qwen/Qwen2.5-0.5B-Instruct`

这个模型更适合在个人电脑上做入门实验。

## 先跑基线

不带 LoRA 适配器，先测一下原始模型：

```bash
python evaluate.py --model-name Qwen/Qwen2.5-0.5B-Instruct
```

## 开始微调

```bash
python train.py
```

训练完成后会在 `outputs/qwen-intent-lora` 下保存：

- LoRA adapter
- tokenizer
- `intent_config.json`

## 评估微调结果

```bash
python evaluate.py --adapter-path outputs/qwen-intent-lora
```

最有学习价值的方式是把下面两次结果放在一起比较：

- `evaluate.py --model-name ...`
- `evaluate.py --adapter-path ...`

重点看：

- `accuracy`
- `macro_f1`
- 哪些标签最容易混淆

## 单条预测

```bash
python predict.py --adapter-path outputs/qwen-intent-lora --text "我想开一张公司抬头的发票"
```

## 下一步怎么继续学

你可以按这个顺序继续：

1. 扩大数据集，每个类别补到 100 条以上
2. 增加更难区分的样本，比如 `退款` 和 `售后投诉`
3. 调整学习率、epoch、LoRA rank
4. 把预测脚本接到你的 Agent 做意图路由

## 一个很实用的观察点

这个项目不是为了让模型学知识，而是让模型学“判断规则”。

如果你的任务是：

- 知识问答
- 最新事实
- 公司内部文档回答

优先考虑 RAG 或搜索，而不是微调。
