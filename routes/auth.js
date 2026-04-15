const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');

const router = express.Router();

const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function isRateLimited(req) {
  const key = `${normalizeEmail(req.body?.correo)}|${getClientIp(req)}`;
  const now = Date.now();
  const data = loginAttempts.get(key);
  if (!data) return false;
  if (now - data.firstAttemptAt > WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }
  return data.count >= MAX_ATTEMPTS;
}

function recordLoginFailure(req) {
  const key = `${normalizeEmail(req.body?.correo)}|${getClientIp(req)}`;
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.firstAttemptAt > WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
    return;
  }
  current.count += 1;
  loginAttempts.set(key, current);
}

function clearLoginFailures(req, correo) {
  const key = `${normalizeEmail(correo)}|${getClientIp(req)}`;
  loginAttempts.delete(key);
}

const registerSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  correo: z.string().trim().email(),
  telefono: z.string().trim().max(30).optional().or(z.literal('')),
  campus: z.string().trim().max(120).optional().or(z.literal('')),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  correo: z.string().trim().email(),
  password: z.string().min(1).max(128)
});

// Registrar nuevo usuario de RH
router.post('/register', async (req, res) => {
  let conn;
  try {
    const parsed = registerSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid registration payload' });
    }

    const { nombre, telefono, campus, password } = parsed.data;
    const correo = normalizeEmail(parsed.data.correo);

    const safeNombre = String(nombre).trim().slice(0, 120);
    const safeTelefono = String(telefono || '').trim().slice(0, 30) || null;
    conn = await db.pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query('SELECT id FROM usuario_rh WHERE correo = ?', [correo]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'Email already registered' });
    }

    let clienteId;
    const [clientes] = await conn.query('SELECT id FROM cliente ORDER BY id ASC LIMIT 1');
    if (clientes.length) {
      clienteId = clientes[0].id;
    } else {
      const [clienteInsert] = await conn.query('INSERT INTO cliente (nombre) VALUES (?)', ['Cliente AHP']);
      clienteId = clienteInsert.insertId;
    }

    const campusNombre = (campus && String(campus).trim()) || 'General';
    let campusId;
    const [campusRows] = await conn.query(
      'SELECT id FROM campus WHERE cliente_id = ? AND nombre = ? LIMIT 1',
      [clienteId, campusNombre]
    );
    if (campusRows.length) {
      campusId = campusRows[0].id;
    } else {
      const [campusInsert] = await conn.query(
        'INSERT INTO campus (cliente_id, nombre) VALUES (?, ?)',
        [clienteId, campusNombre]
      );
      campusId = campusInsert.insertId;
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      `INSERT INTO usuario_rh (cliente_id, campus_id, nombre, correo, telefono, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [clienteId, campusId, safeNombre, correo, safeTelefono, hash]
    );

    await conn.commit();
    // Crear sesión
    req.session.userId = result.insertId;
    req.session.nombre = safeNombre;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session error' });
      }
      res.json({ success: true });
    });
  } catch (err) {
    if (conn) {
      await conn.rollback();
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
});

// Iniciar sesión
router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Missing email or password' });
    }

    const correo = normalizeEmail(parsed.data.correo);
    const { password } = parsed.data;

    if (isRateLimited(req)) {
      return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
    }

    const [rows] = await db.pool.query('SELECT id, nombre, password_hash FROM usuario_rh WHERE correo = ? AND is_active = 1', [correo]);
    if (!rows.length) {
      recordLoginFailure(req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      recordLoginFailure(req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    clearLoginFailures(req, correo);
    req.session.userId = user.id;
    req.session.nombre = user.nombre;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session error' });
      }
      res.json({ success: true });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cerrar sesión
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

module.exports = router;
