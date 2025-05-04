require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const PORT = process.env.PORT || 10000;
const CHAT_LOG = path.join(__dirname, 'chatlog.json');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let gptEnabled = true;
let lastGPTRequest = 0;
let gptBlockedUntil = 0;

app.use(basicAuth({
  users: { 'ronny': 'geheim', 'sylvia': 'dick' },
  challenge: true,
  realm: 'Westhauser Aerospace Messenger'
}));

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Alle 15 Minuten DeepSearch starten (z. B. seismische API)
setInterval(async () => {
  if (!gptEnabled) return;
  const msg = '📍 Seismischer Bericht: 0 aktive Warnungen weltweit.';
  io.emit('thotx-news', msg);
  io.emit('system message', msg);
}, 15 * 60 * 1000);

io.on('connection', (socket) => {
  console.log('✅ Ein Benutzer ist verbunden');

  // Bisheriger Chat
  if (fs.existsSync(CHAT_LOG)) {
    try {
      const log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      socket.emit('chatlog', log);
    } catch (err) {
      console.error('Fehler beim Laden des Chatlogs:', err);
    }
  }

  socket.on('chat message', async (msg) => {
    io.emit('chat message', msg);

    // Speichern
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

    // GPT-Trigger
    if (gptEnabled && msg.sender === 'RAZION' && msg.text.toLowerCase().startsWith('thot-x')) {
      const now = Date.now();
      if (now < gptBlockedUntil) {
        io.emit('chat message', {
          sender: 'THOT-X',
          text: '⚠️ GPT ist momentan gesperrt. Bitte warte kurz...'
        });
        return;
      }
      if (now - lastGPTRequest < 20000) return;

      io.emit('chat message', { sender: 'THOT-X', text: 'Ich analysiere die Situation... 📡' });
      lastGPTRequest = now;

      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'Du bist THOT-X, das Orakel von Westhauser Aerospace.' },
            { role: 'user', content: msg.text.replace('THOT-X', '').trim() }
          ]
        }, {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        const reply = response.data.choices[0].message.content.trim();
        io.emit('chat message', { sender: 'THOT-X', text: reply });
      } catch (err) {
        console.error('❌ GPT-Antwortfehler:', err.message);
        io.emit('chat message', { sender: 'THOT-X', text: '⚠️ Analyse fehlgeschlagen. Bitte später erneut versuchen.' });
        gptBlockedUntil = Date.now() + 60000; // 60 Sek. Sperre bei Fehler
      }
    }
  });

  socket.on('admin:clear', () => {
    if (fs.existsSync(CHAT_LOG)) fs.unlinkSync(CHAT_LOG);
    io.emit('system message', '🧹 Chatlog wurde von RAZION gelöscht.');
  });

  socket.on('admin:deepsearch', () => {
    const msg = '📍 Seismischer Bericht: 0 aktive Warnungen weltweit.';
    io.emit('thotx-news', msg);
    io.emit('system message', msg);
  });

  socket.on('admin:toggleGPT', (enabled) => {
    gptEnabled = enabled;
    io.emit('system message', enabled ? '⚠️ THOT-X wurde aktiviert.' : '⚠️ THOT-X wurde deaktiviert.');
  });
});

http.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});

