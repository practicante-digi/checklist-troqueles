/**
 * Utilidades puras (sin dependencias del DOM ni del state).
 * Para mantener estas funciones aquí deben ser independientes y reutilizables.
 */

/**
 * Formatea segundos a string HH:MM:SS
 * (Re-exportado desde timer.js para uso externo si se necesita)
 */
export function formatTime(seconds) {
    const hrs  = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

/**
 * Capitaliza la primera letra de un string
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}