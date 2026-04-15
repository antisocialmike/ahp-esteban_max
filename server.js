require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const { randomBytes } = require('crypto');

// Genera un secreto de sesión en tiempo de ejecución si no existe en .env
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.startsWith('replace')) {
  const secret = randomBytes(48).toString('hex');
  console.warn('No valid SESSION_SECRET found; generated temporary secret for this process.');
  process.env.SESSION_SECRET = secret;
}

const db = require('./db');
const authRoutes = require('./routes/auth');
const vacantesRoutes = require('./routes/vacantes');
const postulacionesRoutes = require('./routes/postulaciones');
const candidatosRoutes = require('./routes/candidatos');
const { getDbBackend } = require('./db');
const { createSessionStore, getSessionStoreBackend } = require('./services/sessionStore');
const { sendApplicationReceivedEmail } = require('./services/emailNotifications');
const { getStorageBackend, saveBuffer } = require('./services/objectStorage');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Registro simple de peticiones para depuración
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Configuración de sesión
const { store: sessionStore } = createSessionStore();
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'keyboard cat',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 2,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true'
    }
  })
);

app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = randomBytes(32).toString('hex');
  }
  res.setHeader('X-CSRF-Token', req.session.csrfToken);
  next();
});

function csrfExempt(req) {
  if (req.path === '/upload') return true;
  if (req.path.startsWith('/api/public/')) return true;
  if (req.path === '/api/auth/login') return true;
  if (req.path === '/api/auth/register') return true;
  if (req.path === '/api/health/db') return true;
  return false;
}

function requireCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  if (csrfExempt(req)) {
    return next();
  }

  const token = req.get('x-csrf-token');
  if (!token || token !== req.session?.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  return next();
}

app.use(requireCsrf);

// Archivos estáticos con charset UTF-8 explícito para recursos de texto
app.use(
  express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
      } else if (ext === '.css') {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
      } else if (ext === '.js') {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
    }
  })
);

// Carga solo en memoria; no se escribe nada en disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfName = (file.originalname || '').toLowerCase().endsWith('.pdf');
    if (isPdfMime || isPdfName) {
      return cb(null, true);
    }
    cb(new Error('Only PDF files are allowed'));
  }
});

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

async function forwardPdfToN8n(file) {
  if (!N8N_WEBHOOK_URL) {
    throw new Error('N8N_WEBHOOK_URL is not configured in .env');
  }

  const formData = new FormData();
  const filename = file.originalname || 'document.pdf';
  const blob = new Blob([file.buffer], { type: file.mimetype || 'application/pdf' });
  formData.append('pdf', blob, filename);

  let n8nResponse;
  try {
    n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      body: formData
    });
  } catch (err) {
    const detail = err?.cause?.code || err?.cause?.message || err?.message || 'unknown network error';
    throw new Error(`Could not reach n8n webhook at ${N8N_WEBHOOK_URL} (${detail})`);
  }

  let payload;
  try {
    payload = await n8nResponse.json();
  } catch (err) {
    throw new Error(`Invalid JSON response from n8n (status ${n8nResponse.status})`);
  }

  if (!n8nResponse.ok || payload.ok === false) {
    const message = payload.message || `n8n returned status ${n8nResponse.status}`;
    throw new Error(message);
  }

  return payload;
}

async function upsertCandidateFromExtraction(extracted) {
  const correo = (extracted?.correo || '').trim();
  const nombre = (extracted?.nombre || '').trim();

  if (!correo || !nombre) {
    return null;
  }

  const telefono = extracted.telefono ? String(extracted.telefono).trim() : null;
  const area = extracted.area_especialidad ? String(extracted.area_especialidad).trim() : null;
  const exp = Number.isInteger(extracted.experiencia_anos)
    ? extracted.experiencia_anos
    : (extracted.experiencia_anos === null || extracted.experiencia_anos === '' ? null : Number(extracted.experiencia_anos));
  const experiencia = Number.isFinite(exp) ? Math.max(0, Math.trunc(exp)) : null;

  const [existing] = await db.pool.query('SELECT id FROM candidato WHERE correo = ?', [correo]);

  if (existing.length) {
    const candidatoId = existing[0].id;
    await db.pool.query(
      `UPDATE candidato
       SET nombre = ?, telefono = ?, area_especialidad = ?, experiencia_anos = ?
       WHERE id = ?`,
      [nombre, telefono, area, experiencia, candidatoId]
    );
    return candidatoId;
  }

  const [insertResult] = await db.pool.query(
    `INSERT INTO candidato (nombre, correo, telefono, area_especialidad, experiencia_anos)
     VALUES (?, ?, ?, ?, ?)`,
    [nombre, correo, telefono, area, experiencia]
  );

  return insertResult.insertId;
}

async function getRecommendedVacancies(candidatoId, areaEspecialidad) {
  let area = String(areaEspecialidad || '').trim();

  if (!area && candidatoId > 0) {
    const [candidateRows] = await db.pool.query(
      'SELECT area_especialidad FROM candidato WHERE id = ?',
      [candidatoId]
    );
    if (candidateRows.length) {
      area = (candidateRows[0].area_especialidad || '').trim();
    }
  }

  if (!area) {
    return { area: '', vacantes: [] };
  }

  const [rows] = await db.pool.query(
    `SELECT v.id, v.titulo, v.area, v.estatus, v.campus_id,
            CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS yaPostulado
     FROM vacante v
     LEFT JOIN postulacion p ON p.vacante_id = v.id AND p.candidato_id = ?
     WHERE v.estatus = 'OPEN'
       AND LOWER(TRIM(v.area)) = LOWER(TRIM(?))
     ORDER BY v.created_at DESC, v.id DESC`,
    [candidatoId, area]
  );

  return {
    area,
    vacantes: rows.map((row) => ({
      ...row,
      yaPostulado: row.yaPostulado === 1
    }))
  };
}

app.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No file received' });
  }

  try {
    await db.pool.query('SELECT 1 AS ok');
  } catch (err) {
    console.error('DB check failed on /upload:', err.message);
    return res.status(503).json({
      error: 'Database is not reachable',
      dbConnected: false
    });
  }

  try {
    const storedDocument = await saveBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      folder: 'cv-uploads',
      originalName: req.file.originalname,
      filenamePrefix: 'cv'
    });

    const n8nPayload = await forwardPdfToN8n(req.file);
    const extracted = n8nPayload.extracted || {};
    const areaEspecialidad = String(extracted.area_especialidad || '').trim();
    console.log('[UPLOAD] JSON recibido desde n8n:', JSON.stringify(extracted));

    const recomendacionesPrevias = await getRecommendedVacancies(0, areaEspecialidad);
    const openVacanciesCount = recomendacionesPrevias.vacantes.length;
    const hasMatchingOpenVacancies = openVacanciesCount > 0;

    let candidatoId = null;
    let storedInDb = false;

    if (hasMatchingOpenVacancies) {
      candidatoId = await upsertCandidateFromExtraction(extracted);
      storedInDb = Boolean(candidatoId);
    } else {
      console.log('[UPLOAD] No hay vacantes abiertas para el area detectada; no se guarda candidato.');
    }

    console.log('[UPLOAD] DB result:', storedInDb ? `OK (candidato_id=${candidatoId})` : 'Sin insercion por datos incompletos');

    res.json({
      ok: true,
      dbConnected: true,
      receivedFromN8n: true,
      storedInDb,
      hasMatchingOpenVacancies,
      openVacanciesCount,
      storageBackend: storedDocument.backend,
      documentPath: storedDocument.publicPath,
      extracted,
      candidatoId
    });
  } catch (err) {
    console.error('n8n processing failed on /upload:', err.message);
    res.status(502).json({
      ok: false,
      dbConnected: true,
      error: err.message || 'n8n processing failed'
    });
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Only PDF files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

app.get('/api/health/db', async (req, res) => {
  try {
    await db.pool.query('SELECT 1 AS ok');
    res.json({ dbConnected: true, backend: getDbBackend() });
  } catch (err) {
    console.error('DB healthcheck failed:', err.message);
    res.status(503).json({ dbConnected: false, backend: getDbBackend(), error: 'Database not reachable' });
  }
});

app.get('/api/health/ready', async (req, res) => {
  try {
    await db.pool.query('SELECT 1 AS ok');
    res.json({
      ok: true,
      dbConnected: true,
      dbBackend: getDbBackend(),
      sessionBackend: getSessionStoreBackend(),
      storageBackend: getStorageBackend()
    });
  } catch (err) {
    console.error('Readiness healthcheck failed:', err.message);
    res.status(503).json({
      ok: false,
      dbConnected: false,
      dbBackend: getDbBackend(),
      sessionBackend: getSessionStoreBackend(),
      storageBackend: getStorageBackend()
    });
  }
});

app.get('/api/auth/csrf-token', (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// Endpoint público de recomendaciones usado por el flujo de carga de CV.
app.get('/api/public/vacantes/recomendadas', async (req, res) => {
  try {
    const candidatoId = Number(req.query.candidato_id) || 0;
    const areaEspecialidad = String(req.query.area_especialidad || '').trim();
    const recomendaciones = await getRecommendedVacancies(candidatoId, areaEspecialidad);
    res.json(recomendaciones);
  } catch (err) {
    console.error('Error en recomendaciones publicas:', err.message);
    res.status(500).json({ error: 'DB error' });
  }
});

// Endpoint público de postulación desde el modal de recomendaciones.
app.post('/api/public/postulaciones', async (req, res) => {
  try {
    const candidatoId = Number(req.body.candidato_id);
    const vacanteId = Number(req.body.vacante_id);

    if (!Number.isInteger(candidatoId) || candidatoId <= 0 || !Number.isInteger(vacanteId) || vacanteId <= 0) {
      return res.status(400).json({ error: 'candidato_id y vacante_id son requeridos' });
    }

    const [candidateRows] = await db.pool.query(
      'SELECT id, nombre, correo, area_especialidad FROM candidato WHERE id = ?',
      [candidatoId]
    );
    if (!candidateRows.length) {
      return res.status(404).json({ error: 'Candidato no encontrado' });
    }

    const [vacanteRows] = await db.pool.query(
      'SELECT id, titulo, area, estatus FROM vacante WHERE id = ?',
      [vacanteId]
    );
    if (!vacanteRows.length) {
      return res.status(404).json({ error: 'Vacante no encontrada' });
    }

    const vacante = vacanteRows[0];
    const candidate = candidateRows[0];

    if (vacante.estatus !== 'OPEN') {
      return res.status(400).json({ error: 'La vacante no esta abierta' });
    }

    const candidateArea = String(candidate.area_especialidad || '').trim().toLowerCase();
    const vacanteArea = String(vacante.area || '').trim().toLowerCase();
    if (candidateArea && vacanteArea && candidateArea !== vacanteArea) {
      return res.status(400).json({ error: 'La vacante no coincide con el area de especialidad del candidato' });
    }

    try {
      const [insertResult] = await db.pool.query(
        'INSERT INTO postulacion (vacante_id, candidato_id) VALUES (?, ?)',
        [vacanteId, candidatoId]
      );

      await sendApplicationReceivedEmail({
        correo: candidate.correo,
        nombre: candidate.nombre,
        vacanteTitulo: vacante.titulo
      });

      return res.json({ ok: true, alreadyApplied: false, postulacionId: insertResult.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') {
        return res.json({ ok: true, alreadyApplied: true });
      }
      throw err;
    }
  } catch (err) {
    console.error('Error en postulacion publica:', err.message);
    res.status(500).json({ error: 'DB error' });
  }
});

// Middleware de autorización
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ error: 'Not authorized' });
}

// Protege el HTML del dashboard
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Monta rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/vacantes', requireAuth, vacantesRoutes);
app.use('/api/postulaciones', requireAuth, postulacionesRoutes);
app.use('/api/candidatos', candidatosRoutes); // POST abierto, GET protegido internamente

// Ruta de respaldo para otras rutas estáticas (login, create-account, index)
// Son servidas por express.static

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
