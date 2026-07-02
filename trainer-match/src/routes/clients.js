const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function enrichGyms(gymIds) {
  const gyms = db.all('gyms');
  return gymIds.map((id) => gyms.find((g) => g.id === id)).filter(Boolean);
}

function enrichDistricts(districtIds) {
  const districts = db.all('districts');
  return districtIds.map((id) => districts.find((d) => d.id === id)).filter(Boolean);
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
  const { districtId, gymId } = req.query;
  const users = db.all('users');
  const gyms = db.all('gyms');

  let profiles = db.filter('clientProfiles', (p) => p.userId !== req.userId);

  if (gymId) {
    const gid = Number(gymId);
    profiles = profiles.filter((p) => p.gymIds.includes(gid));
  } else if (districtId) {
    const did = Number(districtId);
    profiles = profiles.filter((p) => p.districtIds.includes(did) || p.gymIds.some((id) => {
      const gym = gyms.find((g) => g.id === id);
      return gym && gym.districtId === did;
    }));
  }

  const result = profiles.map((p) => {
    const user = users.find((u) => u.id === p.userId);
    return {
      userId: p.userId,
      name: user ? user.name : 'Клієнт',
      goals: p.goals,
      districts: enrichDistricts(p.districtIds),
      gyms: enrichGyms(p.gymIds),
      application: findApplicationStatus(p.userId, req.userId),
    };
  });

  res.json({ clients: result });
});

module.exports = router;
