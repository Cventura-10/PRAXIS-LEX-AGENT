// PRAXIS-LEX AI Agent Client Application Logic
// Integrates Gemini 1.5 Flash API with Cloud Firestore Real-Time Database
// Built for Hypatia Labs

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. Firebase Configuration (Automatically configured)
const firebaseConfig = {
  projectId: "praxis-lex-by-hypatia-labs",
  appId: "1:241928006976:web:31eaa0d145e383decb9ea5",
  storageBucket: "praxis-lex-by-hypatia-labs.firebasestorage.app",
  apiKey: "AIzaSyDql6Bn4W8rqZVlffhuSHYTMuimlqSOE68",
  authDomain: "praxis-lex-by-hypatia-labs.firebaseapp.com",
  messagingSenderId: "241928006976",
  measurementId: "G-WGDT4SKERF"
};

// 2. Gemini API Configuration (User's API Key)
const GEMINI_API_KEY = "AIzaSyB9E-ZBdeVTCW6KfuiNFQ3swoECVWubAX0";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const todoForm = document.getElementById("todo-form");
const todoInput = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const themeToggle = document.getElementById("btn-theme-toggle");
const agentStateLabel = document.getElementById("agent-state-label");
const statSessions = document.getElementById("stat-sessions");
const statTasks = document.getElementById("stat-tasks");
const statLatency = document.getElementById("stat-latency");
const logsConsole = document.getElementById("logs-console");
const btnClearChat = document.getElementById("btn-clear-chat");

// UI Theme state
let currentTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", currentTheme);
updateThemeIcon();

themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem("theme", currentTheme);
    updateThemeIcon();
    addLog(`Tema cambiado a modo ${currentTheme === "dark" ? "Oscuro" : "Claro"}`, "info");
});

function updateThemeIcon() {
    const icon = themeToggle.querySelector("i");
    if (currentTheme === "dark") {
        icon.className = "fa-solid fa-sun";
    } else {
        icon.className = "fa-solid fa-moon";
    }
}

// LOGGING UTILITY
function addLog(text, type = "default") {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = document.createElement("div");
    logLine.className = `log-line ${type}`;
    logLine.textContent = `[${timestamp}] ${text}`;
    logsConsole.appendChild(logLine);
    logsConsole.scrollTop = logsConsole.scrollHeight;
}

// UPDATE AGENT VISUAL STATE
function setAgentState(state) {
    const avatarGlow = document.querySelector(".avatar-glow");
    const agentAvatar = document.querySelector(".agent-avatar i");
    
    agentStateLabel.textContent = state.toUpperCase();
    
    if (state === "procesando") {
        agentStateLabel.style.color = "var(--accent-purple)";
        avatarGlow.style.background = "radial-gradient(circle, var(--accent-purple-glow), transparent 70%)";
        agentAvatar.className = "fa-solid fa-brain-circuit animate-pulse";
    } else if (state === "pensando") {
        agentStateLabel.style.color = "var(--accent-cyan)";
        avatarGlow.style.background = "radial-gradient(circle, rgba(6, 182, 212, 0.4), transparent 70%)";
        agentAvatar.className = "fa-solid fa-gears animate-spin";
    } else if (state === "guardando") {
        agentStateLabel.style.color = "var(--accent-teal)";
        avatarGlow.style.background = "radial-gradient(circle, var(--accent-teal-glow), transparent 70%)";
        agentAvatar.className = "fa-solid fa-cloud-arrow-up";
    } else {
        agentStateLabel.style.color = "var(--accent-teal)";
        avatarGlow.style.background = "radial-gradient(circle, var(--accent-purple-glow), transparent 70%)";
        agentAvatar.className = "fa-solid fa-robot";
    }
}

// ==========================================
// 3. FIRESTORE REAL-TIME SYNC: PLANNER
// ==========================================
addLog("Conectando con la colección 'todos' de Firestore...", "info");

const qTodos = query(collection(db, "todos"), orderBy("createdAt", "desc"));
let totalTasks = 0;

onSnapshot(qTodos, (snapshot) => {
    todoList.innerHTML = "";
    totalTasks = snapshot.size;
    statTasks.textContent = totalTasks;
    
    if (snapshot.empty) {
        todoList.innerHTML = `
            <li class="todo-empty">
                <i class="fa-solid fa-folder-open"></i>
                <p>No hay tareas registradas aún</p>
            </li>`;
        return;
    }

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const li = document.createElement("li");
        li.className = `todo-item ${data.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <div class="todo-content-area">
                <div class="todo-checkbox ${data.completed ? 'checked' : ''}" data-id="${docSnap.id}" data-completed="${data.completed}">
                    <i class="fa-solid fa-check"></i>
                </div>
                <span class="todo-text">${data.text}</span>
            </div>
            <button class="btn-delete-task" data-id="${docSnap.id}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        todoList.appendChild(li);
    });

    // Add listeners for Checkbox toggling
    document.querySelectorAll(".todo-checkbox").forEach(box => {
        box.addEventListener("click", async (e) => {
            const id = box.getAttribute("data-id");
            const completed = box.getAttribute("data-completed") === "true";
            setAgentState("guardando");
            addLog(`Actualizando estado de tarea en Firestore: ID [${id}]`, "info");
            
            try {
                await updateDoc(doc(db, "todos", id), {
                    completed: !completed
                });
                addLog(`Tarea actualizada exitosamente. Completed: ${!completed}`, "success");
            } catch (err) {
                addLog(`Error al actualizar tarea: ${err.message}`, "error");
            } finally {
                setAgentState("libre");
            }
        });
    });

    // Add listeners for Task deleting
    document.querySelectorAll(".btn-delete-task").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const id = btn.getAttribute("data-id");
            setAgentState("guardando");
            addLog(`Eliminando tarea en Firestore: ID [${id}]`, "info");
            
            try {
                await deleteDoc(doc(db, "todos", id));
                addLog(`Tarea eliminada exitosamente.`, "success");
            } catch (err) {
                addLog(`Error al eliminar tarea: ${err.message}`, "error");
            } finally {
                setAgentState("libre");
            }
        });
    });
}, (err) => {
    addLog(`Error en sync de Firestore (todos): ${err.message}`, "error");
});

// Add Task Submit handler
todoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const taskText = todoInput.value.trim();
    if (!taskText) return;

    todoInput.value = "";
    setAgentState("guardando");
    addLog(`Guardando nueva tarea en Firestore: "${taskText}"`, "info");

    try {
        await addDoc(collection(db, "todos"), {
            text: taskText,
            completed: false,
            createdAt: serverTimestamp()
        });
        addLog("Nueva tarea agregada correctamente.", "success");
    } catch (err) {
        addLog(`Error al guardar tarea: ${err.message}`, "error");
    } finally {
        setAgentState("libre");
    }
});


// ==========================================
// 4. FIRESTORE REAL-TIME SYNC: CHAT
// ==========================================
addLog("Conectando con la colección 'messages' de Firestore...", "info");

const qMessages = query(collection(db, "messages"), orderBy("createdAt", "asc"));
let activeSessions = 1;

onSnapshot(qMessages, (snapshot) => {
    // Clear and rebuild chat UI (excluding static welcome messages)
    const staticWelcome = chatMessages.firstElementChild;
    const staticWelcomeAgent = staticWelcome.nextElementSibling;
    chatMessages.innerHTML = "";
    if (staticWelcome) chatMessages.appendChild(staticWelcome);
    if (staticWelcomeAgent) chatMessages.appendChild(staticWelcomeAgent);

    statSessions.textContent = activeSessions;

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.text) return;

        const isAgent = data.sender === "agent";
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${isAgent ? 'agent-msg' : 'user-msg'}`;

        const timeString = data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Ahora';

        messageDiv.innerHTML = `
            <div class="msg-avatar">
                <i class="fa-solid ${isAgent ? 'fa-robot' : 'fa-user'}"></i>
            </div>
            <div class="message-content">
                <div class="sender-name">${isAgent ? 'PRAXIS-LEX Agent' : 'Usuario'}</div>
                <p>${escapeHTML(data.text)}</p>
                <span class="message-time">${timeString}</span>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
}, (err) => {
    addLog(`Error en sync de Firestore (messages): ${err.message}`, "error");
});

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// Clear chat button
btnClearChat.addEventListener("click", () => {
    // Note: In real production, we'd delete documents, but locally we just reset the sessions counter
    activeSessions++;
    statSessions.textContent = activeSessions;
    chatMessages.innerHTML = "";
    addLog("Pantalla de chat limpiada localmente. Nueva sesión iniciada.", "info");
});

// ==========================================
// 5. GEMINI API CLIENT AND DISPATCH
// ==========================================
chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    chatInput.value = "";
    addLog(`Usuario escribió: "${messageText}"`, "info");

    // Add user message to Firestore
    setAgentState("guardando");
    let userDocRef;
    try {
        userDocRef = await addDoc(collection(db, "messages"), {
            text: messageText,
            sender: "user",
            createdAt: serverTimestamp()
        });
        addLog("Mensaje del usuario registrado en Firestore.", "success");
    } catch (err) {
        addLog(`Error al guardar mensaje del usuario: ${err.message}`, "error");
    }

    // Call Gemini API to generate response
    setAgentState("pensando");
    addLog("Generando respuesta del Agente con Gemini AI...", "info");
    const startTime = performance.now();

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Eres el agente de inteligencia artificial 'PRAXIS-LEX' creado por 'Hypatia Labs'. 
                        Responde de manera profesional, inteligente, servicial y amigable. 
                        Mantén tus respuestas breves y estructuradas. 
                        El usuario acaba de decir: "${messageText}"`
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);
        statLatency.textContent = `${latency} ms`;
        
        let agentReply = "No pude generar una respuesta en este momento.";
        if (result.candidates && result.candidates[0].content.parts[0].text) {
            agentReply = result.candidates[0].content.parts[0].text.trim();
        }

        addLog(`Gemini respondió con éxito en ${latency}ms.`, "success");
        
        // Save Agent Response to Firestore
        setAgentState("guardando");
        await addDoc(collection(db, "messages"), {
            text: agentReply,
            sender: "agent",
            createdAt: serverTimestamp()
        });
        addLog("Respuesta del Agente guardada en Firestore.", "success");

    } catch (err) {
        addLog(`Error al procesar con Gemini o guardar respuesta: ${err.message}`, "error");
        
        // Fallback response inside Firestore so the chat isn't stuck
        await addDoc(collection(db, "messages"), {
            text: "Lo lamento, hubo un error de conexión con la IA de Gemini. Verifica tu clave de API o conexión a Internet.",
            sender: "agent",
            createdAt: serverTimestamp()
        });
    } finally {
        setAgentState("libre");
    }
});

// Finish Init Logs
addLog("Panel de control de Hypatia Labs listo y funcionando.", "success");
setAgentState("libre");
