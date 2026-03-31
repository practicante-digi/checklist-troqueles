import { state } from '../../state.js';
import { $ } from '../../ui.js';

let timerInterval;

/**
 * Convierte segundos totales a formato HH:MM:SS
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
    const hrs  = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

/**
 * Inicia el cronómetro desde cero
 */
export function startTimer() {
    state.timer = { seconds: 0, isRunning: true };
    $('#header-timer').classList.remove('hidden');
    timerInterval = setInterval(() => {
        state.timer.seconds++;
        $('#header-timer').textContent = formatTime(state.timer.seconds);
    }, 1000);
}

/**
 * Restaura el cronómetro desde el estado guardado (al recargar la página)
 */
export function restoreTimer() {
    if (state.timer?.isRunning) {
        $('#header-timer').classList.remove('hidden');
        $('#header-timer').textContent = formatTime(state.timer.seconds);
        timerInterval = setInterval(() => {
            state.timer.seconds++;
            $('#header-timer').textContent = formatTime(state.timer.seconds);
        }, 1000);
    }
}

/**
 * Detiene el cronómetro y lo resetea visualmente
 */
export function stopTimer() {
    clearInterval(timerInterval);
    state.timer.isRunning = false;
    $('#header-timer').classList.add('hidden');
    $('#header-timer').textContent = '00:00:00';
}
