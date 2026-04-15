PRAGMA foreign_keys = ON;

CREATE TABLE cliente (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES cliente(id)
);

CREATE TABLE usuario_rh (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  campus_id INTEGER NOT NULL,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  telefono TEXT,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (correo),
  FOREIGN KEY (cliente_id) REFERENCES cliente(id),
  FOREIGN KEY (campus_id) REFERENCES campus(id)
);

CREATE TABLE candidato (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  telefono TEXT,
  area_especialidad TEXT,
  experiencia_anos INTEGER,
  photo_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (correo)
);

CREATE TABLE vacante (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  campus_id INTEGER NOT NULL,
  created_by INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  area TEXT,
  estatus TEXT NOT NULL DEFAULT 'OPEN',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES cliente(id),
  FOREIGN KEY (campus_id) REFERENCES campus(id),
  FOREIGN KEY (created_by) REFERENCES usuario_rh(id)
);

CREATE TABLE postulacion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vacante_id INTEGER NOT NULL,
  candidato_id INTEGER NOT NULL,
  estatus TEXT NOT NULL DEFAULT 'PENDIENTE',
  interview_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (vacante_id, candidato_id),
  FOREIGN KEY (vacante_id) REFERENCES vacante(id),
  FOREIGN KEY (candidato_id) REFERENCES candidato(id)
);

CREATE TABLE area_especialidad (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (nombre)
);

CREATE INDEX idx_postulacion_estatus ON postulacion(estatus);
CREATE INDEX idx_postulacion_interview_at ON postulacion(interview_at);

CREATE TRIGGER trg_postulacion_updated_at
AFTER UPDATE ON postulacion
FOR EACH ROW
BEGIN
  UPDATE postulacion SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

INSERT INTO area_especialidad (nombre, descripcion) VALUES
  ('Tecnología e Ingeniería', 'Perfiles de ingeniería, sistemas, software, datos y áreas técnicas'),
  ('Administración y Negocios', 'Perfiles de administración, finanzas, contabilidad, RH y negocios'),
  ('Salud y Ciencias de la Vida', 'Perfiles de medicina, enfermería, nutrición, biología y áreas afines'),
  ('Educación, Ciencias Sociales y Derecho', 'Perfiles de docencia, pedagogía, derecho y ciencias sociales'),
  ('Comunicación, Diseño y Marketing', 'Perfiles de comunicación, diseño, publicidad, contenido y marketing');
