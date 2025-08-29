const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store rooms and clients
const rooms = new Map(); // Map<roomCode, { clients: Set<ws>, retardiooActiveClient: clientId | null }>
const clients = new Map(); // Map<clientId, { ws, username, originalUsername, roomCode, retardiooTimeout }>

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Generate a random, unique username
function generateUsername() {
    const adjectives = ['Cool', 'Brave', 'Swift', 'Wise', 'Bold', 'Clever', 'Fierce', 'Gentle'];
    const nouns = ['Fox', 'Wolf', 'Eagle', 'Tiger', 'Bear', 'Lion', 'Hawk', 'Deer'];
    const randomNum = crypto.randomInt(10000).toString().padStart(4, '0');
    return `${adjectives[crypto.randomInt(adjectives.length)]}${nouns[crypto.randomInt(nouns.length)]}${randomNum}`;
}

// Shuffle array using Fisher-Yates algorithm with crypto.randomInt
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Broadcast message to all clients in a room except the sender
function broadcast(roomCode, message, excludeClientId = null) {
    const room = rooms.get(roomCode);
    if (room && room.clients) {
        room.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && (!excludeClientId || client.clientId !== excludeClientId)) {
                client.send(JSON.stringify(message));
            }
        });
    }
}

// Keep-alive ping/pong
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            const client = clients.get(ws.clientId);
            if (client) {
                console.log(`Terminating inactive client: ${client.username}`);
                ws.terminate();
            }
            return;
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000); // Ping every 30 seconds

wss.on('connection', (ws) => {
    let clientId;
    ws.isAlive = true; // Initialize keep-alive flag
    ws.on('pong', () => {
        ws.isAlive = true; // Mark client as alive on pong
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received:', data);

            if (data.type === 'join-room') {
                clientId = data.clientId;
                const roomCode = data.code || 'GENERAL';
                const username = generateUsername();

                // Initialize client data
                clients.set(clientId, { ws, username, originalUsername: username, roomCode, retardiooTimeout: null });

                // Add client to room
                if (!rooms.has(roomCode)) {
                    rooms.set(roomCode, { clients: new Set(), retardiooActiveClient: null });
                }
                rooms.get(roomCode).clients.add(ws);
                ws.clientId = clientId; // Store clientId on ws for reference

                // Send username to client
                ws.send(JSON.stringify({ type: 'username-assigned', username }));

                // Update user list
                const users = Array.from(rooms.get(roomCode).clients).map(client => clients.get(client.clientId).username);
                broadcast(roomCode, { type: 'user-list', users });

                // Notify room of join (single notification)
                if (!data.preventNotification) {
                    broadcast(roomCode, { type: 'room-status', message: `${username} joined room ${roomCode}` }, clientId);
                }

            } else if (data.type === 'message') {
                const client = clients.get(data.clientId);
                if (client && client.roomCode) {
                    broadcast(client.roomCode, {
                        type: 'message',
                        username: client.username,
                        message: data.message,
                        clientId: data.clientId,
                        messageId: data.messageId
                    }, data.clientId);
                }

            } else if (data.type === 'image') {
                const client = clients.get(data.clientId);
                if (client && client.roomCode) {
                    broadcast(client.roomCode, {
                        type: 'image',
                        username: client.username,
                        image: data.image,
                        clientId: data.clientId,
                        messageId: data.messageId
                    }, data.clientId);
                }

            } else if (data.type === 'voice') {
                const client = clients.get(data.clientId);
                if (client && client.roomCode) {
                    broadcast(client.roomCode, {
                        type: 'voice',
                        username: client.username,
                        audio: data.audio,
                        clientId: data.clientId,
                        messageId: data.messageId
                    }, data.clientId);
                }

            } else if (data.type === 'reply') {
                const client = clients.get(data.clientId);
                if (client && client.roomCode) {
                    broadcast(client.roomCode, {
                        type: 'reply',
                        username: client.username,
                        message: data.message,
                        replyTo: data.replyTo,
                        clientId: data.clientId,
                        messageId: data.messageId
                    }, data.clientId);
                }

            } else if (data.type === 'reaction') {
                const client = clients.get(data.clientId);
                if (client && client.roomCode) {
                    broadcast(client.roomCode, {
                        type: 'reaction',
                        messageId: data.messageId,
                        emoji: data.emoji,
                        username: client.username,
                        clientId: data.clientId
                    }, data.clientId);
                }

            } else if (data.type === 'retardioo') {
                const client = clients.get(data.clientId);
                const room = client && client.roomCode && rooms.get(client.roomCode);
                if (client && client.roomCode && room) {
                    if (room.retardiooActiveClient) {
                        // Notify client that Retardioo is already active
                        ws.send(JSON.stringify({ type: 'room-status', message: 'Another user is already Retardioo in this room' }));
                        return;
                    }
                    // Select a random client from the room
                    const roomClients = Array.from(room.clients);
                    if (roomClients.length === 0) return; // No clients in room
                    const shuffledClients = shuffleArray(roomClients);
                    const randomClientWs = shuffledClients[0];
                    const randomClientId = randomClientWs.clientId;
                    const randomClient = clients.get(randomClientId);
                    if (!randomClient) return; // Client not found

                    // Store original username before changing
                    const originalUsername = randomClient.username;
                    randomClient.username = 'Retardioo';
                    randomClient.originalUsername = originalUsername;
                    room.retardiooActiveClient = randomClientId;

                    // Broadcast Retardioo status
                    broadcast(client.roomCode, {
                        type: 'retardioo-set',
                        clientId: randomClientId,
                        originalUsername
                    });

                    // Set 1-minute timer for reversion
                    randomClient.retardiooTimeout = setTimeout(() => {
                        randomClient.username = originalUsername;
                        randomClient.retardiooTimeout = null;
                        room.retardiooActiveClient = null;
                        broadcast(client.roomCode, {
                            type: 'retardioo-revert',
                            clientId: randomClientId,
                            originalUsername
                        });
                        // Update user list
                        const users = Array.from(rooms.get(client.roomCode).clients).map(client => clients.get(client.clientId).username);
                        broadcast(client.roomCode, { type: 'user-list', users });
                    }, 60 * 1000); // 1 minute

                    // Update user list
                    const users = Array.from(rooms.get(client.roomCode).clients).map(client => clients.get(client.clientId).username);
                    broadcast(client.roomCode, { type: 'user-list', users });
                }

            } else if (data.type === 'leave-room') {
                const client = clients.get(data.clientId);
                if (client && client.roomCode) {
                    // Clear Retardioo timeout if active
                    if (client.retardiooTimeout) {
                        clearTimeout(client.retardiooTimeout);
                        client.retardiooTimeout = null;
                        const room = rooms.get(client.roomCode);
                        if (room && room.retardiooActiveClient === data.clientId) {
                            room.retardiooActiveClient = null;
                            broadcast(client.roomCode, {
                                type: 'retardioo-revert',
                                clientId: data.clientId,
                                originalUsername: client.originalUsername
                            });
                        }
                    }

                    // Remove from room
                    const roomCode = client.roomCode;
                    rooms.get(roomCode).clients.delete(ws);
                    if (rooms.get(roomCode).clients.size === 0) {
                        rooms.delete(roomCode);
                    }

                    // Notify room of leave (single notification)
                    if (!data.preventNotification) {
                        broadcast(roomCode, { type: 'room-status', message: `${client.username} left room ${roomCode}` }, data.clientId);
                    }

                    // Update user list
                    if (rooms.has(roomCode)) {
                        const users = Array.from(rooms.get(roomCode).clients).map(client => clients.get(client.clientId).username);
                        broadcast(roomCode, { type: 'user-list', users });
                    }

                    // Clean up client data
                    clients.delete(data.clientId);
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        const client = clients.get(clientId);
        if (client && client.roomCode) {
            // Clear Retardioo timeout if active
            if (client.retardiooTimeout) {
                clearTimeout(client.retardiooTimeout);
                client.retardiooTimeout = null;
                const room = rooms.get(client.roomCode);
                if (room && room.retardiooActiveClient === clientId) {
                    room.retardiooActiveClient = null;
                    broadcast(client.roomCode, {
                        type: 'retardioo-revert',
                        clientId,
                        originalUsername: client.originalUsername
                    });
                }
            }

            // Remove from room
            const roomCode = client.roomCode;
            rooms.get(roomCode).clients.delete(ws);
            if (rooms.get(roomCode).clients.size === 0) {
                rooms.delete(roomCode);
            }

            // Notify room of leave
            broadcast(roomCode, { type: 'room-status', message: `${client.username} left room ${roomCode}` }, clientId);

            // Update user list
            if (rooms.has(roomCode)) {
                const users = Array.from(rooms.get(roomCode).clients).map(client => clients.get(client.clientId).username);
                broadcast(roomCode, { type: 'user-list', users });
            }

            // Clean up client data
            clients.delete(clientId);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

const PORT = process.env.PORT || 3000; // Use Render's PORT or fallback to 3000
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});