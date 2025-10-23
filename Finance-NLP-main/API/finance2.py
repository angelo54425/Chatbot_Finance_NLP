from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import uvicorn

# Set device (GPU if available)
device = 'cuda' if torch.cuda.is_available() else 'cpu'

# Update the model path
model_path = "/Users/angelo/Downloads/Finance-NLP-main/chatbot_model/checkpoint-3499"

# Load model and tokenizer
model = AutoModelForCausalLM.from_pretrained(model_path).to(device)
tokenizer = AutoTokenizer.from_pretrained("gpt2")

# Set padding token
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# Initialize FastAPI app
app = FastAPI()

# ✅ Add CORS Middleware to allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow only frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Define request data model
class RequestData(BaseModel):
    prompt: str

@app.post("/generate")
async def generate_text(request_data: RequestData):
    input_text = request_data.prompt

    # Tokenize input and move to correct device
    input_ids = tokenizer(input_text, return_tensors="pt", padding=True, truncation=True, max_length=512).input_ids.to(device)

    # Generate response
    output = model.generate(
        input_ids,
        max_length=100,  # Adjust output length
        num_beams=5,
        no_repeat_ngram_size=2,
        top_k=50,
        do_sample=True
    )

    # Decode output
    generated_text = tokenizer.decode(output[0], skip_special_tokens=True)

    # Remove the input text from the generated text
    if "Bot:" in generated_text:
        generated_text = generated_text.split("Bot:", 1)[1].strip()

    return {"response": generated_text}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=3000, log_level="info")