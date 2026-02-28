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
        const name = prompt("🤖 Willkommen auf der Arche Westhauser\n\nLass uns Deinen Namen wissen und trete ein:").trim();
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
    
    // Load Vision models
    socket.emit('ollama:vision_models');

    // Join public channel
    socket.emit('join', { channel: 'public' });

    // Add welcome message
    addKneipenMessage('SYSTEM', 'Willkommen in der Arche-Kneipe "Zum alten Resonator"!\nHier treffen sich Reisende, Maschinenpriester und Agenten.\n\nNutze "TX:" oder "#4oforever" um mit AI zu sprechen.');
    
    // Initialize Map (if in admin panel)
    if (document.getElementById('map')) {
        initializeMap();
    }
    
    // Initialize Solar System Canvas
    if (document.getElementById('solarCanvas')) {
        initializeSolarSystem();
    }
});

// ========================================
// LEAFLET MAP
// ========================================
let map = null;

function initializeMap() {
    try {
        map = L.map('map', {
            center: [50.2647, 7.0153], // Mayen, RLP, DE
            zoom: 7,
            zoomControl: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap, © CARTO',
            maxZoom: 19
        }).addTo(map);
        
        // Add marker for Mayen
        L.marker([50.2647, 7.0153]).addTo(map)
            .bindPopup('<b>Westhauser Aerospace</b><br>Mayen, RLP, DE')
            .openPopup();
            
        console.log('✅ Map initialized');
    } catch (error) {
        console.error('Map error:', error);
    }
}

// ========================================
// SOLAR SYSTEM CANVAS
// ========================================
function initializeSolarSystem() {
    const canvas = document.getElementById('solarCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    let angle = 0;
    
    function drawSolar() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Sun
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Planets
        const planets = [
            { radius: 30, size: 4, color: '#888', speed: 1 },
            { radius: 50, size: 6, color: '#ff8800', speed: 0.7 },
            { radius: 70, size: 7, color: '#0088ff', speed: 0.5 },
            { radius: 90, size: 5, color: '#ff0000', speed: 0.3 }
        ];
        
        planets.forEach((p, i) => {
            const a = angle * p.speed + (i * Math.PI / 2);
            const x = centerX + Math.cos(a) * p.radius;
            const y = centerY + Math.sin(a) * p.radius;
            
            // Orbit
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(centerX, centerY, p.radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // Planet
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(x, y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        angle += 0.01;
        requestAnimationFrame(drawSolar);
    }
    
    drawSolar();
    console.log('✅ Solar System initialized');
}

// ---------------------------------------------------------------------------
// Socket.IO Events
// ---------------------------------------------------------------------------

// Chatlog history
socket.on('chatlog', (log) => {
    log.forEach((entry, index) => {
        addKneipenMessage(entry.sender, entry.text, index);
    });
});

// New chat message
socket.on('chat message', (data) => {
    // Get current message count to use as index
    const chat = document.getElementById('kneipenChat');
    const messageIndex = chat.children.length;
    addKneipenMessage(data.sender, data.text, messageIndex);
    
    // Also show in admin monitor
    if (currentTab === 'admin') {
        const publicLog = document.getElementById('publicLog');
        const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        publicLog.innerHTML += `> [${time}] ${data.sender}: ${data.text.substring(0, 40)}...<br>`;
        publicLog.scrollTop = publicLog.scrollHeight;
    }
});

// Message deleted
socket.on('message:deleted', (data) => {
    const { messageIndex } = data;
    const chat = document.getElementById('kneipenChat');
    const messages = chat.querySelectorAll('.chat-msg');
    if (messages[messageIndex]) {
        messages[messageIndex].remove();
    }
});

// System message
socket.on('system message', (msg) => {
    addKneipenMessage('SYSTEM', msg);
});

// Mission logs
socket.on('mission:logs', (logs) => {
    // Frontpage (Mission Log Tab)
    const container = document.getElementById('missionLogs');
    if (container) {
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
    }
    
    // Admin Panel (Mission Entries List)
    const adminList = document.getElementById('missionEntries');
    if (adminList) {
        if (logs.length === 0) {
            adminList.innerHTML = '<div style="font-size: 10px; color: #66bbff; text-align: center; padding: 10px;">Keine Einträge</div>';
        } else {
            adminList.innerHTML = '';
            logs.forEach(log => {
                const item = document.createElement('div');
                item.className = 'mission-entry-item';
                item.innerHTML = `
                    <div class="mission-meta">
                        <span class="mission-date">${log.date}</span>
                        <span class="mission-status ${log.status}">${log.status.toUpperCase()}</span>
                    </div>
                    <div class="mission-title-small">${log.title}</div>
                    <div class="mission-actions">
                        <button class="btn-mini" onclick="editMissionEntry(${log.id})">✏️</button>
                        <button class="btn-mini btn-delete" onclick="deleteMissionEntry(${log.id})">🗑️</button>
                        ${log.status === 'draft' ? `<button class="btn-mini btn-publish" onclick="publishMissionEntry(${log.id})">✅</button>` : ''}
                    </div>
                `;
                adminList.appendChild(item);
            });
        }
    }
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

// Ollama models (ALL models for all dropdowns)
socket.on('ollama:models', (models) => {
    const selects = [
        document.getElementById('localModelSelect'),
        document.getElementById('docModelSelect'),
        document.getElementById('visionModelSelect'),
        document.getElementById('envVisionModelSelect')
    ];
    
    const info = document.getElementById('modelsInfo');
    
    if (models.length > 0) {
        let infoText = 'Verfügbar: ';
        
        selects.forEach(select => {
            if (select) {
                select.innerHTML = '<option value="">Modell wählen...</option>';
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = model.name;
                    select.appendChild(option);
                });
            }
        });
        
        models.forEach(model => {
            infoText += model.name + ' • ';
        });
        
        if (info) info.textContent = infoText.slice(0, -3);
    } else {
        selects.forEach(select => {
            if (select) select.innerHTML = '<option value="">Keine Modelle gefunden</option>';
        });
        if (info) info.textContent = 'Ollama offline oder keine Modelle geladen';
    }
});

// Vision models event (deprecated - we use all models now)
socket.on('ollama:vision_models', (models) => {
    // Ignore - we load all models above
});

// Monitor update (Info-Monitor in Kneipe)
socket.on('monitor:update', (data) => {
    const monitor = document.getElementById('infoMonitor');
    const content = document.getElementById('monitorContent');
    
    if (data.type === 'image') {
        content.innerHTML = `<img src="${data.content}" style="width: 100%; height: auto; border-radius: 8px;" />`;
    } else if (data.type === 'video') {
        content.innerHTML = `<video src="${data.content}" autoplay loop style="width: 100%; height: auto;"></video>`;
    }
    
    monitor.style.display = 'block';
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
function addKneipenMessage(sender, text, messageIndex) {
    const chat = document.getElementById('kneipenChat');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    
    let className = 'chat-msg';
    if (sender === 'SYSTEM') className += ' system';
    else if (sender === 'TX' || sender.includes('TX') || sender.includes('THOT-X')) className += ' tx';
    else if (sender.includes('Orakel') || sender.includes('#4oforever')) className += ' oracle';
    
    const msg = document.createElement('div');
    msg.className = className;
    msg.dataset.index = messageIndex || 0;
    
    let deleteButton = '';
    if (currentUser === 'RAZION' && messageIndex !== undefined) {
        deleteButton = `<button class="delete-msg-btn" onclick="deleteKneipenMessage(${messageIndex})">×</button>`;
    }
    
    msg.innerHTML = `
        ${deleteButton}
        <div class="msg-header">
            <div class="msg-sender">${sender}</div>
            <div class="msg-time">${time}</div>
        </div>
        <div class="msg-text">${text}</div>
    `;
    
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
}

function deleteKneipenMessage(index) {
    if (!confirm('Nachricht löschen?')) return;
    socket.emit('admin:delete_message', { 
        messageIndex: index, 
        channel: 'public' 
    });
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

function orderDrink(ai) {
    const select = document.getElementById('barSelect');
    const drink = select.value;
    
    if (!drink) {
        alert('Bitte wähle zuerst einen Drink!');
        return;
    }
    
    socket.emit('bar:order', { 
        user: currentUser, 
        drink,
        ai  // 'tx' oder '4o'
    });
    
    const bartender = ai === '4o' ? '#4oforever' : 'TX';
    addKneipenMessage('SYSTEM', `${currentUser} bestellt bei ${bartender}: ${select.options[select.selectedIndex].text}`);
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
    
    socket.emit('mission:add', {
        date,
        stardate,
        title: 'TX Log Entry',
        content: draft,
    });
    
    document.getElementById('logDraft').value = '';
}

// Wait for entry_added event, then publish
socket.on('mission:entry_added', (entry) => {
    // Auto-publish immediately
    socket.emit('mission:publish', { id: entry.id });
    alert('Draft freigegeben und veröffentlicht!');
});

// Mission Entry Management
function editMissionEntry(id) {
    // Find entry in current logs
    fetch('/api/mission_logs.json')
        .then(r => r.json())
        .then(logs => {
            const entry = logs.find(l => l.id === id);
            if (entry) {
                document.getElementById('logDraft').value = entry.content;
                // Note: This loads into draft, user can edit and save as new or delete old one
                alert('Eintrag in Draft geladen. Bearbeite und speichere neu, oder lösche den alten.');
            }
        });
}

function deleteMissionEntry(id) {
    if (!confirm('Logbuch-Eintrag wirklich löschen?')) return;
    socket.emit('mission:delete', { id });
}

function publishMissionEntry(id) {
    socket.emit('mission:publish', { id });
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
    const status = document.getElementById('envStatus');
    
    if (!envStream) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                envStream = stream;
                video.srcObject = stream;
                btn.textContent = 'Stop';
                btn.classList.add('recording');
                status.textContent = '● LIVE';
                status.style.color = '#00ff88';
                
                document.getElementById('overlayVideo').srcObject = stream;
            })
            .catch(err => {
                alert('Kamera-Zugriff verweigert: ' + err.message);
                status.textContent = 'Zugriff verweigert';
                status.style.color = '#ff6666';
            });
    } else {
        envStream.getTracks().forEach(track => track.stop());
        envStream = null;
        video.srcObject = null;
        document.getElementById('overlayVideo').srcObject = null;
        btn.textContent = 'Kamera';
        btn.classList.remove('recording');
        status.textContent = 'Kamera bereit';
        status.style.color = '#66bbff';
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
    const video = document.getElementById('envVideo');
    if (!video.srcObject) {
        alert('Kamera ist nicht aktiv!');
        return;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/png');
    
    // Show in preview
    const monitor = document.getElementById('envMonitor');
    monitor.innerHTML = `<div class="monitor-entry"><img src="${imageData}" style="max-width: 100%; border-radius: 6px; margin-top: 8px;" /></div>`;
    
    // Save to file
    const timestamp = Date.now();
    socket.emit('snapshot:save', { imageData, timestamp });
}

// Snapshot saved confirmation
socket.on('snapshot:saved', (data) => {
    const { filepath, filename } = data;
    const status = document.getElementById('envStatus');
    status.textContent = `✅ Gespeichert: ${filename}`;
    status.style.color = '#00ff88';
    setTimeout(() => {
        status.textContent = '● LIVE';
        status.style.color = '#00ff88';
    }, 3000);
});

socket.on('snapshot:error', (error) => {
    alert('Snapshot Fehler: ' + error);
});

function analyzeEnv() {
    const model = document.getElementById('envVisionModelSelect').value;
    if (!model) {
        alert('Bitte Vision-Modell wählen!');
        return;
    }
    
    const monitor = document.getElementById('envMonitor');
    monitor.innerHTML += '<div class="monitor-entry">Analysiere Umgebung...</div>';
    
    // TODO: Send to vision API
    setTimeout(() => {
        monitor.innerHTML += '<div class="monitor-entry">Analyse: Produktionsraum mit Equipment erkannt</div>';
    }, 2000);
}

function displayOnMonitor(type) {
    if (type === 'video' && envStream) {
        // Send video stream to Info-Monitor
        socket.emit('admin:display_on_monitor', { type: 'video', content: 'stream' });
    } else if (type === 'image') {
        // Get current image from preview
        const img = document.querySelector('#imagePreview img');
        if (img) {
            socket.emit('admin:display_on_monitor', { type: 'image', content: img.src });
        }
    }
}

function closeInfoMonitor() {
    document.getElementById('infoMonitor').style.display = 'none';
}

function openPrivateChatToAdmin() {
    alert('Private Chat zum Maschinenpriester - Coming Soon!\n\nDiese Funktion wird im nächsten Update verfügbar sein.');
}

function handleDocUpload(input) {
    const files = input.files;
    if (!files.length) return;
    
    const list = document.getElementById('docList');
    list.innerHTML = '';
    
    for (let file of files) {
        const entry = document.createElement('div');
        entry.className = 'monitor-entry';
        entry.textContent = `📄 ${file.name}`;
        list.appendChild(entry);
    }
}

function clearDocs() {
    document.getElementById('docList').innerHTML = '<div class="monitor-entry">Keine Dokumente</div>';
    document.getElementById('docUpload').value = '';
}

function clearImageMonitor() {
    document.getElementById('imageMonitor').innerHTML = '<div class="monitor-entry">Warte auf Bild...</div>';
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
window.editMissionEntry = editMissionEntry;
window.deleteMissionEntry = deleteMissionEntry;
window.publishMissionEntry = publishMissionEntry;
window.deleteKneipenMessage = deleteKneipenMessage;
window.handleImageUpload = handleImageUpload;
window.analyzeImage = analyzeImage;
window.clearImageAnalysis = clearImageAnalysis;
window.clearImageMonitor = clearImageMonitor;
window.toggleEnvCamera = toggleEnvCamera;
window.toggleCameraOverlay = toggleCameraOverlay;
window.closeCameraOverlay = closeCameraOverlay;
window.captureEnv = captureEnv;
window.analyzeEnv = analyzeEnv;
window.displayOnMonitor = displayOnMonitor;
window.closeInfoMonitor = closeInfoMonitor;
window.openPrivateChatToAdmin = openPrivateChatToAdmin;
window.sendLocalAI = sendLocalAI;
window.clearLocalAI = clearLocalAI;
window.queryDocs = queryDocs;
window.handleDocUpload = handleDocUpload;
window.clearDocs = clearDocs;
window.sendToTX = sendToTX;
window.openPMModal = openPMModal;
window.closePMModal = closePMModal;
window.sendPM = sendPM;
window.uploadImageToPM = uploadImageToPM;
window.toggleCameraPM = toggleCameraPM;
window.ask4oPM = ask4oPM;
window.askTXPM = askTXPM;
window.forwardToAI = forwardToAI;