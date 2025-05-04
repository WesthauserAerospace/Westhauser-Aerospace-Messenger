const socket = io();
const messages = document.getElementById('messages');
const input = document.getElementById('message');
const adminBar = document.getElementById('admin-bar');
const newsBox = document.getElementById('news');

let currentUser = null;
let gptEnabled = true;

// 🧠 Avatar-Auswahl (RAZION / HELIA-0)
while (!currentUser) {
  const name = prompt("Wer bist du? (RAZION, HELIA-0)").trim().toUpperCase();
  if (["RAZION", "HELIA-0"].includes(name)) {
    currentUser = name;
  }
}

// ⚙️ Admin-Sicht für RAZION
if (currentUser === "RAZION") {
  adminBar.style.display = "block";
}

// 💬 Chatnachricht hinzufügen
function addMessage(data) {
  const li = document.createElement('li');
  li.innerHTML = `<strong>${data.sender}:</strong> ${data.text}`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// 📡 THOT-X News anzeigen
function updateNews(content) {
  newsBox.innerHTML = '<strong>THOT-X Warnzentrale</strong><br>' + content;
}

// 📥 Chatlog laden
socket.on('chatlog', (log) => {
  log.forEach(addMessage);
});

// 📩 Neue Chatnachricht
socket.on('chat message', (data) => {
  addMessage(data);
});

// ⚠️ Systemnachricht (z. B. GPT an/aus)
socket.on('system message', (msg) => {
  const li = document.createElement('li');
  li.style.color = "#ff9800";
  li.innerHTML = `<em>⚠️ ${msg}</em>`;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
});

// 🔔 Live-News von THOT-X empfangen
socket.on('thotx-news', (data) => {
  updateNews(data);
});

// ✉️ Nachricht senden
function sendMessage() {
  const msg = input.value;
  if (msg.trim() !== '') {
    socket.emit('chat message', {
      sender: currentUser,
      text: msg
    });
    input.value = '';
  }
}

// ⚙️ Adminfunktionen (nur RAZION)
function clearChat() {
  socket.emit('admin:clear');
}

function triggerDeepSearch() {
  socket.emit('admin:deepsearch');
}

function toggleGPT() {
  gptEnabled = !gptEnabled;
  socket.emit('admin:toggleGPT', gptEnabled);
}
