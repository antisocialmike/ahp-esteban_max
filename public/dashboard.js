// Codigo para interacciones del dashboard

let selectedVacante = null;
let selectedCandidate = null;
let areasEspecialidad = [];
let currentCandidates = [];
let csrfToken = '';

// Estado de paginación
let paginationState = {
  vacantesCurrent: 1,
  vacantesTotal: 1,
  vacantesLimit: 100,
  candidatosCurrent: 1,
  candidatosTotal: 1,
  candidatosLimit: 100,
  isViewingCandidates: false,
  searchQuery: ''
};

async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  const res = await fetch('/api/auth/csrf-token', { method: 'GET' });
  const data = await res.json();
  csrfToken = data?.csrfToken || '';
  return csrfToken;
}

async function requestJson(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const nextOptions = { ...options };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await ensureCsrfToken();
    nextOptions.headers = {
      ...(options.headers || {}),
      'X-CSRF-Token': token
    };
  }

  const res = await fetch(url, nextOptions);
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (err) {
    data = null;
  }

  if (res.status === 401) {
    showInfoModal('Sesion expirada', 'Tu sesión expiró. Inicia sesión nuevamente.');
    setTimeout(() => {
      ahpNavigate('login.html');
    }, 900);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error((data && data.error) || 'Error de servidor');
  }

  return data;
}

// Retorna { data, headers } para extraer información de paginación
async function requestJsonWithHeaders(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const nextOptions = { ...options };

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = await ensureCsrfToken();
    nextOptions.headers = {
      ...(options.headers || {}),
      'X-CSRF-Token': token
    };
  }

  const res = await fetch(url, nextOptions);
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (err) {
    data = null;
  }

  if (res.status === 401) {
    showInfoModal('Sesion expirada', 'Tu sesión expiró. Inicia sesión nuevamente.');
    setTimeout(() => {
      ahpNavigate('login.html');
    }, 900);
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    throw new Error((data && data.error) || 'Error de servidor');
  }

  return {
    data,
    page: parseInt(res.headers.get('X-Page') || '1'),
    limit: parseInt(res.headers.get('X-Limit') || '100'),
    totalCount: parseInt(res.headers.get('X-Total-Count') || '0')
  };
}

function toggleMenu() {
  const menu = document.getElementById('menu');
  menu.classList.toggle('show');
}

function closeMenu() {
  const menu = document.getElementById('menu');
  menu.classList.remove('show');
}

async function loadVacantes(page = 1) {
  const search = document.getElementById('searchInput').value;
  try {
    const url = `/api/vacantes?search=${encodeURIComponent(search)}&page=${page}`;
    const { data: vacantes, page: currentPage, limit, totalCount } = await requestJsonWithHeaders(url);
    
    paginationState.vacantesCurrent = currentPage;
    paginationState.vacantesLimit = limit;
    paginationState.vacantesTotal = Math.ceil(totalCount / limit);
    paginationState.isViewingCandidates = false;
    paginationState.searchQuery = search;
    
    renderVacantes(vacantes);
    updatePaginationControls();
  } catch (err) {
    console.error(err);
    showInfoModal('No fue posible cargar vacantes', err.message || 'Intenta nuevamente.');
  }
}

function renderVacantes(vacantes) {
  const container = document.getElementById('vacantes');
  container.innerHTML = '';

  if (!Array.isArray(vacantes) || vacantes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><path d="M8 7V5a2 2 0 0 1 4 0"/></svg></div>
        <h3>No hay vacantes para mostrar</h3>
        <p>Prueba con otro t\u00e9rmino de b\u00fasqueda o crea una nueva vacante con el bot\u00f3n +.</p>
      </div>
    `;
    return;
  }

  vacantes.forEach(v => {
    const card = document.createElement('div');
    card.className = 'card';

    const tag = document.createElement('span');
    tag.className = 'card-tag';
    tag.textContent = 'Vacante';

    const title = document.createElement('h3');
    title.textContent = v.titulo || 'Vacante sin titulo';

    const meta = document.createElement('p');
    meta.className = 'card-meta';
    meta.textContent = v.area || 'Area sin especificar';

    const summary = document.createElement('div');
    summary.className = 'card-summary';

    const idChip = document.createElement('span');
    idChip.className = 'meta-chip';
    idChip.textContent = `ID #${v.id}`;

    const typeChip = document.createElement('span');
    typeChip.className = 'meta-chip';
    typeChip.textContent = 'Abierta';

    summary.appendChild(idChip);
    summary.appendChild(typeChip);

    const button = document.createElement('button');
    button.className = 'vacante-select-btn';
    button.textContent = 'Ver candidatos';
    button.addEventListener('click', () => selectVacante(v.id));

    card.appendChild(tag);
    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(summary);
    card.appendChild(button);
    container.appendChild(card);
  });
}

async function selectVacante(id) {
  selectedVacante = id;
  await loadCandidatos(id);
}

async function loadCandidatos(vacanteId, status = '', page = 1) {
  try {
    let url = `/api/vacantes/${vacanteId}/candidatos?page=${page}`;
    if (status) url += '&status=' + status;
    
    const { data: candidatos, page: currentPage, limit, totalCount } = await requestJsonWithHeaders(url);

    if (!Array.isArray(candidatos)) {
      throw new Error('Respuesta inválida al cargar candidatos');
    }

    paginationState.candidatosCurrent = currentPage;
    paginationState.candidatosLimit = limit;
    paginationState.candidatosTotal = Math.ceil(totalCount / limit);
    paginationState.isViewingCandidates = true;

    if (candidatos.length === 0) {
      renderEmptyCandidatesState();
      updatePaginationControls();
      return;
    }

    renderCandidatos(candidatos);
    updatePaginationControls();
  } catch (err) {
    console.error(err);
    showInfoModal(
      'No fue posible cargar candidatos',
      'Ocurrió un problema del sistema al consultar candidatos. Intenta nuevamente en unos segundos.'
    );
    loadVacantes();
  }
}

function renderCandidatos(candidates) {
  currentCandidates = candidates;
  const container = document.getElementById('vacantes');
  container.innerHTML = '';
  candidates.forEach(c => {
    const card = document.createElement('div');
    card.className = 'card';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    if (c.photo_path) {
      avatar.style.backgroundImage = `url(${c.photo_path})`;
    }

    const name = document.createElement('h3');
    name.textContent = c.nombre || 'Sin nombre';

    const area = document.createElement('p');
    area.className = 'card-meta';
    area.textContent = c.area_especialidad || 'Sin area';

    const summary = document.createElement('div');
    summary.className = 'card-summary';

    const statusChip = document.createElement('span');
    statusChip.className = `meta-chip status-${String(c.estatus || 'PENDIENTE').toLowerCase()}`;
    statusChip.textContent = c.estatus || 'PENDIENTE';

    const expChip = document.createElement('span');
    expChip.className = 'meta-chip';
    expChip.textContent = `${c.experiencia_anos || 0} años exp.`;

    summary.appendChild(statusChip);
    summary.appendChild(expChip);

    const details = document.createElement('div');
    details.className = 'candidate-details';

    const email = document.createElement('p');
    email.className = 'candidate-detail';
    email.textContent = c.correo || 'Correo no disponible';

    const interview = document.createElement('p');
    interview.className = 'candidate-detail';
    interview.textContent = c.interview_at
      ? `Entrevista: ${new Date(c.interview_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}`
      : 'Entrevista pendiente';

    details.appendChild(email);
    details.appendChild(interview);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const button = document.createElement('button');
    button.className = 'vacante-select-btn';
    button.textContent = 'Ver perfil';
    button.addEventListener('click', () => openCandidateModal(c.postulacion_id));

    const acceptButton = document.createElement('button');
    acceptButton.className = 'quick-action-btn quick-action-accept';
    acceptButton.textContent = 'Aceptar';
    acceptButton.disabled = c.estatus === 'ACEPTADO';
    acceptButton.addEventListener('click', () => quickUpdateCandidateStatus(c.postulacion_id, 'ACEPTADO'));

    const rejectButton = document.createElement('button');
    rejectButton.className = 'quick-action-btn quick-action-reject';
    rejectButton.textContent = 'Rechazar';
    rejectButton.disabled = c.estatus === 'RECHAZADO';
    rejectButton.addEventListener('click', () => quickUpdateCandidateStatus(c.postulacion_id, 'RECHAZADO'));

    card.appendChild(avatar);
    card.appendChild(name);
    card.appendChild(area);
    card.appendChild(summary);
    card.appendChild(details);
    actions.appendChild(button);
    actions.appendChild(acceptButton);
    actions.appendChild(rejectButton);
    card.appendChild(actions);
    container.appendChild(card);
  });
}

async function quickUpdateCandidateStatus(postulacionId, status) {
  try {
    await requestJson(`/api/postulaciones/${postulacionId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    Toast.success(`Candidato ${status === 'ACEPTADO' ? 'aceptado' : 'rechazado'}`);
    if (selectedVacante) {
      loadCandidatos(selectedVacante, '', paginationState.candidatosCurrent);
    }
  } catch (err) {
    console.error(err);
    Toast.error(err.message || 'No se pudo actualizar el estado');
  }
}

function renderEmptyCandidatesState() {
  const container = document.getElementById('vacantes');
  container.innerHTML = `
    <div class="empty-candidates-state">
      <h3>Aún no hay candidatos para esta vacante</h3>
      <p>Cuando lleguen postulaciones aparecerán aquí.</p>
      <button class="submit-btn" onclick="loadVacantes()">Volver a vacantes</button>
    </div>
  `;
}

async function openCandidateModal(postulacionId) {
  try {
    const rec = currentCandidates.find((row) => row.postulacion_id === postulacionId);
    if (!rec) return;
    selectedCandidate = rec;
    // Llenar modal
    document.getElementById('cvName').innerText = rec.nombre;
    document.getElementById('cvCorreo').innerText = rec.correo;
    document.getElementById('cvTelefono').innerText = 'Teléfono: ' + (rec.telefono || '--');
    document.getElementById('cvArea').innerText = 'Área: ' + (rec.area_especialidad || '--');
    document.getElementById('cvExperiencia').innerText = 'Experiencia: ' + (rec.experiencia_anos || 0) + ' años';
    // Foto
    const photoDiv = document.querySelector('.cv-photo');
    if (rec.photo_path) {
      photoDiv.style.backgroundImage = `url(${rec.photo_path})`;
      photoDiv.style.backgroundSize = 'cover';
      photoDiv.style.backgroundPosition = 'center';
    } else {
      photoDiv.style.backgroundImage = "url('stockuserphoto.png')";
      photoDiv.style.backgroundSize = 'cover';
      photoDiv.style.backgroundPosition = 'center';
    }
    // Valor inicial del campo de entrevista
    const iv = document.getElementById('interviewInput');
    iv.value = rec.interview_at ? rec.interview_at.replace(' ', 'T') : '';
    // Calcular "ya pasó"
    const passedEl = document.getElementById('cvPassed');
    if (rec.interview_at) {
      const dt = new Date(rec.interview_at);
      passedEl.innerText = dt < new Date() ? 'La entrevista ya pasó' : '';
    } else {
      passedEl.innerText = '';
    }
    document.getElementById('cvModal').classList.add('show-modal');
  } catch (err) {
    console.error(err);
  }
}

function closeModal() {
  document.getElementById('cvModal').classList.remove('show-modal');
}

async function updateStatus(status) {
  if (!selectedCandidate) return;
  try {
    await requestJson(`/api/postulaciones/${selectedCandidate.postulacion_id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    Toast.success(`Candidato ${status === 'ACEPTADO' ? 'aceptado' : 'rechazado'}`);
    closeModal();
    if (selectedVacante) loadCandidatos(selectedVacante);
  } catch (err) {
    console.error(err);
    Toast.error(err.message || 'Error al actualizar estado');
  }
}

async function saveInterview() {
  if (!selectedCandidate) return;
  const iv = document.getElementById('interviewInput').value;
  if (!iv) {
    Toast.warning('Selecciona una fecha y hora para guardar la entrevista');
    return;
  }

  try {
    await requestJson(`/api/postulaciones/${selectedCandidate.postulacion_id}/interview`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interview_at: iv || null })
    });

    closeModal();
    const when = new Date(iv);
    const prettyDate = Number.isNaN(when.getTime())
      ? iv
      : when.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    Toast.success(`Entrevista agendada para ${prettyDate}`);
    if (selectedVacante) loadCandidatos(selectedVacante);
  } catch (err) {
    console.error(err);
    Toast.error(err.message || 'No se pudo agendar la entrevista');
  }
}

// Vista de pendientes
async function openPendientes() {
  try {
    const list = await requestJson('/api/postulaciones/pending');
    const container = document.getElementById('pendientesList');
    container.innerHTML = '';
    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'pending-item';
      div.innerHTML = `
        <strong>${item.candidato_nombre}</strong> para <em>${item.vacante_titulo}</em>
        <div>
          <button onclick="updateStatusFromList(${item.id}, 'ACEPTADO')">Aceptar</button>
          <button onclick="updateStatusFromList(${item.id}, 'RECHAZADO')">Rechazar</button>
        </div>
      `;
      container.appendChild(div);
    });
    document.getElementById('pendientesModal').classList.add('show-modal');
  } catch (err) {
    console.error(err);
  }
}

function closePendientes() {
  document.getElementById('pendientesModal').classList.remove('show-modal');
}

async function openEntrevistasPendientes() {
  try {
    const list = await requestJson('/api/postulaciones/interviews-pending');

    if (!Array.isArray(list)) {
      throw new Error('Respuesta inválida al cargar entrevistas');
    }

    const container = document.getElementById('entrevistasList');
    container.innerHTML = '';

    if (!list.length) {
      container.innerHTML = '<div class="pending-item">No hay entrevistas pendientes por ahora.</div>';
    } else {
      list.forEach(item => {
        const interviewDate = item.interview_at
          ? new Date(item.interview_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
          : 'Sin fecha';

        const div = document.createElement('div');
        div.className = 'pending-item';
        div.innerHTML = `
          <strong>${item.candidato_nombre}</strong> para <em>${item.vacante_titulo}</em>
          <div style="margin-top:6px;">Fecha: ${interviewDate}</div>
          <div class="pending-actions" style="margin-top:8px;">
            <button class="status-btn" onclick="acceptFromInterviewList(${item.id})">Aceptar</button>
            <button class="status-btn" onclick="cancelInterviewFromList(${item.id})">Cancelar</button>
          </div>
        `;
        container.appendChild(div);
      });
    }

    closeMenu();
    document.getElementById('entrevistasModal').classList.add('show-modal');
  } catch (err) {
    console.error(err);
    showInfoModal('No fue posible cargar entrevistas', err.message || 'Intenta nuevamente.');
  }
}

function closeEntrevistasPendientes() {
  document.getElementById('entrevistasModal').classList.remove('show-modal');
}

function clearVacantesView() {
  const searchInput = document.getElementById('searchInput');
  searchInput.value = '';
  selectedVacante = null;
  loadVacantes();
}

function updatePaginationControls() {
  const container = document.getElementById('pagination-controls');
  if (!container) return;

  const state = paginationState;
  const isVacantes = !state.isViewingCandidates;
  const current = isVacantes ? state.vacantesCurrent : state.candidatosCurrent;
  const total = isVacantes ? state.vacantesTotal : state.candidatosTotal;

  // Mostrar/ocultar paginación
  if (total <= 1) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  // Actualizar estados de botones
  const prevBtn = container.querySelector('.pagination-prev');
  const nextBtn = container.querySelector('.pagination-next');
  const pageInfo = container.querySelector('.pagination-info');

  if (prevBtn) prevBtn.disabled = current <= 1;
  if (nextBtn) nextBtn.disabled = current >= total;
  if (pageInfo) pageInfo.textContent = `Página ${current} de ${total}`;
}

function previousPage() {
  const state = paginationState;
  const isVacantes = !state.isViewingCandidates;
  const current = isVacantes ? state.vacantesCurrent : state.candidatosCurrent;

  if (current <= 1) return;

  if (isVacantes) {
    loadVacantes(current - 1);
  } else {
    loadCandidatos(selectedVacante, '', current - 1);
  }
}

function nextPage() {
  const state = paginationState;
  const isVacantes = !state.isViewingCandidates;
  const current = isVacantes ? state.vacantesCurrent : state.candidatosCurrent;
  const total = isVacantes ? state.vacantesTotal : state.candidatosTotal;

  if (current >= total) return;

  if (isVacantes) {
    loadVacantes(current + 1);
  } else {
    loadCandidatos(selectedVacante, '', current + 1);
  }
}

async function updateStatusFromList(id, status) {
  try {
    await requestJson(`/api/postulaciones/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    openPendientes();
  } catch (err) {
    console.error(err);
  }
}

async function acceptFromInterviewList(id) {
  try {
    await requestJson(`/api/postulaciones/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACEPTADO' })
    });
    openEntrevistasPendientes();
  } catch (err) {
    console.error(err);
    showInfoModal('No fue posible aceptar', err.message || 'Intenta nuevamente.');
  }
}

async function cancelInterviewFromList(id) {
  try {
    await requestJson(`/api/postulaciones/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RECHAZADO' })
    });
    openEntrevistasPendientes();
  } catch (err) {
    console.error(err);
    showInfoModal('No fue posible actualizar', err.message || 'Intenta nuevamente.');
  }
}

function logout() {
  requestJson('/api/auth/logout', { method: 'POST' })
    .catch(() => null)
    .finally(() => {
      ahpNavigate('login.html');
    });
}

async function loadAreasEspecialidad() {
  try {
    const list = await requestJson('/api/vacantes/areas-especialidad');
    areasEspecialidad = Array.isArray(list) ? list : [];
    renderAreaOptions();
  } catch (err) {
    console.error(err);
    const select = document.getElementById('vacanteAreaSelect');
    if (select) {
      select.innerHTML = '<option value="">No se pudieron cargar áreas</option>';
    }
  }
}

function renderAreaOptions() {
  const select = document.getElementById('vacanteAreaSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Selecciona un area</option>';
  areasEspecialidad.forEach((area) => {
    const option = document.createElement('option');
    option.value = area.nombre;
    option.textContent = area.nombre;
    select.appendChild(option);
  });
}

function createVacante() {
  document.getElementById('vacanteTituloInput').value = '';
  renderAreaOptions();
  document.getElementById('createVacanteModal').classList.add('show-modal');
}

function closeCreateVacanteModal() {
  document.getElementById('createVacanteModal').classList.remove('show-modal');
}

function showInfoModal(title, message) {
  document.getElementById('infoModalTitle').innerText = title || 'Información';
  document.getElementById('infoModalMessage').innerText = message || '';
  document.getElementById('infoModal').classList.add('show-modal');
}

function closeInfoModal() {
  document.getElementById('infoModal').classList.remove('show-modal');
}

async function submitCreateVacante() {
  const titulo = document.getElementById('vacanteTituloInput').value.trim();
  const area = document.getElementById('vacanteAreaSelect').value;
  const submitBtn = document.querySelector('.vacante-form-actions .submit-btn');
  const originalText = submitBtn ? submitBtn.textContent : 'Guardar vacante';

  if (!titulo) {
    Toast.warning('El título de la vacante es obligatorio');
    return;
  }

  if (!area) {
    Toast.warning('Selecciona un área de especialidad');
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await requestJson('/api/vacantes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, area })
    });
    Toast.success('Vacante creada exitosamente');
    closeCreateVacanteModal();
    loadVacantes();
  } catch (err) {
    console.error(err);
    Toast.error(err.message || 'Error al crear vacante');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      submitBtn.textContent = originalText;
    }
  }
}

/* ============================================================
  INTERRUPTOR DE MODO OSCURO
  ============================================================ */

function initTheme() {
  const saved = localStorage.getItem('ahp-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', current);
  localStorage.setItem('ahp-theme', current);
  updateThemeIcon(current);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
}

/* ============================================================
  BARRA DE ESTADÍSTICAS
  ============================================================ */

async function loadStats() {
  try {
    const [vacRes, candRes, entRes] = await Promise.all([
      fetch('/api/vacantes?search='),
      fetch('/api/postulaciones/pending'),
      fetch('/api/postulaciones/interviews-pending')
    ]);

    if (vacRes.ok) {
      const vacs = await vacRes.json();
      const el = document.getElementById('statVacantes');
      if (el) el.textContent = Array.isArray(vacs) ? vacs.length : '—';
    }

    if (candRes.ok) {
      const cands = await candRes.json();
      const el = document.getElementById('statCandidatos');
      if (el) el.textContent = Array.isArray(cands) ? cands.length : '—';
    }

    if (entRes.ok) {
      const ents = await entRes.json();
      const el = document.getElementById('statEntrevistas');
      if (el) el.textContent = Array.isArray(ents) ? ents.length : '—';
    }
  } catch (err) {
    console.warn('Stats load failed:', err);
  }
}

// Carga inicial
initTheme();
const themeToggleBtn = document.getElementById('themeToggleBtn');
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', toggleTheme);
}
loadAreasEspecialidad();
loadStats();
loadVacantes();
ensureCsrfToken().catch(() => null);

// Cerrar modales al hacer clic fuera
window.onclick = function(e) {
  const menu = document.getElementById('menu');
  const profile = document.querySelector('.profile');
  const cv = document.getElementById('cvModal');
  const pend = document.getElementById('pendientesModal');
  const entrevistas = document.getElementById('entrevistasModal');
  const createVac = document.getElementById('createVacanteModal');
  const info = document.getElementById('infoModal');

  if (menu && profile && !profile.contains(e.target)) {
    closeMenu();
  }

  if (e.target === cv) closeModal();
  if (e.target === pend) closePendientes();
  if (e.target === entrevistas) closeEntrevistasPendientes();
  if (e.target === createVac) closeCreateVacanteModal();
  if (e.target === info) closeInfoModal();
};
