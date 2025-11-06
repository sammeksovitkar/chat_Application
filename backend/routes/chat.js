// office-chat-backend/routes/chat.js (FINAL, WORKING VERSION)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs'); 
const auth = require('../middleware/auth'); 
const Chat = require('../models/Chat'); 

// --- Multer Storage Configuration ---
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); 
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|docx|xlsx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Error: Only images and documents allowed!')); 
        }
    },
}).single('file'); 


// @route   POST api/chats/text
// @desc    Save a text message to the database
// @access  Private
router.post('/text', auth, async (req, res) => {
    const { chatId, content } = req.body;
    try {
        const newMessage = new Chat({
            sender: req.user.id,
            chatId,
            content,
            type: 'text',
            timestamp: Date.now(),
        });
        const savedMessage = await newMessage.save();
        // 🟢 CRITICAL: Populate sender details for frontend to read
        await savedMessage.populate('sender', 'name'); 
        res.status(201).json(savedMessage); 
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error saving text message');
    }
});

// @route   POST api/chats/upload
// @desc    Handle file upload (photo/document) and save message
// @access  Private
router.post('/upload', auth, (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            // Respond with 400 and the error message for the frontend alert
            return res.status(400).json({ msg: err.message || 'File upload failed: Check size/type.' });
        }
        if (!req.file) {
            return res.status(400).json({ msg: 'No file selected' });
        }

        try {
            // 🟢 CRITICAL FIX: Use the simple relative path for storage
            const fileUrl = `/uploads/${req.file.filename}`;
            
            const newMessage = new Chat({
                sender: req.user.id,
                chatId: req.body.chatId,
                content: fileUrl, 
                type: req.file.mimetype.startsWith('image/') ? 'image' : 'document',
                timestamp: Date.now(),
            });
            const savedMessage = await newMessage.save();
            
            // 🟢 CRITICAL: Populate sender details for frontend to read
            await savedMessage.populate('sender', 'name'); 

            // Return the full saved message object (used by frontend to broadcast)
            res.json(savedMessage);
            
        } catch (dbError) {
            console.error('DB Error during file save:', dbError);
            res.status(500).send('Server Error processing file message.');
        }
    });
});

// @route   GET api/chats/:chatId
// @desc    Fetch message history for a specific chat
// @access  Private
router.get('/:chatId', auth, async (req, res) => {
    try {
        const messages = await Chat.find({ chatId: req.params.chatId })
                                   .populate('sender', 'name staffId') 
                                   .sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error fetching history');
    }
});

// @route   PUT api/chats/:messageId
// @desc    Edit a message's content
// @access  Private
router.put('/:messageId', auth, async (req, res) => {
    try {
        const message = await Chat.findById(req.params.messageId);
        
        if (!message) { return res.status(404).json({ msg: 'Message not found' }); }
        if (message.sender.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized to edit this message' });
        }
        
        message.content = req.body.content;
        message.edited = true;
        await message.save();
        
        // Broadcast the edit event to all clients in the room
        if (req.io) {
            req.io.to(message.chatId).emit('message_edited', {
                messageId: message._id,
                newContent: message.content,
                chatId: message.chatId,
            });
        }

        res.json({ msg: 'Message updated and broadcasted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during message edit');
    }
});

// @route   DELETE api/chats/:messageId
// @desc    Delete a message (for everyone or locally)
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
    const { deleteForEveryone } = req.body;
    
    try {
        const message = await Chat.findById(req.params.messageId);

        if (!message) { return res.status(404).json({ msg: 'Message not found' }); }
        if (message.sender.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized to delete this message' });
        }

        if (deleteForEveryone) {
            await Chat.deleteOne({ _id: req.params.messageId });
            
            // Broadcast the delete event to all clients in the room
            if (req.io) {
                req.io.to(message.chatId).emit('message_deleted', {
                    messageId: req.params.messageId,
                    deleteForEveryone: true,
                    chatId: message.chatId,
                });
            }

            res.json({ msg: 'Message deleted for everyone' });
        } else {
            // Delete for sender only: Client handles the visual removal
            res.json({ msg: 'Message deleted locally (sender handled)' }); 
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error during message deletion');
    }
});

module.exports = router;