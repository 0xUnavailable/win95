# Win95 Chat Room

## Overview
**Win95 Chat Room** is a real-time, end-to-end encrypted chat application designed for crypto builders to connect anonymously. Featuring a retro Windows 95-themed interface, it provides a secure, ephemeral platform for authentic conversations free from algorithmic bias and social clout. 

You have no permanent identity—just a unique, fun username per room—and no messages are ever saved.

---

## Motivation
Existing platforms fall short when it comes to meaningful, private collaboration in the crypto community

**The Goal:** Create an environment where external clout carries zero weight. Identity is fully anonymous, communications are secured via **AES-GCM** end-to-end encryption, and nothing persists to a database.

---

## Features
* **Room Creation/Joining:** Instantly generate a 6-character room code or join an existing one (e.g., `XK7P9M`).
* **Real-Time Messaging:** Instant message relay to all connected peers in a room.
* **End-to-End Encryption:** Messages are encrypted client-side using **AES-GCM** with **RSA-OAEP** key exchange. The server only sees encrypted blobs.
* **Anonymous Usernames:** Auto-generates unique handles (e.g., `SwiftFox`) from custom word lists per session.
* **Zero Persistence:** Room history exists purely in-memory and wipes completely once the last user leaves.

---

## Setup

### Prerequisites
* **Node.js:** v16 or higher
* **Browser:** Any modern browser (Chrome or Firefox recommended)

### Project Structure
```text
chat-room/
├── public/
│   └── index.html
├── server.js
├── .env
└── package.json

```

### Installation

1. **Create the project folder & directory layout:**
```bash
mkdir chat-room
cd chat-room
mkdir public

```


2. **Add files to their respective paths:**
* Move `index.html` into the `public/` folder.
* Place `server.js` and `.env` in the root directory.


3. **Initialize project and install dependencies:**
```bash
npm init -y
npm install express ws dotenv

```


4. **Configure Environment Variables:**
Create or edit `.env` in the root directory:
```env
PORT=8080

```


5. **Run the Application:**
```bash
node server.js

```


*Access the app at `http://localhost:8080` (or your configured port).*

---

## Usage

1. Open `http://localhost:8080` in your browser.
2. **Home Screen:**
* Click **Create** to generate a random 6-character room code.
* Or enter an existing 6-character code and click **Join Room**.


3. **Chat Interface:**
* View session updates via the status bar.
* Type a message and hit **Send** (or press `Enter`).
* Your messages display on the right; peer messages appear on the left.


4. **Leaving a Room:**
* Click the **"x"** button to exit to the main screen.
* Once all users leave, the room state and all associated messages are completely destroyed.



---

## Customization

### Username Word Lists

You can modify or extend the available adjective and noun combinations by editing `server.js`:

```javascript
const adjectives = ['Swift', 'Bright', 'Cool', 'Bold', 'Silent', 'Happy', 'Wise', 'Quick', 'Calm', 'Fierce', 'NewWord'];
const nouns = ['Fox', 'Wolf', 'Eagle', 'Bear', 'Hawk', 'Lion', 'Deer', 'Owl', 'Tiger', 'Panther', 'NewAnimal'];

```

*Usernames are assembled automatically as `Adjective + Noun` (e.g., `SwiftFox`) and are guaranteed unique within each active room.*
