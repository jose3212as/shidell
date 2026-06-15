/* =========================================================
   SHIDELL ADMIN — CONFIG
   Constantes globales y configuración de la API
   ========================================================= */

const CONFIG = {
  API_BASE: '/api',

  ROLES: {
    ADMIN:      'ADMINISTRADOR',
    DOCENTE:    'DOCENTE',
    ESTUDIANTE: 'ESTUDIANTE',
    PADRE:      'PADRE'
  },

  ROLE_LABELS: {
    ADMINISTRADOR: 'Administrador',
    DOCENTE:       'Docente',
    ESTUDIANTE:    'Estudiante',
    PADRE:         'Padre de Familia'
  },

  ROLE_BADGE: {
    ADMINISTRADOR: 'badge-primary',
    DOCENTE:       'badge-purple',
    ESTUDIANTE:    'badge-cyan',
    PADRE:         'badge-green'
  },

  ROLE_AVATAR_BG: {
    ADMINISTRADOR: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
    DOCENTE:       'linear-gradient(135deg,#8b5cf6,#a78bfa)',
    ESTUDIANTE:    'linear-gradient(135deg,#06b6d4,#6366f1)',
    PADRE:         'linear-gradient(135deg,#10b981,#06b6d4)'
  },

  NIVELES:   ['PRIMARIA', 'SECUNDARIA'],
  GRADOS:    ['1', '2', '3', '4', '5', '6'],
  SECCIONES: ['A', 'B', 'C', 'D', 'E'],
  TURNOS:    ['MAÑANA', 'TARDE'],

  DIAS_SEMANA: {
    1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
    4: 'Jueves', 5: 'Viernes', 6: 'Sábado'
  },

  ICONOS_CURSO: [
    'ph-calculator','ph-flask','ph-book-open','ph-code',
    'ph-globe','ph-music-notes','ph-paint-brush','ph-atom',
    'ph-basketball','ph-brain','ph-dna','ph-function'
  ],

  COLORES_CURSO: [
    'purple','blue','green','yellow','red','cyan','orange','pink'
  ],

  COLOR_MAP: {
    purple: '#8b5cf6', blue: '#6366f1', green: '#10b981',
    yellow: '#f59e0b', red: '#ef4444', cyan: '#06b6d4',
    orange: '#f97316', pink: '#ec4899'
  },

  // Páginas del admin
  PAGES: {
    dashboard:      'dashboard.html',
    usuarios:       'usuarios.html',
    cursos:         'cursos.html',
    asistencia:     'asistencia.html',
    calificaciones: 'calificaciones.html',
    reportes:       'reportes.html',
    configuracion:  'configuracion.html'
  }
};

// Namespace global para el estado de la app
window.SHIDELL = window.SHIDELL || {};
