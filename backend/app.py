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

OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://localhost:11434')
MODEL = os.getenv('MODEL', 'llama3.2:1b')
REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', '60'))

@app.get('/health')
def health() -> dict:
    return {'status': 'ok', 'backend': 'online'}

@app.post('/api/chat')
def chat(request: ChatRequest) -> dict:
    payload = {
        'model': MODEL,
        'messages': [
            {
                'role': 'assistant' if message.role == 'ai' else 'user',
                'content': message.content,
            }
            for message in request.messages
        ],
        'stream': False,
    }

    try:
        response = requests.post(
            f'{OLLAMA_URL}/api/chat',
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f'Invalid JSON from Ollama: {exc}')
