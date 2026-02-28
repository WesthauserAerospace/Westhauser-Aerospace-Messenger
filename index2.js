// index.js
require('dotenv').config();
const express   = require('express');
const basicAuth = require('express-basic-auth');
const axios     = require('axios');
const fs        = require('fs');
const path      = require('path');
const http      = require('http');
const { Server }= require('socket.io');

const app  = express();
const server = http.createServer(app);
const io   = new Server(server);

const PORT = process.env.PORT || 10000;

// ---------------------------------------------------------------------------
// Pfade & Logs
// ---------------------------------------------------------------------------
const PUBLIC_DIR = path.join(__dirname, 'public');

const LOGS = {
  public:  path.join(__dirname, 'chatlog_public.json'),
  private: path.join(__dirname, 'chatlog_private.json'),
};
let gptEnabled = true;

// ---------------------------------------------------------------------------
// Static Routing: zwei klare Einstiege
// ---------------------------------------------------------------------------

// PUBLIC (ohne Auth)
app.use('/public', express.static(PUBLIC_DIR, { index: 'index.html' }));
app.get(['/public', '/public/'], (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});
app.get('/public/*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// PRIVATE (mit Basic Auth)
app.use(
  '/private',
  basicAuth({
    users: { ronny: 'geheim', sylvia: 'dick' },
    challenge: true,
    realm: 'Westhauser Aerospace · Private',
  }),
  express.static(PUBLIC_DIR, { index: 'index.html' })
);
app.get('/private/*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Root -> Public
app.get('/', (_req, res) => res.redirect('/public'));

// ---------------------------------------------------------------------------
// GPT 3.5 Helper
// ---------------------------------------------------------------------------
async function askGPT(prompt){
  try{
    const res = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      { model:'gpt-3.5-turbo', messages:[{role:'user', content:prompt}], temperature:0.7 },
      { headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' } }
    );
    return res.data.choices[0].message.content.trim();
  }catch(err){
    console.error('❌ GPT-Antwortfehler:', err.response?.status || err.message);
    return '⚠️ Analyse fehlgeschlagen. Bitte später erneut versuchen.';
  }
}

// ---------------------------------------------------------------------------
// Log Helpers
// ---------------------------------------------------------------------------
function readLog(file){
  try{
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file,'utf8'));
  }catch(e){ console.error('Log read error', e); return []; }
}
function writeLog(file, arr){
  try{ fs.writeFileSync(file, JSON.stringify(arr,null,2), 'utf8'); }
  catch(e){ console.error('Log write error', e); }
}

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------
io.on('connection', (socket)=>{
  console.log('✅ Ein Benutzer ist verbunden');

  // Standard: Public-Raum
  let currentRoom = 'public';
  socket.join(currentRoom);
  socket.emit('chatlog', readLog(LOGS[currentRoom]));

  // Channel wechseln/joinen
  socket.on('join', ({channel})=>{
    if (!['public','private'].includes(channel)) return;
    socket.leave(currentRoom);
    currentRoom = channel;
    socket.join(currentRoom);
    socket.emit('chatlog', readLog(LOGS[currentRoom]));
  });

  // Neue Nachricht
  socket.on('chat message', async (msg)=>{
    const room = (msg.channel==='private') ? 'private' : 'public';
    const entry = { sender: msg.sender, text: msg.text, channel: room };

    // an Raum senden
    io.to(room).emit('chat message', entry);

    // speichern
    const logFile = LOGS[room];
    const log = readLog(logFile);
    log.push(entry);
    writeLog(logFile, log);

    // GPT nur auf explizite THOT-X: (und nur im selben Raum zurück)
    if (gptEnabled && /^thot-x\s*:/i.test(msg.text)) {
      const prompt = msg.text.replace(/^thot-x\s*:/i, '').trim();
      const reply  = await askGPT(prompt);
      io.to(room).emit('chat message', { sender:'THOT-X', text: reply, channel: room });
      const updated = readLog(logFile);
      updated.push({ sender:'THOT-X', text: reply, channel: room });
      writeLog(logFile, updated);
    }
  });

  // Admin: Chat löschen (raumbezogen)
  socket.on('admin:clear', ({channel})=>{
    const room = (channel==='private') ? 'private' : 'public';
    writeLog(LOGS[room], []);
    io.to(room).emit('system message', `🧹 ${room.toUpperCase()}-Chatlog wurde gelöscht.`);
    io.to(room).emit('chatlog', []);
  });

  // Admin: DeepSearch (sende News in beide Räume)
  socket.on('admin:deepsearch', async ()=>{
    try{
      const quakes = await axios.get('https://www.seismicportal.eu/fdsnws/event/1/query?limit=5&format=json');
      const msg = `📡 Seismischer Bericht: ${quakes.data?.features?.length || 0} Ereignisse weltweit.`;
      ['public','private'].forEach(room=>{
        io.to(room).emit('system message', msg);
        io.to(room).emit('thotx-news', msg);
      });
    }catch(e){
      const err = '⚠️ Fehler beim Abrufen der Seismikdaten.';
      ['public','private'].forEach(room=>{
        io.to(room).emit('system message', err);
      });
    }
  });

  // Admin: GPT an/aus
  socket.on('admin:toggleGPT', (enabled)=>{
    gptEnabled = !!enabled;
    ['public','private'].forEach(room=>{
      io.to(room).emit('system message', gptEnabled ? '⚡ THOT-X aktiviert.' : '⚠️ THOT-X deaktiviert.');
    });
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, ()=> console.log(`✅ Server läuft auf Port ${PORT}`));
