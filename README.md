# RupaxAI

A simple assistant UI split into frontend and backend for deployment.

## Project structure

- `frontend/` — static web app, deploy to Vercel or any static host
- `backend/` — FastAPI proxy that forwards chat requests to an Ollama-compatible endpoint

## Local development

### 1. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### 2. Frontend

Open `frontend/index.html` in the browser, or serve it from a local static server:

```powershell
cd frontend
python -m http.server 3000
```

Then open `http://localhost:3000`.

## Deployment

### Vercel (frontend)

1. Push this repository to GitHub.
2. In Vercel, import the repository.
3. Set the project root directory to `frontend`.
4. Deploy the frontend.

### Railway (backend)

1. Import the same repository into Railway.
2. Tell Railway to use `backend` as the service directory if needed.
3. Add environment variables:
   - `OLLAMA_URL` — your Ollama-compatible endpoint
   - `MODEL` — model name, e.g. `llama3.2:1b`
4. Deploy the backend.

### Connect frontend and backend

In `frontend/app.js`, replace the placeholder `API_URL` value with your Railway backend URL once it is live.

```js
const API_URL = 'https://yourproject.up.railway.app';
```

Then redeploy the frontend.

## Important note

A hosted backend still needs a reachable AI provider.
`http://localhost:11434` only works on your local machine, not from Railway.

For a live deployment you must either:

- use a public Ollama endpoint, or
- replace the backend proxy with another remote LLM API provider.
