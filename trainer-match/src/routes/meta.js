const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/districts', (req, res) => {
  res.json({ districts: db.all('districts') });
});

router.get('/gyms', (req, res) => {
  const { districtId } = req.query;
  let gyms = db.all('gyms');
  if (districtId) {
    gyms = gyms.filter((g) => g.districtId === Number(districtId));
  }
  res.json({ gyms });
});

module.exports = router;
