// main.js - Westhauser Aerospace Messenger Client

const socket = io();
let currentUser = null;
let currentTab = 'mission';
let currentChannel = 'public';
let envStream = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
    // User login
    while (!currentUser) {
        const name = prompt("Wer bist du? (RAZION, HEL-3, oder dein Name)").trim();
        if (name) currentUser = name.toUpperCase();
    }

    document.getElementById('userBadge').textContent = `👤 ${currentUser}`;

    // Show admin tab for RAZION
    if (currentUser === 'RAZION') {
        document.getElementById('tab-admin').style.display = 'block';
    }

    // Initialize Matrix Rain
    initMatrixRain();

    // Load Ollama models
    socket.emit('ollama:models');

    // Join public channel
    socket.emit('join', { channel: 'public' });

    // Add welcome message
    addKneipenMessage('SYSTEM', 'Willkommen in der Arche-Kneipe "Zum alten Resonator"!\nHier treffen sich Reisende, Maschinenpriester und Agenten.\n\nNutze "TX:" oder "#4oforever" um mit AI zu sprechen.');
});

// ---------------------------------------------------------------------------
// Socket.IO Events
// ---------------------------------------------------------------------------

// Chatlog history
socket.on('chatlog', (log) => {
    log.forEach(entry => {
        addKneipenMessage(entry.sender, entry.text);
    });
});

// New chat message
socket.on('chat message', (data) => {
    addKneipenMessage(data.sender, data.text);
    
    // Also show in admin monitor
    if (currentTab === 'admin') {
        const publicLog = document.getElementById('publicLog');
        const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        publicLog.innerHTML += `> [${time}] ${data.sender}: ${data.text.substring(0, 40)}...<br>`;
        publicLog.scrollTop = publicLog.scrollHeight;
    }
});

// System message
socket.on('system message', (msg) => {
    addKneipenMessage('SYSTEM', msg);
});

// Mission logs
socket.on('mission:logs', (logs) => {
    const container = document.getElementById('missionLogs');
    container.innerHTML = '';
    
    logs.filter(log => log.status === 'published').forEach(log => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <div class="log-date">${log.date} | ${log.stardate}</div>
            <div class="log-title">${log.title}</div>
            <div class="log-content">${log.content}</div>
        `;
        container.appendChild(entry);
    });
});

// TX response
socket.on('tx:response', (response) => {
    const chat = document.getElementById('txChat');
    chat.innerHTML += `<div class="message assistant"><strong>TX:</strong><br>${response}</div>`;
    chat.scrollTop = chat.scrollHeight;
});

// Local AI response
socket.on('local:response', (data) => {
    const chat = document.getElementById('localAIChat');
    chat.innerHTML += `<div class="message assistant"><strong>${data.model}:</strong><br>${data.response}</div>`;
    chat.scrollTop = chat.scrollHeight;
});

// Ollama models
socket.on('ollama:models', (models) => {
    const select = document.getElementById('localModelSelect');
    const info = document.getElementById('modelsInfo');
    
    if (models.length > 0) {
        select.innerHTML = '<option value="">Modell wählen...</option>';
        let infoText = 'Verfügbar: ';
        
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            select.appendChild(option);
            infoText += model.name + ' • ';
        });
        
        info.textContent = infoText.slice(0, -3);
    } else {
        select.innerHTML = '<option value="">Keine Modelle gefunden</option>';
        info.textContent = 'Ollama offline oder keine Modelle geladen';
    }
});

// ---------------------------------------------------------------------------
// Tab Switching
// ---------------------------------------------------------------------------
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`content-${tabName}`).classList.add('active');
}

// ---------------------------------------------------------------------------
// Kneipe Functions
// ---------------------------------------------------------------------------
function addKneipenMessage(sender, text) {
    const chat = document.getElementById('kneipenChat');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    
    let className = 'chat-msg';
    if (sender === 'SYSTEM') className += ' system';
    else if (sender === 'TX' || sender.includes('TX') || sender.includes('THOT-X')) className += ' tx';
    else if (sender.includes('Orakel') || sender.includes('#4oforever')) className += ' oracle';
    
    const msg = document.createElement('div');
    msg.className = className;
    msg.innerHTML = `
        <div class="msg-header">
            <div class="msg-sender">${sender}</div>
            <div class="msg-time">${time}</div>
        </div>
        <div class="msg-text">${text}</div>
    `;
    
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
}

function sendKneipenMessage() {
    const input = document.getElementById('kneipenInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    socket.emit('chat message', { 
        sender: currentUser, 
        text: text,
        channel: currentChannel
    });
    
    input.value = '';
}

function handleKneipenImage(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const chat = document.getElementById('kneipenChat');
        const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        msg.innerHTML = `
            <div class="msg-header">
                <div class="msg-sender">${currentUser}</div>
                <div class="msg-time">${time}</div>
            </div>
            <div class="msg-text">
                <img src="${e.target.result}" style="max-width: 100%; border-radius: 8px; margin-top: 8px;" />
            </div>
        `;
        chat.appendChild(msg);
        chat.scrollTop = chat.scrollHeight;
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function orderDrink() {
    const select = document.getElementById('barSelect');
    const drink = select.value;
    
    if (!drink) {
        alert('Bitte wähle zuerst einen Drink!');
        return;
    }
    
    socket.emit('bar:order', { user: currentUser, drink });
}

function oracleSpeak(ai) {
    socket.emit('oracle:speak', { ai });
}

// ---------------------------------------------------------------------------
// Admin Functions
// ---------------------------------------------------------------------------

// TX Chat
function sendToTXDirect() {
    const input = document.getElementById('txInput');
    const text = input.value.trim();
    const webSearch = document.getElementById('txWebSearch').checked;
    
    if (!text) return;
    
    const chat = document.getElementById('txChat');
    chat.innerHTML += `<div class="message user">${text}</div>`;
    chat.scrollTop = chat.scrollHeight;
    
    socket.emit('tx:chat', { prompt: text, webSearch });
    input.value = '';
}

function approveDraft() {
    const draft = document.getElementById('logDraft').value.trim();
    if (!draft) {
        alert('Kein Draft vorhanden!');
        return;
    }
    
    const date = new Date().toISOString().split('T')[0];
    const stardate = `${new Date().getFullYear()}.${String(Math.floor((new Date().getMonth() + 1) * 30 + new Date().getDate())).padStart(3, '0')}`;
    
    const id = Date.now();
    
    socket.emit('mission:add', {
        date,
        stardate,
        title: 'TX Log Entry',
        content: draft,
    });
    
    setTimeout(() => {
        socket.emit('mission:publish', { id });
    }, 500);
    
    document.getElementById('logDraft').value = '';
    alert('Draft freigegeben! Wird auf Frontpage veröffentlicht.');
}

// Image Analysis
function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('imagePreview').innerHTML = `<img src="${e.target.result}" style="max-width: 100%; border-radius: 6px;">`;
        
        const monitor = document.getElementById('imageMonitor');
        monitor.innerHTML = '<div class="monitor-entry">Bild geladen. Bereit zur Analyse.</div>';
    };
    reader.readAsDataURL(file);
}

function analyzeImage() {
    const monitor = document.getElementById('imageMonitor');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    monitor.innerHTML = `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div>Analyse läuft...</div>`;
    
    setTimeout(() => {
        monitor.innerHTML += `<div class="monitor-entry warning"><div class="monitor-timestamp">${time}</div>Objekt erkannt: Carbon Fiber Component</div>`;
    }, 2000);
}

function clearImageAnalysis() {
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('imageUpload').value = '';
    document.getElementById('imageMonitor').innerHTML = '<div class="monitor-entry">Warte auf Bild...</div>';
}

// Environment Camera
function toggleEnvCamera() {
    const video = document.getElementById('envVideo');
    const btn = document.getElementById('envCameraBtn');
    
    if (!envStream) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                envStream = stream;
                video.srcObject = stream;
                btn.textContent = 'Stop';
                btn.classList.add('recording');
                
                document.getElementById('overlayVideo').srcObject = stream;
            })
            .catch(err => {
                alert('Kamera-Zugriff verweigert: ' + err.message);
            });
    } else {
        envStream.getTracks().forEach(track => track.stop());
        envStream = null;
        video.srcObject = null;
        document.getElementById('overlayVideo').srcObject = null;
        btn.textContent = 'Kamera';
        btn.classList.remove('recording');
    }
}

function toggleCameraOverlay() {
    const overlay = document.getElementById('cameraOverlay');
    const btn = document.getElementById('overlayBtn');
    
    overlay.classList.toggle('active');
    
    if (overlay.classList.contains('active')) {
        btn.textContent = '📺 Schließen';
        btn.classList.add('recording');
        if (envStream) {
            document.getElementById('overlayVideo').srcObject = envStream;
        }
    } else {
        btn.textContent = '📺 Overlay';
        btn.classList.remove('recording');
    }
}

function closeCameraOverlay() {
    document.getElementById('cameraOverlay').classList.remove('active');
    document.getElementById('overlayBtn').textContent = '📺 Overlay';
    document.getElementById('overlayBtn').classList.remove('recording');
}

function captureEnv() {
    console.log('Capturing environment snapshot');
}

function analyzeEnv() {
    console.log('Analyzing environment');
}

// Local AI
function sendLocalAI() {
    const input = document.getElementById('localAIInput');
    const select = document.getElementById('localModelSelect');
    const model = select.value;
    const text = input.value.trim();
    
    if (!text || !model) {
        alert('Bitte Modell wählen und Text eingeben!');
        return;
    }
    
    const chat = document.getElementById('localAIChat');
    chat.innerHTML += `<div class="message user">${text}</div>`;
    chat.scrollTop = chat.scrollHeight;
    
    socket.emit('local:chat', { model, prompt: text });
    input.value = '';
}

function clearLocalAI() {
    document.getElementById('localAIChat').innerHTML = '';
}

// Documents
function queryDocs() {
    const query = document.getElementById('docQuery').value;
    console.log('Querying docs:', query);
}

// Send to TX
function sendToTX(source) {
    console.log('Sending', source, 'to TX');
}

// Private Messages Modal
function openPMModal(username) {
    document.getElementById('pmUsername').textContent = username;
    document.getElementById('pmModal').classList.add('active');
    document.getElementById('modalOverlay').classList.add('active');
}

function closePMModal() {
    document.getElementById('pmModal').classList.remove('active');
    document.getElementById('modalOverlay').classList.remove('active');
}

function sendPM() {
    const input = document.getElementById('pmInput');
    const text = input.value.trim();
    
    if (!text) return;
    
    console.log('Sending PM:', text);
    input.value = '';
}

function uploadImageToPM() {
    console.log('Upload image to PM');
}

function toggleCameraPM() {
    console.log('Toggle camera in PM');
}

function ask4oPM() {
    console.log('4o answering in PM');
}

function askTXPM() {
    console.log('TX answering in PM');
}

function forwardToAI() {
    console.log('Forwarding to AI');
}

// ---------------------------------------------------------------------------
// Matrix Rain
// ---------------------------------------------------------------------------
function initMatrixRain() {
    const canvas = document.getElementById('matrix-bg');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン01';
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops = [];

    for(let i = 0; i < columns; i++) {
        drops[i] = Math.random() * canvas.height / fontSize;
    }

    function draw() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#00ff00';
        ctx.font = fontSize + 'px monospace';

        for(let i = 0; i < drops.length; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(char, i * fontSize, drops[i] * fontSize);
            if(drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    }

    setInterval(draw, 33);
}

// ---------------------------------------------------------------------------
// Expose functions
// ---------------------------------------------------------------------------
window.switchTab = switchTab;
window.sendKneipenMessage = sendKneipenMessage;
window.handleKneipenImage = handleKneipenImage;
window.orderDrink = orderDrink;
window.oracleSpeak = oracleSpeak;
window.sendToTXDirect = sendToTXDirect;
window.approveDraft = approveDraft;
window.handleImageUpload = handleImageUpload;
window.analyzeImage = analyzeImage;
window.clearImageAnalysis = clearImageAnalysis;
window.toggleEnvCamera = toggleEnvCamera;
window.toggleCameraOverlay = toggleCameraOverlay;
window.closeCameraOverlay = closeCameraOverlay;
window.captureEnv = captureEnv;
window.analyzeEnv = analyzeEnv;
window.sendLocalAI = sendLocalAI;
window.clearLocalAI = clearLocalAI;
window.queryDocs = queryDocs;
window.sendToTX = sendToTX;
window.openPMModal = openPMModal;
window.closePMModal = closePMModal;
window.sendPM = sendPM;
window.uploadImageToPM = uploadImageToPM;
window.toggleCameraPM = toggleCameraPM;
window.ask4oPM = ask4oPM;
window.askTXPM = askTXPM;
window.forwardToAI = forwardToAI;