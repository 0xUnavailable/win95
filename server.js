const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ path: '/ws', server });

const rooms = new Map();
const adjectives = ['Swift', 'Bright', 'Cool', 'Bold', 'Silent', 'Happy', 'Wise', 'Quick', 'Calm', 'Fierce'];
const nouns = ['Fox', 'Wolf', 'Eagle', 'Bear', 'Hawk', 'Lion', 'Deer', 'Owl', 'Tiger', 'Panther'];

function generateUsername(usedUsernames) {
    let username;
    let attempts = 0;
    const maxAttempts = adjectives.length * nouns.length;
    do {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        username = `${adj}${noun}`;
        attempts++;
        if (attempts > maxAttempts) {
            throw new Error('No unique usernames available');
        }
    } while (usedUsernames.has(username));
    return username;
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket handling
wss.on('connection', (ws) => {
    let clientRoom = null;
    let clientId = null;
    let username = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'join-room') {
                clientRoom = data.code || 'GENERAL';
                clientId = data.clientId;

                if (!rooms.has(clientRoom)) {
                    rooms.set(clientRoom, { clients: new Map(), usernames: new Set() });
                }

                const room = rooms.get(clientRoom);
                username = generateUsername(room.usernames);
                room.usernames.add(username);
                room.clients.set(clientId, { ws, username });

                ws.send(JSON.stringify({
                    type: 'username-assigned',
                    username
                }));

                room.clients.forEach((client, id) => {
                    if (client.ws.readyState === WebSocket.OPEN && id !== clientId) {
                        client.ws.send(JSON.stringify(data));
                    }
                });

                room.clients.forEach((client) => {
                    if (client.ws.readyState === WebSocket.OPEN) {
                        client.ws.send(JSON.stringify({
                            type: 'room-status',
                            message: `${client.username} joined room ${clientRoom}`
                        }));
                    }
                });
            } else if (['message', 'image', 'voice', 'public-key', 'aes-key'].includes(data.type)) {
                const room = rooms.get(clientRoom);
                if (room) {
                    room.clients.forEach((client, id) => {
                        if (client.ws.readyState === WebSocket.OPEN && id !== clientId) {
                            client.ws.send(JSON.stringify(data));
                        }
                    });
                }
            } else if (data.type === 'leave-room' && clientRoom) {
                handleClientLeave(clientRoom, clientId, username);
            }
        } catch (error) {
            console.error('Server error processing message:', error);
            ws.send(JSON.stringify({
                type: 'room-status',
                message: `Error: ${error.message}`
            }));
        }
    });

    ws.on('close', () => {
        if (clientRoom && clientId) {
            handleClientLeave(clientRoom, clientId, username);
        }
    });

    function handleClientLeave(roomCode, clientId, username) {
        const room = rooms.get(roomCode);
        if (room) {
            room.clients.delete(clientId);
            room.usernames.delete(username);
            room.clients.forEach((client) => {
                if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.send(JSON.stringify({
                        type: 'room-status',
                        message: `${username} left room ${roomCode}`
                    }));
                }
            });
            if (room.clients.size === 0) {
                rooms.delete(roomCode);
            }
        }
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});