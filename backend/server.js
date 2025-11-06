// office-chat-backend/server.js (FINAL, with Status Tracking and File Upload Setup)

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken'); // Import JWT for socket middleware

// --- Model Import ---
const User = require('./models/User'); 

// --- Configuration ---
require('dotenv').config();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors({
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// 🖼️ CRITICAL: Static file serving for uploads (must match client's SOCKET_URL)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/officechat', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));


// --- Socket.IO Setup ---
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST']
    }
});

// Attach io to request object (for use in routes)
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- Routing ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user')); 
app.use('/api/chats', require('./routes/chat'));


// --- Socket.IO Status and Chat Logic ---
let onlineUsers = {}; // Stores { userId: socketId }

// 🔒 Middleware to verify JWT token and attach user data to socket
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: Token missing'));

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
        
        // CRITICAL: Attach user data, including the ID, to the socket object
        socket.user = decoded.user;
        next();
    } catch (err) {
        next(new Error('Authentication error: Invalid token'));
    }
});


io.on('connection', (socket) => {
    // CRITICAL: Get userId from the authenticated socket object
    const userId = socket.user.id;
    console.log(`User connected: ${userId} (${socket.id})`);

    // 1. On Connect: Store as online, update DB, broadcast ACTIVE status
    onlineUsers[userId] = socket.id;
    
    // Update DB and reset lastActive to current time
    User.findByIdAndUpdate(userId, { lastActive: Date.now() }).exec();
    
    // Notify all clients this user is now online
    io.emit('user_status_update', { userId: userId, isOnline: true });


    // --- Core Chat Handlers ---
    socket.on('join_chat', (chatId) => {
        socket.join(chatId);
        console.log(`User ${userId} joined chat: ${chatId}`);
    });

    socket.on('typing', (data) => {
        socket.to(data.chatId).emit('typing_status', data);
    });

    socket.on('send_message', (data) => {
        socket.to(data.chatId).emit('receive_message', data);
    });

    // ----------------------------------------------------
    // 2. On Disconnect: CRITICAL for Last Seen
    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${userId}`);
        
        // Remove from online list
        delete onlineUsers[userId];

        // Update lastActive in the database
        const now = Date.now();
        // Use 'await' to ensure DB update finishes before broadcasting
        await User.findByIdAndUpdate(userId, { lastActive: now });
        
        // Broadcast OFFLINE status with the Last Seen timestamp
        io.emit('user_status_update', { userId: userId, isOnline: false, lastActive: now });
    });
});


// --- Server Listener ---
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));