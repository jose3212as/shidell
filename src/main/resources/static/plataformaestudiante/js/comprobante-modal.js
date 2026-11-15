(function () {
    'use strict';

    const UUID_PREFIX_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}_/i;

    function formatFileName(archivoUrl) {
        if (!archivoUrl) return 'Documento adjunto verificado';
        const raw = String(archivoUrl).split('/').pop() || 'Documento adjunto verificado';
        try {
            const decoded = decodeURIComponent(raw);
            return decoded.replace(UUID_PREFIX_RE, '') || decoded;
        } catch {
            return raw.replace(UUID_PREFIX_RE, '') || raw;
        }
    }

    function formatTimestamp(fechaInput) {
        const fecha = fechaInput ? new Date(fechaInput) : new Date();
        const valida = Number.isNaN(fecha.getTime()) ? new Date() : fecha;
        const fechaParte = valida.toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const horaParte = valida.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        return `${fechaParte} · ${horaParte} h`;
    }

    function buildMarkup() {
        return `
        <div class="comprobante-card boleta-sheet" role="dialog" aria-modal="true" aria-labelledby="cmpHeaderTitle">
            <svg class="boleta-corner-fold" width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
                <polygon points="0.75,0.75 0.75,25.25 25.25,25.25" class="boleta-corner-flap" />
                <line x1="0.75" y1="0.75" x2="25.25" y2="25.25" class="boleta-corner-stroke" />
                <polyline points="0.75,0.75 0.75,25.25 25.25,25.25" fill="none" class="boleta-corner-stroke" />
            </svg>

            <div class="boleta-inner">
                <header class="boleta-header-frame">
                    <div class="boleta-brand-group">
                        <div class="boleta-seal-top" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M2 10l10-5 10 5-10 5-10-5z" />
                                <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
                            </svg>
                        </div>
                        <div class="boleta-brand-copy">
                            <span class="boleta-issuer">Institución Educativa Shidell</span>
                            <h3 id="cmpHeaderTitle">Boleta de Entrega Académica</h3>
                            <p>Constancia oficial de recepción</p>
                        </div>
                    </div>

                    <div class="boleta-folio-frame">
                        <div class="boleta-folio-head">Boleta electrónica</div>
                        <div class="boleta-folio-code" id="cmpCodigo">REC-SHD-2026-0000</div>
                    </div>
                </header>

                <section class="boleta-ledger-frame" aria-label="Detalle del comprobante">
                    <div class="boleta-ledger-row">
                        <span class="boleta-label">Estudiante</span>
                        <span class="boleta-value" id="cmpEstudiante">Estudiante</span>
                    </div>
                    <div class="boleta-ledger-row">
                        <span class="boleta-label">Correo institucional</span>
                        <span class="boleta-value" id="cmpCorreo">correo@institucion.edu.pe</span>
                    </div>
                    <div class="boleta-ledger-row">
                        <span class="boleta-label">Asignatura</span>
                        <span class="boleta-value" id="cmpCurso">Curso</span>
                    </div>
                    <div class="boleta-ledger-row">
                        <span class="boleta-label">Actividad académica</span>
                        <span class="boleta-value" id="cmpTarea">Tarea</span>
                    </div>
                    <div class="boleta-ledger-row">
                        <span class="boleta-label">Archivo entregado</span>
                        <span class="boleta-value boleta-value-file" id="cmpArchivo">archivo.pdf</span>
                    </div>
                </section>

                <section class="boleta-summary-frame" aria-label="Validación y fecha de registro">
                    <div class="boleta-stamp-cell" aria-hidden="true">
                        <div class="boleta-seal-bottom">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="5 12.5 9.8 17 19 7.5" />
                            </svg>
                        </div>
                    </div>
                    <div class="boleta-summary-rows">
                        <div class="boleta-summary-row">
                            <span class="boleta-label">Estado de recepción</span>
                            <span class="boleta-value boleta-status-ok">Recibido conforme</span>
                        </div>
                        <div class="boleta-summary-row">
                            <span class="boleta-label">Fecha y hora de registro</span>
                            <span class="boleta-value boleta-value-mono" id="cmpTimestamp">--/--/---- · --:--:-- h</span>
                        </div>
                    </div>
                </section>

                <div class="boleta-note-frame">
                    Documento emitido automáticamente por la plataforma académica Shidell.
                </div>
            </div>

            <footer class="comprobante-footer">
                <button type="button" class="btn-print-comprobante" id="btnImprimirComprobante">
                    <img src="../icons/regular/printer.svg" class="icon-img" alt="Imprimir">
                    <span>Imprimir o guardar PDF</span>
                </button>
                <button type="button" class="btn-close-comprobante" id="btnCerrarComprobante">
                    Cerrar
                </button>
            </footer>
        </div>`;
    }

    let boundOverlay = null;
    let escListenerAttached = false;

    function close() {
        const overlay = document.getElementById('comprobanteOverlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
    }

    function mount() {
        const overlay = document.getElementById('comprobanteOverlay');
        if (!overlay) return null;

        if (!overlay.querySelector('.boleta-sheet')) {
            overlay.innerHTML = buildMarkup();
            boundOverlay = null;
        }

        if (boundOverlay !== overlay) {
            boundOverlay = overlay;
            const btnCerrar = overlay.querySelector('#btnCerrarComprobante');
            const btnImprimir = overlay.querySelector('#btnImprimirComprobante');
            if (btnCerrar) btnCerrar.addEventListener('click', close);
            if (btnImprimir) btnImprimir.addEventListener('click', () => window.print());
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });
        }

        if (!escListenerAttached) {
            escListenerAttached = true;
            document.addEventListener('keydown', (e) => {
                const activeOverlay = document.getElementById('comprobanteOverlay');
                if (e.key === 'Escape' && activeOverlay?.classList.contains('open')) {
                    close();
                }
            });
        }

        return overlay;
    }

    function open({ entrega, tarea, user } = {}) {
        const overlay = mount();
        if (!overlay) return;

        const entregaId = entrega?.id || Math.floor(1000 + Math.random() * 9000);
        const codigo = `REC-SHD-2026-${String(entregaId).padStart(4, '0')}`;
        const timestampStr = formatTimestamp(entrega?.fechaEntrega);
        const nombreEstudiante = [user?.nombres, user?.apellidos].filter(Boolean).join(' ') || 'Estudiante';
        const correoEstudiante = user?.email || 'correo@institucion.edu.pe';
        const tituloTarea = tarea?.titulo || entrega?.tarea?.titulo || 'Actividad académica';
        const nombreCurso = tarea?.curso?.nombre || entrega?.tarea?.curso?.nombre || 'Curso regular';
        const archivoNombre = formatFileName(entrega?.archivoUrl);

        overlay.querySelector('#cmpCodigo').textContent = codigo;
        overlay.querySelector('#cmpEstudiante').textContent = nombreEstudiante;
        overlay.querySelector('#cmpCorreo').textContent = correoEstudiante;
        overlay.querySelector('#cmpCurso').textContent = nombreCurso;
        overlay.querySelector('#cmpTarea').textContent = tituloTarea;
        const archivoEl = overlay.querySelector('#cmpArchivo');
        archivoEl.textContent = archivoNombre;
        if (entrega?.archivoUrl) {
            archivoEl.title = String(entrega.archivoUrl).split('/').pop() || archivoNombre;
        } else {
            archivoEl.removeAttribute('title');
        }
        overlay.querySelector('#cmpTimestamp').textContent = timestampStr;

        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
    }

    window.shidellComprobante = {
        mount,
        open,
        close,
        formatFileName,
        formatTimestamp
    };
})();
