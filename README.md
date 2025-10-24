# Finance-NLP — Domain-Specific Chatbot (Finance)

Short summary
- Domain: Finance — conversational chatbot for finance documents and queries (10-Ks, earnings, market concepts).
- Stack: Hugging Face transformers (PyTorch), FastAPI backend, Next.js frontend.
- Repo contents: model checkpoint folder, API server (FastAPI), Next.js frontend (chat UI), utilities and examples.

Quick links
- Code: (this repository)
- Demo video: <ADD DEMO VIDEO LINK>
- Live demo (local): Backend: http://127.0.0.1:8000/docs  — Frontend: http://localhost:5173

Contents
- /chatbot_model/checkpoint-3499 — saved model files (weights, config, tokenizer)
- /API/Finance.py — FastAPI server that loads the model and exposes /generate
- /Frontend — Next.js application (chat UI)
- /Ui — optional static UI assets (Vite)
- /README.md — this file
- /REPORT.md — detailed project report (export to PDF for submission)
- notebooks/ (optional) — training/fine-tuning and preprocessing notebook(s)

Project goals
- Build a finance-focused chatbot that answers domain-specific queries and rejects or requests context for out-of-domain topics.
- Fine-tune a generative Transformer and deploy via API+web UI.
- Provide reproducible instructions and evaluation results.

How to run (local, shortest path)
1. Backend
- Activate venv and install Python deps:
  source .venv/bin/activate
  pip install -r API/requirements.txt
  # if no requirements.txt: pip install fastapi uvicorn transformers torch safetensors pydantic protobuf

- Ensure checkpoint exists:
  ls -lh chatbot_model/checkpoint-3499
  # should contain model.safetensors or pytorch_model.bin and tokenizer files (tokenizer.json or vocab files)

- Start backend:
  uvicorn API.Finance:app --host 127.0.0.1 --port 8000 --reload

2. Frontend
- From /Frontend:
  cd Frontend
  npm install --legacy-peer-deps
  echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" > .env.local
  PORT=5173 npm run dev
- Open http://localhost:5173

API endpoints
- POST /generate — { "prompt": "..." } → { "text": "generated answer" }
- (Docs) GET /docs — interactive Swagger UI

Dataset & preprocessing (summary)
- Source: domain-specific documents (10-Ks, earnings transcripts) and curated QA pairs. If using public data, list sources (SEC EDGAR, company reports).
- Format: conversational pairs (user_prompt, assistant_response) saved as JSONL for generative fine-tuning.
- Preprocessing steps:
  - Normalization: lowercase (optional), whitespace collapse, remove control chars.
  - Tokenization: use the same tokenizer as model (AutoTokenizer.from_pretrained).
  - Truncation: max_length chosen to preserve prompt + response (e.g., 512 tokens).
  - Deduplication and noise removal (remove boilerplate/legal disclaimers if required).
  - Save dataset as train.jsonl, val.jsonl.

Model & fine-tuning (summary)
- Base: GPT-2 family (or selected HF model). Use AutoModelForCausalLM.
- Save/Load: model.save_pretrained(...) and tokenizer.save_pretrained(...)
- Training recipe (example):
  - framework: PyTorch + transformers Trainer or HF accelerate
  - hyperparameters:
    - epochs: 3–5 (adjust)
    - batch_size: 8–32 (GPU-dependent)
    - lr: 1e-5 to 5e-5 (AdamW)
    - weight_decay: 0.01
    - max_new_tokens: 150 (generation)
  - Use gradient accumulation if limited GPU memory.
- Logging: save training_args.bin, trainer_state.json and logs.
- Tip: use safe_serialization=True to produce model.safetensors.

Evaluation
- Quantitative:
  - Perplexity on validation set.
  - BLEU / ROUGE for some setups (not perfect for generative chat, still useful).
  - F1-score for extractive QA if used.
- Qualitative:
  - Example conversational transcripts (appendix).
  - Out-of-domain rejection testing.
- Recommended: include an experiments table showing hyperparameter variations and validation results.

Frontend & UX
- Next.js chat UI at Frontend/components/chat-form.tsx.
- Behavior implemented:
  - Tracks keywords locally (localStorage).
  - Sends prompts to backend /generate and displays responses.
  - Humanizes responses and asks for clarification when low-confidence.
  - Immediate fallback: "Not familiar teritory" for forbidden topics (agriculture, personal data, definitions) — adjust as required.
- CORS: backend must allow the frontend origin (localhost:5173 or 3000).

Security, ethics & limitations
- Sensitive data: the chatbot must not be used to handle private PII. The README includes forbidden topic blocking as an example but you must apply stricter policies if needed.
- Hallucination: generative models can fabricate facts — add disclaimers and confidence warnings.
- Bias & fairness: document dataset bias sources and limitations.

Reproducibility & environment
- Provide requirements file(s):
  - API/requirements.txt (fastapi, uvicorn, transformers, torch, safetensors, protobuf, pydantic)
  - Frontend/package.json (node, next, react)
- Seed control: set random seeds for torch, numpy, python random in training notebook.
- Hardware: mention GPU requirements and approximate VRAM.

Deliverables & submission checklist
- Source code (GitHub repo) with:
  - API/Finance.py (server)
  - Frontend/ (Next app)
  - chatbot_model/checkpoint-3499 (weights + tokenizer) or instructions to download
  - notebooks/ training + preprocessing
  - REPORT.md (this report)
  - Demo video (5–10 minutes) uploaded to YouTube / Drive with link in README
- Demo video should show:
  - Project goals and domain
  - Data & preprocessing
  - Training highlights and hyperparameter table
  - Evaluation metrics and sample conversations
  - Live demo of frontend interacting with backend
  - Limitations and next steps
- Generate PDF report:
  - Use `pandoc REPORT.md -o report.pdf` or print REPORT.md to PDF from your editor.

Appendix — Useful commands
- Create model/tokenizer from notebook:
  ```bash
  python - <<'PY'
  from pathlib import Path
  out_dir = Path("chatbot_model/checkpoint-3499")
  out_dir.mkdir(parents=True, exist_ok=True)
  model.save_pretrained(out_dir, safe_serialization=True)
  tokenizer.save_pretrained(out_dir)
  PY
  ```
- Start backend:
  source .venv/bin/activate
  uvicorn API.Finance:app --host 127.0.0.1 --port 8000 --reload
- Start frontend:
  cd Frontend
  npm install --legacy-peer-deps
  echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" > .env.local
  PORT=5173 npm run dev

Contact / support
- For issues: open an issue in the repo with logs, platform, and steps to reproduce.
