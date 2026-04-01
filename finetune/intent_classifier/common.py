from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch

BASE_DIR = Path(__file__).resolve().parent

DEFAULT_LABELS = [
    "退款",
    "发票",
    "物流",
    "账号问题",
    "售后投诉",
    "商品咨询",
]


def load_jsonl(path: Path) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line:
                continue
            item = json.loads(line)
            if "text" not in item or "label" not in item:
                raise ValueError(
                    f"{path} line {line_number} must contain 'text' and 'label'."
                )
            records.append(item)
    if not records:
        raise ValueError(f"{path} is empty.")
    return records


def save_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def discover_labels(records: List[Dict[str, Any]]) -> List[str]:
    seen = {record["label"] for record in records}
    ordered = [label for label in DEFAULT_LABELS if label in seen]
    extras = sorted(seen - set(ordered))
    return ordered + extras


def build_input_text(text: str, labels: List[str]) -> str:
    label_text = "、".join(labels)
    return (
        "你是一个电商客服意图分类器。"
        f"请从以下类别中选择最合适的一项：{label_text}。\n"
        "只做分类，不要解释。\n"
        f"用户消息：{text}"
    )


def detect_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def recommended_dtype(device: str) -> torch.dtype:
    if device == "cuda":
        if torch.cuda.is_bf16_supported():
            return torch.bfloat16
        return torch.float16
    return torch.float32


def detect_target_modules(model: torch.nn.Module) -> List[str]:
    common_suffixes = [
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj",
        "gate_proj",
        "up_proj",
        "down_proj",
    ]
    names = set()
    for module_name, _ in model.named_modules():
        suffix = module_name.split(".")[-1]
        if suffix in common_suffixes:
            names.add(suffix)
    if names:
        return sorted(names)
    fallback = set()
    for module_name, module in model.named_modules():
        suffix = module_name.split(".")[-1]
        if isinstance(module, torch.nn.Linear) and suffix not in {"lm_head", "score"}:
            fallback.add(suffix)
    return sorted(fallback)


def detect_modules_to_save(model: torch.nn.Module) -> Optional[List[str]]:
    modules = []
    for name in ("score", "classifier"):
        if hasattr(model, name):
            modules.append(name)
    return modules or None


def resolve_model_and_labels(
    model_name: Optional[str], adapter_path: Optional[Path]
) -> Dict[str, Any]:
    if adapter_path is None:
        if not model_name:
            raise ValueError("Either model_name or adapter_path must be provided.")
        return {"base_model_name": model_name, "labels": DEFAULT_LABELS}

    config_path = adapter_path / "intent_config.json"
    if not config_path.exists():
        raise FileNotFoundError(
            f"Missing {config_path}. Train the adapter first or pass --model-name."
        )
    config = load_json(config_path)
    if model_name:
        config["base_model_name"] = model_name
    return config
