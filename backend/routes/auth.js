// office-chat-backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to hash password and register user
router.post('/register', async (req, res) => {
    try {
        const { name, staffId, email, password } = req.body;
        
        if (await User.findOne({ $or: [{ staffId }, { email }] })) {
            return res.status(400).json({ msg: 'User ID or Email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, staffId, email, password: hashedPassword });
        await newUser.save();
        
        res.status(201).json({ msg: 'Staff registered successfully. Please log in.' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Login User
router.post('/login', async (req, res) => {
    try {
        const { staffId, password } = req.body;

        const user = await User.findOne({ staffId });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials' });
        }

        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({ 
            token, 
            user: { id: user.id, name: user.name, staffId: user.staffId, email: user.email ,role:"fsf"} 
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;