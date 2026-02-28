require('dotenv').config();
const express = require('express');
const basicAuth = require('express-basic-auth');
const axios = require('axios');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
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

// 🌍 Statischer Ordner
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🌐 GPT-Kommunikation (GPT-3.5)
async function askGPT(prompt) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ GPT-Antwortfehler:', error.response?.status || error.message);
    return '⚠️ Analyse fehlgeschlagen. Bitte später erneut versuchen.';
  }
}

// 🔌 WebSocket-Logik
io.on('connection', (socket) => {
  console.log('✅ Ein Benutzer ist verbunden');

  // 📜 Bestehenden Chat senden
  if (fs.existsSync(CHAT_LOG)) {
    try {
      const log = JSON.parse(fs.readFileSync(CHAT_LOG, 'utf8'));
      socket.emit('chatlog', log);
    } catch (err) {
      console.error('Fehler beim Laden des Chatlogs:', err);
    }
  }

  // 📥 Neue Nachricht empfangen
  socket.on('chat message', async (msg) => {
    io.emit('chat message', msg);

    // 🧠 GPT-Reaktion
    if (gptEnabled && msg.sender === 'RAZION' && msg.text.toUpperCase().startsWith('THOT-X:')) {
      const prompt = msg.text.replace(/^THOT-X:\s*/i, '').trim();
      const reply = await askGPT(prompt);
      io.emit('chat message', { sender: 'THOT-X', text: reply });
    }

    // 📚 Speichern
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

  // ⚙️ Adminfunktionen
  socket.on('admin:clear', () => {
    fs.writeFileSync(CHAT_LOG, '[]', 'utf8');
    io.emit('system message', '🧹 Chatlog wurde gelöscht.');
  });

  socket.on('admin:toggleGPT', (enabled) => {
    gptEnabled = enabled;
    io.emit('system message', enabled ? '⚡ THOT-X wurde aktiviert.' : '⚠️ THOT-X wurde deaktiviert.');
  });

  socket.on('admin:deepsearch', async () => {
    try {
      const quakes = await axios.get('https://www.seismicportal.eu/fdsnws/event/1/query?limit=5&format=json');
      const msg = `📡 Seismischer Bericht: ${quakes.data?.features?.length || 0} aktive Warnungen weltweit.`;
      io.emit('system message', msg);
      io.emit('thotx-news', msg);
    } catch (err) {
      io.emit('system message', '⚠️ Fehler beim Abrufen der Seismikdaten.');
    }
  });
});

// 🚀 Start
http.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});

