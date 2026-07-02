const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function enrichGyms(gymIds) {
  const gyms = db.all('gyms');
  return gymIds
    .map((id) => gyms.find((g) => g.id === id))
    .filter(Boolean);
}

function findApplicationStatus(clientUserId, trainerUserId) {
  const app = db.find(
    'applications',
    (a) => a.clientUserId === clientUserId && a.trainerUserId === trainerUserId && a.status !== 'cancelled' && a.status !== 'declined'
  ) || db.find(
    'applications',
    (a) => a.clientUserId === clientUserId && a.trainerUserId === trainerUserId
  );
  return app ? { status: app.status, initiator: app.initiator, applicationId: app.id } : null;
}

router.get('/', (req, res) => {
  const { districtId, gymId, specialization, maxPrice } = req.query;
  const users = db.all('users');
  const gyms = db.all('gyms');

  let profiles = db.filter('trainerProfiles', (p) => p.userId !== req.userId);

  if (gymId) {
    const gid = Number(gymId);
    profiles = profiles.filter((p) => p.gymIds.includes(gid));
  } else if (districtId) {
    const did = Number(districtId);
    const gymIdsInDistrict = gyms.filter((g) => g.districtId === did).map((g) => g.id);
    profiles = profiles.filter((p) => p.gymIds.some((id) => gymIdsInDistrict.includes(id)));
  }

  if (specialization) {
    const needle = specialization.toLowerCase();
    profiles = profiles.filter((p) => p.specialization.toLowerCase().includes(needle));
  }

  if (maxPrice) {
    const max = Number(maxPrice);
    profiles = profiles.filter((p) => p.price <= max);
  }

  const result = profiles.map((p) => {
    const user = users.find((u) => u.id === p.userId);
    return {
      userId: p.userId,
      name: user ? user.name : 'Тренер',
      bio: p.bio,
      specialization: p.specialization,
      experienceYears: p.experienceYears,
      price: p.price,
      gyms: enrichGyms(p.gymIds),
      application: findApplicationStatus(req.userId, p.userId),
    };
  });

  res.json({ trainers: result });
});

module.exports = router;
