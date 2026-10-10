-- Configuración global del sitio (clave → valor). Ver diseno/DISENO.md §6.
-- La edita solo el ADMIN y aplica a todos los usuarios.
CREATE TABLE configuracion (
  clave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_by  INTEGER REFERENCES usuario(id),
  -- Valores cerrados por clave.
  CHECK (clave <> 'tema' OR valor IN ('verde', 'azul', 'naranja', 'guinda'))
);

-- Tema de color del sitio; 'verde' es el del diseño original.
INSERT INTO configuracion (clave, valor) VALUES ('tema', 'verde');
