from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import uvicorn

# Set device (GPU if available)
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# Update the model path
model_path = "chatbot_model/checkpoint-3499"

# Load model
model = AutoModelForCausalLM.from_pretrained(model_path).to(device)

# Load tokenizer: prefer tokenizer files in the checkpoint, fallback to gpt2
try:
    tokenizer = AutoTokenizer.from_pretrained(model_path)
except Exception:
    tokenizer = AutoTokenizer.from_pretrained("gpt2")

# Set padding token
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# Initialize FastAPI app
app = FastAPI()

# ✅ Add CORS Middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","http://localhost:3000"],  # Allow only frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Define request data model
class RequestData(BaseModel):
    prompt: str

@app.post("/generate")
async def generate_text(request_data: RequestData):
    input_text = request_data.prompt or ""

    # Tokenize input and move tensors to correct device, include attention_mask
    inputs = tokenizer(
        input_text,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=512,
    )
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs.get("attention_mask")
    if attention_mask is not None:
        attention_mask = attention_mask.to(device)

    # Generate response (use max_new_tokens for open-end generation)
    output = model.generate(
        input_ids,
        attention_mask=attention_mask,
        max_new_tokens=150,
        num_beams=5,
        no_repeat_ngram_size=2,
        top_k=50,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
    )

    # Decode output
    generated_text = tokenizer.decode(output[0], skip_special_tokens=True).strip()

    # Remove the input text if the model repeated it verbatim
    if input_text and input_text in generated_text:
        generated_text = generated_text.split(input_text, 1)[-1].strip()

    return {"text": generated_text}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")