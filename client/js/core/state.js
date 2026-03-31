// --- Estado Global de la Aplicación ---
export const state = {
    selectedTroquel: "",
    selectedTecnico: "",
    selectedTroquelLabel: "",
    selectedTecnicoLabel: "",
    selectedTroquelImage: "",
    currentMaintenanceId: null,
    isSaving: false,
    tasks: {
        preventivo: [],
        correctivo: [],
        antesProduccion: []
    },
    timer: { seconds: 0, isRunning: false },
    sectionComments: {
        preventivo: "",
        correctivo: "",
        antesProduccion: ""
    }
};


// --- Funciones para Manejar el LocalStorage ---
export const saveStateToStorage = () => {
    if (state.currentMaintenanceId) {
        localStorage.setItem('inProgressMaintenance', JSON.stringify(state));
    }
}

export const loadStateFromStorage = () => {
    const saved = localStorage.getItem('inProgressMaintenance');
    if (saved) {
        const parsedState = JSON.parse(saved);

        if (parsedState.currentMaintenanceId) {
            Object.assign(state, JSON.parse(saved));
            return true;
        }
    }
    return false;
}

export const clearStateStorage = () => {
    localStorage.removeItem('inProgressMaintenance');

    // Reseteamos el estado global a sus valores iniciales
    state.selectedTroquel = "";
    state.selectedTecnico = "";
    state.selectedTroquelLabel = "";
    state.selectedTecnicoLabel = "";
    state.selectedTroquelImage = "";
    state.currentMaintenanceId = null;
    state.isSaving = false;
    
    // 🔴 EL CAMBIO ESTÁ AQUÍ: 
    // En lugar de vaciar los arreglos, reiniciamos el estatus de cada tarea
    Object.keys(state.tasks).forEach(sectionKey => {
        state.tasks[sectionKey].forEach(task => {
            task.status = 'No Completado';
        });
    });

    state.timer = { seconds: 0, isRunning: false };
    state.sectionComments = {
        preventivo: "",
        correctivo: "",
        antesProduccion: ""
    };
}