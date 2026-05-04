import os
from typing import List

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

app = FastAPI(title='RupaxAI Backend')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

HF_API_KEY = os.getenv('HF_API_KEY', '')
HF_MODEL = os.getenv('HF_MODEL', 'meta-llama/Llama-2-7b-chat-hf')
REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', '60'))

@app.get('/health')
def health() -> dict:
    return {'status': 'ok', 'backend': 'online'}

@app.post('/api/chat')
def chat(request: ChatRequest) -> dict:
    if not HF_API_KEY:
        raise HTTPException(status_code=500, detail='HF_API_KEY not configured')

    payload = {
        'inputs': request.messages[-1].content if request.messages else '',
    }

    headers = {
        'Authorization': f'Bearer {HF_API_KEY}',
        'Content-Type': 'application/json',
    }

    try:
        response = requests.post(
            f'https://api-inference.huggingface.co/models/{HF_MODEL}',
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    try:
        data = response.json()
        generated_text = data[0].get('generated_text', '') if isinstance(data, list) else data.get('generated_text', '')
        return {
            'message': {
                'content': generated_text,
                'role': 'assistant'
            }
        }
    except (ValueError, KeyError, IndexError) as exc:
        raise HTTPException(status_code=502, detail=f'Invalid response from Hugging Face: {exc}')
