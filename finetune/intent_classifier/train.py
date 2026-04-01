from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from datasets import Dataset, DatasetDict
from peft import LoraConfig, TaskType, get_peft_model
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
    set_seed,
)

from common import (
    BASE_DIR,
    build_input_text,
    detect_device,
    detect_modules_to_save,
    detect_target_modules,
    discover_labels,
    load_jsonl,
    recommended_dtype,
    save_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train a LoRA intent classifier.")
    parser.add_argument(
        "--model-name",
        default="Qwen/Qwen2.5-0.5B-Instruct",
        help="Base model used for learning.",
    )
    parser.add_argument(
        "--train-file",
        type=Path,
        default=BASE_DIR / "data/train.jsonl",
        help="Training dataset in JSONL format.",
    )
    parser.add_argument(
        "--validation-file",
        type=Path,
        default=BASE_DIR / "data/validation.jsonl",
        help="Validation dataset in JSONL format.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=BASE_DIR / "outputs/qwen-intent-lora",
        help="Directory used to save the adapter.",
    )
    parser.add_argument("--num-train-epochs", type=float, default=4.0)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--warmup-ratio", type=float, default=0.05)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=4)
    parser.add_argument("--lora-r", type=int, default=8)
    parser.add_argument("--lora-alpha", type=int, default=16)
    parser.add_argument("--lora-dropout", type=float, default=0.05)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def make_dataset(records: List[Dict[str, Any]], labels: List[str]) -> Dataset:
    label_to_id = {label: index for index, label in enumerate(labels)}
    rows = []
    for record in records:
        rows.append(
            {
                "text": build_input_text(record["text"], labels),
                "label": label_to_id[record["label"]],
            }
        )
    return Dataset.from_list(rows)


def main() -> None:
    args = parse_args()
    set_seed(args.seed)

    train_records = load_jsonl(args.train_file)
    validation_records = load_jsonl(args.validation_file)
    labels = discover_labels(train_records + validation_records)

    dataset = DatasetDict(
        {
            "train": make_dataset(train_records, labels),
            "validation": make_dataset(validation_records, labels),
        }
    )

    device = detect_device()
    tokenizer = AutoTokenizer.from_pretrained(args.model_name, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    def tokenize(batch: Dict[str, List[Any]]) -> Dict[str, Any]:
        return tokenizer(
            batch["text"],
            truncation=True,
            max_length=args.max_length,
        )

    tokenized = dataset.map(tokenize, batched=True, remove_columns=["text"])

    model = AutoModelForSequenceClassification.from_pretrained(
        args.model_name,
        num_labels=len(labels),
        id2label={idx: label for idx, label in enumerate(labels)},
        label2id={label: idx for idx, label in enumerate(labels)},
        torch_dtype=recommended_dtype(device),
        trust_remote_code=True,
    )
    model.config.pad_token_id = tokenizer.pad_token_id

    peft_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=args.lora_dropout,
        bias="none",
        task_type=TaskType.SEQ_CLS,
        target_modules=detect_target_modules(model),
        modules_to_save=detect_modules_to_save(model),
    )
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    def compute_metrics(eval_pred: Any) -> Dict[str, float]:
        logits, labels_array = eval_pred
        predictions = np.argmax(logits, axis=-1)
        return {
            "accuracy": accuracy_score(labels_array, predictions),
            "macro_f1": f1_score(labels_array, predictions, average="macro"),
        }

    training_args = TrainingArguments(
        output_dir=str(args.output_dir),
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        num_train_epochs=args.num_train_epochs,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
        logging_steps=5,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        save_total_limit=2,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        compute_metrics=compute_metrics,
    )

    trainer.train()
    trainer.save_model()
    tokenizer.save_pretrained(args.output_dir)
    metrics = trainer.evaluate()

    save_json(
        args.output_dir / "intent_config.json",
        {
            "task": "intent_classification",
            "base_model_name": args.model_name,
            "labels": labels,
            "max_length": args.max_length,
            "device_used_for_training": device,
            "metrics": metrics,
        },
    )

    print("Saved adapter to:", args.output_dir)
    print("Validation metrics:", metrics)


if __name__ == "__main__":
    main()
