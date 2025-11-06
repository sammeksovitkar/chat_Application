// office-chat-backend/models/Chat.js
const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    chatId: { type: String, required: true }, // The ID of the conversation (e.g., recipient's User ID, or Group ID)
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    content: { 
        type: String, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['text', 'image', 'document'], 
        default: 'text' 
    },
    readBy: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

module.exports = mongoose.model('Chat', ChatSchema);