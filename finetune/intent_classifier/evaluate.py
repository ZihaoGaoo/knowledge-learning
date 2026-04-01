from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, List, Optional

import torch
from peft import PeftModel
from sklearn.metrics import accuracy_score, classification_report, f1_score
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from common import (
    BASE_DIR,
    build_input_text,
    detect_device,
    load_jsonl,
    recommended_dtype,
    resolve_model_and_labels,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate an intent classifier.")
    parser.add_argument(
        "--test-file",
        type=Path,
        default=BASE_DIR / "data/test.jsonl",
        help="Dataset used for evaluation.",
    )
    parser.add_argument(
        "--adapter-path",
        type=Path,
        default=None,
        help="Optional LoRA adapter directory.",
    )
    parser.add_argument(
        "--model-name",
        default=None,
        help="Base model name. Required when no adapter is provided.",
    )
    parser.add_argument("--max-length", type=int, default=256)
    return parser.parse_args()


def load_model(
    model_name: str, labels: List[str], adapter_path: Optional[Path]
) -> Any:
    device = detect_device()
    model = AutoModelForSequenceClassification.from_pretrained(
        model_name,
        num_labels=len(labels),
        id2label={idx: label for idx, label in enumerate(labels)},
        label2id={label: idx for idx, label in enumerate(labels)},
        torch_dtype=recommended_dtype(device),
        trust_remote_code=True,
    )
    model.config.pad_token_id = model.config.eos_token_id
    if adapter_path is not None:
        model = PeftModel.from_pretrained(model, adapter_path)
    model.eval()
    return model


def main() -> None:
    args = parse_args()
    config = resolve_model_and_labels(args.model_name, args.adapter_path)
    labels = config["labels"]
    label_to_id = {label: idx for idx, label in enumerate(labels)}

    tokenizer = AutoTokenizer.from_pretrained(
        args.adapter_path or config["base_model_name"],
        trust_remote_code=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = load_model(config["base_model_name"], labels, args.adapter_path)
    records = load_jsonl(args.test_file)

    gold = []
    pred = []
    device = detect_device()
    model.to(device)

    for record in records:
        encoded = tokenizer(
            build_input_text(record["text"], labels),
            return_tensors="pt",
            truncation=True,
            max_length=args.max_length,
        )
        encoded = {key: value.to(device) for key, value in encoded.items()}
        with torch.no_grad():
            logits = model(**encoded).logits[0].detach().cpu()
        predicted = int(torch.argmax(logits).item())
        gold.append(label_to_id[record["label"]])
        pred.append(predicted)

    print("accuracy:", round(accuracy_score(gold, pred), 4))
    print("macro_f1:", round(f1_score(gold, pred, average="macro"), 4))
    print(
        classification_report(
            gold,
            pred,
            target_names=labels,
            digits=4,
            zero_division=0,
        )
    )


if __name__ == "__main__":
    main()
