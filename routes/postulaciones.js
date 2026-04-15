const express = require('express');
const { z } = require('zod');
const db = require('../db');
const router = express.Router();
const {
  sendApplicationAcceptedEmail,
  sendApplicationRejectedEmail,
  sendInterviewScheduledEmail
} = require('../services/emailNotifications');

const statusSchema = z.object({
  status: z.enum(['ACEPTADO', 'RECHAZADO', 'PENDIENTE'])
});

const interviewSchema = z.object({
  interview_at: z.string().trim().max(40).optional().or(z.literal('')).or(z.null())
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

// pendientes (all postulaciones with status PENDIENTE)
router.get('/pending', async (req, res) => {
  try {
    const scope = await getUserScope(req.session.userId);
    if (!scope) {
      return res.status(401).json({ error: 'Invalid session scope' });
    }

    const { page, limit, offset } = parsePagination(req.query, 100, 200);

    const [countRows] = await db.pool.query(
      `SELECT COUNT(*) AS total
       FROM postulacion p
       JOIN vacante v ON v.id = p.vacante_id
       WHERE p.estatus = 'PENDIENTE'
         AND v.cliente_id = ?
         AND v.campus_id = ?`,
      [scope.cliente_id, scope.campus_id]
    );

    const [rows] = await db.pool.query(
      `SELECT p.id, p.vacante_id, p.candidato_id, p.estatus, p.interview_at,
              c.nombre AS candidato_nombre, v.titulo AS vacante_titulo
       FROM postulacion p
       JOIN candidato c ON c.id = p.candidato_id
       JOIN vacante v ON v.id = p.vacante_id
       WHERE p.estatus = 'PENDIENTE'
         AND v.cliente_id = ?
         AND v.campus_id = ?
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
      [scope.cliente_id, scope.campus_id, limit, offset]
    );

    res.setHeader('X-Page', String(page));
    res.setHeader('X-Limit', String(limit));
    res.setHeader('X-Total-Count', String(countRows[0]?.total || 0));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// entrevistas pendientes/proximas
router.get('/interviews-pending', async (req, res) => {
  try {
    const scope = await getUserScope(req.session.userId);
    if (!scope) {
      return res.status(401).json({ error: 'Invalid session scope' });
    }

    const { page, limit, offset } = parsePagination(req.query, 100, 200);

    const [countRows] = await db.pool.query(
      `SELECT COUNT(*) AS total
       FROM postulacion p
       JOIN vacante v ON v.id = p.vacante_id
       WHERE p.interview_at IS NOT NULL
         AND p.estatus = 'PENDIENTE'
         AND v.cliente_id = ?
         AND v.campus_id = ?`,
      [scope.cliente_id, scope.campus_id]
    );

    const [rows] = await db.pool.query(
      `SELECT p.id, p.vacante_id, p.candidato_id, p.estatus, p.interview_at,
              c.nombre AS candidato_nombre, v.titulo AS vacante_titulo
       FROM postulacion p
       JOIN candidato c ON c.id = p.candidato_id
       JOIN vacante v ON v.id = p.vacante_id
       WHERE p.interview_at IS NOT NULL
        AND p.estatus = 'PENDIENTE'
        AND v.cliente_id = ?
        AND v.campus_id = ?
       ORDER BY p.interview_at ASC
       LIMIT ? OFFSET ?`,
      [scope.cliente_id, scope.campus_id, limit, offset]
    );

    res.setHeader('X-Page', String(page));
    res.setHeader('X-Limit', String(limit));
    res.setHeader('X-Total-Count', String(countRows[0]?.total || 0));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// change status (ACEPTADO/RECHAZADO/PENDIENTE)
router.patch('/:id/status', async (req, res) => {
  try {
    const scope = await getUserScope(req.session.userId);
    if (!scope) {
      return res.status(401).json({ error: 'Invalid session scope' });
    }

    const id = Number(req.params.id);
    const parsed = statusSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { status } = parsed.data;
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const [rows] = await db.pool.query(
      `SELECT p.id, c.nombre AS candidato_nombre, c.correo AS candidato_correo, v.titulo AS vacante_titulo
       FROM postulacion p
       JOIN candidato c ON c.id = p.candidato_id
       JOIN vacante v ON v.id = p.vacante_id
       WHERE p.id = ?
         AND v.cliente_id = ?
         AND v.campus_id = ?`,
      [id, scope.cliente_id, scope.campus_id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Postulación no encontrada' });
    }

    await db.pool.query('UPDATE postulacion SET estatus = ? WHERE id = ?', [status, id]);

    if (status === 'ACEPTADO') {
      const row = rows[0];
      await sendApplicationAcceptedEmail({
        correo: row.candidato_correo,
        nombre: row.candidato_nombre,
        vacanteTitulo: row.vacante_titulo
      });
    }

    if (status === 'RECHAZADO') {
      const row = rows[0];
      await sendApplicationRejectedEmail({
        correo: row.candidato_correo,
        nombre: row.candidato_nombre,
        vacanteTitulo: row.vacante_titulo
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// schedule interview
router.patch('/:id/interview', async (req, res) => {
  try {
    const scope = await getUserScope(req.session.userId);
    if (!scope) {
      return res.status(401).json({ error: 'Invalid session scope' });
    }

    const id = Number(req.params.id);
    const parsed = interviewSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid interview date' });
    }
    const interview_at = parsed.data.interview_at || null;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    if (interview_at) {
      const dt = new Date(interview_at);
      if (Number.isNaN(dt.getTime())) {
        return res.status(400).json({ error: 'Invalid interview date' });
      }
    }

    const [rows] = await db.pool.query(
      `SELECT p.id, c.nombre AS candidato_nombre, c.correo AS candidato_correo, v.titulo AS vacante_titulo
       FROM postulacion p
       JOIN candidato c ON c.id = p.candidato_id
       JOIN vacante v ON v.id = p.vacante_id
       WHERE p.id = ?
         AND v.cliente_id = ?
         AND v.campus_id = ?`,
      [id, scope.cliente_id, scope.campus_id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Postulación no encontrada' });
    }

    // allow null to clear
    await db.pool.query('UPDATE postulacion SET interview_at = ? WHERE id = ?', [interview_at || null, id]);

    if (interview_at) {
      const row = rows[0];
      await sendInterviewScheduledEmail({
        correo: row.candidato_correo,
        nombre: row.candidato_nombre,
        vacanteTitulo: row.vacante_titulo,
        interviewAt: interview_at
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

module.exports = router;
