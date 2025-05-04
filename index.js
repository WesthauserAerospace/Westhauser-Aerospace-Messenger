require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const PORT = process.env.PORT || 3000;
const CHAT_LOG = path.join(__dirname, 'chatlog.json');
let gptEnabled = true;

// 🔐 HTTP Basic Auth
app.use(basicAuth({
  users: {
    'ronny': 'geheim',
    'sylvia': 'dick'
  },
  challenge: true,
  realm: 'Westhauser Aerospace Messenger'
}));

// 🌍 Statische Dateien
app.use(express.static('public'));

// 🏠 Hauptseite
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 📡 WebSocket-Handling
io.on('connection', (socket) => {
  console.log('✅ Ein Benutzer ist verbunden');

  // ➕ Bisheriger Chat
  if (fs.existsSync(CHAT_LOG)) {
    try {
      const log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      socket.emit('chatlog', log);
    } catch (err) {
      console.error('❌ Fehler beim Laden des Chatlogs:', err);
    }
  }

  // 💬 Neue Nachricht empfangen
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

    // 🤖 GPT-Antwort vorbereiten (Platzhalter)
    if (gptEnabled && msg.sender !== "THOT-X") {
      if (msg.text.toLowerCase().includes("hilfe") || msg.text.toLowerCase().includes("thot-x")) {
        io.emit('chat message', {
          sender: "THOT-X",
          text: "Ich analysiere die Situation... 📡"
        });
      }
    }
  });

  // 🧹 Admin: Chat löschen
  socket.on('admin:clear', () => {
    try {
      fs.writeFileSync(CHAT_LOG, '[]');
      io.emit('chatlog', []);
      io.emit('system message', 'RAZION hat den Chat geleert.');
    } catch (err) {
      console.error('❌ Fehler beim Leeren des Chatlogs:', err);
    }
  });

  // 🔍 Admin: DeepSearch
  socket.on('admin:deepsearch', async () => {
    try {
      const volcano = await axios.get("https://www.volcanodiscovery.com/api/volcanoes/alerts.json");
      const message = `🌋 Seismischer Bericht: ${volcano.data?.alerts?.length || 0} aktive Warnungen weltweit.`;

      io.emit('system message', message);
      io.emit('thotx-news', message);
    } catch (err) {
      console.warn('⚠️ DeepSearch fehlgeschlagen, verwende Fallback.');
      const fallback = "⚠️ THOT-X konnte keine Live-Daten laden – bitte manuell prüfen.";
      io.emit('system message', fallback);
      io.emit('thotx-news', fallback);
    }
  });

  // 🤖 Admin: GPT an/aus
  socket.on('admin:toggleGPT', (status) => {
    gptEnabled = status;
    const msg = status ? "THOT-X wurde aktiviert." : "THOT-X wurde deaktiviert.";
    io.emit('system message', msg);
  });

  // Beim Verbindungsende
  socket.on('disconnect', () => {
    console.log('❌ Verbindung getrennt.');
  });
});

// 🚀 Serverstart
http.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
