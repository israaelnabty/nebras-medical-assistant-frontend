// =====================
// Configuration
// =====================
//const API_URL = 'https://israaelnabty-nebraschatbotapi.hf.space/generate';
const API_URL = 'https://nebras-medical-chatbot-chatbotapi.hf.space/generate';

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
// Greeting Detection
// =====================
function isGreetingMessage(message) {
    const greetings = [
        // Greetings
        'hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 
        'good evening', 'good night', 'howdy', 'hola', 'salaam', 'salam',
        
        // Farewells
        'bye', 'goodbye', 'good bye', 'see you', 'farewell', 'take care',
        'catch you later', 'until next time', 'talk to you later', 'ttyl',
        
        // Thanks
        'thanks', 'thank you', 'thx', 'ty', 'appreciate it', 'appreciated',
        'grateful', 'much appreciated',
        
        // Common greeting questions
        'how are you', 'how are you doing', 'how do you do', 'whats up', 
        'what is up', 'sup', 'wassup', 'hows it going', 'how is it going',
        
        // Identity questions
        'whats your name', 'what is your name', 'whats you name', 'what is you name', 
        'who are you', 'what are you',
        'tell me about yourself', 'introduce yourself'
    ];
    
    const normalizedMessage = message.toLowerCase().trim();
    
    // Check if message is only punctuation and whitespace
    if (/^[\s?!.,;:'"]+$/.test(normalizedMessage)) {
        return true;
    }
    
    // Remove common punctuation and normalize apostrophes
    // Remove spaces around apostrophes: "what 's" → "what's", "what' s" → "what's"
    // Then remove apostrophes entirely: "what's" → "whats"
    const cleanMessage = normalizedMessage
        .replace(/\s*'\s*/g, '')  // Remove apostrophes and any spaces around them
        .replace(/[,!.;?]+$/g, '')  // Remove trailing punctuation
        .replace(/[,!.;]/g, ' ')  // Replace other punctuation with space
        .replace(/\s+/g, ' ')  // Collapse multiple spaces into one
        .trim();
    
    // Check if the entire cleaned message matches any greeting phrase exactly
    if (greetings.includes(cleanMessage)) {
        return true;
    }
    
    // Also check with "nebras" removed for phrases like "how are you nebras"
    const messageWithoutNebras = cleanMessage.replace(/\bnebras\b/g, '').replace(/\s+/g, ' ').trim();
    if (greetings.includes(messageWithoutNebras)) {
        return true;
    }
    
    // Split into words
    const words = cleanMessage.split(/\s+/);
    
    // If message has more than 4 words, it's likely not just a greeting
    // Examples: "hi" (1 word) vs "hi I have a headache" (5 words)
    if (words.length > 4) {
        return false;
    }
    
    // Check for exact matches (single greeting word)
    if (words.length === 1 && greetings.includes(words[0])) {
        return true;
    }
    
    // Check for short greeting phrases (up to 4 words)
    // But only if ALL words are greeting-related or very common filler words
    const fillerWords = ['there', 'again', 'so', 'much', 'very', 'nebras'];
    const allWords = [...greetings, ...fillerWords];
    
    if (words.length <= 4) {
        const isAllGreetingWords = words.every(word => allWords.includes(word));
        if (isAllGreetingWords) {
            return true;
        }
    }
    
    return false;
}

function getGreetingResponse(message) {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Identity questions
    if (normalizedMessage.includes('your name') || 
        normalizedMessage.includes('who are you') ||
        normalizedMessage.includes('what are you') ||
        normalizedMessage.includes('about yourself') ||
        normalizedMessage.includes('introduce yourself')) {
        return "I'm Nebras 🤖, your AI medical assistant! I'm here to provide medical information and guidance. How can I help with your health questions today?";
    }
    
    // How are you questions
    if (normalizedMessage.includes('how are you') || 
        normalizedMessage.includes('how do you do') ||
        normalizedMessage.includes('hows it going') ||
        normalizedMessage.includes('how is it going') ||
        normalizedMessage.includes('whats up') ||
        normalizedMessage.includes('what is up') ||
        normalizedMessage.includes('sup') ||
        normalizedMessage.includes('wassup')) {
        return "I'm doing great, thank you for asking! 😊 I'm here and ready to help with any medical questions you have. How can I assist you today?";
    }
    
    // Farewells
    if (normalizedMessage.includes('bye') || 
        normalizedMessage.includes('farewell') ||
        normalizedMessage.includes('see you')) {
        return "Goodbye! Take care and feel free to come back anytime you need medical information. Stay healthy! 👋";
    }
    
    // Thanks
    if (normalizedMessage.includes('thank') || 
        normalizedMessage.includes('thx') ||
        normalizedMessage.includes('ty') ||
        normalizedMessage.includes('appreciate')) {
        return "You're very welcome! I'm here anytime you need medical advice or information. Stay healthy! 😊";
    }
    
    // Question marks only
    if (/^[\s?!.,;:'"]+$/.test(normalizedMessage)) {
        return "I'm here to help with medical questions! Please ask me anything about symptoms, conditions, medications, or general health concerns. 🏥";
    }
    
    // General greetings (hi, hello, etc.)
    return "Hello! 👋 I'm Nebras, your AI medical assistant. How can I help you with your health questions today?";
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
    // Take only the last N exchanges (user + assistant = 2*N messages)
    const recentMessages = currentConversation.slice(-2*historyExchangesCount); 

    // Build conversation context
    let context = "";
    recentMessages.forEach(msg => {
        if (msg.role === 'user') {
            context += `Previous Question: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
            context += `Previous Answer: ${msg.content}\n`;
        }        
    });
    context = context.trim();

    // Get current user message (retry or new input)
    const currentMessage = lastFailedMessage || userInput.value.trim();

    // Base system instruction
    const basePrompt = `
    You are a medical assistant. Provide accurate, concise, professional medical advice in 1–2 sentences.
    Important: Always recommend consulting a healthcare provider for diagnosis and treatment.
    `;

    // Build final prompt
    let prompt;

    if (context) {
        prompt = `
        ${basePrompt}

        Conversation History:
        ${context}

        Current Question: ${currentMessage}

        Your Response:
        `;
    } else {
        prompt = `
        ${basePrompt}

        Question: ${currentMessage}

        Your Response:
        `;
    }
    
    return prompt.trim();
}

async function sendMessage() {
    const message = (lastFailedMessage || userInput.value.trim()).replace(/\s+/g, ' ');
    
    if (!message) return;
    
    // Check if message is a greeting
    if (isGreetingMessage(message)) {
        // Clear input
        if (!lastFailedMessage) {
            userInput.value = '';
        }
        
        // Display greeting and response in UI temporarily (without saving to history)
        const tempUserDiv = document.createElement('div');
        tempUserDiv.className = 'message user';
        const tempUserContent = document.createElement('div');
        tempUserContent.className = 'message-content';
        tempUserContent.textContent = message;
        tempUserDiv.appendChild(tempUserContent);
        chatContainer.appendChild(tempUserDiv);
        
        // Add greeting response immediately without API call
        const greetingResponse = getGreetingResponse(message);
        const tempAssistantDiv = document.createElement('div');
        tempAssistantDiv.className = 'message assistant';
        const tempAssistantContent = document.createElement('div');
        tempAssistantContent.className = 'message-content';
        tempAssistantContent.textContent = greetingResponse;
        tempAssistantDiv.appendChild(tempAssistantContent);
        chatContainer.appendChild(tempAssistantDiv);
        
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Don't add to currentConversation array
        // Don't create a conversation for greeting-only messages
        // Don't update analytics for greetings
        
        userInput.focus();
        
        return; // Exit early, don't call API
    }
    
    // Rest of the original sendMessage code for non-greeting messages...
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
        // Create a conversation ID if this is a new conversation and save it to history
        const isFirstMessage = !currentConversationId;
        if (isFirstMessage) {
            currentConversationId = Date.now().toString();
            const title = message.substring(0, 40) + 
                (message.length > 40 ? '...' : '');

            const conversation = {
                id: currentConversationId,
                title: title || 'New Conversation',
                messages: [...currentConversation],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            conversations.unshift(conversation);
            analytics.totalConversations++;
            renderConversationList();
        }

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
    if(currentConversationId === id) return;

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
            toggleContextMenu(e, conv.id);
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

function toggleContextMenu(e, conversationId) {
    e.preventDefault();
    
    // If clicking the same menu, toggle it
    if (currentContextConversationId === conversationId && contextMenu.classList.contains('active')) {
        hideContextMenu();
        return;
    }
    
    currentContextConversationId = conversationId;
    
    const menu = contextMenu;
    menu.classList.add('active');
    
    // Get the position of the clicked button
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    // Position menu at the button location
    let x = rect.left;
    let y = rect.bottom + 5; // 5px below the button
    
    // Adjust position if menu would go off screen
    const menuWidth = 150;
    const menuHeight = 80;
    
    if (x + menuWidth > window.innerWidth) {
        x = rect.right - menuWidth;
    }
    
    if (y + menuHeight > window.innerHeight) {
        y = rect.top - menuHeight - 5; // Position above the button instead
    }
    
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
}

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
    
    // Context menu - Export from context menu exports the selected conversation
    document.getElementById('contextExport').addEventListener('click', () => {
        if (currentContextConversationId) {
            const conversation = conversations.find(c => c.id === currentContextConversationId);
            if (conversation && conversation.messages.length > 0) {
                // Show export modal with context conversation selected
                exportModal.classList.add('active');
                hideContextMenu();
                sidebar.classList.remove('active');
                
                // Override export functions temporarily to export context conversation
                const originalExportAsText = exportAsText;
                const originalExportAsJson = exportAsJson;
                const originalExportAsHtml = exportAsHtml;
                
                window.tempExportAsText = () => {
                    exportConversationAsText(conversation);
                    exportModal.classList.remove('active');
                    // Restore original functions
                    window.tempExportAsText = null;
                    window.tempExportAsJson = null;
                    window.tempExportAsHtml = null;
                };
                
                window.tempExportAsJson = () => {
                    exportConversationAsJson(conversation);
                    exportModal.classList.remove('active');
                    // Restore original functions
                    window.tempExportAsText = null;
                    window.tempExportAsJson = null;
                    window.tempExportAsHtml = null;
                };
                
                window.tempExportAsHtml = () => {
                    exportConversationAsHtml(conversation);
                    exportModal.classList.remove('active');
                    // Restore original functions
                    window.tempExportAsText = null;
                    window.tempExportAsJson = null;
                    window.tempExportAsHtml = null;
                };
            }
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
    
    // Export options - Check if temp functions exist first
    document.getElementById('exportTxtBtn').addEventListener('click', () => {
        if (window.tempExportAsText) {
            window.tempExportAsText();
        } else {
            exportAsText();
            exportModal.classList.remove('active');
        }
    });
    
    document.getElementById('exportJsonBtn').addEventListener('click', () => {
        if (window.tempExportAsJson) {
            window.tempExportAsJson();
        } else {
            exportAsJson();
            exportModal.classList.remove('active');
        }
    });
    
    document.getElementById('exportHtmlBtn').addEventListener('click', () => {
        if (window.tempExportAsHtml) {
            window.tempExportAsHtml();
        } else {
            exportAsHtml();
            exportModal.classList.remove('active');
        }
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
            // Clear temp export functions when closing modal
            window.tempExportAsText = null;
            window.tempExportAsJson = null;
            window.tempExportAsHtml = null;
        });
    });
    
    // Close modals on outside click
    [statsModal, exportModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                // Clear temp export functions when closing modal
                window.tempExportAsText = null;
                window.tempExportAsJson = null;
                window.tempExportAsHtml = null;
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