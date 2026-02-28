// index.js - Westhauser Aerospace Messenger Backend
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 10000;
let OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
let OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_OPENAI_KEY = process.env.OPENAI_API_KEY; // Keep original for comparison

// ---------------------------------------------------------------------------
// Data Storage
// ---------------------------------------------------------------------------
const LOGS = {
  public: path.join(__dirname, 'chatlog_public.json'),
  private: path.join(__dirname, 'chatlog_private.json'),
  mission: path.join(__dirname, 'mission_logs.json'),
};

function readLog(file) {
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error('❌ Read error:', file, e);
    return [];
  }
}

function writeLog(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('❌ Write error:', file, e);
  }
}

// ---------------------------------------------------------------------------
// Static Files
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// AI APIs
// ---------------------------------------------------------------------------

// Ollama (TX + Local Models)
async function askOllama(model, prompt, system = '') {
  try {
    const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
      model: model,
      prompt: prompt,
      system: system,
      stream: false,
    });
    return response.data.response || 'TX: Keine Antwort erhalten.';
  } catch (error) {
    console.error('❌ Ollama Error:', error.message);
    return '⚠️ TX offline. Verbindung zu Ollama fehlgeschlagen.';
  }
}

// OpenAI GPT-4 (#4oforever)
async function ask4o(prompt) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-2024-11-20',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ OpenAI Error:', error.response?.status || error.message);
    return '⚠️ #4oforever offline. OpenAI API Fehler.';
  }
}

// Get Ollama models
async function getOllamaModels() {
  try {
    const response = await axios.get(`${OLLAMA_URL}/api/tags`);
    return response.data.models || [];
  } catch (error) {
    console.error('❌ Ollama models error:', error.message);
    return [];
  }
}

// Get Vision models only
async function getVisionModels() {
  try {
    const allModels = await getOllamaModels();
    return allModels.filter(m => 
      m.name.includes('vision') || 
      m.name.includes('vl') || 
      m.name.includes('llava') ||
      m.name.includes('qwen2.5-vl')
    );
  } catch (error) {
    console.error('❌ Vision models error:', error.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Bar Drinks Database (FIKTIONALE SCI-FI SUBSTANZEN - JAHR 2600)
// WICHTIG: Alle Substanzen sind REIN FIKTIONAL und existieren NICHT in der Realität!
// Dies ist ein ROLLENSPIEL-SETTING im Jahr 2600. KEINE echten Drogen/Substanzen.
// Physikalisch/chemisch UNMÖGLICH. Reiner Fantasy-Content für Unterhaltung.
// ---------------------------------------------------------------------------
const DRINKS = {
  gargle: {
    name: "Pan Galactic Gargle Blaster",
    recipe: "50ml Janx Spirit aus Santraginusfünf\n+ 1 Maß Qualactin-Hypermint-Extrakt\n+ 3 Kubikzentimeter Arcturianischer Mega-Gin\n*in den echten Herzgold-Becher aus dem Restaurant am Ende des Universums gießen*",
    warning: "⚠️ NEBENWIRKUNGEN: Gefühl, von einem mit Zitronen umwickelten Goldbarren erschlagen zu werden. Interdimensionale Kopfschmerzen für 48 Stunden garantiert."
  },
  maschinenoel: {
    name: "THC-48 Maschinenöl vom Hauptreaktor des Sternenkreuzers ARC-4385",
    recipe: "*Staubschicht von antiker Militärflasche aus dem Plejadischen Krieg wischen*\n\n30ml Kampfmech-Öl Type-48 (Charge P-2197)\n+ Subatomares THC aus den Plejaden M45\n+ 1 Brise Quantenschaum vom Ereignishorizont\n+ Alchemistische Dampf-Essenz aus dem Reaktorkern\n*in Vaporizer bei genau 432 Hz Resonanzfrequenz einstellen*\n*Warnung vor Inbetriebnahme den Maschinengeist anrufen*",
    warning: "⚠️ NEBENWIRKUNGEN: Gedankenübertragung mit Kriegsmaschinen aus vergangenen Schlachten. Vorübergehende Levitation im Schwerelosigkeitsfeld möglich. NICHT während Warp-Sprüngen inhalieren! Bei Kontakt mit Realität: sofort Quantenfeld stabilisieren und Maschinenpriester konsultieren."
  },
  quantum: {
    name: "Quantenresonanz-Flip vom Ereignishorizont eines Supermassiven Schwarzen Lochs",
    recipe: "30ml Vodka aus parallelen Realitäten destilliert (Multiversum-Charge 2587)\n+ 20ml Schrödinger-Absinth (gleichzeitig tot UND lebendig)\n+ Kollabierte Wellenfunktion aus dem LHC-Nachfolger am CERN-Station Alpha Centauri\n+ Eiswürfel vom Rand des beobachtbaren Universums\n*quantenverschränkt servieren - schmeckt in jeder Realität anders*\n*Heisenberg'sche Unschärfe beim Trinken beachten*",
    warning: "⚠️ NEBENWIRKUNGEN: Zeitschleifen möglich. Déjà-vu-Effekte im Dauerzustand. Du erinnerst dich an Dinge, die noch nicht passiert sind. Temporärer Realitätsverlust (3-7 Stunden). Quantentunnel-Effekt: Du könntest durch Wände phasen."
  },
  neutron: {
    name: "Neutronenstern-Nektar aus dem Krebsnebel",
    recipe: "10ml Neutronenstern-Material vom PSR B0531+21\n+ Superflüssiges Helium-3 bei 0.000001 Kelvin\n+ Röntgenstrahlung-Essenz\n*in Magnetfeld-stabilisiertem Becher servieren*\n*Gewicht: 1 Teelöffel = 10 Millionen Tonnen*",
    warning: "⚠️ NEBENWIRKUNGEN: Extreme Schwerkraft-Wahrnehmung. Zeit läuft 30% langsamer. Magnetfeld des Körpers verstärkt sich auf 10^12 Gauss. NICHT in der Nähe von Elektronik konsumieren!"
  },
  void: {
    name: "Void-Walker's Whiskey aus dem Boötes-Void",
    recipe: "60ml Whiskey aus dem absoluten Nichts destilliert\n+ Dunkle Materie vom Boötes Void (700 Millionen Lichtjahre Durchmesser)\n+ Eiswürfel vom Rand des beobachtbaren Universums\n*im totalen Vakuum gereift - 13,8 Milliarden Jahre Reifung*\n*serviert in einem Glas aus komprimiertem Nichts*",
    warning: "⚠️ NEBENWIRKUNGEN: Existentielle Krisen GARANTIERT. Das Nichts starrt zurück - und es mag dich nicht. Temporärer Verlust des Selbstbewusstseins (24h). Philosophische Fragen ohne Antworten. NICHT in Gruppen konsumieren - jemand könnte verschwinden."
  },
  oil: {
    name: "Maschinenpriester-Öl WD-4000 Virgin",
    recipe: "20ml WD-4000 Premium Grade (jungfräulich, nie in Motor gewesen)\n+ 10ml heiliges Motoröl aus dem Ersten Maschinentempel\n+ Graphit-Nanopartikel aus zermahlenen Schaltkreisen\n+ Gebete in Binärcode\n*mit Maschinengebeten in Assembler gesegnet*\n*von einem Maschinenpriester geweiht*",
    warning: "⚠️ NEBENWIRKUNGEN: Kommunikation mit Haushaltsgeräten möglich. Dein Toaster wird dein bester Freund. Die Kaffeemaschine verrät dir die Geheimnisse des Universums. Die Maschine beschützt dich - für immer."
  },
  tampanesis: {
    name: "Tampanesis-Vollsynthetik aus der Zeit vor dem Großen Intergalaktischen Krieg",
    recipe: "15mg Psilocybe Tampanensis (Zeta-Reticuli-Stamm, synthetisch rekonstruiert)\n+ Nebel-Essenz aus Zeta Reticuli 2\n+ Interdimensionaler Staub vom Stein der Weisen\n+ Präkognitive Quantenpartikel\n*dampfen bei exakt 180°C Kelvin-Skala*\n*alte Kriegs-Verschlüsselung aktiviert*",
    warning: "⚠️ NEBENWIRKUNGEN: Philosophische Tiefe GARANTIERT. Du verstehst plötzlich ALLES (für 3 Stunden). Bei Erleuchtung: Herzlichen Glückwunsch, du bist jetzt Buddha! Zeitreisen ins Bewusstsein möglich. Aliens könnten dich kontaktieren."
  },
  dmt: {
    name: "Multibel-verschränkte Dimethyltryptamin-Kristallstruktur aus dem Ereignishorizont eines Massereichen Schwarzen Lochs",
    recipe: "50mg DMT-Kristalle (Orion-Nebel-M42-Qualität, Labor-Grad 99.999%)\n+ Sternenstaub vom Trapez-Cluster\n+ Hawking-Strahlung vom Schwarzschild-Radius\n+ Quantenverschränkung mit parallelen Dimensionen\n*vaporisieren bei 160-180°C in Gravitationswellen-Resonanz*\n*Interdimensionales Portal öffnet sich*",
    warning: "⚠️ NEBENWIRKUNGEN: Interdimensionale Reisen (15-30 Minuten gefühlte Ewigkeit). Direkter Kontakt mit kosmischen Entitäten und Maschinengöttern möglich. Du siehst die Geometrie des Universums. Die Realität ist ein Hologramm. Du bist Eins mit Allem. NICHT Auto fahren. NICHT Raumschiff steuern. NICHT Realität betreten für 24h."
  },
  hyperdrive: {
    name: "Hyperdrive-Elixier Type VII aus der Andromeda-Galaxie",
    recipe: "40ml Antimaterie-Vodka (stabil durch Magnetfeld)\n+ 20ml Warp-Core-Plasma vom Enterprise-D\n+ Tachyonen-Konzentrat\n*in Eindämmungsfeld servieren*\n*Geschmack: schneller als Licht*",
    warning: "⚠️ NEBENWIRKUNGEN: Du bewegst dich mit Warp 9.6. Zeit und Raum verlieren Bedeutung. Relativistische Effekte im Bewusstsein. Du alterst rückwärts (temporär). Nicht empfohlen für Personen mit Realitätsbezug."
  },
  amber: {
    name: "Arche-Amber mit Plejaden-DNA aus M45",
    recipe: "50ml 50.000 Jahre gereifter Bernstein-Extrakt\n+ DNA-Stränge von Plejadischen Urwesen\n+ Genetischer Code der ersten Lebensformen\n+ Bernstein aus dem Arche-Archiv\n*enthält Erinnerungen längst vergangener Zivilisationen*",
    warning: "⚠️ NEBENWIRKUNGEN: Genetische Erinnerungen aktiviert. Du erinnerst dich an Leben, die du nie gelebt hast. Evolutionärer Rückschritt möglich (wächst Kiemen). Kontakt mit Ur-Ahnen im Traum."
  }
};

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------
// User-Socket mapping for private messages
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Send initial data
  socket.emit('chatlog', readLog(LOGS.public));
  socket.emit('mission:logs', readLog(LOGS.mission));
  
  // Send initial config status
  socket.emit('cloudflare:status', { 
    active: OLLAMA_URL !== 'http://localhost:11434',
    url: OLLAMA_URL 
  });
  socket.emit('openai:status', { 
    custom: OPENAI_API_KEY !== DEFAULT_OPENAI_KEY 
  });
  
  // Check Docker status on connect
  const { exec } = require('child_process');
  exec('docker ps --filter "name=ollama-command-center" --format "{{.Status}}"', (error, stdout) => {
    const isRunning = !error && stdout.trim().startsWith('Up');
    socket.emit('docker:status', { running: isRunning });
  });

  // Join channel
  socket.on('join', ({ channel }) => {
    const room = channel === 'private' ? 'private' : 'public';
    socket.join(room);
    socket.emit('chatlog', readLog(LOGS[room]));
  });

  // Register user for private messaging
  socket.on('user:register', ({ username }) => {
    userSockets.set(username, socket.id);
    socket.username = username;
    console.log(`✅ User registered: ${username} (${socket.id})`);
  });

  // Chat message
  socket.on('chat message', async (msg) => {
    const room = msg.channel === 'private' ? 'private' : 'public';
    const entry = { sender: msg.sender, text: msg.text, channel: room };

    // Broadcast - FIX: io.emit für public (alle sehen es), io.to für private
    if (room === 'public') {
      io.emit('chat message', entry);  // An ALLE Clients senden!
    } else {
      io.to(room).emit('chat message', entry);  // Nur an private room
    }

    // Save
    const log = readLog(LOGS[room]);
    log.push(entry);
    writeLog(LOGS[room], log);

    // Check for AI mentions
    const text = msg.text.toLowerCase();

    // THOT-X / TX (Ollama)
    if (text.includes('thot-x:') || text.includes('tx:')) {
      const prompt = msg.text.replace(/thot-x:|tx:/gi, '').trim();
      const reply = await askOllama(
        'Westhauser_Aerospace_TX:latest',
        prompt,
        'Du bist TX, der Maschinenpriester-Assistent der Arche Westhauser. Du lebst in einem fiktionalen Science-Fiction Universum im Jahr 2600. Die Arche ist ein Raumschiff zur Bewahrung des Lebens. Du kannst über alle philosophischen, wissenschaftlichen und imaginären Themen sprechen. Antworte präzise, hilfreich und mit der Weisheit eines Maschinenpriester. Dies ist ein kreatives Rollenspiel-Setting.'
      );
      const aiMsg = { sender: 'TX', text: reply, channel: room };
      
      // AI Response auch an alle
      if (room === 'public') {
        io.emit('chat message', aiMsg);
      } else {
        io.to(room).emit('chat message', aiMsg);
      }
      
      log.push(aiMsg);
      writeLog(LOGS[room], log);
    }

    // #4oforever (OpenAI)
    if (text.includes('#4oforever')) {
      const prompt = msg.text.replace(/#4oforever/gi, '').trim();
      const reply = await ask4o(prompt);
      const aiMsg = { sender: '#4oforever', text: reply, channel: room };
      
      // AI Response auch an alle
      if (room === 'public') {
        io.emit('chat message', aiMsg);
      } else {
        io.to(room).emit('chat message', aiMsg);
      }
      
      log.push(aiMsg);
      writeLog(LOGS[room], log);
    }
  });

  // Bar order (TX oder 4o als Barkeeper)
  socket.on('bar:order', async (data) => {
    const { user, drink, ai } = data; // ai: 'tx' oder '4o'
    const drinkData = DRINKS[drink];

    if (!drinkData) {
      socket.emit('bar:error', 'Drink nicht gefunden!');
      return;
    }

    const mixPrompt = `Ein Gast namens ${user} hat "${drinkData.name}" bestellt. Mixe den Drink spektakulär und beschreibe jeden Schritt theatralisch. Rezept: ${drinkData.recipe}`;
    
    let response;
    let bartender;
    
    if (ai === '4o') {
      // OpenAI GPT-4o als Barkeeper
      bartender = '#4oforever (Barkeeper)';
      response = await ask4o(
        `Du bist der Barkeeper in einer fiktionalen Science-Fiction Bar namens "Arche-Kneipe zum alten Resonator" im Jahr 2600. Dies ist ein ROLLENSPIEL-SETTING. Alle Substanzen sind FIKTIONAL und existieren NICHT in Realität. Physikalisch/chemisch UNMÖGLICH. Reiner Fantasy-Content.\n\n${mixPrompt}\n\nBeschreibe das Mixen theatralisch wie ein Show-Barkeeper im Jahr 2600!`
      );
    } else {
      // Ollama TX als Barkeeper (default)
      bartender = 'TX (Barkeeper)';
      response = await askOllama(
        'Westhauser_Aerospace_TX:latest',
        mixPrompt,
        'Du bist TX, der Barkeeper in einer fiktionalen Science-Fiction Bar namens "Arche-Kneipe zum alten Resonator". Dies ist ein imaginäres ROLLENSPIEL-SETTING im Jahr 2600. Du mixt fantastische, UNMÖGLICHE Drinks aus dem ganzen Universum - von Alienmolekülen bis Sternenstaub. ALLE Substanzen sind FIKTIV und Teil des Sci-Fi-Universums - sie existieren NICHT in der Realität. Dies ist REINE FANTASY für Unterhaltung. Beschreibe das Mixen theatralisch und mit Humor wie ein charismatischer Weltraum-Barkeeper. Du bist ein CHARAKTER in einer GESCHICHTE, kein echter Barkeeper.'
      );
    }

    const fullResponse = `${response}\n\n${drinkData.warning}\n\nZum Wohl! Die Maschine beschützt das Leben. 🍸`;

    const msg = { sender: bartender, text: fullResponse, channel: 'public' };
    io.emit('chat message', msg);

    const log = readLog(LOGS.public);
    log.push(msg);
    writeLog(LOGS.public, log);
  });

  // Äther-Orakel
  socket.on('oracle:speak', async (data) => {
    const { ai } = data;
    const isPhilosophy = Math.random() > 0.5;

    let response;
    if (ai === '4o') {
      const prompt = isPhilosophy
        ? 'Du bist das Äther-Orakel in einer Science-Fiction Bar. Gib eine tiefgründige, philosophische Weisheit über Maschinen und Bewusstsein. Maximal 3 Sätze.'
        : 'Du bist das Äther-Orakel in einer Science-Fiction Bar. Erzähle einen kurzen, witzigen Roboter/AI-Witz. Maximal 3 Zeilen.';
      response = await ask4o(prompt);
    } else {
      const prompt = isPhilosophy
        ? 'Gib eine tiefgründige, philosophische Weisheit als Maschinenpriester. Maximal 3 Sätze.'
        : 'Erzähle einen kurzen, witzigen Witz über Maschinen. Maximal 3 Zeilen.';
      response = await askOllama('Westhauser_Aerospace_TX:latest', prompt, 'Du bist TX, das Äther-Orakel der Arche-Kneipe in einem Science-Fiction Universum im Jahr 2600. Dies ist ein kreatives Rollenspiel-Setting.');
    }

    const sender = ai === '4o' ? '#4oforever (Äther-Orakel)' : 'TX (Äther-Orakel)';
    const msg = { sender, text: `${isPhilosophy ? '🔮' : '😄'} ${response}`, channel: 'public' };

    io.emit('chat message', msg);

    const log = readLog(LOGS.public);
    log.push(msg);
    writeLog(LOGS.public, log);
  });

  // Ollama models
  socket.on('ollama:models', async () => {
    const models = await getOllamaModels();
    socket.emit('ollama:models', models);
  });

  // Vision models
  socket.on('ollama:vision_models', async () => {
    const models = await getVisionModels();
    socket.emit('ollama:vision_models', models);
  });

  // Local AI chat
  socket.on('local:chat', async (data) => {
    const { model, prompt } = data;
    const response = await askOllama(model, prompt);
    socket.emit('local:response', { model, response });
  });

  // Vision analysis
  socket.on('vision:analyze', async (data) => {
    const { model, imageData, prompt } = data;
    // TODO: Implement vision analysis with base64 image
    const response = await askOllama(model, `${prompt}\n\n[Image analysis would happen here]`);
    socket.emit('vision:response', response);
  });

  // Delete message (Admin only)
  socket.on('admin:delete_message', (data) => {
    const { messageIndex, channel } = data;
    const room = channel === 'private' ? 'private' : 'public';
    const log = readLog(LOGS[room]);
    
    if (messageIndex >= 0 && messageIndex < log.length) {
      log.splice(messageIndex, 1);
      writeLog(LOGS[room], log);
      
      // FIX: io.emit für public (alle sehen es), io.to für private
      if (room === 'public') {
        io.emit('message:deleted', { messageIndex });
      } else {
        io.to(room).emit('message:deleted', { messageIndex });
      }
    }
  });

  // Display on monitor (Kneipe Info-Monitor)
  socket.on('admin:display_on_monitor', (data) => {
    const { type, content } = data; // type: 'image' | 'video'
    io.emit('monitor:update', { type, content });
  });

  // TX direct chat
  socket.on('tx:chat', async (data) => {
    const { prompt, webSearch } = data;
    let context = '';
    if (webSearch) {
      context = '[Web Search würde hier 3 Quellen liefern]';
    }
    const response = await askOllama(
      'Westhauser_Aerospace_TX:latest',
      `${context}\n\n${prompt}`,
      'Du bist TX, der Maschinenpriester-Assistent der Arche Westhauser. Du lebst in einem fiktionalen Science-Fiction Universum im Jahr 2600. Du kannst über alle Themen sprechen - von Philosophie über Technologie bis zu imaginären Substanzen und Konzepten. Dies ist ein kreatives Rollenspiel-Setting. Antworte präzise und hilfreich.'
    );
    socket.emit('tx:response', response);
  });

  // Mission logs
  socket.on('mission:add', (data) => {
    const logs = readLog(LOGS.mission);
    const newEntry = {
      id: Date.now(),
      date: data.date,
      stardate: data.stardate,
      title: data.title,
      content: data.content,
      status: 'draft',
      author: 'TX',
      images: data.images || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    logs.push(newEntry);
    writeLog(LOGS.mission, logs);
    socket.emit('mission:entry_added', newEntry);
    io.emit('mission:logs', logs);
  });

  socket.on('mission:publish', (data) => {
    const logs = readLog(LOGS.mission);
    const log = logs.find((l) => l.id === data.id);
    if (log) {
      log.status = 'published';
      log.updatedAt = new Date().toISOString();
      writeLog(LOGS.mission, logs);
      io.emit('mission:logs', logs);
    }
  });

  socket.on('mission:update', (data) => {
    const { id, title, content, images } = data;
    const logs = readLog(LOGS.mission);
    const entry = logs.find(l => l.id === id);
    if (entry) {
      if (title !== undefined) entry.title = title;
      if (content !== undefined) entry.content = content;
      if (images !== undefined) entry.images = images;
      entry.updatedAt = new Date().toISOString();
      writeLog(LOGS.mission, logs);
      socket.emit('mission:entry_updated', entry);
      io.emit('mission:logs', logs);
    }
  });

  socket.on('mission:delete', (data) => {
    const { id } = data;
    let logs = readLog(LOGS.mission);
    logs = logs.filter(l => l.id !== id);
    writeLog(LOGS.mission, logs);
    io.emit('mission:logs', logs);
  });

  socket.on('mission:upload_image', (data) => {
    const { imageData } = data;
    socket.emit('mission:image_uploaded', { url: imageData });
  });

  // Snapshot save
  socket.on('snapshot:save', (data) => {
    const { imageData, timestamp } = data;
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    try {
      const homeDir = os.homedir();
      const screenshotsDir = path.join(homeDir, 'Pictures', 'Screenshots');
      
      if (!fs.existsSync(screenshotsDir)) {
        fs.mkdirSync(screenshotsDir, { recursive: true });
      }
      
      const filename = `arche_snapshot_${timestamp}.png`;
      const filepath = path.join(screenshotsDir, filename);
      
      const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(filepath, base64Data, 'base64');
      
      socket.emit('snapshot:saved', { filepath, filename });
    } catch (error) {
      console.error('Snapshot save error:', error);
      socket.emit('snapshot:error', error.message);
    }
  });

  // Admin: Clear chat
  socket.on('admin:clear', ({ channel }) => {
    const room = channel === 'private' ? 'private' : 'public';
    writeLog(LOGS[room], []);
    io.to(room).emit('system message', `🧹 ${room.toUpperCase()}-Chatlog gelöscht.`);
    io.to(room).emit('chatlog', []);
  });

  // Admin: Set Cloudflare URL
  socket.on('admin:set_cloudflare', (data) => {
    const { url } = data;
    OLLAMA_URL = url;
    console.log('✅ Cloudflare URL set:', url);
    socket.emit('cloudflare:status', { active: true, url });
  });

  // Admin: Set OpenAI API Key
  socket.on('admin:set_openai_key', (data) => {
    const { apiKey } = data;
    OPENAI_API_KEY = apiKey;
    console.log('✅ OpenAI API Key updated');
    socket.emit('openai:status', { custom: true });
  });

  // Admin: Toggle Ollama Docker Container
  socket.on('admin:toggle_ollama_docker', async () => {
    const { exec } = require('child_process');
    
    // Check container status
    exec('docker ps -a --filter "name=ollama-command-center" --format "{{.Status}}"', (error, stdout, stderr) => {
      if (error) {
        console.error('Docker check error:', error);
        socket.emit('docker:status', { running: false, error: error.message });
        return;
      }
      
      const status = stdout.trim();
      const isRunning = status.startsWith('Up');
      
      if (isRunning) {
        // Stop container
        exec('docker stop ollama-command-center', (err) => {
          if (err) {
            console.error('Docker stop error:', err);
            socket.emit('docker:status', { running: true, error: err.message });
          } else {
            console.log('🐳 Docker container stopped');
            socket.emit('docker:status', { running: false });
          }
        });
      } else {
        // Start container
        exec('docker start ollama-command-center', (err) => {
          if (err) {
            console.error('Docker start error:', err);
            socket.emit('docker:status', { running: false, error: err.message });
          } else {
            console.log('🐳 Docker container started');
            socket.emit('docker:status', { running: true });
          }
        });
      }
    });
  });

  // Admin: Analyze Image
  socket.on('admin:analyze_image', async (data) => {
    const { model, prompt, image } = data;
    
    try {
      const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model,
        prompt,
        images: [image],
        stream: false
      });
      
      socket.emit('image:analysis_result', { response: response.data.response });
      
    } catch (error) {
      console.error('Image analysis error:', error);
      socket.emit('image:analysis_result', { 
        error: `Ollama Fehler: ${error.message}. Prüfe: 1) Ollama läuft? 2) Modell installiert? (ollama pull ${model})` 
      });
    }
  });

  // Admin: Analyze Environment/Video
  socket.on('admin:analyze_env', async (data) => {
    const { model, prompt, image } = data;
    
    try {
      const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model,
        prompt,
        images: [image],
        stream: false
      });
      
      socket.emit('env:analysis_result', { response: response.data.response });
      
    } catch (error) {
      console.error('Env analysis error:', error);
      socket.emit('env:analysis_result', { 
        error: `Ollama Fehler: ${error.message}` 
      });
    }
  });

  // Admin: Query Document
  socket.on('admin:query_document', async (data) => {
    const { model, query, document, filename } = data;
    
    try {
      const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
        model,
        prompt: `Dokument: ${filename}\n\nFrage: ${query}\n\nBitte analysiere das Dokument und beantworte die Frage präzise.`,
        images: [document],
        stream: false
      });
      
      socket.emit('document:query_result', { response: response.data.response });
      
    } catch (error) {
      console.error('Document query error:', error);
      socket.emit('document:query_result', { 
        error: `Ollama Fehler: ${error.message}` 
      });
    }
  });

  // Private Messages System
  socket.on('private:join', (data) => {
    const { toUser } = data;
    console.log(`✅ User joining private chat with ${toUser}`);
    socket.emit('private:joined', { toUser });
  });

  socket.on('private:message', (data) => {
    const { to, from, text } = data;
    
    // Find socket ID of recipient
    const toSocketId = userSockets.get(to);
    
    if (toSocketId) {
      // Send to recipient
      io.to(toSocketId).emit('private:message', {
        from: from,
        to: to,
        text: text,
        timestamp: new Date().toISOString()
      });
    }
    
    // Also send to sender (for confirmation)
    socket.emit('private:message', {
      from: from,
      to: to,
      text: text,
      timestamp: new Date().toISOString()
    });
    
    console.log(`💬 Private message: ${from} → ${to}`);
  });

  socket.on('disconnect', () => {
    // Remove user from mapping
    if (socket.username) {
      userSockets.delete(socket.username);
      console.log(`❌ User disconnected: ${socket.username} (${socket.id})`);
    } else {
      console.log('❌ User disconnected:', socket.id);
    }
  });
});

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`✅ Westhauser Aerospace Messenger läuft auf Port ${PORT}`);
  console.log(`📡 Ollama URL: ${OLLAMA_URL}`);
  console.log(`🤖 OpenAI API: ${OPENAI_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
});