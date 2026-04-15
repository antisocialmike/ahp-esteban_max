const express = require('express');
const { z } = require('zod');
const db = require('../db');
const router = express.Router();

const createVacanteSchema = z.object({
  titulo: z.string().trim().min(1).max(160),
  area: z.string().trim().max(120).optional().or(z.literal(''))
});

function parsePagination(query, defaultLimit = 100, maxLimit = 200) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function getUserScope(userId) {
  const [rows] = await db.pool.query(
    'SELECT cliente_id, campus_id FROM usuario_rh WHERE id = ? AND is_active = 1 LIMIT 1',
    [userId]
  );
  return rows[0] || null;
}

// list available specialty areas for vacancy creation dropdown
router.get('/areas-especialidad', async (req, res) => {
  try {
    const [rows] = await db.pool.query(
      `SELECT id, nombre
       FROM area_especialidad
       WHERE is_active = 1
       ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// list vacantes with optional search
router.get('/', async (req, res) => {
  try {
    const scope = await getUserScope(req.session.userId);
    if (!scope) {
      return res.status(401).json({ error: 'Invalid session scope' });
    }

    const search = String(req.query.search || '').trim().slice(0, 100);
    const { page, limit, offset } = parsePagination(req.query, 100, 200);

    let sql = 'SELECT * FROM vacante WHERE cliente_id = ? AND campus_id = ?';
    let countSql = 'SELECT COUNT(*) AS total FROM vacante WHERE cliente_id = ? AND campus_id = ?';
    const params = [scope.cliente_id, scope.campus_id];
    if (search) {
      sql += ' AND titulo LIKE ?';
      countSql += ' AND titulo LIKE ?';
      params.push('%' + search + '%');
    }
    sql += ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
    const queryParams = [...params, limit, offset];

    const [countRows] = await db.pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    res.setHeader('X-Page', String(page));
    res.setHeader('X-Limit', String(limit));
    res.setHeader('X-Total-Count', String(total));
    const [rows] = await db.pool.query(sql, queryParams);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// create vacante
router.post('/', async (req, res) => {
  try {
    const scope = await getUserScope(req.session.userId);
    if (!scope) {
      return res.status(401).json({ error: 'Invalid session scope' });
    }

    const parsed = createVacanteSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid vacancy payload' });
    }

    const titulo = parsed.data.titulo;
    const area = parsed.data.area || '';

    const clienteId = scope.cliente_id;
    const campusId = scope.campus_id;
    const createdBy = req.session.userId;
    const [result] = await db.pool.query(
      `INSERT INTO vacante (cliente_id, campus_id, created_by, titulo, area)
       VALUES (?, ?, ?, ?, ?)`,
      [clienteId, campusId, createdBy, titulo, area || null]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// candidates of a vacante
router.get('/:id/candidatos', async (req, res) => {
  try {
    const scope = await getUserScope(req.session.userId);
    if (!scope) {
      return res.status(401).json({ error: 'Invalid session scope' });
    }

    const vacanteId = Number(req.params.id);
    const status = String(req.query.status || '').trim();
    const { page, limit, offset } = parsePagination(req.query, 100, 200);

    if (!Number.isInteger(vacanteId) || vacanteId <= 0) {
      return res.status(400).json({ error: 'Invalid vacante id' });
    }

    let sql = `
            SELECT c.id, c.nombre, c.correo, c.telefono, c.area_especialidad,
              c.experiencia_anos, c.photo_path,
             p.id AS postulacion_id, p.estatus, p.interview_at
      FROM candidato c
      JOIN postulacion p ON p.candidato_id = c.id
      JOIN vacante v ON v.id = p.vacante_id
      WHERE p.vacante_id = ?
        AND v.cliente_id = ?
        AND v.campus_id = ?
    `;
    let countSql = `
      SELECT COUNT(*) AS total
      FROM candidato c
      JOIN postulacion p ON p.candidato_id = c.id
      JOIN vacante v ON v.id = p.vacante_id
      WHERE p.vacante_id = ?
        AND v.cliente_id = ?
        AND v.campus_id = ?
    `;
    const params = [vacanteId, scope.cliente_id, scope.campus_id];
    if (status) {
      sql += ' AND p.estatus = ?';
      countSql += ' AND p.estatus = ?';
      params.push(status);
    }
    sql += ' ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?';

    const [countRows] = await db.pool.query(countSql, params);
    const total = countRows[0]?.total || 0;
    const queryParams = [...params, limit, offset];

    res.setHeader('X-Page', String(page));
    res.setHeader('X-Limit', String(limit));
    res.setHeader('X-Total-Count', String(total));

    const [rows] = await db.pool.query(sql, queryParams);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
