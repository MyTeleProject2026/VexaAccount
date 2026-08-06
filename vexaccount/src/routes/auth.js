const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Placeholder in-memory users (replace with DB)
const users = [];

router.post('/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  // TODO: hash password and store in DB
  users.push({ email, password });
  return res.status(201).json({ message: 'User registered' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1h' });
  return res.json({ token });
});

module.exports = router;
