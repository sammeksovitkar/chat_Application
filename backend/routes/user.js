// office-chat-backend/routes/users.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User'); 

// @route   GET api/users
// @desc    Get all staff members (excluding password and including lastActive)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        // Find all users and select all fields EXCEPT password
        // This ensures 'lastActive' is included and sent to the frontend
        const users = await User.find().select('-password'); 
        // console.log(users,"asdfee")
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;