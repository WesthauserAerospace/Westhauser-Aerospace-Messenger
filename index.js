const express = require('express');
const basicAuth = require('express-basic-auth');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CHAT_LOG = path.join(__dirname, 'chatlog.json');

// 🔐 HTTP Basic Auth – nur eingeloggte User dürfen rein
app.use(basicAuth({
  users: {
    'ronny': 'geheim',
    'sylvia': 'dick'
  },
  challenge: true,
  realm: 'Westhauser Aerospace Messenger'
}));

// 🌍 Statischer Ordner für HTML, JS etc.
app.use(express.static('public'));

// 🏠 Hauptseite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔌 WebSocket-Logik
io.on('connection', (socket) => {
  console.log('✅ Ein Benutzer ist verbunden');

  // Lade bisherigen Chat
  if (fs.existsSync(CHAT_LOG)) {
    try {
      const log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      socket.emit('chatlog', log);
    } catch (err) {
      console.error('Fehler beim Laden des Chatlogs:', err);
    }
  }

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);

    let log = [];
    if (fs.existsSync(CHAT_LOG)) {
      try {
        log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      } catch (err) {
        console.error('Fehler beim Lesen des Chatlogs:', err);
      }
    }

    log.push(msg);

    try {
      fs.writeFileSync(CHAT_LOG, JSON.stringify(log, null, 2), 'utf8');
    } catch (err) {
      console.error('Fehler beim Schreiben des Chatlogs:', err);
    }
  });
});

// 🚀 Server starten
http.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});
