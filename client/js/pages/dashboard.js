const POWERBI_URL = "https://app.powerbi.com/view?r=eyJrIjoiODY0OTQxNTItYzZjMS00ZDRkLWExYzgtMmE4ZjIzNzhlN2Y5IiwidCI6IjY0NWE3NDU1LTkzMGItNDk3Ni1iOTFiLTYzOTAxOGEwZGY5OCJ9&navContentPaneEnabled=false";

// Intervalo de refresco: 10 minutos
const REFRESH_INTERVAL = 600000;

// Tiempo de seguridad para renderizado (5 minutos)
const RENDER_BUFFER = 300000;

/**
 * Carga reporte en background y hace el swap invisible
 * @param {boolean} isFirstLoad - Si es true, no intenta borrar nada viejo
 */
function refreshReport(isFirstLoad = false) {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    // 1. Crear el iframe nuevo (Oculto detrás)
    const newIframe = document.createElement('iframe');
    newIframe.className = 'pbi-iframe pbi-loading';
    newIframe.title = "Monitor Power BI";

    // 2. Cache Buster: Timestamp para forzar datos nuevos
    const timestamp = new Date().getTime();
    const random = Math.random().toString(36).substring(7);
    newIframe.src = `${POWERBI_URL}&t=${timestamp}&r=${random}&nocache=true`;

    // 3. Insertar en el DOM (Empieza a cargar)
    container.appendChild(newIframe);

    // 4. Esperar al evento onload del HTML base
    newIframe.onload = () => {

        // 5. Esperar el buffer de seguridad (para que desaparezca el logo de carga interno)
        setTimeout(() => {
            // Hacer visible el nuevo (z-index alto)
            newIframe.classList.remove('pbi-loading');
            newIframe.classList.add('pbi-visible');

            // Si no es la primera vez, borrar el viejo
            if (!isFirstLoad) {
                const oldIframes = container.querySelectorAll('.pbi-visible');
                oldIframes.forEach(iframe => {
                    if (iframe !== newIframe) {
                        // Pequeño timeout extra para asegurar suavidad visual
                        setTimeout(() => iframe.remove(), 100);
                    }
                });
            }
        }, RENDER_BUFFER);
    };
}

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Carga inmediata al abrir la página
    refreshReport(true);

    // 2. Programar el ciclo infinito de 1 hora
    setInterval(() => {
        refreshReport(false);
    }, REFRESH_INTERVAL);
});