import { getChoicesTroquelConfig, formatTroquelOptions } from '../core/ui.js';

let isDatepickerOpen = false;
let currentPage = 1;
let totalPages = 1;
let choicesTecnico, choicesTroquel;
let fpDesde, fpHasta;
let initialized = false;

/**
 * Inicializa el Historial. Se llama solo la primera vez que se activa el tab.
 */
export async function initHistorial() {
    if (initialized) return;
    initialized = true;

    // === Flatpickr ===
    const fpConfig = {
        locale: 'es',
        dateFormat: 'Y-m-d',
        altInput: true,
        altFormat: 'd \\de M Y',
        disableMobile: true,
        onOpen: () => { isDatepickerOpen = true; },
        onClose: () => { setTimeout(() => { isDatepickerOpen = false; }, 150); }
    };

    fpDesde = flatpickr('#filtro-desde-head', { ...fpConfig, placeholder: 'Desde' });
    fpHasta = flatpickr('#filtro-hasta-head', { ...fpConfig, placeholder: 'Hasta' });

    // === Carga de filtros ===
    await Promise.all([cargarTecnicos(), cargarTroqueles()]);
    configurarEventosFiltros();
    buscarHistorial();
}

async function cargarTecnicos() {
    try {
        const res = await fetch('/api/users');
        const data = await res.json();
        const options = data.map(u => ({ value: u.Nombre, label: u.Nombre }));
        choicesTecnico = new Choices(document.getElementById('filtro-tecnico-head'), {
            searchEnabled: true, itemSelectText: '', shouldSort: false, allowHTML: false,
        });
        choicesTecnico.setChoices(options, 'value', 'label', false);
    } catch (e) { console.error('Error cargando técnicos:', e); }
}

async function cargarTroqueles() {
    try {
        const res = await fetch('/api/troqueles');
        const data = await res.json();
        const options = formatTroquelOptions(data, 'Codigo', true);
        choicesTroquel = new Choices(document.getElementById('filtro-troquel-head'), getChoicesTroquelConfig(true));
        choicesTroquel.setChoices(options, 'value', 'label', true);
    } catch (e) { console.error('Error cargando troqueles:', e); }
}

function configurarEventosFiltros() {
    document.querySelectorAll('.th-content').forEach(th => {
        th.addEventListener('click', (e) => {
            e.preventDefault();
            const parentTh = e.target.closest('.th-filter');
            if (!parentTh) return;
            const targetPopup = parentTh.querySelector('.filter-popup');
            if (!targetPopup) return;
            const isHidden = targetPopup.classList.contains('popup-hidden');
            cerrarTodosLosDropdowns();
            if (isHidden) {
                targetPopup.classList.remove('popup-hidden');
                parentTh.style.zIndex = '50';
            }
        });
    });

    document.querySelectorAll('.btn-clear').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const popup = e.target.closest('.filter-popup');
            if (popup.id === 'popup-troquel') limpiarFiltro('troquel');
            if (popup.id === 'popup-tecnico') limpiarFiltro('tecnico');
            if (popup.id === 'popup-fecha') limpiarFiltro('fecha');
        });
    });

    document.querySelectorAll('.btn-apply').forEach(btn => {
        btn.addEventListener('click', (e) => { e.preventDefault(); aplicarFiltros(); });
    });

    // Cierra dropdowns al clicar fuera
    document.addEventListener('click', (event) => {
        if (isDatepickerOpen) return;
        if (event.target.closest('.th-content')) return;
        if (event.target.closest('.filter-popup')) return;
        if (event.target.closest('.flatpickr-calendar')) return;
        if (event.target.closest('.choices__list--dropdown')) return;
        cerrarTodosLosDropdowns();
    });

    document.getElementById('btn-prev').addEventListener('click', () => cambiarPagina(-1));
    document.getElementById('btn-next').addEventListener('click', () => cambiarPagina(1));
    document.getElementById('btn-cerrar-modal').addEventListener('click', () => cerrarModal());

    document.getElementById('tabla-body').addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (row) verDetalle(row.dataset.id);
    });

    document.getElementById('detail-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) cerrarModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cerrarModal();
    });
}

function cerrarTodosLosDropdowns() {
    document.querySelectorAll('.th-filter').forEach(th => th.style.zIndex = '1');
    document.querySelectorAll('.filter-popup').forEach(p => p.classList.add('popup-hidden'));
}

function limpiarFiltro(tipo) {
    if (tipo === 'troquel' && choicesTroquel) choicesTroquel.setChoiceByValue('');
    if (tipo === 'tecnico' && choicesTecnico) choicesTecnico.setChoiceByValue('');
    if (tipo === 'fecha') {
        if (fpDesde) fpDesde.clear();
        if (fpHasta) fpHasta.clear();
    }
    aplicarFiltros();
}

function aplicarFiltros() {
    cerrarTodosLosDropdowns();
    buscarHistorial(1);
}

async function buscarHistorial(page = 1) {
    currentPage = page;
    const tecnico = document.getElementById('filtro-tecnico-head').value;
    const troquel = document.getElementById('filtro-troquel-head').value;
    const desde = fpDesde.selectedDates.length ? fpDesde.formatDate(fpDesde.selectedDates[0], 'Y-m-d') : '';
    const hasta = fpHasta.selectedDates.length ? fpHasta.formatDate(fpHasta.selectedDates[0], 'Y-m-d') : '';

    const thTecnico = document.getElementById('th-tecnico');
    const thTroquel = document.getElementById('th-troquel');
    const thFecha = document.getElementById('th-fecha');
    if (thTecnico) thTecnico.classList.toggle('active-filter', !!tecnico);
    if (thTroquel) thTroquel.classList.toggle('active-filter', !!troquel);
    if (thFecha) thFecha.classList.toggle('active-filter', !!(desde || hasta));

    const params = new URLSearchParams();
    if (tecnico) params.set('tecnico', tecnico);
    if (troquel) params.set('troquel', troquel);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    params.set('page', page);
    params.set('limit', 30);

    const tbody = document.getElementById('tabla-body');
    const emptyState = document.getElementById('empty-state');

    tbody.innerHTML = Array.from({ length: 5 }, () => `
    <tr>
        <td><div class="skeleton-cell" style="width:100px"></div></td>
        <td><div class="skeleton-cell" style="width:120px"></div></td>
        <td><div class="skeleton-cell" style="width:100px"></div></td>
        <td><div class="skeleton-cell" style="width:60px"></div></td>
    </tr>
    `).join('');

    try {
        const res = await fetch(`/api/historial?${params.toString()}`);
        const result = await res.json();
        const { data, pagination } = result;

        totalPages = pagination.totalPages;
        document.getElementById('total-badge').textContent = `${pagination.total} registro${pagination.total !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            tbody.innerHTML = data.map(row => `
            <tr data-id="${row.idMantenimiento}">
                <td style="font-weight:600;">${escapeHtml(row.CodigoTroquel)}</td>
                <td>${escapeHtml(row.NombreTecnico)}</td>
                <td>${formatFecha(row.Inicio)}</td>
                <td><span class="duracion-badge">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                ${formatDuracion(row.DuracionMinutos)}
                </span></td>
            </tr>
            `).join('');
        }

        actualizarPaginacion(pagination);
    } catch (err) {
        console.error('Error buscando historial:', err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#ef4444; padding:2rem;">Error al cargar los datos.</td></tr>`;
    }
}

function actualizarPaginacion(p) {
    document.getElementById('page-indicator').textContent = `${p.page} / ${p.totalPages || 1}`;
    document.getElementById('btn-prev').disabled = p.page <= 1;
    document.getElementById('btn-next').disabled = p.page >= p.totalPages;
}

function cambiarPagina(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) buscarHistorial(newPage);
}

async function verDetalle(id) {
    const modal = document.getElementById('detail-modal');
    const body = document.getElementById('modal-body');

    modal.classList.add('active');
    body.innerHTML = `<div style="text-align:center; padding:2rem;"><div style="width:2rem; height:2rem; border:3px solid #f3f4f6; border-top-color:#ff5c35; border-radius:50%; animation:spin 0.8s linear infinite; margin:0 auto 1rem;"></div><p style="color:#6b7280;">Cargando detalle...</p></div>`;

    const subhEl = document.getElementById('modal-subheader');
    if (subhEl) subhEl.innerHTML = '';

    try {
        const res = await fetch(`/api/historial/${id}`);
        const result = await res.json();
        const { info, actividades } = result;

        document.getElementById('modal-title').textContent = `${info.CodigoTroquel}`;

        const subheaderHtml = `<div class="info-grid">
            <div class="info-item"><div class="info-label">Técnico</div><div class="info-value">${escapeHtml(info.NombreTecnico)}</div></div>
            <div class="info-item"><div class="info-label">Inicio</div><div class="info-value">${formatFechaHora(info.Inicio)}</div></div>
            <div class="info-item"><div class="info-label">Fin</div><div class="info-value">${formatFechaHora(info.Fin)}</div></div>
            <div class="info-item"><div class="info-label">Duración</div><div class="info-value">${formatDuracion(info.DuracionMinutos)}</div></div>
        </div>`;
        const subheaderDOM = document.getElementById('modal-subheader');
        if (subheaderDOM) subheaderDOM.innerHTML = subheaderHtml;

        let html = '';
        const porTipo = {};
        actividades.forEach(a => {
            if (!porTipo[a.TipoMantenimiento]) porTipo[a.TipoMantenimiento] = [];
            porTipo[a.TipoMantenimiento].push(a);
        });

        if (actividades.length === 0) {
            html += `<p style="color:#9ca3af; text-align:center; padding:1rem;">No hay actividades registradas.</p>`;
        } else {
            let isFirstSection = true;
            for (const [tipo, acts] of Object.entries(porTipo)) {
                const openAttr = isFirstSection ? 'open' : '';
                isFirstSection = false;
                const tipoLimpio = tipo.replace(/[^\w\s\u00C0-\u017F-]/g, '').trim();

                html += `<details class="tipo-section" ${openAttr}>
                    <summary><span>${escapeHtml(tipoLimpio)}</span>
                    <svg class="tipo-section-icon" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                    </svg></summary>
                    <div class="tipo-section-content">`;

                const sectionComment = acts.find(a => a.Comentario && a.Comentario.trim())?.Comentario || "";

                acts.forEach(a => {
                    const estadoClass = a.Estado === 'Completado' ? 'estado-completado' : a.Estado === 'No Completado' ? 'estado-no-completado' : 'estado-no-aplica';
                    const iconCheck = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
                    const iconCross = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
                    const iconDash = `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"/></svg>`;
                    const estadoIcon = a.Estado === 'Completado' ? iconCheck : a.Estado === 'No Completado' ? iconCross : iconDash;

                    html += `<div class="actividad-row">
                        <span class="estado-badge ${estadoClass}" title="${escapeHtml(a.Estado)}">${estadoIcon}</span>
                        <div class="actividad-info"><div class="actividad-nombre">${escapeHtml(a.Actividad)}</div></div>
                    </div>`;
                });

                if (sectionComment) {
                    html += `<div class="section-comment-display mt-4 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                        <div class="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1">Observaciones de la sección</div>
                        <div class="text-sm text-gray-700 italic">"${escapeHtml(sectionComment)}"</div>
                    </div>`;
                }
                html += `</div></details>`;
            }
        }
        body.innerHTML = html;
    } catch (err) {
        console.error('Error cargando detalle:', err);
        body.innerHTML = `<p style="color:#ef4444; text-align:center; padding:2rem;">Error al cargar el detalle.</p>`;
    }
}

function cerrarModal() {
    document.getElementById('detail-modal').classList.remove('active');
}

// --- Utilidades de formato ---
function formatFecha(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    const dia = String(d.getDate()).padStart(2, '0');
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return `${dia} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function formatFechaHora(isoString) {
    if (!isoString) return '—';
    const d = new Date(isoString);
    const dia = String(d.getDate()).padStart(2, '0');
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${dia} ${meses[d.getMonth()]} ${h}:${m}`;
}

function formatDuracion(minutos) {
    if (minutos == null || minutos < 0) return '—';
    if (minutos < 60) return `${minutos} min`;
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
