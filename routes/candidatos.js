const express = require('express');
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.status(401).json({ error: 'Not authorized' });
}

const uploadsDir = path.join(__dirname, '../public/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// configure multer to store in public/uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // keep original name with timestamp prefix to avoid collisions
    const safeOriginalName = String(file.originalname || 'file')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    const unique = Date.now() + '-' + safeOriginalName;
    cb(null, unique);
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedMime.includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Tipo de archivo no permitido'));
  }
});

// stub for future CV parsing
function parseCv(cvPath) {
  // placeholder - in the future use OCR/parse logic
  return {};
}

// create or update candidate and optional postulacion
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const correo = String(req.body.correo || '').trim().toLowerCase();
    const telefono = String(req.body.telefono || '').trim();
    const area_especialidad = String(req.body.area_especialidad || '').trim();
    const experienciaRaw = req.body.experiencia_anos;
    const vacanteRaw = req.body.vacante_id;

    if (!nombre || !correo) {
      return res.status(400).json({ error: 'Name and email required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const experiencia = experienciaRaw === '' || experienciaRaw === undefined
      ? null
      : Number(experienciaRaw);
    if (experiencia !== null && (!Number.isFinite(experiencia) || experiencia < 0 || experiencia > 80)) {
      return res.status(400).json({ error: 'Invalid years of experience' });
    }

    const vacanteId = vacanteRaw ? Number(vacanteRaw) : null;
    if (vacanteRaw && (!Number.isInteger(vacanteId) || vacanteId <= 0)) {
      return res.status(400).json({ error: 'Invalid vacante_id' });
    }

    // check existing candidate
    const [existing] = await db.pool.query('SELECT * FROM candidato WHERE correo = ?', [correo]);
    let candidatoId;
    if (existing.length) {
      candidatoId = existing[0].id;
      // update missing fields
      await db.pool.query(
        `UPDATE candidato SET nombre = ?, telefono = ?, area_especialidad = ?, experiencia_anos = ?, photo_path = ?
         WHERE id = ?`,
        [nombre.slice(0, 120),
         telefono || existing[0].telefono,
         area_especialidad.slice(0, 120) || existing[0].area_especialidad,
         experiencia === null ? existing[0].experiencia_anos : Math.trunc(experiencia),
         req.file ? '/uploads/' + req.file.filename : existing[0].photo_path,
         candidatoId]
      );
    } else {
      const photoPath = req.file ? '/uploads/' + req.file.filename : null;
      const [result] = await db.pool.query(
        `INSERT INTO candidato (nombre, correo, telefono, area_especialidad, experiencia_anos, photo_path)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nombre.slice(0, 120), correo, telefono.slice(0, 30) || null, area_especialidad.slice(0, 120) || null, experiencia === null ? null : Math.trunc(experiencia), photoPath]
      );
      candidatoId = result.insertId;
    }
    // create postulacion if vacante_id provided
    if (vacanteId) {
      try {
        await db.pool.query(
          `INSERT INTO postulacion (vacante_id, candidato_id) VALUES (?, ?)`,
          [vacanteId, candidatoId]
        );
      } catch (err) {
        if (err.code !== 'SQLITE_CONSTRAINT' && err.code !== 'ER_DUP_ENTRY') {
          throw err;
        }
      }
    }
    res.json({ id: candidatoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// get candidate by id (protected)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await db.pool.query('SELECT id, nombre, correo, telefono, area_especialidad, experiencia_anos, photo_path FROM candidato WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message === 'Tipo de archivo no permitido') {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

module.exports = router;
