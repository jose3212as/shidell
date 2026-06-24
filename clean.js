const { Client } = require('pg');
const bcrypt = require('bcrypt');
const client = new Client({ user:'postgres', host:'localhost', database:'demo1', password:'Joseelmer31', port:5432 });

function normalizar(v='') { return v.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function abreviar(valor) {
  const map = {
    'MANANA':'M','MAÑANA':'M','TARDE':'T',
    'PRIMARIA':'PRI','SECUNDARIA':'SEC',
    'COMUNICACION':'COM','MATEMATICA':'MAT',
    'CIENCIA Y TECNOLOGIA':'CYT','PERSONAL SOCIAL':'PSO',
    'CIENCIAS SOCIALES':'SOC','INGLES':'ING',
    'ARTE Y CULTURA':'ART','EDUCACION FISICA':'EFI',
    'RELIGION':'REL','TUTORIA':'TUT','REFUERZO ESCOLAR':'REF',
    'DPCC':'DPCC','EPT':'EPT'
  };
  const n = normalizar(valor).toUpperCase();
  return map[n] || n.replace(/[^A-Z0-9]/g,'');
}
function emailPara(codigo) {
  return normalizar(codigo).toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'') + '@shidell.edu';
}
function etiquetaTurno(t) { return t === 'TARDE' ? 'Tarde' : 'Mañana'; }

// Perú: Primaria=MAÑANA, Secundaria=TARDE
const TURNO_NIVEL = { PRIMARIA: 'MAÑANA', SECUNDARIA: 'TARDE' };
const AULA_PRI = ['Comunicación','Matemática','Ciencia y Tecnología','Personal Social','Tutoría','Refuerzo Escolar'];

function codigoPara(nivel, grado, seccion, turno, area) {
  const g = parseInt(grado) || 0;
  const t = abreviar(turno);
  if (nivel === 'PRIMARIA') {
    if (AULA_PRI.includes(area)) return { codigo: `PLZ-PRI-AULA-${grado}${seccion}-${t}`, nombre: 'Prof. de Aula', apellido: `${grado}°${seccion} ${etiquetaTurno(turno)}` };
    if (area === 'Religión')    return { codigo: 'PLZ-PRI-REL-ESCUELA', nombre: 'Docente Religión', apellido: 'Primaria' };
    return { codigo: `PLZ-PRI-${abreviar(area)}-${t}`, nombre: `Docente ${area}`, apellido: `Primaria ${etiquetaTurno(turno)}` };
  }
  if (area === 'Religión' || area === 'Tutoría')
    return { codigo: `PLZ-SEC-${abreviar(area)}-${t}`, nombre: `Docente ${area}`, apellido: `Secundaria ${etiquetaTurno(turno)}` };
  if (['DPCC','EPT','Educación Física','Arte y Cultura'].includes(area))
    return { codigo: `PLZ-SEC-${abreviar(area)}-${t}`, nombre: `Docente ${area}`, apellido: `Secundaria ${etiquetaTurno(turno)}` };
  if (area === 'Ciencias Sociales' || area === 'Inglés')
    return { codigo: `PLZ-SEC-${abreviar(area)}-${t}`, nombre: `Docente ${area}`, apellido: `Secundaria ${etiquetaTurno(turno)}` };
  if (area === 'Ciencia y Tecnología') {
    const grupo = g <= 3 ? '1-3' : '4-5';
    return { codigo: `PLZ-SEC-CYT-G${grupo}-${t}`, nombre: 'Docente CyT', apellido: `G${grupo} ${etiquetaTurno(turno)}` };
  }
  const grupo = g <= 2 ? '1-2' : '3-5';
  return { codigo: `PLZ-SEC-${abreviar(area)}-G${grupo}-${t}`, nombre: `Docente ${area}`, apellido: `G${grupo} ${etiquetaTurno(turno)}` };
}

async function getOrCreateTeacher(info) {
  const res = await client.query(`SELECT id FROM usuarios WHERE codigo_plaza = $1`, [info.codigo]);
  if (res.rows.length > 0) {
    await client.query(`UPDATE usuarios SET rol='DOCENTE' WHERE codigo_plaza=$1 AND rol='ARCHIVADO'`, [info.codigo]);
    return res.rows[0].id;
  }
  const hash = await bcrypt.hash('123456', 10);
  const email = emailPara(info.codigo);
  const ins = await client.query(
    `INSERT INTO usuarios (nombres, apellidos, email, password, rol, codigo_plaza)
     VALUES ($1,$2,$3,$4,'DOCENTE',$5)
     ON CONFLICT (email) DO UPDATE SET rol='DOCENTE', codigo_plaza=$5 RETURNING id`,
    [info.nombre, info.apellido, email, hash, info.codigo]
  );
  return ins.rows[0].id;
}

async function run() {
  await client.connect();
  console.log('Connected.\n');

  // Step 1: Archive courses with wrong turno (PRIMARIA-TARDE and SECUNDARIA-MAÑANA)
  const wrongTurno = await client.query(`
    UPDATE cursos SET turno = 'ARCHIVADO'
    WHERE (nivel = 'PRIMARIA' AND turno = 'TARDE')
       OR (nivel = 'SECUNDARIA' AND turno = 'MAÑANA')
  `);
  console.log(`Cursos con turno incorrecto archivados: ${wrongTurno.rowCount}`);

  // Step 2: Reassign all active courses with correct teachers
  const courses = await client.query(
    `SELECT id, nombre, nivel, grado, seccion, turno FROM cursos WHERE turno != 'ARCHIVADO'`
  );
  console.log(`Cursos activos: ${courses.rows.length}`);

  const cache = new Map();
  for (const c of courses.rows) {
    // Enforce correct turno per nivel
    const expectedTurno = TURNO_NIVEL[c.nivel] || c.turno;
    if (c.turno !== expectedTurno) continue; // safety skip

    const info = codigoPara(c.nivel, c.grado, c.seccion, expectedTurno, c.nombre);
    if (!cache.has(info.codigo)) {
      cache.set(info.codigo, await getOrCreateTeacher(info));
    }
    await client.query(`UPDATE cursos SET docente_id=$1 WHERE id=$2`, [cache.get(info.codigo), c.id]);
  }
  console.log(`Docentes asignados. Plazas únicas: ${cache.size}`);

  // Step 3: Archive orphaned teachers
  const arch = await client.query(`
    UPDATE usuarios SET rol='ARCHIVADO'
    WHERE rol='DOCENTE'
      AND NOT EXISTS (SELECT 1 FROM cursos c WHERE c.docente_id=usuarios.id AND c.turno!='ARCHIVADO')
  `);
  console.log(`Docentes archivados (sin cursos activos): ${arch.rowCount}`);

  // Final count
  const final = await client.query(`SELECT COUNT(*) FROM usuarios WHERE rol='DOCENTE'`);
  const aulas = await client.query(`SELECT COUNT(DISTINCT (nivel||grado||seccion||turno)) FROM cursos WHERE turno!='ARCHIVADO'`);
  console.log(`\n✓ AULAS ACTIVAS: ${aulas.rows[0].count}`);
  console.log(`✓ DOCENTES ACTIVOS: ${final.rows[0].count}`);

  // Breakdown
  const bk = await client.query(`
    SELECT u.codigo_plaza, COUNT(DISTINCT (c.nivel||c.grado||c.seccion)) as aulas
    FROM usuarios u
    JOIN cursos c ON c.docente_id=u.id AND c.turno!='ARCHIVADO'
    WHERE u.rol='DOCENTE'
    GROUP BY u.id, u.codigo_plaza ORDER BY u.codigo_plaza
  `);
  const byType = { 'Prof. Aula Primaria':0, 'Especialidad Primaria':0, 'Secundaria':0 };
  for (const r of bk.rows) {
    if (r.codigo_plaza?.includes('AULA')) byType['Prof. Aula Primaria']++;
    else if (r.codigo_plaza?.includes('-PRI-')) byType['Especialidad Primaria']++;
    else byType['Secundaria']++;
  }
  console.log('Desglose:');
  Object.entries(byType).forEach(([k,v]) => console.log(`  ${k}: ${v}`));

  await client.end();
}
run().catch(console.error);
