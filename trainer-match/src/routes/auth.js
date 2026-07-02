const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function publicUser(user) {
  const trainerProfile = db.find('trainerProfiles', (p) => p.userId === user.id);
  const clientProfile = db.find('clientProfiles', (p) => p.userId === user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    hasTrainerProfile: !!trainerProfile,
    hasClientProfile: !!clientProfile,
  };
}

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Вкажіть імʼя, email та пароль' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль має містити щонайменше 6 символів' });
  }
  const existing = db.find('users', (u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Користувач з таким email вже існує' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = db.insert('users', {
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  });
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.find('users', (u) => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Невірний email або пароль' });
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  const user = db.find('users', (u) => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'Користувача не знайдено' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
