const express = require("express");
const router = express.Router();

// Import models
const User = require("../models/User");
const Account = require("../models/Account");


// CREATE AN USER -> path: /users
router.post("/", async (req, res) => {

  // Check if the user is already in the database.
  const emailExists = await User.findOne({
    'email': req.body.email
  });
  if (emailExists) {
    return res.status(409).send("Email already in use!");
  }

  const user = new User({
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    password: req.body.password,
    email: req.body.email
  });

  const account = new Account({
    // Assign created user id to account
    user: user._id,
    bankPrefix: process.env.BANK_PREFIX
  });

  try {
    const newUser = await user.save();
    const newAccount = await account.save();
    res.status(201).json({ newUser, newAccount });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;