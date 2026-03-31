import { state } from '../core/state.js';
import { $ } from '../core/ui.js';
import { formatTime } from './timer.js';

let countdownInterval = null;
let remainingTime = 5;

/**
 * Muestra el modal de confirmación con el resumen del mantenimiento actual.
 */
export function showConfirmationModal() {
    $('#modal-timer-summary').textContent = formatTime(state.timer.seconds);
    $('#modal-sections-summary').innerHTML = '';

    ['preventivo', 'correctivo', 'antesProduccion'].forEach(key => {
        const tasks = state.tasks[key] || [];
        const completed = tasks.filter(t => t.status === 'Completado').length;
        const total = tasks.length;

        if (total === 0) return;

        const isComplete = completed === total;
        const titleColor = isComplete ? 'text-green-600' : 'text-gray-700';

        $('#modal-sections-summary').innerHTML += `
            <li class="flex items-center justify-between py-1 px-1">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold ${titleColor} tracking-wider">
                        ${key.toUpperCase()}
                    </span>
                </div>
                <span class="text-sm font-semibold tabular-nums ${isComplete ? 'text-green-600' : 'text-gray-900'}">
                    ${completed}/${total}
                </span>
            </li>`;
    });

    $('#confirmation-modal').classList.remove('hidden');
}

/**
 * Oculta el modal de confirmación y resetea su contenido interno.
 */
export function hideConfirmationModal() {
    clearInterval(countdownInterval);
    $('#confirmation-modal').classList.add('hidden');

    // Esperamos que termine la animación CSS antes de resetear el contenido
    setTimeout(() => {
        $('#modal-content-summary').classList.remove('hidden');
        $('#modal-content-loading').classList.add('hidden');
        $('#modal-content-success').classList.add('hidden');
    }, 400);
}

/**
 * Maneja la confirmación del modal: ejecuta la finalización y muestra el estado de éxito.
 * @param {Function} onConfirm - función async que finaliza el mantenimiento (executeFinalization)
 */
export async function handleModalConfirmation(onConfirm) {
    $('#modal-content-summary').classList.add('hidden');
    $('#modal-content-loading').classList.remove('hidden');

    const success = await onConfirm();

    if (success) {
        $('#modal-content-loading').classList.add('hidden');
        $('#modal-content-success').classList.remove('hidden');

        remainingTime = 5;
        $('#countdown').textContent = remainingTime;
        countdownInterval = setInterval(() => {
            remainingTime--;
            $('#countdown').textContent = remainingTime;
            if (remainingTime <= 0) hideConfirmationModal();
        }, 1000);

        $('#close-success-modal').onclick = hideConfirmationModal;
    } else {
        hideConfirmationModal();
    }
}
