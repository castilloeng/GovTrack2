"""
Genera un archivo SQL con los datos de prueba de la app de escritorio (desktop/db/GovTrackDB.db)
en el esquema de la versión web: municipios, secciones, colonias, casillas, resultados, personas,
enlaces y asignaciones.

Uso (desde web/):
    python scripts/seed_desde_desktop.py > .wrangler/seed.sql
    npx wrangler d1 execute govtrack --local --file .wrangler/seed.sql

El SQL BORRA primero los datos de geografía, elección y estructura (no toca usuarios ni
configuración), así que se puede volver a correr. Pensado para la D1 local: los datos son de prueba.
"""

import json
import re
import sqlite3
import sys
from pathlib import Path

ORIGEN = Path(__file__).resolve().parents[2] / 'desktop' / 'db' / 'GovTrackDB.db'

TIPO_SECCION = {'URBANO(A)': 'URBANA', 'RURAL': 'RURAL', 'MIXTO(A)': 'MIXTA'}
PROCESO = (1, 2024, 'Proceso Electoral Local 2024')
ELECCION = (1, 1, 'AYUNTAMIENTO')


def q(v):
    """Literal SQL."""
    if v is None:
        return 'NULL'
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def limpio(s):
    return re.sub(r'\s+', ' ', (s or '').strip()).upper()


def telefono(t):
    t = re.sub(r'\D', '', t or '')
    return t if len(t) == 10 else None


def seccion(v):
    """'164E' (colonias de casillas extraordinarias en Cacahoatán) es la sección 164."""
    return int(re.sub(r'\D', '', str(v)))


def entero(v):
    try:
        return max(0, int(str(v).strip()))
    except (TypeError, ValueError):
        return 0


def main():
    db = sqlite3.connect(ORIGEN)
    out = []
    w = out.append

    w('-- Generado por scripts/seed_desde_desktop.py')
    for t in ['operador_asignacion', 'operador_enlace', 'persona', 'resultado', 'casilla', 'eleccion',
              'proceso_electoral', 'partido', 'seccion_colonia', 'colonia', 'seccion']:
        w(f'DELETE FROM {t};')

    municipios = sorted({limpio(m) for (m,) in db.execute(
        'SELECT MUNICIPIO FROM Colonias UNION SELECT MUNICIPIO FROM Seccion2 UNION SELECT MUNICIPIO FROM Contacto')})
    for m in municipios:
        w(f'INSERT OR IGNORE INTO municipio (nombre) VALUES ({q(m)});')
    mun = lambda m: f'(SELECT id FROM municipio WHERE nombre = {q(limpio(m))})'

    # ---------- Secciones ----------
    secciones = {}  # (municipio, numero) -> id
    tipos = {}
    for num, tipo, m in db.execute('SELECT SECCION, TIPO_SECCION, MUNICIPIO FROM Colonias'):
        tipos.setdefault((limpio(m), seccion(num)), TIPO_SECCION.get(limpio(tipo)))
    for num, m in db.execute('SELECT SECCION, MUNICIPIO FROM Seccion2'):
        tipos.setdefault((limpio(m), seccion(num)), None)
    for i, (clave, tipo) in enumerate(sorted(tipos.items()), 1):
        secciones[clave] = i
        w(f'INSERT INTO seccion (id, municipio_id, numero, tipo) VALUES ({i}, {mun(clave[0])}, {clave[1]}, {q(tipo)});')

    # ---------- Colonias (únicas por municipio + nombre + CP) ----------
    colonias = {}  # (municipio, nombre, cp) -> id
    col_por_seccion = {}  # (municipio, seccion, nombre) -> colonia_id
    relaciones = set()
    for num, tipo_col, nombre, cp, m in db.execute(
            'SELECT SECCION, TIPO_COLONIA, NOMBRE_COLONIA, CP, MUNICIPIO FROM Colonias ORDER BY MUNICIPIO, NOMBRE_COLONIA'):
        m, nombre = limpio(m), limpio(nombre)
        cp = cp if cp and re.fullmatch(r'\d{5}', cp) else None
        clave = (m, nombre, cp)
        if clave not in colonias:
            colonias[clave] = len(colonias) + 1
            w(f'INSERT INTO colonia (id, municipio_id, nombre, tipo_asentamiento, cp) VALUES '
              f'({colonias[clave]}, {mun(m)}, {q(nombre)}, {q(limpio(tipo_col) or None)}, {q(cp)});')
        sid = secciones[(m, seccion(num))]
        col_por_seccion.setdefault((m, seccion(num), nombre), colonias[clave])
        relaciones.add((sid, colonias[clave]))
    for sid, cid in sorted(relaciones):
        w(f'INSERT INTO seccion_colonia (seccion_id, colonia_id) VALUES ({sid}, {cid});')

    # ---------- Proceso, elección, partidos, casillas y resultados ----------
    w(f'INSERT INTO proceso_electoral (id, anio, nombre) VALUES ({PROCESO[0]}, {PROCESO[1]}, {q(PROCESO[2])});')
    w(f'INSERT INTO eleccion (id, proceso_id, cargo) VALUES ({ELECCION[0]}, {ELECCION[1]}, {q(ELECCION[2])});')
    partidos = {}
    casillas = {}
    resultados = []
    for num, tipo, ln, votos, ubic, m in db.execute(
            'SELECT SECCION, TIPO, LN, PARTIDOS, UBICACION, MUNICIPIO FROM Seccion2 ORDER BY MUNICIPIO, CAST(SECCION AS INT), TIPO'):
        sid = secciones[(limpio(m), seccion(num))]
        clave = (sid, re.sub(r'\s+', '', tipo).upper())
        if clave in casillas:
            continue
        casillas[clave] = len(casillas) + 1
        w(f'INSERT INTO casilla (id, proceso_id, seccion_id, tipo, lista_nominal, ubicacion) VALUES '
          f'({casillas[clave]}, {PROCESO[0]}, {sid}, {q(clave[1])}, {entero(ln)}, {q((ubic or "").strip() or None)});')
        for siglas, v in json.loads(votos or '{}').items():
            pid = partidos.setdefault(siglas.upper(), len(partidos) + 1)
            resultados.append((casillas[clave], pid, entero(v)))
    for siglas, pid in partidos.items():
        w(f'INSERT INTO partido (id, siglas) VALUES ({pid}, {q(siglas)});')
    for cid, pid, v in resultados:
        w(f'INSERT INTO resultado (casilla_id, eleccion_id, partido_id, votos) VALUES ({cid}, {ELECCION[0]}, {pid}, {v});')

    # ---------- Personas (únicas por nombre), enlaces y asignaciones ----------
    personas = {}  # nombre -> id
    telefonos = set()

    def persona(nombre, tel, m):
        nombre = limpio(nombre)
        if not nombre:
            return None
        if nombre not in personas:
            personas[nombre] = len(personas) + 1
            tel = telefono(tel)
            if tel in telefonos:
                tel = None
            if tel:
                telefonos.add(tel)
            w(f'INSERT INTO persona (id, nombre, telefono, municipio_id) VALUES ({personas[nombre]}, {q(nombre)}, {q(tel)}, {mun(m)});')
        return personas[nombre]

    for nombre, tel, m in db.execute('SELECT NOMBRE, TELEFONO, MUNICIPIO FROM Contacto ORDER BY NOMBRE'):
        persona(nombre, tel, m)

    enlaces = {}
    asignaciones = set()
    for row in db.execute('SELECT NOMBRE, TELEFONO, COLONIA, SECCION, NUM_PERSONAS, OBSERVACIONES, '
                          'OPERADOR_ENLACE1, TELEFONO1, OPERADOR_ENLACE2, TELEFONO2, MUNICIPIO FROM ContactoDet'):
        nombre, tel, col, num, npers, obs, e1, t1, e2, t2, m = row
        m = limpio(m)
        oid = persona(nombre, tel, m)
        if oid not in enlaces:
            ids = []
            for en, et in ((e1, t1), (e2, t2)):
                eid = persona(en, et, m)
                if eid and eid != oid and eid not in ids:
                    ids.append(eid)
            enlaces[oid] = ids
            for orden, eid in enumerate(ids, 1):
                w(f'INSERT INTO operador_enlace (operador_id, orden, enlace_id) VALUES ({oid}, {orden}, {eid});')
        sid = secciones.get((m, seccion(num)))
        cid = col_por_seccion.get((m, seccion(num), limpio(col)))
        if not sid or not cid or (oid, sid, cid) in asignaciones:
            continue
        asignaciones.add((oid, sid, cid))
        w(f'INSERT INTO operador_asignacion (operador_id, seccion_id, colonia_id, num_personas, observaciones) VALUES '
          f'({oid}, {sid}, {cid}, {entero(npers)}, {q((obs or "").strip() or None)});')

    sys.stdout.reconfigure(encoding='utf-8')
    print('\n'.join(out))
    print(f'-- {len(secciones)} secciones, {len(colonias)} colonias, {len(casillas)} casillas, '
          f'{len(personas)} personas, {len(asignaciones)} asignaciones', file=sys.stderr)


if __name__ == '__main__':
    main()
