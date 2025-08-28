let ws;
let username = '';
let roomCode = '';
const clientId = Math.random().toString(36).substring(2);
let mediaRecorder;
let audioChunks = [];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
let selectedMessage = null;
let messageCounter = 0;
let replyMode = false;
let replyToData = null;
let touchStartTime = 0;
let touchTimeout = null;

function createRoom() {
    roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    joinRoom(roomCode);
}

function joinRoom(code) {
    if (!code && code !== 'GENERAL') return;
    roomCode = code.toUpperCase();
    document.getElementById('home').style.display = 'none';
    document.getElementById('chat').style.display = 'block';
    document.getElementById('roomName').textContent = roomCode;
    connectWebSocket();
}

function backToHome() {
    if (ws) {
        ws.send(JSON.stringify({ type: 'leave-room' }));
        ws.close();
    }
    document.getElementById('chat').style.display = 'none';
    document.getElementById('home').style.display = 'block';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('messageInput').value = '';
    document.getElementById('imageInput').value = '';
    document.getElementById('roomCode').value = '';
    document.getElementById('username').textContent = 'Connecting...';
    document.getElementById('userList').innerHTML = '';
    cancelReply();
    hideContextMenu();
    hideReactionUsers();
    username = '';
    roomCode = '';
    messageCounter = 0;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        document.getElementById('recordButton').textContent = 'Record Voice';
    }
}

function connectWebSocket() {
    ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join-room', code: roomCode, clientId }));
    };
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data);
        if (data.type === 'username-assigned') {
            username = data.username;
            document.getElementById('username').textContent = username;
        } else if (data.type === 'room-status') {
            addMessage(data.message, 'status');
        } else if (data.type === 'user-list') {
            updateUserList(data.users);
        } else if (data.type === 'message' && data.clientId !== clientId) {
            addMessage(`${data.username}: ${data.message}`, 'receiver', { type: 'text', content: data.message, messageId: data.messageId, username: data.username });
        } else if (data.type === 'image' && data.clientId !== clientId) {
            addImage(data.username, data.image, 'receiver', { type: 'image', content: data.image, messageId: data.messageId, username: data.username });
        } else if (data.type === 'voice' && data.clientId !== clientId) {
            addVoice(data.username, data.audio, 'receiver', { type: 'voice', content: data.audio, messageId: data.messageId, username: data.username });
        } else if (data.type === 'reply' && data.clientId !== clientId) {
            addReply(data.username, data.message, data.replyTo, 'receiver', data.messageId);
        } else if (data.type === 'reaction' && data.clientId !== clientId) {
            addReaction(data.messageId, data.emoji, data.username);
        }
    };
    ws.onclose = () => {
        addMessage('Disconnected from server', 'status');
    };
}

function updateUserList(users) {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';
    users.forEach(user => {
        const p = document.createElement('p');
        p.textContent = user;
        p.addEventListener('click', () => {
            userList.classList.remove('show');
        });
        p.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            userList.classList.remove('show');
        });
        userList.appendChild(p);
    });
}

function addMessage(text, className = '', data = null) {
    const messages = document.getElementById('messages');
    const p = document.createElement('p');
    p.className = `message ${className}`;
    p.id = `msg-${data?.messageId || messageCounter++}`;
    p.textContent = text;
    if (data) {
        p.dataset.message = JSON.stringify({ ...data, reactions: {} });
        const reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'reactions';
        p.appendChild(reactionsDiv);
    }
    addTouchAndContextMenu(p);
    messages.appendChild(p);
    messages.scrollTop = messages.scrollHeight;
}

function addImage(username, imageData, className = '', data = null) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.id = `msg-${data?.messageId || messageCounter++}`;
    div.innerHTML = `<p><strong>${username}:</strong></p><img src="${imageData}" alt="Shared image"><div class="reactions"></div>`;
    if (data) div.dataset.message = JSON.stringify({ ...data, reactions: {} });
    addTouchAndContextMenu(div);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function addVoice(username, audioData, className = '', data = null) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.id = `msg-${data?.messageId || messageCounter++}`;
    div.innerHTML = `<p><strong>${username}:</strong></p><audio controls src="${audioData}"></audio><div class="reactions"></div>`;
    if (data) div.dataset.message = JSON.stringify({ ...data, reactions: {} });
    addTouchAndContextMenu(div);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function addReply(username, message, replyTo, className = '', messageId = null) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.id = `msg-${messageId || messageCounter++}`;
    let quoteContent = replyTo.content;
    if (replyTo.type === 'image') quoteContent = '[Image]';
    if (replyTo.type === 'voice') quoteContent = '[Voice Message]';
    const truncatedContent = quoteContent.length > 50 ? quoteContent.substring(0, 50) + '...' : quoteContent;
    div.innerHTML = `<p class="reply-quote" data-message-id="${replyTo.messageId}">${replyTo.username}: ${truncatedContent}</p><p><strong>${username}:</strong> ${message}</p><div class="reactions"></div>`;
    div.dataset.message = JSON.stringify({ type: 'text', content: message, messageId, username, reactions: {} });
    const replyQuote = div.querySelector('.reply-quote');
    replyQuote.addEventListener('click', () => {
        const target = document.getElementById(`msg-${replyTo.messageId}`);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.style.backgroundColor = '#ffff99';
            setTimeout(() => {
                target.style.backgroundColor = className.includes('sender') ? '#add8e6' : '#e0e0e0';
            }, 1000);
        } else {
            console.warn(`Message with ID msg-${replyTo.messageId} not found`);
        }
    });
    addTouchAndContextMenu(div);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function addReaction(messageId, emoji, username) {
    console.log(`Adding reaction: messageId=${messageId}, emoji=${emoji}, username=${username}`);
    const message = document.getElementById(`msg-${messageId}`);
    if (message) {
        const data = JSON.parse(message.dataset.message);
        if (!data.reactions[emoji]) {
            data.reactions[emoji] = [];
        }
        if (!data.reactions[emoji].includes(username)) {
            data.reactions[emoji].push(username);
        }
        message.dataset.message = JSON.stringify(data);
        updateReactionsDisplay(message, data.reactions);
    } else {
        console.warn(`Message with ID msg-${messageId} not found for reaction`);
    }
}

function updateReactionsDisplay(message, reactions) {
    const reactionsDiv = message.querySelector('.reactions');
    if (!reactionsDiv) return;
    let displayText = '';
    if (reactions['👍'] && reactions['👍'].length > 0) {
        displayText += `👍 ${reactions['👍'].length} `;
    }
    if (reactions['👎'] && reactions['👎'].length > 0) {
        displayText += `👎 ${reactions['👎'].length}`;
    }
    reactionsDiv.textContent = displayText.trim();
}

function showReactionUsers(event, element) {
    const data = element.dataset.message ? JSON.parse(element.dataset.message) : null;
    if (!data || !Object.keys(data.reactions).length) return;

    const reactionUsers = document.getElementById('reactionUsers');
    reactionUsers.innerHTML = '';
    let hasUsers = false;

    ['👍', '👎'].forEach(emoji => {
        if (data.reactions[emoji] && data.reactions[emoji].length > 0) {
            const p = document.createElement('p');
            p.textContent = `${emoji}: ${data.reactions[emoji].join(', ')}`;
            reactionUsers.appendChild(p);
            hasUsers = true;
        }
    });

    if (hasUsers) {
        let x, y;
        if (event.type === 'touchstart') {
            x = event.touches[0].pageX;
            y = event.touches[0].pageY;
        } else {
            x = event.pageX;
            y = event.pageY;
        }
        reactionUsers.style.display = 'block';
        reactionUsers.style.left = `${Math.min(x, window.innerWidth - 120)}px`;
        reactionUsers.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
    } else {
        reactionUsers.style.display = 'none';
    }

    document.addEventListener('click', hideReactionUsers, { once: true });
    document.addEventListener('touchstart', (e) => {
        if (!reactionUsers.contains(e.target)) {
            hideReactionUsers();
        }
    }, { once: true });
}

function hideReactionUsers() {
    document.getElementById('reactionUsers').style.display = 'none';
}

function addTouchAndContextMenu(element) {
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e, element);
    });

    let touchDuration = 0;
    element.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        touchStartTime = Date.now();
        touchTimeout = setTimeout(() => {
            showContextMenu(e, element);
        }, 500);
    });
    element.addEventListener('touchend', (e) => {
        e.stopPropagation();
        touchDuration = Date.now() - touchStartTime;
        clearTimeout(touchTimeout);
        if (touchDuration < 500) {
            const data = element.dataset.message ? JSON.parse(element.dataset.message) : null;
            if (data && Object.keys(data.reactions).length > 0) {
                showReactionUsers(e, element);
            }
        }
    });
    element.addEventListener('touchmove', (e) => {
        e.stopPropagation();
        clearTimeout(touchTimeout);
    });
    element.addEventListener('click', (e) => {
        e.stopPropagation();
        const data = element.dataset.message ? JSON.parse(element.dataset.message) : null;
        if (data && Object.keys(data.reactions).length > 0) {
            showReactionUsers(e, element);
        }
    });
}

function showContextMenu(event, element) {
    selectedMessage = element;
    const contextMenu = document.getElementById('contextMenu');
    let x, y;
    if (event.type === 'touchstart') {
        x = event.touches[0].pageX;
        y = event.touches[0].pageY;
    } else {
        x = event.pageX;
        y = event.pageY;
    }
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${Math.min(x, window.innerWidth - 120)}px`;
    contextMenu.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
    document.addEventListener('click', hideContextMenu, { once: true });
    document.addEventListener('touchstart', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    }, { once: true });
}

function hideContextMenu() {
    document.getElementById('contextMenu').style.display = 'none';
    selectedMessage = null;
}

function copyMessage() {
    if (!selectedMessage) return;
    const data = selectedMessage.dataset.message ? JSON.parse(selectedMessage.dataset.message) : null;
    let textToCopy = '';
    if (data) {
        if (data.type === 'text') {
            textToCopy = selectedMessage.textContent.split(': ').slice(1).join(': ');
        } else if (data.type === 'image' || data.type === 'voice') {
            textToCopy = data.content;
        }
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
        addMessage('Message copied to clipboard', 'status');
    }).catch(() => {
        addMessage('Failed to copy message', 'status');
    });
    hideContextMenu();
}

function replyToMessage() {
    if (!selectedMessage) return;
    const data = selectedMessage.dataset.message ? JSON.parse(selectedMessage.dataset.message) : null;
    if (data) {
        replyMode = true;
        replyToData = {
            username: data.username || selectedMessage.querySelector('strong')?.textContent?.replace(':', '') || 'unknown',
            type: data.type,
            content: data.type === 'image' ? '[Image]' : data.type === 'voice' ? '[Voice Message]' : data.content,
            messageId: data.messageId
        };
        const input = document.getElementById('messageInput');
        input.placeholder = `Replying to ${replyToData.username}: ${replyToData.content.length > 50 ? replyToData.content.substring(0, 50) + '...' : replyToData.content}`;
        input.value = '';
        input.classList.add('reply-mode');
        document.getElementById('cancelReplyButton').style.display = 'inline-block';
        input.focus();
    }
    hideContextMenu();
}

function reactToMessage(emoji) {
    if (!selectedMessage) {
        console.warn('No message selected for reaction');
        return;
    }
    const data = selectedMessage.dataset.message ? JSON.parse(selectedMessage.dataset.message) : null;
    if (data && data.messageId) {
        console.log('Sending reaction:', { type: 'reaction', messageId: data.messageId, emoji, username, clientId });
        ws.send(JSON.stringify({
            type: 'reaction',
            messageId: data.messageId,
            emoji,
            username,
            clientId
        }));
        addReaction(data.messageId, emoji, username);
    } else {
        console.warn('No valid message data for reaction:', data);
    }
    hideContextMenu();
}

function cancelReply() {
    replyMode = false;
    replyToData = null;
    const input = document.getElementById('messageInput');
    input.placeholder = 'Type a message...';
    input.value = '';
    input.classList.remove('reply-mode');
    document.getElementById('cancelReplyButton').style.display = 'none';
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    if (input.value.trim()) {
        const message = input.value;
        const messageId = `${clientId}-${messageCounter++}`;
        if (replyMode && replyToData) {
            ws.send(JSON.stringify({
                type: 'reply',
                message,
                username,
                clientId,
                messageId,
                replyTo: replyToData
            }));
            addReply(username, message, replyToData, 'sender', messageId);
            cancelReply();
        } else {
            ws.send(JSON.stringify({ type: 'message', message, username, clientId, messageId }));
            addMessage(`${username}: ${message}`, 'sender', { type: 'text', content: message, messageId, username });
        }
        input.value = '';
        selectedMessage = null;
    }
}

function sendImage() {
    const input = document.getElementById('imageInput');
    const file = input.files[0];
    if (file) {
        if (file.size > MAX_IMAGE_SIZE) {
            addMessage('Image size exceeds 5MB limit', 'status');
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const messageId = `${clientId}-${messageCounter++}`;
            ws.send(JSON.stringify({ type: 'image', image: reader.result, username, clientId, messageId }));
            addImage(username, reader.result, 'sender', { type: 'image', content: reader.result, messageId, username });
            input.value = '';
        };
        reader.readAsDataURL(file);
    }
}

async function toggleRecording() {
    const button = document.getElementById('recordButton');
    if (button.textContent === 'Record Voice') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => {
                    const messageId = `${clientId}-${messageCounter++}`;
                    ws.send(JSON.stringify({ type: 'voice', audio: reader.result, username, clientId, messageId }));
                    addVoice(username, reader.result, 'sender', { type: 'voice', content: reader.result, messageId, username });
                };
                reader.readAsDataURL(blob);
            };
            mediaRecorder.start();
            button.textContent = 'Stop Recording';
        } catch (error) {
            addMessage('Error accessing microphone', 'status');
        }
    } else {
        mediaRecorder.stop();
        button.textContent = 'Record Voice';
    }
}

// Toggle user list on click/touch
document.getElementById('userListButton').addEventListener('click', (e) => {
    e.stopPropagation();
    const userList = document.getElementById('userList');
    userList.classList.toggle('show');
});
document.getElementById('userListButton').addEventListener('touchstart', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const userList = document.getElementById('userList');
    userList.classList.toggle('show');
});