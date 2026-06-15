// Shidell Teacher Portal - Estudiantes Logic
instalarAuthFetchDocente();

function instalarAuthFetchDocente() {
    if (window.__shidellAuthFetch) return;
    window.__shidellAuthFetch = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('shidell_user') || 'null'); } catch {}
        if (!user?.sessionToken) return originalFetch(input, init);
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${user.sessionToken}`);
        return originalFetch(input, { ...init, headers });
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const currentHost = window.location.host;
    const API_BASE = (currentHost === "" || !currentHost.includes('localhost')) ? 'http://localhost:8080' : '';
    
    const storedUser = localStorage.getItem('shidell_user');
    let teacherEmail = 'profesor@shidell.edu'; 
    let teacherName = 'Ana López';

    if (storedUser) {
        try {
            const user = JSON.parse(storedUser);
            if (user.rol === 'DOCENTE') {
                teacherEmail = user.email;
                teacherName = `${user.nombres} ${user.apellidos}`;
            }
        } catch(e) {}
    }

    const nameLabel = document.getElementById('user-name-label');
    if (nameLabel) nameLabel.textContent = teacherName;

    let todosLosEstudiantes = []; // Para búsqueda local

    async function inicializar() {
        const statusEl = document.getElementById('server-status');
        const tbody = document.getElementById('estudiantes-table-body');
        
        try {
            statusEl.textContent = 'Estado: Obteniendo cursos...';
            
            // 1. Buscar ID del docente
            const respDocente = await fetch(`${API_BASE}/api/docente/buscar?email=${teacherEmail}`);
            const docente = await respDocente.json();
            
            if (!docente || !docente.id) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Docente no encontrado.</td></tr>';
                return;
            }

            // 2. Obtener cursos
            const respCursos = await fetch(`${API_BASE}/api/docente/${docente.id}/cursos`);
            const cursos = await respCursos.json();
            
            if (!cursos || cursos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No tienes cursos asignados.</td></tr>';
                return;
            }

            statusEl.textContent = 'Estado: Recopilando alumnos...';
            
            // 3. Recopilar estudiantes de todos los cursos
            const promesas = cursos.map(async (curso) => {
                const resp = await fetch(`${API_BASE}/api/docente/curso/${curso.id}/estudiantes`);
                const alumnos = await resp.json();
                return alumnos.map(a => ({
                    ...a,
                    cursoNombre: curso.nombre,
                    gradoSeccion: `${curso.grado}° ${curso.seccion} - ${curso.nivel}`
                }));
            });

            const resultados = await Promise.all(promesas);
            
            // Aplanar y eliminar duplicados por ID
            const mapaEstudiantes = new Map();
            resultados.flat().forEach(est => {
                if (!mapaEstudiantes.has(est.id)) {
                    mapaEstudiantes.set(est.id, est);
                }
            });

            todosLosEstudiantes = Array.from(mapaEstudiantes.values());
            
            statusEl.textContent = 'Estado: Conectado';
            renderizarTabla(todosLosEstudiantes);
            
        } catch (error) {
            console.error(error);
            statusEl.textContent = 'Estado: Error';
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error de conexión con el servidor.</td></tr>';
        }
    }

    function renderizarTabla(lista) {
        const tbody = document.getElementById('estudiantes-table-body');
        tbody.innerHTML = '';
        
        if (lista.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No se encontraron estudiantes.</td></tr>';
            return;
        }

        lista.forEach(est => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">
                            ${est.nombres.charAt(0)}${est.apellidos.charAt(0)}
                        </div>
                        <strong>${est.nombres} ${est.apellidos}</strong>
                    </div>
                </td>
                <td>${est.email}</td>
                <td><span class="status-pill success" style="background: var(--blue-light); color: var(--blue);">${est.cursoNombre}</span></td>
                <td style="font-size: 13px; color: var(--text-secondary);">${est.gradoSeccion}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-secondary" style="padding: 6px 10px; font-size: 12px;"><i class="ph ph-eye"></i></button>
                        <button class="btn-secondary" style="padding: 6px 10px; font-size: 12px;"><i class="ph ph-chat-circle"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Buscador
    const searchInput = document.getElementById('search-students');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtrados = todosLosEstudiantes.filter(est => 
                `${est.nombres} ${est.apellidos}`.toLowerCase().includes(term) ||
                est.email.toLowerCase().includes(term) ||
                est.cursoNombre.toLowerCase().includes(term)
            );
            renderizarTabla(filtrados);
        });
    }

    inicializar();
});
