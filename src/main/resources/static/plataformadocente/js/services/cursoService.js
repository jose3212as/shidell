import { API } from './api.js';

export const CursoService = {
    _docenteId: null,
    
    async getDocenteId(email) {
        if (this._docenteId) return this._docenteId;
        const docente = await API.fetch(`/api/docente/buscar?email=${encodeURIComponent(email)}`);
        this._docenteId = docente.id;
        return this._docenteId;
    },

    async getDashboard(email) {
        const id = await this.getDocenteId(email);
        return await API.fetch(`/api/docente/${id}/dashboard`);
    },

    async getCursosUnicos(email) {
        const id = await this.getDocenteId(email);
        const cursosCrudos = await API.fetch(`/api/docente/${id}/cursos`);
        
        // Deduplicar cursos por nombre, nivel, grado y sección
        const mapUnicos = new Map();
        cursosCrudos.forEach(c => {
            const key = `${c.nombre}-${c.nivel}-${c.grado}-${c.seccion}`.toLowerCase();
            if (!mapUnicos.has(key)) mapUnicos.set(key, c);
        });
        
        return Array.from(mapUnicos.values());
    },
    
    async getHorarioCompleto(email) {
        const id = await this.getDocenteId(email);
        // Retorna todos los bloques de cursos (sin deduplicar) para pintar el calendario
        return await API.fetch(`/api/docente/${id}/cursos`);
    }
};
