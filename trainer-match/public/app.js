const API_BASE = '/api';

let token = localStorage.getItem('fitmatch_token') || null;
let currentUser = null;
let districts = [];
let gyms = [];

let activeRole = localStorage.getItem('fitmatch_role') || 'client';
let activeSubTab = 'search';
let authMode = 'login';

let editingClientProfile = false;
let editingTrainerProfile = false;

let clientFormSelection = { districtIds: [], gymIds: [] };
let trainerFormSelection = { gymIds: [] };
let clientFilters = { districtId: '', gymId: '', specialization: '', maxPrice: '' };
let trainerBrowseFilters = { districtId: '', gymId: '' };

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || t('errorGeneric'));
  return data;
}

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ── Auth screen ── */

function renderAuthLangRow() {
  const row = document.getElementById('auth-lang-row');
  row.innerHTML = Object.keys(I18N).map((l) => `
    <button type="button" class="icon-btn" style="${l === currentLang ? 'background:var(--accent);color:#04160a' : ''}" onclick="setLang('${l}')">${l.toUpperCase()}</button>
  `).join('');
}

function renderAuthTexts() {
  document.getElementById('auth-tagline').textContent = t('tagline');
  document.getElementById('label-name').textContent = t('authName');
  document.getElementById('label-email').textContent = t('authEmail');
  document.getElementById('label-password').textContent = t('authPassword');
  document.getElementById('input-name').placeholder = t('authName');
  document.getElementById('field-name').style.display = authMode === 'register' ? 'block' : 'none';
  document.getElementById('input-name').required = authMode === 'register';
  document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? t('authLoginBtn') : t('authRegisterBtn');
  document.getElementById('auth-switch').textContent = authMode === 'login' ? t('authSwitchToRegister') : t('authSwitchToLogin');
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  document.getElementById('auth-error').textContent = '';
  renderAuthTexts();
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';
  const email = document.getElementById('input-email').value.trim();
  const password = document.getElementById('input-password').value;
  const name = document.getElementById('input-name').value.trim();
  try {
    const data = authMode === 'login'
      ? await api('/auth/login', { method: 'POST', body: { email, password } })
      : await api('/auth/register', { method: 'POST', body: { name, email, password } });
    token = data.token;
    localStorage.setItem('fitmatch_token', token);
    currentUser = data.user;
    await startMain();
  } catch (err) {
    errEl.textContent = err.message;
  }
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('main-screen').style.display = 'none';
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('fitmatch_token');
  location.reload();
}

/* ── Main app shell ── */

async function startMain() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-screen').style.display = 'flex';

  const [{ districts: d }, { gyms: g }] = await Promise.all([
    api('/meta/districts'),
    api('/meta/gyms'),
  ]);
  districts = d;
  gyms = g;

  renderLangSelect();
  renderHeaderTexts();
  renderTabTexts();

  document.getElementById('role-client-tab').onclick = () => switchRole('client');
  document.getElementById('role-trainer-tab').onclick = () => switchRole('trainer');
  document.getElementById('sub-search-tab').onclick = () => switchSubTab('search');
  document.getElementById('sub-applications-tab').onclick = () => switchSubTab('applications');
  document.getElementById('logout-btn').onclick = logout;

  updateTabActiveStates();
  await renderContent();
}

function renderLangSelect() {
  const sel = document.getElementById('lang-select');
  sel.innerHTML = Object.keys(I18N).map((l) => `<option value="${l}" ${l === currentLang ? 'selected' : ''}>${I18N[l].langName}</option>`).join('');
  sel.onchange = (e) => setLang(e.target.value);
}

function renderHeaderTexts() {
  document.getElementById('logout-btn').textContent = t('logout');
}

function renderTabTexts() {
  document.getElementById('role-client-tab').textContent = t('roleClient');
  document.getElementById('role-trainer-tab').textContent = t('roleTrainer');
  document.getElementById('sub-search-tab').textContent = t('navSearch');
  document.getElementById('sub-applications-tab').textContent = t('navApplications');
}

function updateTabActiveStates() {
  document.getElementById('role-client-tab').classList.toggle('active', activeRole === 'client');
  document.getElementById('role-trainer-tab').classList.toggle('active', activeRole === 'trainer');
  document.getElementById('sub-search-tab').classList.toggle('active', activeSubTab === 'search');
  document.getElementById('sub-applications-tab').classList.toggle('active', activeSubTab === 'applications');
}

function switchRole(role) {
  activeRole = role;
  activeSubTab = 'search';
  editingClientProfile = false;
  editingTrainerProfile = false;
  localStorage.setItem('fitmatch_role', role);
  updateTabActiveStates();
  renderContent();
}

function switchSubTab(tab) {
  activeSubTab = tab;
  editingClientProfile = false;
  editingTrainerProfile = false;
  updateTabActiveStates();
  renderContent();
}

async function renderContent() {
  try {
    if (activeRole === 'client' && activeSubTab === 'search') return await renderClientSearch();
    if (activeRole === 'client' && activeSubTab === 'applications') return await renderClientApplications();
    if (activeRole === 'trainer' && activeSubTab === 'search') return await renderTrainerSearch();
    if (activeRole === 'trainer' && activeSubTab === 'applications') return await renderTrainerApplications();
  } catch (err) {
    document.getElementById('main-content').innerHTML = `<div class="empty-note">${escapeHtml(err.message)}</div>`;
  }
}

/* ── Shared option/chip builders ── */

function districtOptionsHtml(selected) {
  return `<option value="">${t('filterAll')}</option>` +
    districts.map((d) => `<option value="${d.id}" ${String(d.id) === String(selected) ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('');
}

function gymOptionsHtml(selectedDistrictId, selectedGymId) {
  const list = selectedDistrictId ? gyms.filter((g) => String(g.districtId) === String(selectedDistrictId)) : gyms;
  return `<option value="">${t('filterAll')}</option>` +
    list.map((g) => `<option value="${g.id}" ${String(g.id) === String(selectedGymId) ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
}

function districtChipsHtml(selectedIds) {
  return districts.map((d) => `<div class="chip ${selectedIds.includes(d.id) ? 'selected' : ''}" onclick="toggleClientDistrictChip(${d.id})">${escapeHtml(d.name)}</div>`).join('');
}

function gymChipsHtml(selectedIds, toggleFnName) {
  return gyms.map((g) => {
    const dist = districts.find((d) => d.id === g.districtId);
    const label = dist ? `${g.name} (${dist.name})` : g.name;
    return `<div class="chip ${selectedIds.includes(g.id) ? 'selected' : ''}" onclick="${toggleFnName}(${g.id})">${escapeHtml(label)}</div>`;
  }).join('');
}

function toggleClientDistrictChip(id) {
  const arr = clientFormSelection.districtIds;
  const idx = arr.indexOf(id);
  if (idx === -1) arr.push(id); else arr.splice(idx, 1);
  document.getElementById('cf-districts').innerHTML = districtChipsHtml(arr);
}

function toggleClientGymChip(id) {
  const arr = clientFormSelection.gymIds;
  const idx = arr.indexOf(id);
  if (idx === -1) arr.push(id); else arr.splice(idx, 1);
  document.getElementById('cf-gyms').innerHTML = gymChipsHtml(arr, 'toggleClientGymChip');
}

function toggleTrainerGymChip(id) {
  const arr = trainerFormSelection.gymIds;
  const idx = arr.indexOf(id);
  if (idx === -1) arr.push(id); else arr.splice(idx, 1);
  document.getElementById('tf-gyms').innerHTML = gymChipsHtml(arr, 'toggleTrainerGymChip');
}

/* ── Application actions (shared) ── */

function applicationActionHtml(application, targetType, targetUserId) {
  if (!application) {
    return `
    <div class="field" style="margin-bottom:8px">
      <input type="text" id="msg-${targetType}-${targetUserId}" placeholder="${t('messagePlaceholder')}" />
    </div>
    <button class="btn-primary" onclick="sendApplicationAction('${targetType}', ${targetUserId})">${targetType === 'trainer' ? t('sendApplication') : t('inviteClient')}</button>`;
  }
  const statusKey = { pending: 'applicationPending', accepted: 'applicationAccepted', declined: 'applicationDeclined', cancelled: 'applicationCancelled' }[application.status];
  const isMine = (targetType === 'trainer' && application.initiator === 'client') || (targetType === 'client' && application.initiator === 'trainer');
  let extra = '';
  if (application.status === 'pending' && isMine) {
    extra = `<button class="btn-secondary btn-danger" style="margin-top:8px" onclick="cancelApplication(${application.applicationId})">${t('cancelApplication')}</button>`;
  }
  return `<div class="status-pill status-${application.status}">${t(statusKey)}</div>${extra}`;
}

async function sendApplicationAction(targetType, targetUserId) {
  const input = document.getElementById(`msg-${targetType}-${targetUserId}`);
  const message = input ? input.value.trim() : '';
  try {
    if (targetType === 'trainer') {
      await api('/applications/client-to-trainer', { method: 'POST', body: { trainerUserId: targetUserId, message } });
    } else {
      await api('/applications/trainer-to-client', { method: 'POST', body: { clientUserId: targetUserId, message } });
    }
    showToast(t('applicationSent'));
    await renderContent();
  } catch (err) {
    showToast(err.message);
  }
}

async function cancelApplication(id) {
  try {
    await api(`/applications/${id}`, { method: 'PATCH', body: { action: 'cancel' } });
    showToast(t('applicationCancelled'));
    await renderContent();
  } catch (err) {
    showToast(err.message);
  }
}

async function respondApplication(id, action) {
  try {
    await api(`/applications/${id}`, { method: 'PATCH', body: { action } });
    showToast(action === 'accept' ? t('applicationAccepted') : t('applicationDeclined'));
    await renderContent();
  } catch (err) {
    showToast(err.message);
  }
}

/* ── Client role: search ── */

function editClientProfile() {
  editingClientProfile = true;
  renderContent();
}

function clientProfileFormHtml(profile) {
  clientFormSelection.districtIds = profile ? [...profile.districtIds] : [];
  clientFormSelection.gymIds = profile ? [...profile.gymIds] : [];
  return `
  <div class="card-panel">
    <h2>${t('clientProfileTitle')}</h2>
    <div class="hint">${t('clientProfileHint')}</div>
    <div class="field">
      <label>${t('goalsLabel')}</label>
      <textarea id="cf-goals" placeholder="${t('goalsPlaceholder')}">${escapeHtml(profile ? profile.goals : '')}</textarea>
    </div>
    <div class="field">
      <label>${t('districtsLabel')}</label>
      <div class="multiselect" id="cf-districts">${districtChipsHtml(clientFormSelection.districtIds)}</div>
    </div>
    <div class="field">
      <label>${t('gymsLabel')}</label>
      <div class="multiselect" id="cf-gyms">${gymChipsHtml(clientFormSelection.gymIds, 'toggleClientGymChip')}</div>
    </div>
    <button class="btn-primary" id="cf-save-btn">${t('saveProfile')}</button>
  </div>`;
}

function bindClientProfileForm() {
  document.getElementById('cf-save-btn').onclick = async () => {
    const goals = document.getElementById('cf-goals').value.trim();
    try {
      await api('/profile/client', {
        method: 'PUT',
        body: { goals, districtIds: clientFormSelection.districtIds, gymIds: clientFormSelection.gymIds },
      });
      currentUser.hasClientProfile = true;
      editingClientProfile = false;
      showToast(t('profileSaved'));
      await renderContent();
    } catch (err) {
      showToast(err.message);
    }
  };
}

function clientFiltersHtml() {
  return `
  <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
    <button class="icon-btn" onclick="editClientProfile()">${t('editProfile')}</button>
  </div>
  <div class="filters">
    <div class="field full" style="margin-bottom:0">
      <label>${t('filterDistrict')}</label>
      <select id="filter-district">${districtOptionsHtml(clientFilters.districtId)}</select>
    </div>
    <div class="field" style="margin-bottom:0">
      <label>${t('filterGym')}</label>
      <select id="filter-gym">${gymOptionsHtml(clientFilters.districtId, clientFilters.gymId)}</select>
    </div>
    <div class="field" style="margin-bottom:0">
      <label>${t('filterMaxPrice')}</label>
      <input type="number" id="filter-maxprice" min="0" value="${clientFilters.maxPrice || ''}" />
    </div>
    <div class="field full" style="margin-bottom:0">
      <label>${t('filterSpecialization')}</label>
      <input type="text" id="filter-spec" value="${escapeHtml(clientFilters.specialization || '')}" placeholder="${t('specializationPlaceholder')}" />
    </div>
    <div class="full">
      <button class="btn-secondary" id="apply-filters-btn">${t('applyFilters')}</button>
    </div>
  </div>`;
}

function bindClientFilters() {
  document.getElementById('filter-district').onchange = (e) => {
    clientFilters.districtId = e.target.value;
    clientFilters.gymId = '';
    renderContent();
  };
  document.getElementById('filter-gym').onchange = (e) => {
    clientFilters.gymId = e.target.value;
    renderContent();
  };
  document.getElementById('apply-filters-btn').onclick = () => {
    clientFilters.maxPrice = document.getElementById('filter-maxprice').value;
    clientFilters.specialization = document.getElementById('filter-spec').value.trim();
    renderContent();
  };
}

function trainerCardHtml(tr) {
  const gymTags = tr.gyms.map((g) => `<span class="tag">${escapeHtml(g.name)}</span>`).join('');
  return `
  <div class="person-card">
    <div class="person-name">${escapeHtml(tr.name)}</div>
    <div class="person-sub">${escapeHtml(tr.specialization)}</div>
    ${tr.bio ? `<div class="person-bio">${escapeHtml(tr.bio)}</div>` : ''}
    <div class="person-meta">
      <span>⭐ ${tr.experienceYears} ${t('experienceYears')}</span>
      <span>💵 ${tr.price} ${t('pricePerSession')}</span>
    </div>
    <div class="tags">${gymTags}</div>
    ${applicationActionHtml(tr.application, 'trainer', tr.userId)}
  </div>`;
}

function trainersListHtml(trainers) {
  if (!trainers.length) return `<div class="empty-note">${t('trainersEmpty')}</div>`;
  return trainers.map(trainerCardHtml).join('');
}

async function renderClientSearch() {
  const { profile } = await api('/profile/client');
  const main = document.getElementById('main-content');
  if (!profile || editingClientProfile) {
    main.innerHTML = clientProfileFormHtml(profile);
    bindClientProfileForm();
    return;
  }
  const params = new URLSearchParams();
  if (clientFilters.districtId) params.set('districtId', clientFilters.districtId);
  if (clientFilters.gymId) params.set('gymId', clientFilters.gymId);
  if (clientFilters.specialization) params.set('specialization', clientFilters.specialization);
  if (clientFilters.maxPrice) params.set('maxPrice', clientFilters.maxPrice);
  const { trainers } = await api('/trainers?' + params.toString());
  main.innerHTML = clientFiltersHtml() + trainersListHtml(trainers);
  bindClientFilters();
}

async function renderClientApplications() {
  const { applications } = await api('/applications?as=client');
  const main = document.getElementById('main-content');
  if (!applications.length) {
    main.innerHTML = `<div class="empty-note">${t('applicationsEmpty')}</div>`;
    return;
  }
  main.innerHTML = applications.map(clientApplicationItemHtml).join('');
}

function clientApplicationItemHtml(a) {
  const statusKey = { pending: 'applicationPending', accepted: 'applicationAccepted', declined: 'applicationDeclined', cancelled: 'applicationCancelled' }[a.status];
  let actions = '';
  if (a.status === 'pending') {
    actions = a.initiator === 'client'
      ? `<div class="app-item-actions"><button class="btn-secondary btn-danger" onclick="cancelApplication(${a.id})">${t('cancelApplication')}</button></div>`
      : `<div class="app-item-actions">
          <button class="btn-primary" onclick="respondApplication(${a.id}, 'accept')">${t('accept')}</button>
          <button class="btn-secondary btn-danger" onclick="respondApplication(${a.id}, 'decline')">${t('decline')}</button>
        </div>`;
  }
  return `
  <div class="app-item">
    <div class="app-item-top">
      <div class="app-item-name">${escapeHtml(a.trainerName)}</div>
      <span class="status-pill status-${a.status}" style="width:auto;padding:4px 10px;font-size:11px">${t(statusKey)}</span>
    </div>
    ${a.message ? `<div class="app-item-msg">${escapeHtml(a.message)}</div>` : ''}
    ${actions}
  </div>`;
}

/* ── Trainer role: search ── */

function editTrainerProfile() {
  editingTrainerProfile = true;
  renderContent();
}

function trainerProfileFormHtml(profile) {
  trainerFormSelection.gymIds = profile ? [...profile.gymIds] : [];
  return `
  <div class="card-panel">
    <h2>${t('trainerProfileTitle')}</h2>
    <div class="hint">${t('trainerProfileHint')}</div>
    <div class="field">
      <label>${t('specializationLabel')}</label>
      <input type="text" id="tf-specialization" value="${escapeHtml(profile ? profile.specialization : '')}" placeholder="${t('specializationPlaceholder')}" />
    </div>
    <div class="field-row">
      <div class="field">
        <label>${t('experienceLabel')}</label>
        <input type="number" id="tf-experience" min="0" value="${profile ? profile.experienceYears : ''}" />
      </div>
      <div class="field">
        <label>${t('priceLabel')}</label>
        <input type="number" id="tf-price" min="0" value="${profile ? profile.price : ''}" />
      </div>
    </div>
    <div class="field">
      <label>${t('bioLabel')}</label>
      <textarea id="tf-bio" placeholder="${t('bioPlaceholder')}">${escapeHtml(profile ? profile.bio : '')}</textarea>
    </div>
    <div class="field">
      <label>${t('trainerGymsLabel')}</label>
      <div class="multiselect" id="tf-gyms">${gymChipsHtml(trainerFormSelection.gymIds, 'toggleTrainerGymChip')}</div>
    </div>
    <button class="btn-primary" id="tf-save-btn">${t('saveProfile')}</button>
  </div>`;
}

function bindTrainerProfileForm() {
  document.getElementById('tf-save-btn').onclick = async () => {
    const specialization = document.getElementById('tf-specialization').value.trim();
    const experienceYears = document.getElementById('tf-experience').value;
    const price = document.getElementById('tf-price').value;
    const bio = document.getElementById('tf-bio').value.trim();
    try {
      await api('/profile/trainer', {
        method: 'PUT',
        body: { specialization, experienceYears, price, bio, gymIds: trainerFormSelection.gymIds },
      });
      currentUser.hasTrainerProfile = true;
      editingTrainerProfile = false;
      showToast(t('profileSaved'));
      await renderContent();
    } catch (err) {
      showToast(err.message);
    }
  };
}

function trainerFiltersHtml() {
  return `
  <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
    <button class="icon-btn" onclick="editTrainerProfile()">${t('editProfile')}</button>
  </div>
  <div class="filters">
    <div class="field full" style="margin-bottom:0">
      <label>${t('filterDistrict')}</label>
      <select id="filter-t-district">${districtOptionsHtml(trainerBrowseFilters.districtId)}</select>
    </div>
    <div class="field full" style="margin-bottom:0">
      <label>${t('filterGym')}</label>
      <select id="filter-t-gym">${gymOptionsHtml(trainerBrowseFilters.districtId, trainerBrowseFilters.gymId)}</select>
    </div>
  </div>`;
}

function bindTrainerFilters() {
  document.getElementById('filter-t-district').onchange = (e) => {
    trainerBrowseFilters.districtId = e.target.value;
    trainerBrowseFilters.gymId = '';
    renderContent();
  };
  document.getElementById('filter-t-gym').onchange = (e) => {
    trainerBrowseFilters.gymId = e.target.value;
    renderContent();
  };
}

function clientCardHtml(c) {
  const districtTags = c.districts.map((d) => `<span class="tag">${escapeHtml(d.name)}</span>`).join('');
  const gymTags = c.gyms.map((g) => `<span class="tag">${escapeHtml(g.name)}</span>`).join('');
  return `
  <div class="person-card">
    <div class="person-name">${escapeHtml(c.name)}</div>
    ${c.goals ? `<div class="person-bio">${escapeHtml(c.goals)}</div>` : ''}
    <div class="tags">${districtTags}${gymTags}</div>
    ${applicationActionHtml(c.application, 'client', c.userId)}
  </div>`;
}

function clientsListHtml(clients) {
  if (!clients.length) return `<div class="empty-note">${t('clientsEmpty')}</div>`;
  return clients.map(clientCardHtml).join('');
}

async function renderTrainerSearch() {
  const { profile } = await api('/profile/trainer');
  const main = document.getElementById('main-content');
  if (!profile || editingTrainerProfile) {
    main.innerHTML = trainerProfileFormHtml(profile);
    bindTrainerProfileForm();
    return;
  }
  const params = new URLSearchParams();
  if (trainerBrowseFilters.districtId) params.set('districtId', trainerBrowseFilters.districtId);
  if (trainerBrowseFilters.gymId) params.set('gymId', trainerBrowseFilters.gymId);
  const { clients } = await api('/clients?' + params.toString());
  main.innerHTML = trainerFiltersHtml() + clientsListHtml(clients);
  bindTrainerFilters();
}

async function renderTrainerApplications() {
  const { applications } = await api('/applications?as=trainer');
  const main = document.getElementById('main-content');
  if (!applications.length) {
    main.innerHTML = `<div class="empty-note">${t('applicationsEmpty')}</div>`;
    return;
  }
  main.innerHTML = applications.map(trainerApplicationItemHtml).join('');
}

function trainerApplicationItemHtml(a) {
  const statusKey = { pending: 'applicationPending', accepted: 'applicationAccepted', declined: 'applicationDeclined', cancelled: 'applicationCancelled' }[a.status];
  let actions = '';
  if (a.status === 'pending') {
    actions = a.initiator === 'trainer'
      ? `<div class="app-item-actions"><button class="btn-secondary btn-danger" onclick="cancelApplication(${a.id})">${t('cancelApplication')}</button></div>`
      : `<div class="app-item-actions">
          <button class="btn-primary" onclick="respondApplication(${a.id}, 'accept')">${t('accept')}</button>
          <button class="btn-secondary btn-danger" onclick="respondApplication(${a.id}, 'decline')">${t('decline')}</button>
        </div>`;
  }
  return `
  <div class="app-item">
    <div class="app-item-top">
      <div class="app-item-name">${escapeHtml(a.clientName)}</div>
      <span class="status-pill status-${a.status}" style="width:auto;padding:4px 10px;font-size:11px">${t(statusKey)}</span>
    </div>
    ${a.message ? `<div class="app-item-msg">${escapeHtml(a.message)}</div>` : ''}
    ${actions}
  </div>`;
}

/* ── Language change / init ── */

function onLangChange() {
  document.documentElement.lang = currentLang;
  renderAuthLangRow();
  renderAuthTexts();
  if (currentUser) {
    renderLangSelect();
    renderHeaderTexts();
    renderTabTexts();
    renderContent();
  }
}

async function init() {
  document.documentElement.lang = currentLang;
  renderAuthLangRow();
  renderAuthTexts();
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
  document.getElementById('auth-switch').addEventListener('click', toggleAuthMode);

  if (token) {
    try {
      const data = await api('/auth/me');
      currentUser = data.user;
      await startMain();
      return;
    } catch (err) {
      token = null;
      localStorage.removeItem('fitmatch_token');
    }
  }
  showAuthScreen();
}

window.addEventListener('DOMContentLoaded', init);
