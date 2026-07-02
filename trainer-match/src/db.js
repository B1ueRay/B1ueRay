const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.json');

function emptyState() {
  return {
    seq: {},
    users: [],
    trainerProfiles: [],
    clientProfiles: [],
    districts: [],
    gyms: [],
    applications: [],
  };
}

function load() {
  if (!fs.existsSync(DB_PATH)) {
    return emptyState();
  }
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to read data.json, starting fresh:', err.message);
    return emptyState();
  }
}

let state = load();

function persist() {
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2));
}

function nextId(collection) {
  state.seq[collection] = (state.seq[collection] || 0) + 1;
  return state.seq[collection];
}

function insert(collection, record) {
  const row = { id: nextId(collection), ...record };
  state[collection].push(row);
  persist();
  return row;
}

function all(collection) {
  return state[collection];
}

function find(collection, predicate) {
  return state[collection].find(predicate);
}

function filter(collection, predicate) {
  return state[collection].filter(predicate);
}

function update(collection, id, patch) {
  const row = state[collection].find((r) => r.id === id);
  if (!row) return null;
  Object.assign(row, patch);
  persist();
  return row;
}

function upsertByUser(collection, userId, patch) {
  const existing = state[collection].find((r) => r.userId === userId);
  if (existing) {
    Object.assign(existing, patch);
    persist();
    return existing;
  }
  return insert(collection, { userId, ...patch });
}

module.exports = { insert, all, find, filter, update, upsertByUser, persist };
