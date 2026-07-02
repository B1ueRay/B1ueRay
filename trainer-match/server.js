const express = require('express');
const path = require('path');
const seed = require('./src/seed');

const authRoutes = require('./src/routes/auth');
const metaRoutes = require('./src/routes/meta');
const profileRoutes = require('./src/routes/profile');
const trainerRoutes = require('./src/routes/trainers');
const clientRoutes = require('./src/routes/clients');
const applicationRoutes = require('./src/routes/applications');

seed.run();

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/applications', applicationRoutes);

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TrainerMatch server running on http://localhost:${PORT}`);
});
