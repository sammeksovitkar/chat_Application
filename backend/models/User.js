// office-chat-backend/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    staffId: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    // Profile picture path will be saved here after upload
    profilePic: { type: String, default: 'uploads/default.jpg' }, 
    isOnline: { type: Boolean, default: false },
    lastActive: {
    type: Date,
    default: Date.now ,
    role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
},
},
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);