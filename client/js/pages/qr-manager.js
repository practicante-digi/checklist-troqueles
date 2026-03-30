
const grid = document.getElementById('qr-grid');
const searchInput = document.getElementById('search-input');
const counterBadge = document.getElementById('counter-badge');
const btnDownloadAll = document.getElementById('btn-download-all');
const btnPrint = document.getElementById('btn-print');

let allTroqueles = [];

async function loadQRCodes() {
    try {
    const response = await fetch('/api/troqueles/qr/batch');
    if (!response.ok) throw new Error('Error al cargar QR codes');

    allTroqueles = await response.json();
    renderCards(allTroqueles);
    } catch (error) {
    grid.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 3rem;';
    errorDiv.innerHTML = `
        <p style="color: #ef4444; font-weight: 600; font-size: 1.1rem;">Error al cargar los códigos QR</p>
        <p style="color: #6b7280; margin-top: 0.5rem;">${error.message}</p>`;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-toolbar primary';
    retryBtn.style.margin = '1rem auto';
    retryBtn.textContent = 'Reintentar';
    retryBtn.addEventListener('click', loadQRCodes);
    errorDiv.appendChild(retryBtn);
    grid.appendChild(errorDiv);
    }
}

function renderCards(troqueles) {
    if (troqueles.length === 0) {
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <p style="color: #6b7280; font-weight: 500;">No se encontraron troqueles</p>
        </div>`;
    counterBadge.textContent = '0 troqueles';
    return;
    }

    counterBadge.textContent = `${troqueles.length} troquel${troqueles.length !== 1 ? 'es' : ''}`;

    grid.innerHTML = troqueles.map(t => `
    <div class="qr-card" data-codigo="${t.codigo.toLowerCase()}" data-id="${t.idTroquel}">
        
        <div class="qr-image-wrapper">
        <img src="${t.qr}" alt="QR ${t.codigo}">
        </div>

        <div class="qr-card-content" style="width: 100%;">
        <div class="qr-label mb-3">${t.codigo}</div>
        
        <div class="qr-actions">
            <button class="btn-action btn-download" data-qr="${t.qr}" data-codigo="${t.codigo}" title="Descargar QR">
            <svg style="width:16px;height:16px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            <span class="sm:hidden lg:inline">Descargar</span>
            </button>
            
            <button class="btn-action action-open btn-open" data-url="${t.url}" title="Abrir formulario">
            <svg style="width:16px;height:16px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            <span class="sm:hidden lg:inline">Abrir</span>
            </button>
        </div>
        </div>
        
    </div>
    `).join('');
}

function downloadQR(dataUrl, codigo) {
    const link = document.createElement('a');
    link.download = `QR-${codigo}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event delegation: handle clicks on download and open buttons inside the grid
grid.addEventListener('click', (e) => {
    const downloadBtn = e.target.closest('.btn-download');
    const openBtn = e.target.closest('.btn-open');

    if (downloadBtn) {
    const qr = downloadBtn.dataset.qr;
    const codigo = downloadBtn.dataset.codigo;
    if (qr && codigo) downloadQR(qr, codigo);
    }

    if (openBtn) {
    const url = openBtn.dataset.url;
    if (url) window.open(url, '_blank');
    }
});

// Print button
btnPrint.addEventListener('click', () => {
    window.print();
});

// Descargar todos los QRs en un archivo ZIP (Versión Definitiva)
btnDownloadAll.addEventListener('click', async () => {
    if (allTroqueles.length === 0) return;

    // 1. Cambiamos el botón a estado de carga
    const originalText = btnDownloadAll.innerHTML;
    btnDownloadAll.innerHTML = `
    <div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-right: 6px; display: inline-block; vertical-align: middle;"></div>
    Comprimiendo...
    `;
    btnDownloadAll.disabled = true;
    btnDownloadAll.style.opacity = '0.7';

    try {
    // 2. Inicializamos JSZip
    const zip = new JSZip();
    const imgFolder = zip.folder("QR_Troqueles");

    // 3. Procesamos cada imagen
    const promesasDescarga = allTroqueles.map(async (t) => {
        try {
        // Si el QR viene en formato Base64 (que es tu caso)
        if (t.qr.startsWith('data:image')) {
            // Extraemos solo el código de la imagen quitando la cabecera
            const base64Data = t.qr.split(',')[1];
            imgFolder.file(`QR-${t.codigo}.png`, base64Data, {base64: true});
        } 
        // Si por algún motivo viniera como URL normal (plan B)
        else {
            const respuesta = await fetch(t.qr);
            const blob = await respuesta.blob();
            imgFolder.file(`QR-${t.codigo}.png`, blob);
        }
        } catch (err) {
        console.error(`No se pudo agregar el QR de ${t.codigo}:`, err);
        }
    });

    // Esperamos a que TODAS las imágenes se hayan procesado
    await Promise.all(promesasDescarga);

    // 4. Generamos el archivo ZIP
    const content = await zip.generateAsync({type: "blob"});

    // 5. Forzamos la descarga del ZIP
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = "Codigos_QR_Troqueles.zip";
    document.body.appendChild(link);
    link.click();
    
    // Limpieza de memoria
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    } catch (error) {
    console.error("Error al generar el ZIP:", error);
    alert("Hubo un error al generar el archivo ZIP. Intenta nuevamente.");
    } finally {
    // 6. Restauramos el botón a la normalidad
    btnDownloadAll.innerHTML = originalText;
    btnDownloadAll.disabled = false;
    btnDownloadAll.style.opacity = '1';
    }
});

// Init
loadQRCodes();
