import { state } from '../../state.js';
import { $ } from '../../ui.js';

/**
 * Inicia el reloj en tiempo real en el header
 */
export function setHeaderInfo() {
    setInterval(() => {
        const now = new Date();
        $('#header-date').innerHTML = `<span class='text-sm font-medium text_primary_color'>${now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'})}</span> <span class='ml-4 text-lg font-semibold text_primary_color'>${now.toLocaleTimeString('en-US')}</span>`;
    }, 1000);
}

/**
 * Actualiza la imagen del troquel en el header.
 * Usa state.selectedTroquelImage para mostrar u ocultar la imagen.
 */
export function updateHeaderImage() {
    const imgElement = $('#header-troquel-image');
    const placeholder = $('#header-troquel-placeholder');

    if (!imgElement || !placeholder) return;

    if (state.selectedTroquelImage) {
        imgElement.src = state.selectedTroquelImage;
        imgElement.classList.remove('hidden');
        placeholder.classList.add('hidden');

        imgElement.onerror = () => {
            imgElement.classList.add('hidden');
            placeholder.textContent = '';
            placeholder.classList.remove('hidden');
        };
    } else {
        imgElement.src = '';
        imgElement.classList.add('hidden');
        placeholder.textContent = '';
        placeholder.classList.remove('hidden');
    }
}

/**
 * Evita el parpadeo visual al recargar la página con un mantenimiento activo.
 * Aplica inmediatamente el estado guardado en localStorage antes de que el JS cargue los datos.
 */
export function applyAntiFlicker() {
    const savedState = localStorage.getItem('inProgressMaintenance');
    if (!savedState) return;

    const parsedState = JSON.parse(savedState);
    if (!parsedState.currentMaintenanceId) return;

    $('#selectors-section').classList.add('hidden');
    $('#start-section').classList.add('hidden');
    $('#accordion-container').classList.remove('hidden');
    $('#save-button-container').classList.remove('hidden');
    $('#header-active-controls').classList.remove('hidden');
    document.body.classList.add('mantenimiento-activo');

    $('#header-troquel-display').textContent = parsedState.selectedTroquelLabel || '-';
    $('#header-tecnico-display').textContent = parsedState.selectedTecnicoLabel || '-';

    if (parsedState.selectedTroquelImage) {
        $('#header-troquel-image').src = parsedState.selectedTroquelImage;
        $('#header-troquel-image').classList.remove('hidden');
        $('#header-troquel-placeholder').classList.add('hidden');
    }
}
