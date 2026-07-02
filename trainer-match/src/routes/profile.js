const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function toIdArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter((n) => Number.isInteger(n));
}

router.get('/trainer', (req, res) => {
  const profile = db.find('trainerProfiles', (p) => p.userId === req.userId);
  res.json({ profile: profile || null });
});

router.put('/trainer', (req, res) => {
  const { bio = '', specialization = '', experienceYears = 0, price = 0, gymIds = [] } = req.body || {};
  if (!specialization.trim()) {
    return res.status(400).json({ error: 'Вкажіть спеціалізацію' });
  }
  const profile = db.upsertByUser('trainerProfiles', req.userId, {
    bio,
    specialization,
    experienceYears: Number(experienceYears) || 0,
    price: Number(price) || 0,
    gymIds: toIdArray(gymIds),
    updatedAt: new Date().toISOString(),
  });
  res.json({ profile });
});

router.get('/client', (req, res) => {
  const profile = db.find('clientProfiles', (p) => p.userId === req.userId);
  res.json({ profile: profile || null });
});

router.put('/client', (req, res) => {
  const { goals = '', districtIds = [], gymIds = [] } = req.body || {};
  const profile = db.upsertByUser('clientProfiles', req.userId, {
    goals,
    districtIds: toIdArray(districtIds),
    gymIds: toIdArray(gymIds),
    updatedAt: new Date().toISOString(),
  });
  res.json({ profile });
});

module.exports = router;
