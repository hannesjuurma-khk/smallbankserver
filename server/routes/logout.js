const express = require("express");
const router = express.Router();

router.post('/', async (req, res) => {
  res.clearCookie("authorization");
  res.send('You have logged out!')
});

module.exports = router;