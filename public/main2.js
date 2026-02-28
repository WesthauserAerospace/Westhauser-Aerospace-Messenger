const socket   = io();
const messages = document.getElementById('messages');
const input    = document.getElementById('message');
const adminBar = document.getElementById('admin-bar');
const newsBox  = document.getElementById('news');

let currentUser    = null;
let currentChannel = 'public'; // 'public' | 'private'
let gptEnabled     = true;

// Avatare / Tags
const AVATAR = { 'RAZION':'🛡️', 'HEL-3':'🜂', 'THOT-X':'🔮', 'SYSTEM':'⚠️' };
const TAGCLASS = { 'RAZION':'razion', 'HEL-3':'hel3', 'THOT-X':'thotx' };

// Avatar-Auswahl
while (!currentUser) {
  const name = prompt("Wer bist du? (RAZION, HEL-3)").trim().toUpperCase();
  if (["RAZION","HEL-3"].includes(name)) currentUser = name;
}

// Admin-Bar nur für RAZION
if (currentUser === "RAZION") adminBar.style.display = "flex";

// Channel joinen
joinChannel(currentChannel);

function joinChannel(channel){
  currentChannel = channel;
  // Tabs visualisieren
  document.getElementById('tab-public').classList.toggle('active', channel==='public');
  document.getElementById('tab-private').classList.toggle('active', channel==='private');

  // UI zurücksetzen & Channel beitreten
  messages.innerHTML = '';
  socket.emit('join', { channel });
}

function switchChannel(channel){ joinChannel(channel); }

// Rendering einer Nachricht
function renderMessage({ sender, text, channel }){
  if (channel && channel !== currentChannel) return; // nur aktueller Channel

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
  time.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

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

// THOT-X News
function updateNews(html){ newsBox.innerHTML = html; }

// Events
socket.on('chatlog', (log) => { log.forEach((entry) => renderMessage(entry)); });
socket.on('chat message', (data) => { renderMessage(data); });
socket.on('system message', (msg) => { renderMessage({ sender:'SYSTEM', text: msg, channel: currentChannel }); });
socket.on('thotx-news', (data) => { updateNews(data); });

// Senden
function sendMessage(){
  const msg = input.value;
  if (!msg.trim()) return;
  socket.emit('chat message', { sender: currentUser, text: msg, channel: currentChannel });
  input.value = '';
}

// Admin
function clearChat(){        socket.emit('admin:clear',       { channel: currentChannel }); }
function triggerDeepSearch(){ socket.emit('admin:deepsearch',  { channel: currentChannel }); }
function toggleGPT(){         gptEnabled = !gptEnabled; socket.emit('admin:toggleGPT', gptEnabled); }

// Expose
window.switchChannel = switchChannel;
window.sendMessage = sendMessage;
window.clearChat = clearChat;
window.triggerDeepSearch = triggerDeepSearch;
window.toggleGPT = toggleGPT;

