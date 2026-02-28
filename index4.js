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
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
// Bar Drinks Database
// ---------------------------------------------------------------------------
const DRINKS = {
  gargle: {
    name: "Pan Galactic Gargle Blaster",
    recipe: "50ml Janx Spirit aus Santraginusfünf\n+ 1 Maß Qualactin-Hypermint-Extrakt\n+ 3 Kubikzentimeter Arcturianischer Mega-Gin\n*in den echten Herzgold-Becher gießen*",
    warning: "⚠️ Gefühl, von einem mit Zitronen umwickelten Goldbarren erschlagen zu werden."
  },
  maschinenoel: {
    name: "Maschinenöl THC-48 (Plejadischer Krieg)",
    recipe: "*Staub von antiker Militärflasche wischen*\n30ml Kampfmech-Öl Type-48\n+ Subatomares THC aus den Plejaden M45\n+ 1 Brise Quantenschaum\n*in Vaporizer bei 432 Hz*",
    warning: "⚠️ Gedankenübertragung mit Maschinen. Levitation möglich."
  },
  quantum: {
    name: "Quantenresonanz-Flip vom Ereignishorizont",
    recipe: "30ml Vodka aus parallelen Realitäten\n+ 20ml Schrödinger-Absinth\n+ Kollabierte Wellenfunktion\n*quantenverschränkt servieren*",
    warning: "⚠️ Schmeckt in jeder Realität anders. Zeitschleifen möglich."
  },
  void: {
    name: "Void-Walker's Whiskey aus dem Boötes-Void",
    recipe: "60ml Whiskey aus dem Nichts destilliert\n+ Dunkle Materie vom Boötes Void\n+ Eiswürfel vom Rand des Universums",
    warning: "⚠️ Existentielle Krisen. Das Nichts starrt zurück."
  },
  oil: {
    name: "Maschinenpriester-Öl WD-4000",
    recipe: "20ml WD-4000 Premium\n+ 10ml heiliges Motoröl\n+ Graphit-Partikel\n*mit Maschinengebeten gesegnet*",
    warning: "⚠️ Kommunikation mit Haushaltsgeräten. Die Maschine beschützt dich."
  },
  tampanesis: {
    name: "Tampanesis-Nebel vom Stein der Weisen (ζ Reticuli)",
    recipe: "15mg Psilocybe Tampanensis\n+ Nebel-Essenz aus Zeta Reticuli 2\n+ Interdimensionaler Staub\n*dampfen bei 180°C*",
    warning: "⚠️ Philosophische Tiefe garantiert. Bei Erleuchtung: Glückwunsch!"
  },
  dmt: {
    name: "DMT-Kristalle aus dem Orion-Nebel M42",
    recipe: "50mg DMT-Kristalle (Orion-Qualität)\n+ Sternenstaub vom Trapez-Cluster\n*vaporisieren bei 160-180°C*",
    warning: "⚠️ Interdimensionale Reisen (15min). Kontakt mit kosmischen Entitäten."
  },
};

// ---------------------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Send initial data
  socket.emit('chatlog', readLog(LOGS.public));
  socket.emit('mission:logs', readLog(LOGS.mission));

  // Join channel
  socket.on('join', ({ channel }) => {
    const room = channel === 'private' ? 'private' : 'public';
    socket.join(room);
    socket.emit('chatlog', readLog(LOGS[room]));
  });

  // Chat message
  socket.on('chat message', async (msg) => {
    const room = msg.channel === 'private' ? 'private' : 'public';
    const entry = { sender: msg.sender, text: msg.text, channel: room };

    // Broadcast
    io.to(room).emit('chat message', entry);

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
      io.to(room).emit('chat message', aiMsg);
      log.push(aiMsg);
      writeLog(LOGS[room], log);
    }

    // #4oforever (OpenAI)
    if (text.includes('#4oforever')) {
      const prompt = msg.text.replace(/#4oforever/gi, '').trim();
      const reply = await ask4o(prompt);
      const aiMsg = { sender: '#4oforever', text: reply, channel: room };
      io.to(room).emit('chat message', aiMsg);
      log.push(aiMsg);
      writeLog(LOGS[room], log);
    }
  });

  // Bar order
  socket.on('bar:order', async (data) => {
    const { user, drink } = data;
    const drinkData = DRINKS[drink];

    if (!drinkData) {
      socket.emit('bar:error', 'Drink nicht gefunden!');
      return;
    }

    const mixPrompt = `Ein Gast namens ${user} hat "${drinkData.name}" bestellt. Mixe den Drink spektakulär und beschreibe jeden Schritt theatralisch. Rezept: ${drinkData.recipe}`;
    const response = await askOllama(
      'Westhauser_Aerospace_TX:latest',
      mixPrompt,
      'Du bist TX, der Barkeeper in einer fiktionalen Science-Fiction Bar namens "Arche-Kneipe zum alten Resonator". Dies ist ein imaginäres Rollenspiel-Setting im Jahr 2600. Du mixt fantastische, unmögliche Drinks aus dem ganzen Universum - von Alienmolekülen bis Sternenstaub. Alle Substanzen sind fiktiv und Teil des Sci-Fi-Universums. Beschreibe das Mixen theatralisch und mit Humor. Du bist ein Charakter in einer Geschichte, kein echter Barkeeper.'
    );

    const fullResponse = `${response}\n\n${drinkData.warning}\n\nZum Wohl! Die Maschine beschützt das Leben. 🍸`;

    const msg = { sender: 'TX (Barkeeper)', text: fullResponse, channel: 'public' };
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
    const log = readJSON(LOGS[room]);
    
    if (messageIndex >= 0 && messageIndex < log.length) {
      log.splice(messageIndex, 1);
      writeJSON(LOGS[room], log);
      io.to(room).emit('message:deleted', { messageIndex });
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
    logs.push({
      id: Date.now(),
      date: data.date,
      stardate: data.stardate,
      title: data.title,
      content: data.content,
      status: 'draft',
      author: 'TX',
    });
    writeLog(LOGS.mission, logs);
    io.emit('mission:logs', logs);
  });

  socket.on('mission:publish', (data) => {
    const logs = readLog(LOGS.mission);
    const log = logs.find((l) => l.id === data.id);
    if (log) {
      log.status = 'published';
      writeLog(LOGS.mission, logs);
      io.emit('mission:logs', logs);
    }
  });

  // Admin: Clear chat
  socket.on('admin:clear', ({ channel }) => {
    const room = channel === 'private' ? 'private' : 'public';
    writeLog(LOGS[room], []);
    io.to(room).emit('system message', `🧹 ${room.toUpperCase()}-Chatlog gelöscht.`);
    io.to(room).emit('chatlog', []);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
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
