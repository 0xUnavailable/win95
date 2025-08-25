# Win95 Chat Room

# Overview
Win95 Chat Room is a real-time, end-to-end encrypted chat application designed for crypto builders to connect anonymously. With a retro Windows 95-themed interface, it provides a secure, ephemeral platform for authentic conversations without the influence of big accounts or algorithmic biases.This app ensures a level playing field where you have no identity just a funky username, and messages are never saved.
Motivation
I built this app to address the shortcomings of existing platforms for meaningful, private conversations in the crypto community:

Twitter: A popularity contest where algorithms favor big accounts, giving them undue influence. DMs feel suspicious and aren’t suited for real conversations.
Reddit: Overly restrictive with strict moderators and automods, not designed for real-time chat.
Discord: Overtaken by bots and airdrop farmers, leading to transactional interactions rather than authentic ones.
Bluesky: A low-budget Twitter clone with minimal engagement, essentially a dead space.
Farcaster: Promising but hampered by algorithmic issues, not ideal for anonymous collaboration.

Goal: Create a platform where influence has no weight. Your identity is anonymous, messages are end-to-end encrypted with AES-GCM, and nothing is saved. This ensures a level playing field for crypto builders to collaborate without bias or "dick riding."

Features
Room Creation/Joining: Create a room with a random 6-character code or join one with a valid code (e.g., XK7P9M).
Real-Time Messaging: Messages are delivered instantly to all users in the room.
End-to-End Encryption: Messages are encrypted client-side using AES-GCM with RSA-OAEP key exchange. The server only relays encrypted data.
Anonymous Usernames: Each user gets a unique username (e.g., SwiftFox) from customizable word lists, ensuring anonymity.
No Persistence: Messages are stored in memory and cleared when the last user leaves the room.


Setup
Prerequisites:

Node.js (v16 or higher)
A modern browser (Chrome or Firefox recommended)
Project Structure:
chat-room/
├── public/
│   └── index.html
├── server.js
├── .env
├── package.json


Installation:

Create a project directory (e.g., chat-room).
Save index.html in the public folder.
Save server.js and .env in the root directory.
Install dependencies:npm init -y
npm install express ws dotenv




Configure Environment:

Create or edit .env in the root directory:PORT=8080


Optionally, change the PORT to another value (e.g., 8081).


Run the Server:

Run:node server.js


The server starts on http://localhost:8080 (or the port specified in .env).



Usage

Open a browser and navigate to http://localhost:8080.
Home Screen:
Click "Create" to generate a random 6-character code (e.g., XK7P9M).
Or enter a 6-character alphanumeric code and click "Join Room".


Chat Screen:
The status bar shows room events (e.g., "Joined room XK7P9M") in 14px font.
Type a message and click "Send" or press Enter.
Your messages appear on the right; others’ appear on the left, with 14px font for readability.


Leave Room:
Click the "x" button to leave the room and return to the home screen.
The room persists until the last user leaves, at which point all messages are cleared.




Customization

Username Word Lists:
Edit the adjectives and nouns arrays in server.js:const adjectives = ['Swift', 'Bright', 'Cool', 'Bold', 'Silent', 'Happy', 'Wise', 'Quick', 'Calm', 'Fierce', 'NewWord'];
const nouns = ['Fox', 'Wolf', 'Eagle', 'Bear', 'Hawk', 'Lion', 'Deer', 'Owl', 'Tiger', 'Panther', 'NewAnimal'];


Usernames are generated as adjective + noun (e.g., SwiftFox). The server ensures uniqueness per room.









