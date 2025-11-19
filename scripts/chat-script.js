// =====================
// Configuration
// =====================
const API_URL = 'https://israaelnabty-nebraschatbotapi.hf.space/generate';

// =====================
// State Management
// =====================
let historyExchangesCount = 3;
let currentConversation = [];
let conversations = [];
let currentConversationId = null;
let lastFailedMessage = null;
let isWaitingForResponse = false;
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
const historyDropdownBtn = document.getElementById('historyDropdownBtn');
const contextMenu = document.getElementById('contextMenu');

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
// Disclaimer Management
// =====================
function shouldShowDisclaimer() {
    return localStorage.getItem('nebras_hide_disclaimer') !== 'true';
}

function saveDisclaimerPreference(hideDisclaimer) {
    localStorage.setItem('nebras_hide_disclaimer', hideDisclaimer ? 'true' : 'false');
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
    const recentMessages = currentConversation.slice(-2*historyExchangesCount); 

    let context = "";
    recentMessages.forEach(msg => {
        if (msg.role === 'user') {
            context += `Previous Question: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
            context += `Previous Answer: ${msg.content}\n`;
        }
    });

    const currentMessage = lastFailedMessage || userInput.value.trim();

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
    const message = lastFailedMessage || userInput.value.trim();
    
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
    
    // Only add user message if this is not a retry
    if (!lastFailedMessage) {
        addMessage(message, true);
        userInput.value = '';
    } else {
        // If retrying, remove the old error message
        const errorMessages = chatContainer.querySelectorAll('.message.error');
        errorMessages.forEach(msg => msg.remove());

        // Also, remove it from the conversation history
        currentConversation = currentConversation.filter(msg => !msg.isError);
    }
    
    // Update analytics
    analytics.totalMessages++;
    analytics.apiCalls++;
    
    // Show loading
    isWaitingForResponse = true;
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
        if(isWaitingForResponse) {
            addMessage(data.response, false);
        }        
        
        // Clear the failed message state on success
        lastFailedMessage = null;
        
    } catch (error) {
        console.error('Error:', error);
        
        // Store the failed message for retry
        lastFailedMessage = message;
        
        // Add error message with retry button
        if(isWaitingForResponse) {
            addMessage('Sorry, I encountered an error. Please make sure the API is running and try again.', false, true);
        }        

    } finally {
        isWaitingForResponse = false;
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

function addMessage(content, isUser, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    // Add retry button if this is an error message
    if (isError) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'retry-btn';
        retryBtn.textContent = '🔄 Retry';
        retryBtn.onclick = () => {
            sendMessage();
        };
        contentDiv.appendChild(document.createElement('br'));
        contentDiv.appendChild(retryBtn);
    }
    
    messageDiv.appendChild(contentDiv);
    chatContainer.appendChild(messageDiv);
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Add to current conversation
    currentConversation.push({
        role: isUser ? 'user' : 'assistant',
        content: content,
        timestamp: new Date().toISOString(),
        isError: isError
    });
}

function clearChat() {
    showConfirmModal({
        title: 'Delete Chat',
        message: 'Are you sure you want to delete this chat?',
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
            lastFailedMessage = null;
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
    loading.classList.remove('active');
    isWaitingForResponse = false;

    chatContainer.innerHTML = welcomeMessage;
    currentConversationId = null;
    currentConversation = [];
    lastFailedMessage = null;
    if (shouldShowDisclaimer()) {
        showDisclaimerModal();
    }
}

function updateCurrentConversation() {
    if (!currentConversationId) 
        return;

    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation) 
        return;

    const hasUserMessage = currentConversation.some(m => m.role === 'user');    
    if (!hasUserMessage) {
        conversations = conversations.filter(c => c.id !== currentConversationId);
        analytics.totalConversations = Math.max(analytics.totalConversations - 1, 0);
        currentConversationId = null;
        renderConversationList();
        return;
    }
    
    conversation.messages = [...currentConversation];
    conversation.updatedAt = new Date().toISOString();
    
    renderConversationList();    
}

function loadConversation(id) {
    loading.classList.remove('active');
    isWaitingForResponse = false;
    
    const conversation = conversations.find(c => c.id === id);
    if (!conversation) return;
    
    currentConversationId = id;
    currentConversation = [...conversation.messages];

    const lastMessage = currentConversation[currentConversation.length - 1];
    if (lastMessage && lastMessage.isError) {
        for (let i = currentConversation.length - 2; i >= 0; i--) {
            if (currentConversation[i].role === 'user') {
                lastFailedMessage = currentConversation[i].content;
                break;
            }
        }
    } else {
        lastFailedMessage = null;
    }

    chatContainer.innerHTML = '';
    
    if (currentConversation.length === 0) {
        chatContainer.innerHTML = welcomeMessage;
    } else {
        currentConversation.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role === 'user' ? 'user' : 'assistant'} ${msg.isError ? 'error' : ''}`;
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = msg.content;
            
            if (msg.isError) {
                const retryBtn = document.createElement('button');
                retryBtn.className = 'retry-btn';
                retryBtn.textContent = '🔄 Retry';
                retryBtn.onclick = () => {
                    sendMessage();
                };
                contentDiv.appendChild(document.createElement('br'));
                contentDiv.appendChild(retryBtn);
            }
            
            messageDiv.appendChild(contentDiv);
            chatContainer.appendChild(messageDiv);
        });
    }
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    renderConversationList();
    sidebar.classList.remove('active');
}

function deleteConversation(id) {
    showConfirmModal({
        title: 'Delete Conversation',
        message: 'Are you sure you want to delete this conversation?',
        onConfirm: () => {
            conversations = conversations.filter(c => c.id !== id);
            analytics.totalConversations = Math.max(analytics.totalConversations - 1, 0);
            
            if (currentConversationId === id) {
                createNewConversation();
            }
            
            saveToLocalStorage();
            renderConversationList();
        }
    });
}

function exportConversation(id, format = 'text') {
    const conversation = conversations.find(c => c.id === id);
    if (!conversation || conversation.messages.length === 0) {
        alert('No messages to export');
        return;
    }
    
    if (format === 'text') {
        exportConversationAsText(conversation);
    } else if (format === 'json') {
        exportConversationAsJson(conversation);
    } else if (format === 'html') {
        exportConversationAsHtml(conversation);
    }
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
        
        const content = document.createElement('div');
        content.className = 'conversation-item-content';
        content.onclick = () => loadConversation(conv.id);
        
        const title = document.createElement('h4');
        title.textContent = conv.title;
        
        const date = document.createElement('p');
        date.textContent = new Date(conv.updatedAt).toLocaleString();
        
        content.appendChild(title);
        content.appendChild(date);
        
        const menuBtn = document.createElement('button');
        menuBtn.className = 'conversation-item-menu';
        menuBtn.textContent = '⋮';
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            showContextMenu(e, conv.id);
        };
        
        item.appendChild(content);
        item.appendChild(menuBtn);
        
        // Long press support for mobile
        let pressTimer;
        item.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                e.preventDefault();
                showContextMenu(e, conv.id);
            }, 500);
        });
        
        item.addEventListener('touchend', () => {
            clearTimeout(pressTimer);
        });
        
        item.addEventListener('touchmove', () => {
            clearTimeout(pressTimer);
        });
        
        conversationList.appendChild(item);
    });
}

// =====================
// Context Menu
// =====================
let currentContextConversationId = null;

function showContextMenu(e, conversationId) {
    e.preventDefault();
    currentContextConversationId = conversationId;
    
    const menu = contextMenu;
    menu.classList.add('active');
    
    // Position the menu
    let x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    let y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    
    // Adjust position if menu would go off screen
    const menuWidth = 150;
    const menuHeight = 80;
    
    if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
    }
    
    if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

function hideContextMenu() {
    contextMenu.classList.remove('active');
    currentContextConversationId = null;
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
// Dropdown Toggle
// =====================
function toggleHistoryDropdown() {
    const arrow = historyDropdownBtn.querySelector('.dropdown-arrow');
    conversationList.classList.toggle('collapsed');
    arrow.classList.toggle('rotated');
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
    exportConversationAsText(conversation);
}

function exportAsJson() {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation || conversation.messages.length === 0) {
        alert('No messages to export');
        return;
    }
    exportConversationAsJson(conversation);
}

function exportAsHtml() {
    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation || conversation.messages.length === 0) {
        alert('No messages to export');
        return;
    }
    exportConversationAsHtml(conversation);
}

function exportConversationAsText(conversation) {
    let text = `Nebras Conversation - ${conversation.title}\n`;
    text += `Date: ${new Date(conversation.createdAt).toLocaleString()}\n`;
    text += `${'='.repeat(50)}\n\n`;
    
    conversation.messages.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : 'Nebras';
        text += `${role}: ${msg.content}\n\n`;
    });
    
    downloadFile(text, `nebras-conversation-${Date.now()}.txt`, 'text/plain');
}

function exportConversationAsJson(conversation) {
    const json = JSON.stringify(conversation, null, 2);
    downloadFile(json, `nebras-conversation-${Date.now()}.json`, 'application/json');
}

function exportConversationAsHtml(conversation) {
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
    
    // History dropdown
    historyDropdownBtn.addEventListener('click', toggleHistoryDropdown);
    
    // Context menu
    document.getElementById('contextExport').addEventListener('click', () => {
        if (currentContextConversationId) {
            exportModal.classList.add('active');
            const tempCurrentId = currentConversationId;
            currentConversationId = currentContextConversationId;
            hideContextMenu();
            sidebar.classList.remove('active');
            // Restore after a delay to allow export
            setTimeout(() => {
                currentConversationId = tempCurrentId;
            }, 100);
        }
    });
    
    document.getElementById('contextDelete').addEventListener('click', () => {
        if (currentContextConversationId) {
            deleteConversation(currentContextConversationId);
            hideContextMenu();
        }
    });
    
    // Hide context menu on outside click
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target) && !e.target.closest('.conversation-item-menu')) {
            hideContextMenu();
        }
    });
    
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

    modal.classList.add('active');

    modalConfirm.onclick = null;
    modalCancel.onclick = null;
    modalClose.onclick = null;

    modalConfirm.addEventListener('click', () => {
            onConfirm();
            modal.classList.remove('active');
        }, 
        { once: true }
    );

    modalCancel.addEventListener('click', () => modal.classList.remove('active'), { once: true });
    modalClose.addEventListener('click', () => modal.classList.remove('active'), { once: true });

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
    const checkbox = document.getElementById('disclaimerDontShow');

    checkbox.checked = false;
    modal.classList.add('active');

    btnOk.onclick = () => {
        if (checkbox.checked) {
            saveDisclaimerPreference(true);
        }
        modal.classList.remove('active');
    };
}

// =====================
// Initialize App
// =====================
init();