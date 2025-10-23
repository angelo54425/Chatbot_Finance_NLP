from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
import uvicorn

# Initialize FastAPI app
app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to your frontend's URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load GPT-2 tokenizer and model
model_name = "gpt2"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained("chatbot_model/checkpoint-3499")

# Set pad token
tokenizer.pad_token = tokenizer.eos_token

# Define request model
class ChatRequest(BaseModel):
    user_input: str

# Function to generate chatbot response
def chatbot_response(user_input):
    input_text = f"User: {user_input}\nBot:"
    inputs = tokenizer(input_text, return_tensors="pt")
    input_ids = inputs.input_ids
    attention_mask = inputs.attention_mask
    
    with torch.no_grad():
        output = model.generate(input_ids, attention_mask=attention_mask, max_length=50, pad_token_id=tokenizer.eos_token_id)

    response = tokenizer.decode(output[:, input_ids.shape[-1]:][0], skip_special_tokens=True)
    return response.strip()

# Define API route
@app.post("/chat/")
def chat(request: ChatRequest):
    response = chatbot_response(request.user_input)
    return {"bot_response": response}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)