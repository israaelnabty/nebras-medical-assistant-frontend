// =====================
// Configuration
// =====================
const API_URL = 'https://israaelnabty-nebraschatbotapi.hf.space/generate';

// =====================
// State Management
// =====================
let historyExchangesCount = 3; // Number of previous exchanges to include in context
let currentConversation = [];
let conversations = [];
let currentConversationId = null;
let analytics = {
    totalMessages: 0,
    totalConversations: 0,
    apiCalls: 0,
    averageResponseTime: 0,
    responseTimes: []
};

// =====================
// DOM Elements
// =====================
const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const loading = document.getElementById('loading');
const apiStatus = document.getElementById('apiStatus');
const themeToggle = document.getElementById('themeToggle');
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('closeSidebar');
const newChatBtn = document.getElementById('newChatBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const conversationList = document.getElementById('conversationList');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const statsBtn = document.getElementById('statsBtn');
const statsModal = document.getElementById('statsModal');
const exportModal = document.getElementById('exportModal');
const statsContent = document.getElementById('statsContent');

// =====================
// Initialization
// =====================
function init() {
    loadFromLocalStorage();
    checkAPIHealth();
    loadTheme();
    createNewConversation();
    attachEventListeners();
    userInput.focus();
}

// =====================
// Local Storage Management
// =====================
function loadFromLocalStorage() {
    const savedConversations = localStorage.getItem('nebras_conversations');
    const savedAnalytics = localStorage.getItem('nebras_analytics');
    
    if (savedConversations) {
        conversations = JSON.parse(savedConversations);
    }
    
    if (savedAnalytics) {
        analytics = JSON.parse(savedAnalytics);
    }
    
    renderConversationList();
}

function saveToLocalStorage() {
    localStorage.setItem('nebras_conversations', JSON.stringify(conversations));
    localStorage.setItem('nebras_analytics', JSON.stringify(analytics));
}

function loadTheme() {
    const savedTheme = localStorage.getItem('nebras_theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function saveTheme(theme) {
    localStorage.setItem('nebras_theme', theme);
}

// =====================
// API Functions
// =====================
async function checkAPIHealth() {
    try {
        const response = await fetch(API_URL.replace('/generate', '/'));
        if (response.ok) {
            apiStatus.textContent = 'API: Connected';
            apiStatus.className = 'api-status connected';
        } else {
            apiStatus.textContent = 'API: Error';
            apiStatus.className = 'api-status disconnected';
        }
    } catch (error) {
        apiStatus.textContent = 'API: Offline';
        apiStatus.className = 'api-status disconnected';
    }
}

function buildPrompt() {
    // Take last n exchanges (2n messages) from currentConversation
    const recentMessages = currentConversation.slice(-2*historyExchangesCount); 

    let context = "";
    recentMessages.forEach(msg => {
        if (msg.role === 'user') {
            context += `Previous Q: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
            context += `Previous A: ${msg.content}\n`;
        }
    });

    const currentMessage = userInput.value.trim();

    const prompt = `
    You are a medical assistant. Provide accurate, concise, professional medical advice in 1-3 sentences.
    Important: Always recommend consulting a healthcare provider for diagnosis and treatment.

    Conversation History:
    ${context}

    Current Question: ${currentMessage}

    Your Response:
    `;
    return prompt;
}

async function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message) return;

    // If this is the first user message of a new conversation
    if (!currentConversationId) {
        currentConversationId = Date.now().toString();
        const title = message.substring(0, 40) + 
            (message.length > 40 ? '...' : '');

        const conversation = {
            id: currentConversationId,
            title: title || 'New Conversation',
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        conversations.unshift(conversation);
        analytics.totalConversations++;

        renderConversationList();
        saveToLocalStorage();
    }
    
    // Add user message
    addMessage(message, true);
    userInput.value = '';
    
    // Update analytics
    analytics.totalMessages++;
    analytics.apiCalls++;
    
    // Show loading
    loading.classList.add('active');
    sendBtn.disabled = true;
    
    const startTime = Date.now();
    
    try {
        const fullPrompt = buildPrompt();

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: fullPrompt
            })
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Update analytics
        analytics.responseTimes.push(responseTime);
        analytics.averageResponseTime = 
            analytics.responseTimes.reduce((a, b) => a + b, 0) / analytics.responseTimes.length;
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        addMessage(data.response, false);
        
    } catch (error) {
        console.error('Error:', error);
        addMessage('Sorry, I encountered an error. Please make sure the API is running and try again.', false);
    } finally {
        loading.classList.remove('active');
        sendBtn.disabled = false;
        userInput.focus();
        
        // Save conversation and analytics
        updateCurrentConversation();
        saveToLocalStorage();
    }
}

// =====================
// Message Management
// =====================
let welcomeMessage = `
    <div class="message assistant">
        <div class="message-content">
            🥼 Hi! I'm Nebras 🤖, your AI medical assistant. How can I help you today?
        </div>
    </div>
`;

function addMessage(content, isUser) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Add to current conversation
    currentConversation.push({
        role: isUser ? 'user' : 'assistant',
        content: content,
        timestamp: new Date().toISOString()
    });
}

function clearChat() {
    showConfirmModal({
        title: 'Clear Chat',
        message: 'Are you sure you want to clear this chat?',
        onConfirm: () => {
            // Remove current conversation from the list if it exists
            if (currentConversationId) {
                conversations = conversations.filter(c => c.id !== currentConversationId);
                analytics.totalConversations = Math.max(analytics.totalConversations - 1, 0);
                saveToLocalStorage();
                renderConversationList();
            }
            
            createNewConversation();
            sidebar.classList.remove('active');
        }
    });
}

function clearAllHistory() {
    showConfirmModal({
        title: 'Clear All Chats',
        message: 'Are you sure you want to delete ALL chat history? This cannot be undone.',
        onConfirm: () => {
            conversations = [];
        analytics = {
            totalMessages: 0,
            totalConversations: 0,
            apiCalls: 0,
            averageResponseTime: 0,
            responseTimes: []
        };
        saveToLocalStorage();
        renderConversationList();
        createNewConversation();
        sidebar.classList.remove('active');
        }
    });
}

// =====================
// Conversation Management
// =====================
function createNewConversation() {
    chatContainer.innerHTML = welcomeMessage;
    currentConversationId = null;
    currentConversation = [];
    showDisclaimerModal();
}

function updateCurrentConversation() {
    if (!currentConversationId) 
        return;

    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) 
        return;

    // ❌ If no user messages → remove conversation entirely
    const hasUserMessage = currentConversation.some(m => m.role === 'user');    
    if (!hasUserMessage) {
        conversations = conversations.filter(c => c.id !== currentConversationId);
        analytics.totalConversations = Math.max(analytics.totalConversations - 1, 0);
        currentConversationId = null;
        renderConversationList();
        return;
    }
    
    // ✔ Otherwise save conversation
    conversation.messages = [...currentConversation];
    conversation.updatedAt = new Date().toISOString();
    
    renderConversationList();    
}

function loadConversation(id) {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;
    
    currentConversationId = id;
    currentConversation = [...conversation.messages];

    // Clear and reload chat
    chatContainer.innerHTML = '';
    
    if (currentConversation.length === 0) {
        chatContainer.innerHTML = welcomeMessage;
    } else {
        currentConversation.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role === 'user' ? 'user' : 'assistant'}`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = msg.content;
            
            messageDiv.appendChild(contentDiv);
            chatContainer.appendChild(messageDiv);
        });
    }
    
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Re-render conversation list to update active state
    renderConversationList();

    sidebar.classList.remove('active');
}

function renderConversationList() {
    conversationList.innerHTML = '';
    
    if (conversations.length === 0) {
        conversationList.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">No conversations yet</p>';
        return;
    }
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        if (conv.id === currentConversationId) {
            item.classList.add('active');
        }
        item.onclick = () => loadConversation(conv.id);
        
        const title = document.createElement('h4');
        title.textContent = conv.title;
        
        const date = document.createElement('p');
        date.textContent = new Date(conv.updatedAt).toLocaleString();
        
        item.appendChild(title);
        item.appendChild(date);
        conversationList.appendChild(item);
    });
}

// =====================
// Theme Management
// =====================
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.body.setAttribute('data-theme', newTheme);
    saveTheme(newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('.theme-icon');
    icon.textContent = theme === 'light' ? '🌙' : '☀️';
}

// =====================
// Export Functions
// =====================
function exportAsText() {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation || conversation.messages.length === 0) {
        alert('No messages to export');
        return;
    }
    
    let text = `Nebras Conversation - ${conversation.title}\n`;
    text += `Date: ${new Date(conversation.createdAt).toLocaleString()}\n`;
    text += `${'='.repeat(50)}\n\n`;
    
    conversation.messages.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : 'Nebras';
        text += `${role}: ${msg.content}\n\n`;
    });
    
    downloadFile(text, `nebras-conversation-${Date.now()}.txt`, 'text/plain');
}

function exportAsJson() {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation || conversation.messages.length === 0) {
        alert('No messages to export');
        return;
    }
    
    const json = JSON.stringify(conversation, null, 2);
    downloadFile(json, `nebras-conversation-${Date.now()}.json`, 'application/json');
}

function exportAsHtml() {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation || conversation.messages.length === 0) {
        alert('No messages to export');
        return;
    }
    
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nebras Conversation - ${conversation.title}</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .message {
            margin: 15px 0;
            padding: 15px;
            border-radius: 10px;
        }
        .user {
            background: #667eea;
            color: white;
            margin-left: 20%;
        }
        .assistant {
            background: white;
            margin-right: 20%;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🩺 Nebras Conversation</h1>
        <p>${conversation.title}</p>
        <p>Date: ${new Date(conversation.createdAt).toLocaleString()}</p>
    </div>
`;
    
    conversation.messages.forEach(msg => {
        html += `    <div class="message ${msg.role}">${msg.content}</div>\n`;
    });
    
    html += `
</body>
</html>`;
    
    downloadFile(html, `nebras-conversation-${Date.now()}.html`, 'text/html');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =====================
// Statistics
// =====================
function showStats() {
    statsContent.innerHTML = `
        <div class="stat-item">
            <h3>📊 Total Messages</h3>
            <p>${analytics.totalMessages}</p>
        </div>
        <div class="stat-item">
            <h3>💬 Total Conversations</h3>
            <p>${analytics.totalConversations}</p>
        </div>
        <div class="stat-item">
            <h3>🔄 API Calls</h3>
            <p>${analytics.apiCalls}</p>
        </div>
        <div class="stat-item">
            <h3>⚡ Avg Response Time</h3>
            <p>${Math.round(analytics.averageResponseTime)}ms</p>
        </div>
        <div class="stat-item">
            <h3>📅 Member Since</h3>
            <p>${conversations.length > 0 ? 
                new Date(conversations[conversations.length - 1].createdAt).toLocaleDateString() : 
                'Today'}</p>
        </div>
    `;
    
    statsModal.classList.add('active');
    sidebar.classList.remove('active');
}

// =====================
// Event Listeners
// =====================
function attachEventListeners() {
    // Send message
    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Menu toggle
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    closeSidebar.addEventListener('click', () => sidebar.classList.remove('active'));
    
    // New chat button
    newChatBtn.addEventListener('click', () => {
        createNewConversation();
        sidebar.classList.remove('active');
    });
    
    // Clear history button
    clearHistoryBtn.addEventListener('click', clearAllHistory);
    
    // Controls
    clearBtn.addEventListener('click', clearChat);
    exportBtn.addEventListener('click', () => {
        exportModal.classList.add('active');
        sidebar.classList.remove('active');
    });
    statsBtn.addEventListener('click', showStats);
    
    // Export options
    document.getElementById('exportTxtBtn').addEventListener('click', () => {
        exportAsText();
        exportModal.classList.remove('active');
    });
    
    document.getElementById('exportJsonBtn').addEventListener('click', () => {
        exportAsJson();
        exportModal.classList.remove('active');
    });
    
    document.getElementById('exportHtmlBtn').addEventListener('click', () => {
        exportAsHtml();
        exportModal.classList.remove('active');
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });
    
    // Close modals on outside click
    [statsModal, exportModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('active');
        }
    });
}

// =====================
// Confirmation Modal
// =====================
function showConfirmModal({ title = 'Confirm', message = 'Are you sure?', onConfirm }) {
    const modal = document.getElementById('confirmModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalConfirm = document.getElementById('modalConfirm');
    const modalCancel = document.getElementById('modalCancel');
    const modalClose = document.getElementById('modalClose');

    modalTitle.textContent = title;
    modalBody.textContent = message;

    // Show modal
    modal.classList.add('active');

    // Cleanup old handlers
    modalConfirm.onclick = null;
    modalCancel.onclick = null;
    modalClose.onclick = null;

    // Confirm action
    modalConfirm.addEventListener('click', () => {
            onConfirm();
            modal.classList.remove('active');
        }, 
        { once: true }
    );

    // Cancel and Close actions
    modalCancel.addEventListener('click', () => modal.classList.remove('active'), { once: true });
    modalClose.addEventListener('click', () => modal.classList.remove('active'), { once: true });

    // Close modal when clicking outside the content
    modal.addEventListener('click', e => {
            if (e.target === modal) modal.classList.remove('active');
        }, { once: true }
    );
}

// =====================
// Disclaimer Modal
// =====================
function showDisclaimerModal() {
    const modal = document.getElementById('disclaimerModal');
    const btnOk = document.getElementById('disclaimerOk');

    modal.classList.add('active');

    // Close handlers
    btnOk.onclick = () => modal.classList.remove('active');
}


// =====================
// Initialize App
// =====================
init();