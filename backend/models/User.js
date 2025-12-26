// office-chat-backend/models/User.js

const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    staffId: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    profilePic: { type: String, default: 'uploads/default.jpg' }, 
    isOnline: { type: Boolean, default: false },
    
    // 🟢 CORRECT LOCATION for lastActive
    lastActive: {
        type: Date,
        default: Date.now 
    }, 
    
    // 🟢 CORRECT LOCATION for role (outside of lastActive)
    role: { 
        type: String, 
        required: true,
        enum: ['user', 'admin'], 
        default: 'user' 
    },

}, { timestamps: true }); // timestamps is an option for the main schema

module.exports = mongoose.model('User', UserSchema);