// public/main.js

// UI-Elemente
const messages = document.getElementById('messages');
const input    = document.getElementById('message');
const adminBar = document.getElementById('admin-bar');
const newsBox  = document.getElementById('news');

// Erkennen, ob wir im privaten Bereich sind (URL)
const isPrivate = location.pathname.startsWith('/private');

// Socket.IO Namespace je nach Bereich
const socket = io(isPrivate ? '/priv' : '/pub', { path: '/socket.io' });

// Nutzer / Flags
let currentUser = null;
let gptEnabled  = true;

// Avatare / Styles
const AVATAR   = { RAZION: '🛡️', 'HEL-3': '🜂', 'THOT-X': '🔮', SYSTEM: '⚠️' };
const TAGCLASS = { RAZION: 'razion', 'HEL-3': 'hel3', 'THOT-X': 'thotx' };

// Avatar-Auswahl (nur RAZION oder HEL-3)
while (!currentUser) {
  const name = (prompt('Wer bist du? (RAZION, HEL-3)') || '').trim().toUpperCase();
  if (['RAZION', 'HEL-3'].includes(name)) currentUser = name;
}

// Admin-Bar nur für RAZION
if (currentUser === 'RAZION' && adminBar) adminBar.style.display = 'flex';

// Tabs visuell setzen
const tabPublic  = document.getElementById('tab-public');
const tabPrivate = document.getElementById('tab-private');
if (tabPublic && tabPrivate) {
  tabPublic.classList.toggle('active', !isPrivate);
  tabPrivate.classList.toggle('active', isPrivate);
}

/* ---------- Rendering ---------- */

function renderMessage({ sender, text }) {
  const isSelf = sender === currentUser;

  const li = document.createElement('li');
  li.className = `message ${isSelf ? 'right' : ''}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = AVATAR[sender] || '👤';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const meta = document.createElement('div');
  meta.className = 'meta';

  const nameTag = document.createElement('span');
  nameTag.className = `tag ${TAGCLASS[sender] || ''}`;
  nameTag.textContent = sender;

  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  meta.appendChild(nameTag);
  meta.appendChild(time);

  const content = document.createElement('div');
  content.className = 'text';
  content.textContent = text;

  bubble.appendChild(meta);
  bubble.appendChild(content);

  li.appendChild(avatar);
  li.appendChild(bubble);

  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

function updateNews(html) {
  if (newsBox) newsBox.innerHTML = html;
}

/* ---------- Socket-Events ---------- */

socket.on('chatlog', (log = []) => {
  log.forEach((entry) => renderMessage(entry));
});

socket.on('chat message', (data) => {
  renderMessage(data);
});

socket.on('system message', (msg) => {
  renderMessage({ sender: 'SYSTEM', text: msg });
});

socket.on('thotx-news', (data) => {
  updateNews(data);
});

/* ---------- Aktionen ---------- */

function sendMessage() {
  const msg = input.value;
  if (!msg || !msg.trim()) return;

  // Server erwartet { sender, text }
  socket.emit('chat message', { sender: currentUser, text: msg.trim() });
  input.value = '';
}

// Admin-Funktionen – wirken pro Namespace (Public/Privat)
function clearChat()        { socket.emit('admin:clear'); }
function triggerDeepSearch(){ socket.emit('admin:deepsearch'); }
function toggleGPT()        { gptEnabled = !gptEnabled; socket.emit('admin:toggleGPT', gptEnabled); }

// Channel-Wechsel über Navigation (sauber: andere URL, anderer Namespace)
function switchChannel(channel) {
  window.location.href = channel === 'private' ? '/private' : '/';
}

/* ---------- Expose für Buttons ---------- */
window.sendMessage        = sendMessage;
window.clearChat          = clearChat;
window.triggerDeepSearch  = triggerDeepSearch;
window.toggleGPT          = toggleGPT;
window.switchChannel      = switchChannel;
