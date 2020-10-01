const express = require("express");
const router = express.Router();
const bcrypt = require('bcryptjs');

// Import models
const User = require("../models/User");
const Account = require("../models/Account");

// Import validation
const { registerValidation } = require('./validations/validations');


// CREATE AN USER -> path: /users
router.post("/", async (req, res) => {

  // Validate data before creating an user
  const {error} = registerValidation(req.body);
  if (error) {
    return res.status(400).send(error.details[0].message);
  }

  // Check if the user is already in the database.
  const emailExists = await User.findOne({
    'email': req.body.email
  });
  if (emailExists) {
    return res.status(409).send("Email already in use!");
  }

  // Hash the password
  // The salt is just a randomly generated string, that will be added on top of the password before hashing. The number tells how many loops of hashes it does for generation.
  const salt = await bcrypt.genSalt(10);
  // This creates a hashed password, what only bcrypt can decrypt.
  const hashPassword = await bcrypt.hash(req.body.password, salt);

  const user = new User({
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    password: hashPassword,
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