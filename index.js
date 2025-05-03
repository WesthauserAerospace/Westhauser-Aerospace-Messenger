const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const CHAT_LOG = path.join(__dirname, 'chatlog.json');

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
  console.log('Ein Benutzer ist verbunden');

  // Lade bisherigen Chat
  if (fs.existsSync(CHAT_LOG)) {
    const log = JSON.parse(fs.readFileSync(CHAT_LOG));
    socket.emit('chatlog', log);
  }

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);

    let log = [];
    if (fs.existsSync(CHAT_LOG)) {
      log = JSON.parse(fs.readFileSync(CHAT_LOG));
    }
    log.push(msg);
    fs.writeFileSync(CHAT_LOG, JSON.stringify(log, null, 2));
  });
});

// <<< DIESE Klammer war zu viel oder falsch platziert! >>>
http.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
});

