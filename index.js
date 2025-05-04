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
let gptEnabled = true;
let lastDeepSearch = 0;

// 🔐 HTTP Basic Auth
app.use(basicAuth({
  users: { 'ronny': 'geheim', 'hel-3': 'dick' },
  challenge: true,
  realm: 'Westhauser Aerospace Messenger'
}));

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🌐 GPT-Funktion
async function callGPT(prompt) {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Du bist THOT-X, ein präzises KI-Orakel.' },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('❌ GPT-Antwortfehler:', err.response?.status || err.message);
    return '⚠️ Analyse fehlgeschlagen. Bitte später erneut versuchen.';
  }
}

// 🌍 THOT-X News-Funktion
async function performDeepSearch() {
  try {
    const quakeRes = await axios.get('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson');
    const numQuakes = quakeRes.data.features.length;
    const news = `📍 Seismischer Bericht: ${numQuakes} aktive Warnungen weltweit.`;
    io.emit('system message', news);
    io.emit('thotx-news', news);
  } catch (err) {
    const error = '⚠️ Fehler beim Abrufen seismischer Daten.';
    console.error(error);
    io.emit('system message', error);
  }
}

// 🔁 Auto-DeepSearch alle 15 Minuten
setInterval(() => {
  if (gptEnabled) {
    performDeepSearch();
  }
}, 15 * 60 * 1000);

io.on('connection', (socket) => {
  console.log('✅ Ein Benutzer ist verbunden');

  // 🕘 Vergangener Chat
  if (fs.existsSync(CHAT_LOG)) {
    try {
      const log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      socket.emit('chatlog', log);
    } catch (err) {
      console.error('Fehler beim Laden des Chatlogs:', err);
    }
  }

  // 💬 Neue Nachricht
  socket.on('chat message', async (data) => {
    io.emit('chat message', data);

    let log = [];
    if (fs.existsSync(CHAT_LOG)) {
      try {
        log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      } catch (err) {
        console.error('Fehler beim Lesen des Chatlogs:', err);
      }
    }

    log.push(data);
    try {
      fs.writeFileSync(CHAT_LOG, JSON.stringify(log, null, 2), 'utf8');
    } catch (err) {
      console.error('Fehler beim Schreiben des Chatlogs:', err);
    }

    // 🧠 GPT aktiv?
    if (gptEnabled && data.sender === 'RAZION' && data.text.toLowerCase().includes('thot-x')) {
      io.emit('chat message', { sender: 'THOT-X', text: 'Ich analysiere die Situation... 📡' });
      const reply = await callGPT(data.text);
      io.emit('chat message', { sender: 'THOT-X', text: reply });
    }
  });

  // 🧼 Chat löschen
  socket.on('admin:clear', () => {
    fs.writeFileSync(CHAT_LOG, '[]', 'utf8');
    io.emit('system message', '🧹 Chatlog gelöscht.');
  });

  // 🛰 DeepSearch manuell
  socket.on('admin:deepsearch', () => {
    const now = Date.now();
    if (now - lastDeepSearch >= 60 * 1000) {
      lastDeepSearch = now;
      performDeepSearch();
    } else {
      io.emit('system message', '🕒 DeepSearch ist nur einmal pro Minute erlaubt.');
    }
  });

  // 🔘 GPT ein/aus
  socket.on('admin:toggleGPT', (status) => {
    gptEnabled = status;
    const msg = gptEnabled ? '⚡️ THOT-X wurde aktiviert.' : '⚠️⚠️ THOT-X wurde deaktiviert.';
    io.emit('system message', msg);
  });
});

http.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});

