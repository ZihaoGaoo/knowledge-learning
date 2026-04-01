from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, List, Optional

import torch
from peft import PeftModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from common import (
    build_input_text,
    detect_device,
    recommended_dtype,
    resolve_model_and_labels,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Predict customer support intent.")
    parser.add_argument(
        "--adapter-path",
        type=Path,
        default=None,
        help="Optional LoRA adapter path.",
    )
    parser.add_argument(
        "--model-name",
        default=None,
        help="Base model name. Required when no adapter is provided.",
    )
    parser.add_argument("--text", default=None, help="Single text to predict.")
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
    model.to(device)
    return model


def predict_one(
    text: str,
    tokenizer: Any,
    model: Any,
    labels: List[str],
    max_length: int,
) -> None:
    device = detect_device()
    encoded = tokenizer(
        build_input_text(text, labels),
        return_tensors="pt",
        truncation=True,
        max_length=max_length,
    )
    encoded = {key: value.to(device) for key, value in encoded.items()}
    with torch.no_grad():
        logits = model(**encoded).logits[0]
        probabilities = torch.softmax(logits, dim=-1)
    top_score, top_index = torch.max(probabilities, dim=-1)
    print("prediction:", labels[int(top_index)])
    print("confidence:", round(float(top_score), 4))


def main() -> None:
    args = parse_args()
    config = resolve_model_and_labels(args.model_name, args.adapter_path)
    labels = config["labels"]
    tokenizer = AutoTokenizer.from_pretrained(
        args.adapter_path or config["base_model_name"],
        trust_remote_code=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = load_model(config["base_model_name"], labels, args.adapter_path)

    if args.text:
        predict_one(args.text, tokenizer, model, labels, args.max_length)
        return

    print("Enter customer message, or press Ctrl+C to exit.")
    while True:
        text = input("> ").strip()
        if not text:
            continue
        predict_one(text, tokenizer, model, labels, args.max_length)


if __name__ == "__main__":
    main()
