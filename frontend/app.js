const API_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : 'https://YOUR_RAILWAY_APP.up.railway.app';

let sessions = [];
let activeIdx = null;
let isLoading = false;
let totalTokens = 0;
let totalMsgs = 0;
let recognition = null;
let isListening = false;

window.addEventListener('DOMContentLoaded', () => {
  checkBackend();
  loadSessions();
});

async function checkBackend() {
  try {
    const r = await fetch(`${API_URL}/health`);
    if (r.ok) {
      document.getElementById('modelStatus').textContent = 'Online · Ready';
      document.querySelector('.model-dot').style.background = '#22c55e';
      document.querySelector('.model-dot').style.boxShadow = '0 0 8px #22c55e';
      hideError();
    } else {
      throw new Error();
    }
  } catch {
    document.getElementById('modelStatus').textContent = 'Offline — Start backend';
    document.querySelector('.model-dot').style.background = '#ef4444';
    document.querySelector('.model-dot').style.boxShadow = '0 0 8px #ef4444';
    showError(`Backend unreachable at <strong>${API_URL}</strong>. Update <code>frontend/app.js</code> and deploy backend first.`);
  }
}

function toggleVoice() {
  if (isListening) {
    stopVoice();
  } else {
    startVoice();
  }
}

function startVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onstart = () => {
    isListening = true;
    document.getElementById('micBtn').classList.add('active');
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const input = document.getElementById('userInput');
    input.value = transcript;
    autoResize(input);
  };
  recognition.onend = () => stopVoice();
  recognition.start();
}

function stopVoice() {
  if (recognition) {
    recognition.stop();
  }
  isListening = false;
  document.getElementById('micBtn').classList.remove('active');
}

function speak(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  }
}

function loadSessions() {
  try {
    sessions = JSON.parse(localStorage.getItem('rupaxai_sessions') || '[]');
  } catch {
    sessions = [];
  }
  renderChatList();
}

function saveSessions() {
  localStorage.setItem('rupaxai_sessions', JSON.stringify(sessions));
}

function newChat() {
  const session = {
    id: Date.now(),
    title: 'New Chat',
    messages: [],
    created: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  sessions.unshift(session);
  activeIdx = 0;
  saveSessions();
  renderChatList();
  renderMessages();
  updateStats();
  document.getElementById('chatTitle').textContent = 'New Conversation';
  document.getElementById('welcome').style.display = '';
}

function switchChat(idx) {
  activeIdx = idx;
  renderChatList();
  renderMessages();
  updateStats();
  const title = sessions[idx].title;
  document.getElementById('chatTitle').textContent = title === 'New Chat' ? 'New Conversation' : title;
}

function renderChatList() {
  const el = document.getElementById('chatList');
  if (!sessions.length) {
    el.innerHTML = `<div style="padding:12px 16px;font-size:0.78rem;color:var(--text-muted)">No chats yet</div>`;
    return;
  }
  el.innerHTML = sessions.map((s, i) => `
      <div class="chat-item ${i === activeIdx ? 'active' : ''}" onclick="switchChat(${i})">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis">${escHtml(s.title)}</span>
      </div>
    `).join('');
}

function renderMessages() {
  if (activeIdx === null) return;
  const msgs = sessions[activeIdx].messages;
  const area = document.getElementById('chatArea');
  const welcome = document.getElementById('welcome');

  if (!msgs.length) {
    welcome.style.display = '';
    area.querySelectorAll('.msg').forEach(el => el.remove());
    return;
  }

  welcome.style.display = 'none';
  area.querySelectorAll('.msg').forEach(el => el.remove());
  msgs.forEach(m => area.appendChild(buildBubble(m.role, m.content, m.time)));
  scrollBottom();
}

function buildBubble(role, content, time) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const isAI = role === 'ai';
  div.innerHTML = `
      <div class="avatar ${role}">${isAI ? '🤖' : 'U'}</div>
      <div>
        <div class="bubble-meta">
          <span class="bubble-name">${isAI ? 'RupaxAI' : 'You'}</span>
          <span class="bubble-time">${time || ''}</span>
        </div>
        <div class="bubble">${formatContent(content)}</div>
      </div>
    `;
  return div;
}

function formatContent(text) {
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre style="background:#070b14;border:1px solid var(--border);border-radius:8px;padding:12px;overflow-x:auto;margin:8px 0;font-size:0.82rem"><code style="color:#e2e8f0">${escHtml(code.trim())}</code></pre>`
  );
  text = text.replace(/`([^`]+)`/g, `<code style="background:#1a2235;padding:2px 6px;border-radius:4px;font-size:0.85em;color:#c084fc">$1</code>`);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  hideError();
  if (activeIdx === null) newChat();

  input.value = '';
  autoResize(input);

  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  sessions[activeIdx].messages.push({ role: 'user', content: text, time });

  if (sessions[activeIdx].title === 'New Chat') {
    sessions[activeIdx].title = text.length > 36 ? text.slice(0, 36) + '…' : text;
    renderChatList();
    document.getElementById('chatTitle').textContent = sessions[activeIdx].title;
  }

  totalMsgs++;
  updateStats();
  renderMessages();

  const area = document.getElementById('chatArea');
  const typing = document.createElement('div');
  typing.className = 'msg ai';
  typing.id = 'typing';
  typing.innerHTML = `
      <div class="avatar ai">🤖</div>
      <div><div class="bubble">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div></div>
    `;
  area.appendChild(typing);
  scrollBottom();

  isLoading = true;
  document.getElementById('sendBtn').disabled = true;
  const t0 = performance.now();

  try {
    const history = sessions[activeIdx].messages
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }))
      .slice(-20);

    const resp = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    });

    if (!resp.ok) {
      const payload = await resp.json().catch(() => ({}));
      throw new Error(payload.detail || `HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const aiText = data?.message?.content || data?.output?.[0]?.content || '';
    if (!aiText) throw new Error('No assistant response received from backend.');

    const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    typing.remove();
    sessions[activeIdx].messages.push({ role: 'ai', content: aiText, time: aiTime });
    totalMsgs++;
    totalTokens += Math.ceil(aiText.split(/\s+/).length * 1.3);
    speak(aiText);
    document.getElementById('statSpeed').textContent = ((performance.now() - t0) / 1000).toFixed(1) + 's';
    updateStats();
    saveSessions();
    renderMessages();
  } catch (err) {
    typing.remove();
    showError(`Error: ${escHtml(err.message)}`);
  } finally {
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    input.focus();
  }
}

function sendSuggestion(btn) {
  document.getElementById('userInput').value = btn.textContent;
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

function scrollBottom() {
  const area = document.getElementById('chatArea');
  area.scrollTop = area.scrollHeight;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateStats() {
  const msgs = activeIdx !== null ? sessions[activeIdx].messages.length : 0;
  document.getElementById('statMsgs').textContent = msgs;
  document.getElementById('statTokens').textContent = totalTokens;
  document.getElementById('tokenPill').textContent = `${totalTokens} tokens`;
  document.getElementById('msgPill').textContent = `${msgs} messages`;
}

function showError(html) {
  const banner = document.getElementById('errorBanner');
  document.getElementById('errorText').innerHTML = html;
  banner.classList.add('show');
}

function hideError() {
  document.getElementById('errorBanner').classList.remove('show');
}
