#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/Users/angelo/Downloads/Finance-NLP-main"
VENV_DIR="$PROJECT_DIR/.venv"
MODEL_DIR="$PROJECT_DIR/chatbot_model/checkpoint-3499"
SAFETENSORS_FILE="$(ls "$MODEL_DIR"/*.safetensors 2>/dev/null | head -n1 || true)"

echo "-> Changing to project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# Create or activate virtualenv
if [ -d "$VENV_DIR" ]; then
  echo "-> Activating existing virtualenv at $VENV_DIR"
  # shellcheck source=/dev/null
  source "$VENV_DIR/bin/activate"
else
  echo "-> Creating virtualenv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
  # shellcheck source=/dev/null
  source "$VENV_DIR/bin/activate"
fi

echo "-> Upgrading pip"
pip install --upgrade pip

echo "-> Installing required packages (this may take a while)"
pip install "numpy<2" safetensors huggingface-hub transformers "uvicorn[standard]" fastapi pydantic

# Try installing torch; may fail on some mac setups — it's best-effort here.
echo "-> Attempting to install torch (may be large). If this fails, install manually following https://pytorch.org/"
pip install --upgrade --force-reinstall torch || echo "Warning: pip install torch failed; please install manually if needed."

# Validate model folder
if [ ! -d "$MODEL_DIR" ]; then
  echo "ERROR: model folder not found at $MODEL_DIR"
  echo "If the model is on Hugging Face and private, set HF_REPO and HUGGINGFACE_HUB_TOKEN env vars then re-run."
  echo "Optional automatic download (requires HF_REPO env var, e.g. 'owner/repo'):"
  echo "  export HF_REPO=owner/repo"
  echo "  export HUGGINGFACE_HUB_TOKEN=hf_xxx"
  echo "Re-run this script after providing model files or HF_REPO/token."
  exit 1
fi

echo "-> Listing model files:"
ls -lh "$MODEL_DIR" || true

# Quick corruption check for safetensors
if [ -n "$SAFETENSORS_FILE" ]; then
  echo "-> Inspecting safetensors header: $SAFETENSORS_FILE"
  head_bytes=$(head -c 128 "$SAFETENSORS_FILE" | tr -d '\0' | head -c 80 || true)
  if printf '%s' "$head_bytes" | grep -qiE "<!DOCTYPE|<html|<html>"; then
    echo "ERROR: safetensors file looks like HTML/error page (corrupted)."
    echo "Delete the corrupted file and re-download the checkpoint, or re-run with HF_REPO/HUGGINGFACE_HUB_TOKEN to snapshot_download."
    exit 2
  fi
  size_bytes=$(stat -f%z "$SAFETENSORS_FILE" 2>/dev/null || stat -c%s "$SAFETENSORS_FILE")
  if [ "$size_bytes" -lt 1000000 ]; then
    echo "WARNING: safetensors file is suspiciously small (<1MB). It may be incomplete."
    echo "Please re-download or replace the checkpoint files."
    exit 3
  fi
else
  echo "No .safetensors file found in checkpoint folder. If model uses .bin weights, ensure those are present."
fi

# Optional: if HF_REPO and token set, try snapshot_download to refresh files
if [ -n "${HF_REPO:-}" ] && [ -n "${HUGGINGFACE_HUB_TOKEN:-}" ]; then
  echo "-> HF_REPO and token provided — attempting snapshot_download into $MODEL_DIR"
  python - <<PY
from huggingface_hub import snapshot_download
import os
repo = os.environ.get("HF_REPO")
token = os.environ.get("HUGGINGFACE_HUB_TOKEN")
print("Downloading", repo)
snapshot_download(repo, local_dir="$MODEL_DIR", token=token, allow_patterns=["*.safetensors","*.bin","config.json","tokenizer*"], resume_download=False)
print("Snapshot download complete")
PY
fi

echo "-> Starting server once using uvicorn (foreground). Use Ctrl+C to stop."
uvicorn API.Finance:app --host 0.0.0.0 --port 5000 --reload