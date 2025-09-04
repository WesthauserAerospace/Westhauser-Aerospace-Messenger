// index.js
const express = require('express');
const basicAuth = require('express-basic-auth');
const http = require('http');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// getrennte Chatlogs
const LOG_PUBLIC  = path.join(__dirname, 'chatlog-public.json');
const LOG_PRIVATE = path.join(__dirname, 'chatlog-private.json');

// --- Helpers ---------------------------------------------------------------
function readLog(which) {
  const file = which === 'private' ? LOG_PRIVATE : LOG_PUBLIC;
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
}

function writeLog(which, data) {
  const file = which === 'private' ? LOG_PRIVATE : LOG_PUBLIC;
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8'); }
  catch (e) { console.error('Log write error:', e.message); }
}

function channelFromReferer(req) {
  // /private... -> private, sonst public
  const ref = (req.headers?.referer || '').toLowerCase();
  return /\/private(\/|$)/.test(ref) ? 'private' : 'public';
}

// --- Security / Performance Middlewares -----------------------------------
app.use(helmet({
  contentSecurityPolicy: false, // Socket.IO default
}));
app.use(compression());

// --- Static Routing: zwei klare Einstiege ---------------------------------
// Öffentlich
app.use('/public', express.static(path.join(__dirname, 'public')));
// Private – mit Basic Auth
app.use(
  '/private',
  basicAuth({
    users: { ronny: 'geheim', sylvia: 'dick' }, // <- wie gehabt
    challenge: true,
    realm: 'Westhauser Aerospace · Private',
  }),
  express.static(path.join(__dirname, 'public'))
);

// Fallbacks auf index.html (damit relative Pfade funktionieren)
app.get('/public*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/private*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Root – optional auf public umleiten
app.get('/', (_req, res) => res.redirect('/public'));

// --- Socket.IO -------------------------------------------------------------
io.on('connection', (socket) => {
  // Kanal aus Referer bestimmen
  let currentChannel = channelFromReferer(socket.request);

  // in Room joinen
  socket.join(currentChannel);

  // Initiales Chatlog für diesen Kanal schicken
  socket.emit('chatlog', readLog(currentChannel));

  // explizites Join (z.B. wenn UI umschaltet)
  socket.on('join', ({ channel }) => {
    const target = channel === 'private' ? 'private' : 'public';
    socket.leave(currentChannel);
    currentChannel = target;
    socket.join(currentChannel);
    socket.emit('chatlog', readLog(currentChannel));
  });

  // normale Chatnachrichten
  socket.on('chat message', (data) => {
    const msg = {
      sender: (data?.sender || 'Unbekannt').toUpperCase(),
      text: String(data?.text || ''),
      channel: (data?.channel === 'private') ? 'private' : (data?.channel === 'public') ? 'public' : currentChannel,
      ts: Date.now(),
    };
    if (!msg.text.trim()) return;

    // ins passende Log schreiben
    const log = readLog(msg.channel);
    log.push({ sender: msg.sender, text: msg.text, channel: msg.channel, ts: msg.ts });
    writeLog(msg.channel, log);

    // an alle im Kanal
    io.to(msg.channel).emit('chat message', msg);
  });

  // Admin: Chat leeren
  socket.on('admin:clear', ({ channel }) => {
    const which = channel === 'private' ? 'private' : 'public';
    writeLog(which, []);
    io.to(which).emit('system message', 'Chatlog wurde geleert.');
    io.to(which).emit('chatlog', []); // UI sofort leeren
  });

  // Admin: DeepSearch manuell (hier nur Event weiterreichen – deine bestehende Logik nutzt das)
  socket.on('admin:deepsearch', ({ channel }) => {
    const which = channel === 'private' ? 'private' : 'public';
    io.to(which).emit('system message', 'DeepSearch gestartet …');
    // -> deine bestehende DeepSearch-Implementierung (Seismo/Solar) bleibt unberührt
  });

  // Admin: GPT an/aus toggeln (Flag an Clients)
  socket.on('admin:toggleGPT', (enabled) => {
    io.emit('system message', `THOT-X wurde ${enabled ? 'aktiviert' : 'deaktiviert'}.`);
  });
});

// --- Start -----------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});
