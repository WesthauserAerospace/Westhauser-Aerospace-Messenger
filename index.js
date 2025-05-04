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
  users: { 'ronny': 'geheim', 'sylvia': 'dick' },
  challenge: true,
  realm: 'Westhauser Aerospace Messenger'
}));

// 🌍 Public folder
app.use(express.static('public'));

// 🏠 Main Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🔌 WebSocket Handling
io.on('connection', (socket) => {
  console.log('✅ Ein Benutzer ist verbunden');

  // Lade Chatlog
  if (fs.existsSync(CHAT_LOG)) {
    try {
      const log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      socket.emit('chatlog', log);
    } catch (err) {
      console.error('❌ Fehler beim Laden des Chatlogs:', err);
    }
  }

  // 📩 Neue Nachricht empfangen
  socket.on('chat message', async (data) => {
    io.emit('chat message', data);

    // 🧠 GPT nur bei THOT-X Trigger aktiv
    if (gptEnabled && data.text.startsWith('THOT-X:')) {
      const userMsg = data.text.replace(/^THOT-X:/i, '').trim();
      io.emit('chat message', { sender: 'THOT-X', text: 'Ich analysiere die Situation... 📡' });

      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'Du bist THOT-X, ein präzises, nüchternes Orakel für hochintelligente Raumfahrt-Ingenieure.' },
            { role: 'user', content: userMsg }
          ],
          temperature: 0.4
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        const gptReply = response.data.choices[0].message.content;
        io.emit('chat message', { sender: 'THOT-X', text: gptReply });
      } catch (err) {
        console.error('❌ GPT-Antwortfehler:', err.message);
        io.emit('chat message', { sender: 'THOT-X', text: '⚠️ Analyse fehlgeschlagen. Bitte später erneut versuchen.' });
      }
    }

    // 📁 Chat speichern
    let log = [];
    if (fs.existsSync(CHAT_LOG)) {
      try {
        log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      } catch (err) {
        console.error('❌ Fehler beim Lesen des Chatlogs:', err);
      }
    }

    log.push(data);

    try {
      fs.writeFileSync(CHAT_LOG, JSON.stringify(log, null, 2), 'utf8');
    } catch (err) {
      console.error('❌ Fehler beim Schreiben des Chatlogs:', err);
    }
  });

  // 🛠 Adminfunktionen
  socket.on('admin:clear', () => {
    try {
      fs.writeFileSync(CHAT_LOG, '[]', 'utf8');
      io.emit('system message', '💬 Chatlog gelöscht.');
    } catch (err) {
      console.error('❌ Fehler beim Löschen des Chatlogs:', err);
    }
  });

  socket.on('admin:toggleGPT', (state) => {
    gptEnabled = state;
    io.emit('system message', `⚠️ THOT-X wurde ${gptEnabled ? 'aktiviert' : 'deaktiviert'}.`);
  });
});

// 🚀 Start Server
http.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});
