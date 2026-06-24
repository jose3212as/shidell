import { Auth } from '../../services/auth.js';
import { CursoService } from '../../services/cursoService.js';
import { API } from '../../services/api.js';

export const CalendarioView = {
    async render() {
        return `
            <div class="content-header" style="margin-bottom:20px;">
                <div>
                    <h2>Calendario Académico</h2>
                    <p>Gestiona todos tus eventos, exámenes y fechas de entrega de tareas del mes.</p>
                </div>
            </div>

            <div class="calendar-main-container">
                <div class="calendar-top-controls">
                    <h3 class="calendar-month-title" id="cal-month-title">Cargando...</h3>
                    <div class="calendar-nav-buttons">
                        <button class="calendar-nav-btn" id="cal-prev"><i class="ph ph-caret-left"></i></button>
                        <button class="calendar-nav-btn" id="cal-today">Hoy</button>
                        <button class="calendar-nav-btn" id="cal-next"><i class="ph ph-caret-right"></i></button>
                    </div>
                </div>

                <div class="calendar-month-grid" id="cal-grid">
                    <!-- Los días se inyectarán aquí -->
                </div>
            </div>
        `;
    },

    async afterRender() {
        this.user = Auth.getUser();
        this.currentDate = new Date();
        
        // Almacenes de datos
        this.eventos = [];
        this.tareas = [];

        this.setupEvents();
        await this.loadAllData();
    },

    setupEvents() {
        document.getElementById('cal-prev').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() - 1);
            this.renderCalendarGrid();
        });

        document.getElementById('cal-next').addEventListener('click', () => {
            this.currentDate.setMonth(this.currentDate.getMonth() + 1);
            this.renderCalendarGrid();
        });

        document.getElementById('cal-today').addEventListener('click', () => {
            this.currentDate = new Date();
            this.renderCalendarGrid();
        });
    },

    async loadAllData() {
        const grid = document.getElementById('cal-grid');
        grid.innerHTML = '<div style="grid-column: 1 / -1;" class="calendar-loading"><i class="ph ph-spinner ph-spin" style="font-size:32px;"></i><p>Sincronizando calendario...</p></div>';

        try {
            // 1. Obtener Eventos
            this.eventos = await API.fetch(`/api/docente/${this.user.id}/eventos`);

            // 2. Obtener Cursos y Tareas
            const cursos = await CursoService.getCursosUnicos(this.user.email);
            
            const promesasTareas = cursos.map(async (curso) => {
                const tareas = await API.fetch(`/api/docente/curso/${curso.id}/tareas`);
                return tareas.map(t => ({
                    ...t,
                    cursoNombre: curso.nombre,
                    gradoSeccion: `${curso.grado} ${curso.seccion}`
                }));
            });

            const resultadosTareas = await Promise.all(promesasTareas);
            this.tareas = resultadosTareas.flat();

            // 3. Obtener bloques de clases regulares (horario semanal)
            this.bloquesHorario = await CursoService.getHorarioCompleto(this.user.email);

            // Dibujar el calendario con los datos ya cargados
            this.renderCalendarGrid();

        } catch (error) {
            console.error("Error cargando datos del calendario:", error);
            grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 20px; color: red;">Error al sincronizar datos.</div>';
        }
    },

    renderCalendarGrid() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        
        // Título del mes
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        document.getElementById('cal-month-title').textContent = `${monthNames[month]} ${year}`;

        // Lógica del calendario
        const firstDay = new Date(year, month, 1).getDay(); // 0 (Dom) a 6 (Sab)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Ajustar para que la semana empiece en Lunes
        // Si firstDay es 0 (Domingo), ajustamos a 6. Si no, firstDay - 1.
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        const grid = document.getElementById('cal-grid');
        
        // Nombres de los días de la semana
        let html = `
            <div class="calendar-day-header">Lun</div>
            <div class="calendar-day-header">Mar</div>
            <div class="calendar-day-header">Mié</div>
            <div class="calendar-day-header">Jue</div>
            <div class="calendar-day-header">Vie</div>
            <div class="calendar-day-header">Sáb</div>
            <div class="calendar-day-header">Dom</div>
        `;

        const today = new Date();
        const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

        // Días del mes anterior
        for (let i = 0; i < startOffset; i++) {
            const numDia = daysInPrevMonth - startOffset + i + 1;
            html += `<div class="calendar-day-cell inactive-month"><span class="calendar-day-number">${numDia}</span></div>`;
        }

        // Días del mes actual
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = isCurrentMonth && today.getDate() === i;
            const cls = isToday ? 'calendar-day-cell today' : 'calendar-day-cell';
            
            // Construir fecha en formato YYYY-MM-DD para buscar eventos/tareas
            const strMonth = String(month + 1).padStart(2, '0');
            const strDay = String(i).padStart(2, '0');
            const dateKey = `${year}-${strMonth}-${strDay}`;
            
            // Determinar día de la semana para backend (1=Lun ... 7=Dom)
            const jsDay = new Date(year, month, i).getDay();
            const backendDay = jsDay === 0 ? 7 : jsDay;

            html += `<div class="${cls}">
                        <span class="calendar-day-number">${i}</span>
                        ${this.getItemsForDate(dateKey, backendDay)}
                     </div>`;
        }

        // Días del mes siguiente para completar la cuadrícula (42 celdas máximo: 6 filas x 7)
        const totalCells = startOffset + daysInMonth;
        const rowsNeeded = Math.ceil(totalCells / 7);
        const nextMonthDays = (rowsNeeded * 7) - totalCells;

        for (let i = 1; i <= nextMonthDays; i++) {
            html += `<div class="calendar-day-cell inactive-month"><span class="calendar-day-number">${i}</span></div>`;
        }

        grid.innerHTML = html;
    },

    getItemsForDate(dateKey, backendDay) {
        let itemsHtml = '';

        // 1. Filtrar Clases Regulares (bloques de horario)
        if (this.bloquesHorario && backendDay) {
            const clasesDelDia = this.bloquesHorario.filter(b => Number(b.diaSemana) === backendDay);
            // Ordenar por hora de inicio
            clasesDelDia.sort((a,b) => a.horaInicio.localeCompare(b.horaInicio));
            
            clasesDelDia.forEach(c => {
                itemsHtml += `
                    <div class="calendar-item clase" title="Clase: ${c.nombre} (${c.grado} ${c.seccion})">
                        <i class="ph ph-chalkboard-teacher"></i> ${c.horaInicio} - ${c.nombre}
                    </div>
                `;
            });
        }

        // 2. Filtrar Eventos
        // dateKey formato: "2026-06-15". Eventos tienen "fechaInicio": "2026-06-15T09:00:00"
        const evs = this.eventos.filter(e => {
            if (!e.fechaInicio) return false;
            return e.fechaInicio.startsWith(dateKey);
        });

        evs.forEach(e => {
            itemsHtml += `
                <div class="calendar-item evento" title="${e.titulo} - ${e.descripcion || ''}">
                    <i class="ph ph-calendar-star"></i> ${e.titulo}
                </div>
            `;
        });

        // 3. Filtrar Tareas / Exámenes
        // Tareas tienen "fechaVencimiento": "2026-06-20" o similar
        const ts = this.tareas.filter(t => {
            if (!t.fechaVencimiento) return false;
            return t.fechaVencimiento === dateKey || t.fechaVencimiento.startsWith(dateKey);
        });

        ts.forEach(t => {
            itemsHtml += `
                <div class="calendar-item tarea" title="Entrega: ${t.titulo} (${t.cursoNombre})">
                    <i class="ph ph-file-text"></i> ${t.titulo}
                </div>
            `;
        });

        return itemsHtml;
    }
};
