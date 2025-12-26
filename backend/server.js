const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const User = require('./models/User'); 
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// 1. DYNAMIC PORT: Render uses process.env.PORT (defaults to 10000)
const PORT = process.env.PORT || 5000;

// 2. SECURE CORS: Explicitly allow your frontend URL from Env Vars
const allowedOrigins = [process.env.CORS_ORIGIN, process.env.CORS_ORIGIN2].filter(Boolean);
app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : "*", 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());

// 3. PERSISTENT FOLDER CHECK: Ensure uploads folder exists on startup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// 4. MONGODB: Use Atlas URI from Environment Variables
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// 5. SOCKET SETUP: Optimize for production with 'websocket' and 'polling'
const io = new Server(server, {
    cors: {
        origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'] // Helps bypass proxy issues
});

app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/user')); 
app.use('/api/chats', require('./routes/chat'));

let onlineUsers = {}; 

io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Auth error: Token missing'));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key');
        socket.user = decoded.user;
        next();
    } catch (err) {
        next(new Error('Auth error: Invalid token'));
    }
});

io.on('connection', (socket) => {
    const userId = socket.user.id;
    onlineUsers[userId] = socket.id;
    
    User.findByIdAndUpdate(userId, { lastActive: Date.now() }).exec();
    io.emit('user_status_update', { userId: userId, isOnline: true });

    socket.on('join_chat', (chatId) => socket.join(chatId));
    socket.on('typing', (data) => socket.to(data.chatId).emit('typing_status', data));
    socket.on('send_message', (data) => socket.to(data.chatId).emit('receive_message', data));

    socket.on('disconnect', async () => {
        delete onlineUsers[userId];
        const now = Date.now();
        await User.findByIdAndUpdate(userId, { lastActive: now });
        io.emit('user_status_update', { userId: userId, isOnline: false, lastActive: now });
    });
});

server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
