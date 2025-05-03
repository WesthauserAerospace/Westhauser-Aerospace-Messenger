const socket = io();
const messages = document.getElementById('messages');
const input = document.getElementById('message');

function addMessage(msg) {
  const li = document.createElement('li');
  li.textContent = msg;
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

socket.on('chatlog', (log) => {
  log.forEach(addMessage);
});

socket.on('chat message', (msg) => {
  addMessage(msg);
});

function sendMessage() {
  const msg = input.value;
  if (msg.trim() !== '') {
    socket.emit('chat message', msg);
    input.value = '';
  }
}
