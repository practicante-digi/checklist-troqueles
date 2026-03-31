import { state, saveStateToStorage } from '../../state.js';

/**
 * Callback que se dispara cuando el usuario marca/desmarca una tarea del checklist.
 * @param {HTMLInputElement} checkbox
 * @param {Function} onStatusChange - callback para notificar a main.js que actualice el botón de guardar
 */
export function handleTaskCheckboxChange(checkbox, onStatusChange) {
    const { section, taskId } = checkbox.dataset;
    const task = state.tasks[section]?.find(t => t.id == taskId);
    if (task) {
        task.status = checkbox.checked ? 'Completado' : 'No Completado';
        checkSectionCompletion(section);
        saveStateToStorage();
        if (onStatusChange) onStatusChange();
    }
}

/**
 * Evalúa si todas las tareas de una sección están completadas y aplica la clase visual.
 * @param {string} sectionKey - 'preventivo' | 'correctivo' | 'antesProduccion'
 */
export function checkSectionCompletion(sectionKey) {
    const tasks = state.tasks[sectionKey] || [];
    const allCompleted = tasks.length > 0 && tasks.every(task => task.status === 'Completado');
    const accordionButton = document.querySelector(`[data-target="#accordion-content-${sectionKey}"]`);

    if (accordionButton) {
        accordionButton.classList.toggle('section-complete', allCompleted);
    }
}
