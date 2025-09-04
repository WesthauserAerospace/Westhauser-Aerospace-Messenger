require('dotenv').config();
const express   = require('express');
const basicAuth = require('express-basic-auth');
const axios     = require('axios');
const app  = express();
const http = require('http').createServer(app);
const io   = require('socket.io')(http);
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;

const LOGS = {
  public:  path.join(__dirname, 'chatlog_public.json'),
  private: path.join(__dirname, 'chatlog_private.json'),
};
let gptEnabled = true;

// --- Basic Auth (HTTP) ---
app.use(basicAuth({
  users: { 'ronny': 'geheim', 'sylvia': 'dick' },
  challenge: true,
  realm: 'Westhauser Aerospace Messenger'
}));

// Static
app.use(express.static('public'));
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));

// GPT 3.5 helper
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

// helpers
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

// Socket
io.on('connection', (socket)=>{
  console.log('✅ Ein Benutzer ist verbunden');

  // aktueller Raum des Clients
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
    // optional: leeres chatlog pushen
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

// Start
http.listen(PORT, ()=> console.log(`✅ Server läuft auf Port ${PORT}`));
