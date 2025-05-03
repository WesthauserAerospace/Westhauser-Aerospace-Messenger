const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CHAT_LOG = path.join(__dirname, 'chatlog.json');

// Statischer Ordner
app.use(express.static(path.join(__dirname, 'public')));

// Startseite ausliefern
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO-Verbindung
io.on('connection', (socket) => {
  console.log('✅ Ein Benutzer ist verbunden');

  // Chatlog laden (wenn vorhanden)
  if (fs.existsSync(CHAT_LOG)) {
    try {
      const log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      socket.emit('chatlog', log);
    } catch (err) {
      console.error('❌ Fehler beim Laden des Chatlogs:', err);
    }
  }

  // Neue Nachricht empfangen
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);

    let log = [];
    if (fs.existsSync(CHAT_LOG)) {
      try {
        log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      } catch (err) {
        console.error('❌ Fehler beim Lesen des Chatlogs:', err);
      }
    }

    log.push(msg);

    try {
      fs.writeFileSync(CHAT_LOG, JSON.stringify(log, null, 2), 'utf8');
    } catch (err) {
      console.error('❌ Fehler beim Schreiben des Chatlogs:', err);
    }
  });
});

// Server starten
http.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
