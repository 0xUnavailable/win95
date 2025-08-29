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
let retardiooCooldown = false;
let retardiooClientId = null;
let retardiooOriginalUsername = null;
let pendingRetardiooUsername = null; // Store username for local Retardioo notification
const statusMessages = new Map(); // Track status messages to deduplicate

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
    document.getElementById('retardiooButton').disabled = false;
    connectWebSocket();
}

function backToHome() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave-room', preventNotification: true }));
        ws.close();
    }
    document.getElementById('chat').style.display = 'none';
    document.getElementById('home').style.display = 'block';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('messageInput').value = '';
    document.getElementById('imageInput').value = '';
    document.getElementById('roomCode').value = '';
    document.getElementById('username').textContent = 'Connecting...';
    document.getElementById('username').classList.remove('retardioo');
    document.getElementById('userList').innerHTML = '';
    cancelReply();
    hideContextMenu();
    hideReactionUsers();
    username = '';
    roomCode = '';
    messageCounter = 0;
    retardiooCooldown = false;
    retardiooClientId = null;
    retardiooOriginalUsername = null;
    pendingRetardiooUsername = null;
    document.getElementById('retardiooButton').disabled = true;
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
            const messageKey = `${data.message}-${Date.now()}`;
            if (!statusMessages.has(data.message)) {
                statusMessages.set(data.message, messageKey);
                addMessage(data.message, 'status');
                setTimeout(() => {
                    statusMessages.delete(data.message);
                }, 1000);
            } else {
                console.log(`Skipped duplicate status message: ${data.message}`);
            }
        } else if (data.type === 'user-list') {
            updateUserList(data.users);
        } else if (data.type === 'message' && data.clientId !== clientId) {
            addMessage(`${data.username}: ${data.message}`, 'receiver', { type: 'text', content: data.message, messageId: data.messageId, username: data.username });
        } else if (data.type === 'image' && data.clientId !== clientId) {
            addImage(data.username, data.image, 'receiver', { type: 'image', content: data.image, messageId: data.messageId, username: data.username });
        } else if (data.type === 'voice' && data.clientId !== clientId) {
            addVoice(data.username, data.audio, 'receiver', { type: 'voice', content: data.audio, messageId: data.messageId, username: data.username });
        } else if (data.type === 'reply' && data.clientId !== clientId) {
            console.log('Processing reply:', { clientId: data.clientId, retardiooClientId, username: data.username, replyTo: data.replyTo });
            addReply(data.username, data.message, data.replyTo, 'receiver', data.messageId);
        } else if (data.type === 'reaction' && data.clientId !== clientId) {
            addReaction(data.messageId, data.emoji, data.username);
        } else if (data.type === 'retardioo-set') {
            retardiooClientId = data.clientId;
            retardiooOriginalUsername = data.originalUsername;
            console.log(`Retardioo set: clientId=${data.clientId}, originalUsername=${data.originalUsername}`);
            updateRetardiooUI(data.clientId, data.originalUsername);
        } else if (data.type === 'retardioo-revert') {
            console.log(`Retardioo revert: clientId=${data.clientId}, originalUsername=${data.originalUsername}`);
            revertRetardiooUI(data.clientId, data.originalUsername);
            retardiooClientId = null;
            retardiooOriginalUsername = null;
        }
    };
    ws.onclose = () => {
        addMessage('Disconnected from server', 'status');
    };
}

function triggerRetardioo() {
    if (retardiooCooldown) {
        addMessage('Retardioo button is on cooldown (1 minute)', 'status');
        return;
    }
    pendingRetardiooUsername = username;
    console.log(`Triggering Retardioo: username=${username}, pendingRetardiooUsername=${pendingRetardiooUsername}`);
    ws.send(JSON.stringify({ type: 'retardioo', clientId }));
    retardiooCooldown = true;
    document.getElementById('retardiooButton').disabled = true;
    setTimeout(() => {
        retardiooCooldown = false;
        document.getElementById('retardiooButton').disabled = false;
        addMessage('Retardioo button is ready again!', 'status');
    }, 60 * 1000); // 1 minute
}

function updateRetardiooUI(targetClientId, originalUsername) {
    console.log(`Updating Retardioo UI: targetClientId=${targetClientId}, originalUsername=${originalUsername}, pendingRetardiooUsername=${pendingRetardiooUsername}`);
    if (targetClientId === clientId) {
        username = 'Retardioo';
        document.getElementById('username').textContent = 'Retardioo';
        document.getElementById('username').classList.add('retardioo');
    }
    document.querySelectorAll(`.message[data-message*="${originalUsername}"]`).forEach(message => {
        const data = JSON.parse(message.dataset.message);
        if (data.username === originalUsername) {
            data.username = 'Retardioo';
            message.dataset.message = JSON.stringify(data);
            const usernameElement = message.querySelector('strong');
            if (usernameElement) {
                usernameElement.innerHTML = `<span class="retardioo">Retardioo</span>:`;
            }
            const replyQuote = message.querySelector('.reply-quote');
            if (replyQuote && replyQuote.textContent.startsWith(`${originalUsername}:`)) {
                const content = replyQuote.textContent.split(': ').slice(1).join(': ');
                replyQuote.innerHTML = `<span class="retardioo">Retardioo</span>: ${content}`;
            }
        }
    });
    updateUserList([...document.querySelectorAll('#userList p')].map(p => p.textContent).map(u => u === originalUsername ? 'Retardioo' : u));
    document.querySelectorAll('.message').forEach(message => {
        const data = JSON.parse(message.dataset.message);
        if (data.reactions) {
            ['👍', '👎'].forEach(emoji => {
                if (data.reactions[emoji]?.includes(originalUsername)) {
                    data.reactions[emoji] = data.reactions[emoji].map(u => u === originalUsername ? 'Retardioo' : u);
                    message.dataset.message = JSON.stringify(data);
                    updateReactionsDisplay(message, data.reactions);
                }
            });
        }
    });
    const notificationUsername = targetClientId === clientId ? pendingRetardiooUsername : originalUsername;
    addMessage(`${notificationUsername} is now Retardioo!`, 'status');
    if (targetClientId === clientId) {
        pendingRetardiooUsername = null;
    }
}

function revertRetardiooUI(targetClientId, originalUsername) {
    console.log(`Reverting Retardioo UI: targetClientId=${targetClientId}, originalUsername=${originalUsername}`);
    // Update username for the affected client
    if (targetClientId === clientId) {
        username = originalUsername;
        document.getElementById('username').textContent = originalUsername;
        document.getElementById('username').classList.remove('retardioo');
    }
    // Update messages
    document.querySelectorAll(`.message[data-message*="${originalUsername}"]`).forEach(message => {
        const data = JSON.parse(message.dataset.message);
        if (data.username === 'Retardioo') {
            data.username = originalUsername;
            message.dataset.message = JSON.stringify(data);
            const usernameElement = message.querySelector('strong');
            if (usernameElement) {
                usernameElement.innerHTML = `${originalUsername}:`;
            }
            const replyQuote = message.querySelector('.reply-quote');
            if (replyQuote && replyQuote.textContent.startsWith('Retardioo:')) {
                const content = replyQuote.textContent.split(': ').slice(1).join(': ');
                replyQuote.innerHTML = `${originalUsername}: ${content}`;
            }
        }
    });
    // Update user list
    updateUserList([...document.querySelectorAll('#userList p')].map(p => p.textContent).map(u => u === 'Retardioo' ? originalUsername : u));
    // Update reaction users
    document.querySelectorAll('.message').forEach(message => {
        const data = JSON.parse(message.dataset.message);
        if (data.reactions) {
            ['👍', '👎'].forEach(emoji => {
                if (data.reactions[emoji]?.includes('Retardioo')) {
                    data.reactions[emoji] = data.reactions[emoji].map(u => u === 'Retardioo' ? originalUsername : u);
                    message.dataset.message = JSON.stringify(data);
                    updateReactionsDisplay(message, data.reactions);
                }
            });
        }
    });
    addMessage(`${originalUsername} is no longer Retardioo.`, 'status');
}

function updateUserList(users) {
    const userList = document.getElementById('userList');
    userList.innerHTML = '';
    users.forEach(user => {
        const p = document.createElement('p');
        p.textContent = user;
        if (user === 'Retardioo') p.classList.add('retardioo');
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
    p.innerHTML = text;
    if (data) {
        p.dataset.message = JSON.stringify({ ...data, reactions: {} });
        const reactionsDiv = document.createElement('div');
        reactionsDiv.className = 'reactions';
        p.appendChild(reactionsDiv);
    }
    addTouchAndContextMenu(p);
    messages.appendChild(p);
    const isAtBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 50;
    if (isAtBottom) {
        messages.scrollTop = messages.scrollHeight;
    }
    if (className.includes('status')) {
        console.log(`Adding status message: ${text}, ID: ${p.id}`);
        setTimeout(() => {
            p.style.transition = 'opacity 0.5s';
            p.style.opacity = '0';
            setTimeout(() => {
                if (p.parentNode) {
                    console.log(`Removing status message: ${text}, ID: ${p.id}`);
                    p.parentNode.removeChild(p);
                }
            }, 500);
        }, 5000);
    }
}

function addImage(username, imageData, className = '', data = null) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.id = `msg-${data?.messageId || messageCounter++}`;
    const usernameSpan = `<span${username === 'Retardioo' ? ' class="retardioo"' : ''}>${username}</span>`;
    div.innerHTML = `<p><strong>${usernameSpan}:</strong></p><img src="${imageData}" alt="Shared image"><div class="reactions"></div>`;
    if (data) div.dataset.message = JSON.stringify({ ...data, reactions: {} });
    addTouchAndContextMenu(div);
    messages.appendChild(div);
    const isAtBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 50;
    if (isAtBottom) {
        messages.scrollTop = messages.scrollHeight;
    }
}

function addVoice(username, audioData, className = '', data = null) {
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.id = `msg-${data?.messageId || messageCounter++}`;
    const usernameSpan = `<span${username === 'Retardioo' ? ' class="retardioo"' : ''}>${username}</span>`;
    div.innerHTML = `<p><strong>${usernameSpan}:</strong></p><audio controls src="${audioData}"></audio><div class="reactions"></div>`;
    if (data) div.dataset.message = JSON.stringify({ ...data, reactions: {} });
    addTouchAndContextMenu(div);
    messages.appendChild(div);
    const isAtBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 50;
    if (isAtBottom) {
        messages.scrollTop = messages.scrollHeight;
    }
}

function addReply(username, message, replyTo, className = '', messageId = null) {
    console.log('Adding reply:', { username, message, replyTo, className, messageId, retardiooClientId });
    const messages = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.id = `msg-${messageId || messageCounter++}`;
    
    let quoteContent = replyTo.content;
    if (replyTo.type === 'image') quoteContent = '[Image]';
    if (replyTo.type === 'voice') quoteContent = '[Voice Message]';
    const truncatedContent = quoteContent.length > 50 ? quoteContent.substring(0, 50) + '...' : quoteContent;
    
    const replyToDisplayUsername = (replyTo.clientId === retardiooClientId) ? 'Retardioo' : replyTo.username;
    const replyUsernameSpan = `<span${replyToDisplayUsername === 'Retardioo' ? ' class="retardioo"' : ''}>${replyToDisplayUsername}</span>`;
    
    const senderDisplayUsername = (username === 'Retardioo' || (className.includes('sender') && clientId === retardiooClientId)) ? 'Retardioo' : username;
    const usernameSpan = `<span${senderDisplayUsername === 'Retardioo' ? ' class="retardioo"' : ''}>${senderDisplayUsername}</span>`;
    
    div.innerHTML = `<p class="reply-quote" data-message-id="${replyTo.messageId}">${replyUsernameSpan}: ${truncatedContent}</p><p><strong>${usernameSpan}:</strong> ${message}</p><div class="reactions"></div>`;
    
    div.dataset.message = JSON.stringify({ 
        type: 'text', 
        content: message, 
        messageId, 
        username: username,
        reactions: {} 
    });
    
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
    const isAtBottom = messages.scrollHeight - messages.scrollTop <= messages.clientHeight + 50;
    if (isAtBottom) {
        messages.scrollTop = messages.scrollHeight;
    }
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
    const reactionUsers = document.getElementById('reactionUsers');
    if (reactionUsers.style.display === 'block' && selectedMessage === message) {
        showReactionUsers({ type: 'click', pageX: parseInt(reactionUsers.style.left), pageY: parseInt(reactionUsers.style.top) }, message);
    }
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
            const users = data.reactions[emoji].map(u => `<span${u === 'Retardioo' ? ' class="retardioo"' : ''}>${u}</span>`).join(', ');
            p.innerHTML = `${emoji}: ${users}`;
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
        reactionUsers.style.left = `${Math.min(x, window.innerWidth - reactionUsers.offsetWidth - 10)}px`;
        reactionUsers.style.top = `${Math.min(y, window.innerHeight - reactionUsers.offsetHeight - 10)}px`;
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
    contextMenu.style.left = `${Math.min(x, window.innerWidth - contextMenu.offsetWidth - 10)}px`;
    contextMenu.style.top = `${Math.min(y, window.innerHeight - contextMenu.offsetHeight - 10)}px`;
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
            username: data.username,
            type: data.type,
            content: data.type === 'image' ? '[Image]' : data.type === 'voice' ? '[Voice Message]' : data.content,
            messageId: data.messageId,
            clientId: data.clientId || null
        };
        console.log('Setting reply mode:', replyToData);
        const displayUsername = (data.clientId === retardiooClientId) ? 'Retardioo' : data.username;
        const input = document.getElementById('messageInput');
        input.placeholder = `Replying to ${displayUsername}: ${replyToData.content.length > 50 ? replyToData.content.substring(0, 50) + '...' : replyToData.content}`;
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
        const displayUsername = (clientId === retardiooClientId && retardiooClientId) ? 'Retardioo' : username;
        console.log('Sending reaction:', { type: 'reaction', messageId: data.messageId, emoji, username: displayUsername, clientId });
        ws.send(JSON.stringify({
            type: 'reaction',
            messageId: data.messageId,
            emoji,
            username: displayUsername,
            clientId
        }));
        addReaction(data.messageId, emoji, displayUsername);
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
        console.log('Sending message:', { replyMode, replyToData, username, clientId, retardiooClientId });
        if (replyMode && replyToData) {
            ws.send(JSON.stringify({
                type: 'reply',
                message,
                username: username,
                clientId,
                messageId,
                replyTo: { ...replyToData }
            }));
            const displayUsername = (clientId === retardiooClientId && retardiooClientId) ? 'Retardioo' : username;
            addReply(displayUsername, message, replyToData, 'sender', messageId);
            cancelReply();
        } else {
            ws.send(JSON.stringify({ type: 'message', message, username, clientId, messageId }));
            const displayUsername = (clientId === retardiooClientId && retardiooClientId) ? 'Retardioo' : username;
            addMessage(`${displayUsername}: ${message}`, 'sender', { type: 'text', content: message, messageId, username });
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
            const displayUsername = (clientId === retardiooClientId && retardiooClientId) ? 'Retardioo' : username;
            addImage(displayUsername, reader.result, 'sender', { type: 'image', content: reader.result, messageId, username });
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
                    const displayUsername = (clientId === retardiooClientId && retardiooClientId) ? 'Retardioo' : username;
                    addVoice(displayUsername, reader.result, 'sender', { type: 'voice', content: reader.result, messageId, username });
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

document.getElementById('userListButton').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleUserList(e);
});
document.getElementById('userListButton').addEventListener('touchstart', (e) => {
    e.stopPropagation();
    e.preventDefault();
    toggleUserList(e);
});

function toggleUserList(event) {
    const userList = document.getElementById('userList');
    const userListButton = document.getElementById('userListButton');
    const isVisible = userList.classList.contains('show');
    
    if (!isVisible) {
        userList.style.left = '';
        userList.style.top = '';
        userList.style.right = '';
        userList.style.bottom = '';
        userList.style.maxWidth = '';
        
        const buttonRect = userListButton.getBoundingClientRect();
        userList.style.position = 'absolute';
        userList.style.top = '100%';
        userList.style.marginTop = '2px';
        
        if (getComputedStyle(userListButton.parentElement).position === 'static') {
            userListButton.parentElement.style.position = 'relative';
        }
        
        userList.style.visibility = 'hidden';
        userList.classList.add('show');
        
        const dropdownWidth = userList.offsetWidth;
        const buttonWidth = userListButton.offsetWidth;
        
        const leftOffset = -(dropdownWidth * 0.75);
        userList.style.left = `${leftOffset}px`;
        
        const buttonLeft = buttonRect.left;
        const dropdownLeft = buttonLeft + leftOffset;
        const dropdownRight = dropdownLeft + dropdownWidth;
        
        if (dropdownRight > window.innerWidth) {
            const maxAllowedWidth = window.innerWidth - dropdownLeft - 10;
            userList.style.maxWidth = `${maxAllowedWidth}px`;
            userList.style.overflowX = 'auto';
        }
        
        if (dropdownLeft < 0) {
            const adjustment = -dropdownLeft + 10;
            userList.style.left = `${leftOffset + adjustment}px`;
        }
        
        userList.style.visibility = 'visible';
        userList.classList.remove('show');
    }
    
    userList.classList.toggle('show', !isVisible);
}

document.getElementById('retardiooButton').addEventListener('touchstart', (e) => {
    e.stopPropagation();
    e.preventDefault();
    triggerRetardioo();
});