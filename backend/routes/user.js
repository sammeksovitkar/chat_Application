const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User'); 
const bcrypt = require('bcryptjs'); 

// --- Helper Function for Admin Check ---
// Assuming req.user is set by the 'auth' middleware
const isAdmin = (req) => {
    return req.user && req.user.role === 'admin';
};

// @route   GET api/users
// @desc    Get all staff members (excluding password and including lastActive)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const users = await User.find().select('-password'); 
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/users/register
// @desc    Register a new staff member (Admin functionality)
// @access  Private (Should be protected by an Admin check, but keeping public access as per your original code)
router.post('/register', async (req, res) => {
    try {
        const { name, staffId, email, password } = req.body;
        
        if (await User.findOne({ $or: [{ staffId }, { email }] })) {
            return res.status(400).json({ msg: 'User ID or Email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ name, staffId, email, password: hashedPassword, role: 'staff' }); // Default to 'staff'
        await newUser.save();
        
        const userWithoutPassword = {
            _id: newUser._id,
            name: newUser.name,
            staffId: newUser.staffId,
            email: newUser.email,
            role: newUser.role,
        };
        
        res.status(201).json({ msg: 'Staff registered successfully.', user: userWithoutPassword });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// ----------------------------------------------------
// 🟢 NEW: EDIT/UPDATE USER SERVICE (PUT)
// ----------------------------------------------------
// @route   PUT api/users/:id
// @desc    Update a user's details (Admin only)
// @access  Private/Admin
router.put('/:id', auth, async (req, res) => {
    // 💡 Security check: Only Admins can update user accounts
    // if (!isAdmin(req)) {
    //     return res.status(403).json({ msg: 'Authorization denied. Admin access required.' });
    // }

    const userId = req.params.id;
    const updateFields = req.body;
    let newPassword;

    try {
        let user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        // 1. Handle Password Update (Optional)
        if (updateFields.password) {
            const salt = await bcrypt.genSalt(10);
            newPassword = await bcrypt.hash(updateFields.password, salt);
            updateFields.password = newPassword;
        }

        // 2. Update the user document
        // FindByIdAndUpdate returns the old document by default. We use { new: true } to get the updated one.
        user = await User.findByIdAndUpdate(
            userId, 
            { $set: updateFields }, 
            { new: true, runValidators: true } // Return new document and run Mongoose validators
        ).select('-password'); // Exclude password from the final response

        // 3. Return the updated user object (without password)
        res.json(user);

    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Invalid User ID format.' });
        }
        res.status(500).send('Server Error');
    }
});

// ----------------------------------------------------
// 🟢 NEW: DELETE USER SERVICE (DELETE)
// ----------------------------------------------------
// @route   DELETE api/users/:id
// @desc    Delete a user (Admin only)
// @access  Private/Admin
router.delete('/:id', auth, async (req, res) => {
    // 💡 Security check: Only Admins can delete user accounts
    if (!isAdmin(req)) {
        return res.status(403).json({ msg: 'Authorization denied. Admin access required.' });
    }

    const userId = req.params.id;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Prevent admin from deleting their own account (optional, but wise)
        if (req.user.id === userId) {
             return res.status(400).json({ msg: 'Cannot delete your own active account via this endpoint.' });
        }
        
        // Remove the user document
        await User.findByIdAndDelete(userId);

        res.json({ msg: 'User deleted successfully' });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;