// --- Funciones puras para comunicarse con el Backend ---
export async function fetchTroqueles() {
    const response = await fetch('/api/troqueles');
    if (!response.ok) throw new Error('Error al conectar con el servidor para obtener troqueles');
    return await response.json();
}

export async function fetchTecnicos() {
    const response = await fetch('/api/users');
    if (!response.ok) throw new Error('Error al conectar con el servidor para obtener técnicos');
    return await response.json();
}

export async function fetchActividades() {
    const response = await fetch('/api/actividades');
    if (!response.ok) throw new Error('Error al cargar el checklist de actividades');
    return await response.json();
}

export async function apiIniciarMantenimiento(payload) {
    const response = await fetch('/api/mantenimiento/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al iniciar el mantenimiento');
    }
    return await response.json();
}

export async function apiFinalizarMantenimiento(idMantenimiento, actividadesCompletadas) {
    const response = await fetch('/api/mantenimiento/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idMantenimiento, actividadesCompletadas })
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al finalizar el mantenimiento.');
    }
    return await response.json();
}

export async function apiCancelarMantenimiento(idMantenimiento) {
    const response = await fetch(`/api/mantenimiento/${idMantenimiento}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error desconocido al cancelar el mantenimiento.');
    }
    return true;
}