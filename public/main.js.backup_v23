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
    
    // Enter key handlers for all chats
    const imageChatInput = document.getElementById('imageChatInput');
    if (imageChatInput) {
        imageChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendImageChat();
        });
    }
    
    const envChatInput = document.getElementById('envChatInput');
    if (envChatInput) {
        envChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendEnvChat();
        });
    }
    
    const docChatInput = document.getElementById('docChatInput');
    if (docChatInput) {
        docChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendDocChat();
        });
    }
    
    const localAIInput = document.getElementById('localAIInput');
    if (localAIInput) {
        localAIInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendLocalAI();
        });
    }
});

// ========================================
// LEAFLET MAP
// ========================================
const OLLAMA_URL = 'http://localhost:11434';
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
// LEAFLET MAP
// ========================================
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

// Quick AI Buttons in Kneipe
function askAI(type) {
    const input = document.getElementById('kneipenInput');
    const text = input.value.trim();
    
    if (!text) {
        alert('Bitte zuerst eine Nachricht eingeben!');
        return;
    }
    
    // Prefix hinzufügen
    const prefix = type === '4o' ? '#4oforever ' : 'TX: ';
    const fullMessage = prefix + text;
    
    socket.emit('chat message', { 
        sender: currentUser, 
        text: fullMessage,
        channel: currentChannel
    });
    
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
    const draft = document.getElementById('logbuchDraft').value.trim();
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
        status: 'DRAFT'
    });
    
    document.getElementById('logbuchDraft').value = '';
    alert('✅ Logbuch-Eintrag als DRAFT gespeichert!');
}

// TX Draft erstellen für Logbuch
async function createTXDraft() {
    const model = 'qwen2.5:latest'; // or get from selection
    const prompt = `Erstelle einen professionellen Logbuch-Eintrag basierend auf allen aktuellen Informationen. 

Nutze diese Informationen:
${window.lastImageAnalysis ? '- Bildanalyse: ' + window.lastImageAnalysis.result : ''}
${window.lastEnvAnalysis ? '- Umgebungsanalyse: ' + window.lastEnvAnalysis.result : ''}
${window.lastDocAnalysis ? '- Dokumentenanalyse (' + window.lastDocAnalysis.document + '): ' + window.lastDocAnalysis.result : ''}

Format:
Titel: [Kurzer prägnanter Titel]
Status: DRAFT
Inhalt: [Detaillierter Eintrag mit wichtigsten Erkenntnissen]

Antworte NUR mit dem Logbuch-Eintrag, keine zusätzlichen Erklärungen.`;

    try {
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                model,
                prompt,
                stream: false
            })
        });
        
        if (!response.ok) throw new Error('Ollama Error');
        
        const data = await response.json();
        
        // Parse TX response and fill draft field
        const draftField = document.getElementById('logbuchDraft');
        if (draftField) {
            draftField.value = data.response;
        }
        
        alert('✅ TX hat einen Entwurf erstellt! Bitte überprüfen und ggf. anpassen.');
        
    } catch (error) {
        alert('❌ Fehler beim Erstellen des Entwurfs: ' + error.message);
        console.error('TX Draft error:', error);
    }
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
        // Create image to resize
        const img = new Image();
        img.onload = () => {
            // Resize to max 800px
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const maxSize = 800;
            
            if (width > maxSize || height > maxSize) {
                if (width > height) {
                    height = (height / width) * maxSize;
                    width = maxSize;
                } else {
                    width = (width / height) * maxSize;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            
            // Convert to JPEG with quality 0.8
            const resizedDataURL = canvas.toDataURL('image/jpeg', 0.8);
            
            document.getElementById('imagePreview').innerHTML = `<img src="${resizedDataURL}" style="max-width: 100%; border-radius: 6px;">`;
            
            const monitor = document.getElementById('imageMonitor');
            monitor.innerHTML = '<div class="monitor-entry">✅ Bild optimiert und bereit zur Analyse.</div>';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function analyzeImage() {
    const imgElement = document.querySelector('#imagePreview img');
    if (!imgElement) {
        alert('Bitte zuerst ein Bild hochladen!');
        return;
    }
    
    const model = document.getElementById('visionModelSelect').value;
    if (!model) {
        alert('Bitte Vision-Modell auswählen!');
        return;
    }
    
    const prompt = document.getElementById('analysisPrompt').value.trim() || 
        'Analysiere dieses Bild detailliert. Beschreibe was du siehst, Material, Zustand, Qualität und gib eine Bewertung.';
    
    const monitor = document.getElementById('imageMonitor');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    monitor.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div>🔄 Analyse läuft...</div>`;
    monitor.scrollTop = monitor.scrollHeight;
    
    try {
        const base64Image = imgElement.src.split(',')[1];
        
        // Timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
        
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                images: [base64Image],
                stream: false
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        monitor.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div>✅ ${data.response}</div>`;
        monitor.scrollTop = monitor.scrollHeight;
        
        // Store last analysis for "Send to TX"
        window.lastImageAnalysis = {
            type: 'Bildanalyse',
            result: data.response,
            timestamp: time
        };
        
    } catch (error) {
        let errorMsg = error.message;
        if (error.name === 'AbortError') {
            errorMsg = 'Timeout nach 60s - Bild zu groß oder Ollama reagiert nicht';
        }
        monitor.innerHTML += `<div class="monitor-entry warning"><div class="monitor-timestamp">${time}</div>❌ Fehler: ${errorMsg}<br><br>Prüfe: 1) Ollama läuft? 2) Modell installiert? (ollama pull ${model})</div>`;
        monitor.scrollTop = monitor.scrollHeight;
        console.error('Image analysis error:', error);
    }
}

function sendImageToTX() {
    if (!window.lastImageAnalysis) {
        alert('Bitte zuerst eine Bildanalyse durchführen!');
        return;
    }
    
    const txBriefing = document.getElementById('txBriefing');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    txBriefing.innerHTML += `<div class="briefing-entry"><div class="briefing-timestamp">${time}</div><strong>📸 ${window.lastImageAnalysis.type}:</strong><br>${window.lastImageAnalysis.result}</div>`;
    txBriefing.scrollTop = txBriefing.scrollHeight;
    
    alert('✅ Bildanalyse an TX gesendet!');
}

function resetImageMonitor() {
    document.getElementById('imageMonitor').innerHTML = '<div class="monitor-entry">Warte auf Bild...</div>';
    window.lastImageAnalysis = null;
}

function sendImageChat() {
    const input = document.getElementById('imageChat Input');
    const text = input.value.trim();
    if (!text) return;
    
    const monitor = document.getElementById('imageMonitor');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    monitor.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div><strong>Du:</strong> ${text}</div>`;
    input.value = '';
    monitor.scrollTop = monitor.scrollHeight;
    
    // TODO: Send to Ollama for follow-up
}

// Socket response for image analysis - REMOVED, using direct fetch now
// socket.on('image:analysis_result', ...) - NOT NEEDED

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

async function analyzeEnv() {
    const video = document.getElementById('envVideo');
    if (!video || !envStream) {
        alert('Bitte zuerst Kamera aktivieren!');
        return;
    }
    
    const model = document.getElementById('envVisionModelSelect').value;
    if (!model) {
        alert('Bitte Vision-Modell wählen!');
        return;
    }
    
    const prompt = document.getElementById('envAnalysisPrompt').value.trim() || 
        'Analysiere diese Kameraaufnahme. Was siehst du? Beschreibe die Umgebung, Objekte und relevante Details.';
    
    const monitor = document.getElementById('envMonitor');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    monitor.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div>🔄 Analysiere Umgebung...</div>`;
    monitor.scrollTop = monitor.scrollHeight;
    
    try {
        // Capture frame from video and resize
        const canvas = document.createElement('canvas');
        let width = video.videoWidth;
        let height = video.videoHeight;
        const maxSize = 800;
        
        if (width > maxSize || height > maxSize) {
            if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
            } else {
                width = (width / height) * maxSize;
                height = maxSize;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(video, 0, 0, width, height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
        
        // Timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
        
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                images: [base64Image],
                stream: false
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        monitor.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div>✅ ${data.response}</div>`;
        monitor.scrollTop = monitor.scrollHeight;
        
        // Store last analysis for "Send to TX"
        window.lastEnvAnalysis = {
            type: 'Umgebungskamera-Analyse',
            result: data.response,
            timestamp: time
        };
        
    } catch (error) {
        let errorMsg = error.message;
        if (error.name === 'AbortError') {
            errorMsg = 'Timeout nach 60s - Frame zu groß oder Ollama reagiert nicht';
        }
        monitor.innerHTML += `<div class="monitor-entry warning"><div class="monitor-timestamp">${time}</div>❌ Fehler: ${errorMsg}</div>`;
        monitor.scrollTop = monitor.scrollHeight;
        console.error('Env analysis error:', error);
    }
}

function sendEnvToTX() {
    if (!window.lastEnvAnalysis) {
        alert('Bitte zuerst eine Umgebungsanalyse durchführen!');
        return;
    }
    
    const txBriefing = document.getElementById('txBriefing');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    txBriefing.innerHTML += `<div class="briefing-entry"><div class="briefing-timestamp">${time}</div><strong>📹 ${window.lastEnvAnalysis.type}:</strong><br>${window.lastEnvAnalysis.result}</div>`;
    txBriefing.scrollTop = txBriefing.scrollHeight;
    
    alert('✅ Umgebungsanalyse an TX gesendet!');
}

function resetEnvMonitor() {
    document.getElementById('envMonitor').innerHTML = '<div class="monitor-entry">Kamera bereit...</div>';
    window.lastEnvAnalysis = null;
}

function sendEnvChat() {
    const input = document.getElementById('envChatInput');
    const text = input.value.trim();
    if (!text) return;
    
    const monitor = document.getElementById('envMonitor');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    monitor.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div><strong>Du:</strong> ${text}</div>`;
    input.value = '';
    monitor.scrollTop = monitor.scrollHeight;
}

// Socket response for env analysis - REMOVED, using direct fetch now

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

let uploadedDocBase64 = null;
let uploadedDocName = null;

function handleDocUpload(input) {
    const files = input.files;
    if (!files.length) return;
    
    const list = document.getElementById('docList');
    const file = files[0]; // Take first file
    uploadedDocName = file.name;
    
    // Clear and show uploading
    list.innerHTML = `<div class="monitor-entry">📤 Lade ${file.name}...</div>`;
    
    // Read as base64
    const reader = new FileReader();
    reader.onload = (e) => {
        if (file.type.startsWith('image/')) {
            // Image file - resize it
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxSize = 800;
                
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height / width) * maxSize;
                        width = maxSize;
                    } else {
                        width = (width / height) * maxSize;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                uploadedDocBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                
                list.innerHTML = `<div class="monitor-entry">✅ Dokument geladen: ${file.name}</div>`;
                console.log('✅ Image document loaded:', file.name);
            };
            img.src = e.target.result;
        } else {
            // PDF or other - use as is
            uploadedDocBase64 = e.target.result.split(',')[1];
            list.innerHTML = `<div class="monitor-entry">✅ Dokument geladen: ${file.name}</div>`;
            console.log('✅ Document loaded:', file.name);
        }
    };
    reader.readAsDataURL(file);
}

function clearDocs() {
    document.getElementById('docList').innerHTML = '<div class="monitor-entry">Keine Dokumente</div>';
    document.getElementById('docUpload').value = '';
    uploadedDocBase64 = null;
    uploadedDocName = null;
}

function resetDocMonitor() {
    document.getElementById('docList').innerHTML = '<div class="monitor-entry">Keine Dokumente</div>';
    uploadedDocBase64 = null;
    uploadedDocName = null;
}

async function queryDocs() {
    const query = document.getElementById('docQuery').value.trim();
    const model = document.getElementById('docModelSelect').value;
    
    if (!query) {
        alert('Bitte eine Frage eingeben!');
        return;
    }
    
    if (!model) {
        alert('Bitte Vision-Modell auswählen!');
        return;
    }
    
    if (!uploadedDocBase64) {
        alert('Bitte zuerst ein Dokument hochladen!');
        return;
    }
    
    const list = document.getElementById('docList');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    list.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div>🔄 Analysiere "${uploadedDocName}"...</div>`;
    list.scrollTop = list.scrollHeight;
    
    try {
        // Timeout controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout for documents
        
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                model: model,
                prompt: `Dokument: ${uploadedDocName}\n\nFrage: ${query}\n\nBitte analysiere das Dokument und beantworte die Frage präzise auf Deutsch.`,
                images: [uploadedDocBase64],
                stream: false
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        list.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div>✅ Antwort: ${data.response}</div>`;
        list.scrollTop = list.scrollHeight;
        
        // Store last analysis for "Send to TX"
        window.lastDocAnalysis = {
            type: 'Dokumentenanalyse',
            document: uploadedDocName,
            query: query,
            result: data.response,
            timestamp: time
        };
        
    } catch (error) {
        let errorMsg = error.message;
        if (error.name === 'AbortError') {
            errorMsg = 'Timeout nach 90s - Dokument zu groß oder Ollama reagiert nicht';
        }
        list.innerHTML += `<div class="monitor-entry warning"><div class="monitor-timestamp">${time}</div>❌ Fehler: ${errorMsg}</div>`;
        list.scrollTop = list.scrollHeight;
        console.error('Document query error:', error);
    }
}

function sendDocToTX() {
    if (!window.lastDocAnalysis) {
        alert('Bitte zuerst eine Dokumentenanalyse durchführen!');
        return;
    }
    
    const txBriefing = document.getElementById('txBriefing');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    txBriefing.innerHTML += `<div class="briefing-entry"><div class="briefing-timestamp">${time}</div><strong>📄 ${window.lastDocAnalysis.type} (${window.lastDocAnalysis.document}):</strong><br>Frage: ${window.lastDocAnalysis.query}<br>Antwort: ${window.lastDocAnalysis.result}</div>`;
    txBriefing.scrollTop = txBriefing.scrollHeight;
    
    alert('✅ Dokumentenanalyse an TX gesendet!');
}

function sendDocChat() {
    const input = document.getElementById('docChatInput');
    const text = input.value.trim();
    if (!text) return;
    
    const list = document.getElementById('docList');
    const time = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    list.innerHTML += `<div class="monitor-entry"><div class="monitor-timestamp">${time}</div><strong>Du:</strong> ${text}</div>`;
    input.value = '';
    list.scrollTop = list.scrollHeight;
}

function clearImageMonitor() {
    document.getElementById('imageMonitor').innerHTML = '<div class="monitor-entry">Warte auf Bild...</div>';
    window.lastImageAnalysis = null;
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

// Socket response for document query - REMOVED, using direct fetch now

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

// ========================================
// ADMIN CONFIG CONTROLS
// ========================================
function activateCloudflare() {
    const url = document.getElementById('cloudflareUrl').value.trim();
    
    if (!url) {
        alert('Bitte Cloudflare URL eingeben!');
        return;
    }
    
    if (!url.startsWith('http')) {
        alert('URL muss mit http:// oder https:// beginnen!');
        return;
    }
    
    socket.emit('admin:set_cloudflare', { url });
    
    document.getElementById('cloudflareStatus').textContent = 'Active';
    document.getElementById('cloudflareStatus').classList.remove('inactive');
    
    console.log('✅ Cloudflare URL aktiviert:', url);
}

function updateOpenAI() {
    const apiKey = document.getElementById('openaiApiKey').value.trim();
    
    if (!apiKey) {
        alert('Bitte OpenAI API Key eingeben!');
        return;
    }
    
    if (!apiKey.startsWith('sk-')) {
        alert('OpenAI API Key sollte mit "sk-" beginnen!');
        return;
    }
    
    socket.emit('admin:set_openai_key', { apiKey });
    
    document.getElementById('openaiStatus').textContent = 'Updated';
    document.getElementById('openaiStatus').classList.remove('inactive');
    document.getElementById('openaiApiKey').value = '';
    
    console.log('✅ OpenAI API Key aktualisiert');
}

function toggleOllamaDocker() {
    socket.emit('admin:toggle_ollama_docker');
    console.log('🐳 Docker Toggle angefordert...');
}

// Docker status updates
socket.on('docker:status', (data) => {
    const statusEl = document.getElementById('dockerStatus');
    if (data.running) {
        statusEl.textContent = '● UP';
        statusEl.style.color = '#00ff88';
        statusEl.classList.remove('inactive');
    } else {
        statusEl.textContent = '○ DOWN';
        statusEl.style.color = '#ff6666';
        statusEl.classList.add('inactive');
    }
});

socket.on('cloudflare:status', (data) => {
    const statusEl = document.getElementById('cloudflareStatus');
    statusEl.textContent = data.active ? 'Active' : 'Local';
    if (!data.active) statusEl.classList.add('inactive');
});

socket.on('openai:status', (data) => {
    const statusEl = document.getElementById('openaiStatus');
    statusEl.textContent = data.custom ? 'Custom' : 'Default';
    if (!data.custom) statusEl.classList.add('inactive');
});

// ---------------------------------------------------------------------------
// Expose functions
// ---------------------------------------------------------------------------
window.switchTab = switchTab;
window.sendKneipenMessage = sendKneipenMessage;
window.handleKneipenImage = handleKneipenImage;
window.askAI = askAI;
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
window.activateCloudflare = activateCloudflare;
window.updateOpenAI = updateOpenAI;
window.toggleOllamaDocker = toggleOllamaDocker;
window.sendImageToTX = sendImageToTX;
window.sendEnvToTX = sendEnvToTX;
window.sendDocToTX = sendDocToTX;
window.resetImageMonitor = resetImageMonitor;
window.resetEnvMonitor = resetEnvMonitor;
window.resetDocMonitor = resetDocMonitor;
window.sendImageChat = sendImageChat;
window.sendEnvChat = sendEnvChat;
window.sendDocChat = sendDocChat;
window.createTXDraft = createTXDraft;