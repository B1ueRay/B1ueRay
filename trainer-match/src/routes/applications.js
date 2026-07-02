const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function activeApplicationBetween(clientUserId, trainerUserId) {
  return db.find(
    'applications',
    (a) => a.clientUserId === clientUserId && a.trainerUserId === trainerUserId && (a.status === 'pending' || a.status === 'accepted')
  );
}

function serialize(app) {
  const users = db.all('users');
  const client = users.find((u) => u.id === app.clientUserId);
  const trainer = users.find((u) => u.id === app.trainerUserId);
  return {
    ...app,
    clientName: client ? client.name : 'Клієнт',
    trainerName: trainer ? trainer.name : 'Тренер',
  };
}

// Client applies to a trainer ("залишити заявку")
router.post('/client-to-trainer', (req, res) => {
  const { trainerUserId, message = '' } = req.body || {};
  const trainer = db.find('trainerProfiles', (p) => p.userId === Number(trainerUserId));
  if (!trainer) return res.status(404).json({ error: 'Тренера не знайдено' });
  if (Number(trainerUserId) === req.userId) {
    return res.status(400).json({ error: 'Не можна подати заявку самому собі' });
  }
  if (activeApplicationBetween(req.userId, Number(trainerUserId))) {
    return res.status(409).json({ error: 'Заявка вже існує' });
  }
  const app = db.insert('applications', {
    clientUserId: req.userId,
    trainerUserId: Number(trainerUserId),
    status: 'pending',
    initiator: 'client',
    message,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json({ application: serialize(app) });
});

// Trainer invites/selects a client
router.post('/trainer-to-client', (req, res) => {
  const { clientUserId, message = '' } = req.body || {};
  const client = db.find('clientProfiles', (p) => p.userId === Number(clientUserId));
  if (!client) return res.status(404).json({ error: 'Клієнта не знайдено' });
  if (Number(clientUserId) === req.userId) {
    return res.status(400).json({ error: 'Не можна запросити самого себе' });
  }
  if (activeApplicationBetween(Number(clientUserId), req.userId)) {
    return res.status(409).json({ error: 'Заявка вже існує' });
  }
  const app = db.insert('applications', {
    clientUserId: Number(clientUserId),
    trainerUserId: req.userId,
    status: 'pending',
    initiator: 'trainer',
    message,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json({ application: serialize(app) });
});

// List applications where current user participates, from either side
router.get('/', (req, res) => {
  const { as } = req.query;
  let apps;
  if (as === 'trainer') {
    apps = db.filter('applications', (a) => a.trainerUserId === req.userId);
  } else if (as === 'client') {
    apps = db.filter('applications', (a) => a.clientUserId === req.userId);
  } else {
    apps = db.filter('applications', (a) => a.trainerUserId === req.userId || a.clientUserId === req.userId);
  }
  apps = apps.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ applications: apps.map(serialize) });
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { action } = req.body || {};
  const app = db.find('applications', (a) => a.id === id);
  if (!app) return res.status(404).json({ error: 'Заявку не знайдено' });

  const isReceiver = app.initiator === 'client' ? app.trainerUserId === req.userId : app.clientUserId === req.userId;
  const isInitiator = app.initiator === 'client' ? app.clientUserId === req.userId : app.trainerUserId === req.userId;

  if (action === 'accept' || action === 'decline') {
    if (!isReceiver) return res.status(403).json({ error: 'Тільки отримувач заявки може її прийняти або відхилити' });
    if (app.status !== 'pending') return res.status(409).json({ error: 'Заявка вже оброблена' });
    const updated = db.update('applications', id, { status: action === 'accept' ? 'accepted' : 'declined', updatedAt: new Date().toISOString() });
    return res.json({ application: serialize(updated) });
  }

  if (action === 'cancel') {
    if (!isInitiator) return res.status(403).json({ error: 'Тільки автор заявки може її скасувати' });
    if (app.status !== 'pending') return res.status(409).json({ error: 'Можна скасувати лише заявку, що очікує' });
    const updated = db.update('applications', id, { status: 'cancelled', updatedAt: new Date().toISOString() });
    return res.json({ application: serialize(updated) });
  }

  return res.status(400).json({ error: 'Невідома дія' });
});

module.exports = router;
