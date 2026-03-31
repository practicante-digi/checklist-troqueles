import { state, saveStateToStorage, loadStateFromStorage, clearStateStorage } from './js/core/state.js';
import { fetchTroqueles, fetchTecnicos, fetchActividades, apiIniciarMantenimiento, apiFinalizarMantenimiento, apiCancelarMantenimiento } from './js/api/api.js';
import { $, showToast, renderAccordions, getChoicesTroquelConfig, formatTroquelOptions } from './js/core/ui.js';
import { startTimer, restoreTimer, stopTimer } from './js/components/timer.js';
import { setHeaderInfo, updateHeaderImage, applyAntiFlicker } from './js/components/header.js';
import { handleTaskCheckboxChange, checkSectionCompletion } from './js/components/accordion.js';
import { showConfirmationModal, hideConfirmationModal, handleModalConfirmation } from './js/components/modal.js';

// --- Variables de Choices.js ---
let choicesTroqueles;
let choicesTecnicos;

// --- Selectores del DOM ---
const troquelesSelect = $('#troquelesSelect');
const techSelect = $('#tech-select');
const selectorsSection = $('#selectors-section');
const accordionContainer = $('#accordion-container');
const saveButton = $('#save-button');
const saveButtonContainer = $('#save-button-container');
const startSection = $('#start-section');
const startMessage = $('#start-message');
const startButton = $('#start-button');
const confirmationModal = $('#confirmation-modal');
const cancelConfirmationModal = $('#cancel-confirmation-modal');

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    applyAntiFlicker();
    setHeaderInfo();
    setupEventListeners();

    // 1. Resolver el tab correcto ANTES de cargar datos pesados de la API (para evitar 'flicker' visual)
    const urlParams = new URLSearchParams(window.location.search);
    const troquelFromQR = urlParams.get('troquel');
    let initialTab = localStorage.getItem('activeTab') || 'formulario';

    // Si hay QR o una sesión guardada a medias, forzamos que abra en Formulario
    if (troquelFromQR || localStorage.getItem('mantenimientoState')) {
        initialTab = 'formulario';
    }

    // Ejecutamos switchTab aquí mismo (antes del bloque async) para esconder rápido el formulario en el DOM
    switchTab(initialTab);

    // Inicializar Choices.js
    choicesTroqueles = new Choices(troquelesSelect, getChoicesTroquelConfig(false));

    choicesTecnicos = new Choices(techSelect, {
        searchEnabled: false,
        itemSelectText: '',
        shouldSort: false,
    });

    // Traer datos de la API
    try {
        const [troquelesData, tecnicosData, actividadesData] = await Promise.all([
            fetchTroqueles(), fetchTecnicos(), fetchActividades()
        ]);

        const opcionesTroqueles = formatTroquelOptions(troquelesData, 'idTroquel', false);
        choicesTroqueles.setChoices(opcionesTroqueles, 'value', 'label', true);

        const opcionesTecnicos = tecnicosData.map(t => ({ value: String(t.idUsuario), label: t.Nombre }));
        choicesTecnicos.setChoices([{ value: '', label: 'Seleccionar técnico', selected: true, disabled: true, placeholder: true }, ...opcionesTecnicos], 'value', 'label', true);

        Object.assign(state.tasks, actividadesData);
        renderAccordions(checkbox => handleTaskCheckboxChange(checkbox, updateSaveButtonStatus));

    } catch (error) {
        return showToast("Error fatal", "No se pudieron cargar los datos iniciales.", "destructive");
    }

    // C. Restaurar Sesión con datos ya cargados
    if (loadStateFromStorage()) {
        restaurarMantenimiento();
    } else if (troquelFromQR) {
        choicesTroqueles.setChoiceByValue(String(troquelFromQR));
        state.selectedTroquel = troquelFromQR;
        checkHeaderFields();
    }
}

// ==========================================
// FLUJO DE MANTENIMIENTO
// ==========================================

async function handleStartMaintenance() {
    if (!state.selectedTroquel || !state.selectedTecnico) {
        return showToast('Error', 'Selecciona troquel y técnico antes de iniciar.', 'destructive');
    }

    startButton.disabled = true;
    startButton.innerHTML = '<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block"></div> Iniciando...';

    try {
        const result = await apiIniciarMantenimiento({ idTroquel: state.selectedTroquel, idUsuario: state.selectedTecnico });
        state.currentMaintenanceId = result.idMantenimiento;

        const troquelData = choicesTroqueles.getValue();
        state.selectedTroquelLabel = troquelData?.customProperties?.codigo || troquelData?.label || state.selectedTroquel;
        state.selectedTecnicoLabel = choicesTecnicos.getValue()?.label || state.selectedTecnico;
        state.selectedTroquelImage = troquelData?.customProperties?.imagenUrl || "";

        saveStateToStorage();
        showToast('¡Mantenimiento Iniciado!', 'Checklist disponible.', 'success');

        accordionContainer.classList.remove('hidden');
        saveButtonContainer.classList.remove('hidden');
        startSection.classList.add('hidden');
        selectorsSection.classList.add('hidden');
        document.body.classList.add('mantenimiento-activo');
        $('#header-active-controls').classList.remove('hidden');

        $('#header-troquel-display').textContent = state.selectedTroquelLabel;
        $('#header-tecnico-display').textContent = state.selectedTecnicoLabel;

        updateHeaderImage();
        choicesTroqueles.disable();
        choicesTecnicos.disable();
        updateSaveButtonStatus();
        startTimer();
    } catch (error) {
        showToast('Error', error.message, 'destructive');
        startButton.disabled = false;
        startButton.innerHTML = `Iniciar Mantenimiento`;
    }
}

function restaurarMantenimiento() {
    choicesTroqueles.setChoiceByValue(String(state.selectedTroquel));
    choicesTecnicos.setChoiceByValue(String(state.selectedTecnico));
    choicesTroqueles.disable();
    choicesTecnicos.disable();

    accordionContainer.classList.remove('hidden');
    saveButtonContainer.classList.remove('hidden');
    startSection.classList.add('hidden');
    selectorsSection.classList.add('hidden');
    document.body.classList.add('mantenimiento-activo');

    const troquelData = choicesTroqueles.getValue();
    const troquelLabel = troquelData?.customProperties?.codigo || troquelData?.label;
    const tecnicoLabel = choicesTecnicos.getValue()?.label;

    state.selectedTroquelImage = troquelData?.customProperties?.imagenUrl || state.selectedTroquelImage || "";

    $('#header-troquel-display').textContent = (troquelLabel && !troquelLabel.includes('Seleccionar')) ? troquelLabel : '-';
    $('#header-tecnico-display').textContent = (tecnicoLabel && !tecnicoLabel.includes('Seleccionar')) ? tecnicoLabel : '-';

    updateHeaderImage();
    $('#header-active-controls').classList.remove('hidden');

    renderAccordions(checkbox => handleTaskCheckboxChange(checkbox, updateSaveButtonStatus));

    Object.keys(state.tasks).forEach(sectionKey => {
        state.tasks[sectionKey].forEach(task => {
            const row = document.querySelector(`.task-row[data-task-id="${task.id}"]`);
            if (row) row.querySelector('.task-checkbox').checked = (task.status === 'Completado');
        });
        const textarea = document.getElementById(`comment-textarea-${sectionKey}`);
        if (textarea && state.sectionComments[sectionKey]) textarea.value = state.sectionComments[sectionKey];
        checkSectionCompletion(sectionKey);
    });

    restoreTimer();
    updateSaveButtonStatus();
}

async function executeFinalization() {
    try {
        const actividadesCompletadas = Object.keys(state.tasks).flatMap(sectionKey => {
            const sectionComment = state.sectionComments[sectionKey] || "";
            return state.tasks[sectionKey].map(task => ({
                id: task.id,
                status: task.status || "No Completado",
                comment: sectionComment
            }));
        });

        await apiFinalizarMantenimiento(state.currentMaintenanceId, actividadesCompletadas);
        await resetForm();
        return true;
    } catch (error) {
        showToast('Error', 'No se pudo finalizar. Intenta de nuevo.', 'destructive');
        return false;
    }
}

async function executeCancellation() {
    try {
        if (state.currentMaintenanceId) {
            await apiCancelarMantenimiento(state.currentMaintenanceId);
            showToast('Cancelado', 'Mantenimiento cancelado exitosamente.', 'success');
        }
    } catch (error) {
        showToast('Error', `Error al cancelar: ${error.message}`, 'destructive');
    } finally {
        await resetForm();
    }
}

async function resetForm() {
    clearStateStorage();

    if (choicesTroqueles) {
        choicesTroqueles.removeActiveItems();
        choicesTroqueles.setChoiceByValue('');
        choicesTroqueles.enable();
    }
    if (choicesTecnicos) {
        choicesTecnicos.removeActiveItems();
        choicesTecnicos.setChoiceByValue('');
        choicesTecnicos.enable();
    }

    document.body.classList.remove('mantenimiento-activo');
    $('#header-active-controls').classList.add('hidden');

    selectorsSection.classList.remove('hidden');
    accordionContainer.classList.add('hidden');
    saveButtonContainer.classList.add('hidden');

    checkHeaderFields();

    startButton.disabled = false;
    startButton.innerHTML = `Iniciar Mantenimiento`;

    stopTimer();
    renderAccordions(checkbox => handleTaskCheckboxChange(checkbox, updateSaveButtonStatus));
}

// ==========================================
// EVENTOS Y LÓGICA DE INTERFAZ
// ==========================================

function setupEventListeners() {
    troquelesSelect.addEventListener('change', (e) => {
        state.selectedTroquel = e.target.value;
        const selectedItem = choicesTroqueles.getValue();
        state.selectedTroquelImage = selectedItem?.customProperties?.imagenUrl || "";
        checkHeaderFields();
    });

    techSelect.addEventListener('change', (e) => {
        state.selectedTecnico = e.target.value;
        checkHeaderFields();
    });

    startButton.addEventListener('click', handleStartMaintenance);
    saveButton.addEventListener('click', handleSaveButtonClick);

    // Delegación de eventos para el Acordeón
    accordionContainer.addEventListener('click', (e) => {
        const trigger = e.target.closest('.accordion-trigger');
        if (trigger) {
            const targetContent = $(trigger.dataset.target);
            const targetArrow = trigger.querySelector('.accordion-chevron');
            const isOpening = !targetContent.classList.contains('open');

            accordionContainer.querySelectorAll('.accordion-content').forEach(c => c.classList.remove('open'));
            accordionContainer.querySelectorAll('.accordion-chevron').forEach(a => a.classList.remove('rotate-180'));

            if (isOpening) {
                targetContent.classList.add('open');
                targetArrow.classList.add('rotate-180');
            }
        }
    });

    // Guardado de comentarios en tiempo real
    accordionContainer.addEventListener('input', (e) => {
        const textarea = e.target.closest('.section-comment-textarea');
        if (textarea) {
            state.sectionComments[textarea.dataset.section] = textarea.value;
            saveStateToStorage();
        }
    });

    // Modales de Confirmación / Cancelación
    $('#cancel-button').addEventListener('click', () => cancelConfirmationModal.classList.remove('hidden'));
    $('#modal-cancel-abort-button').addEventListener('click', () => cancelConfirmationModal.classList.add('hidden'));
    $('#modal-cancel-confirm-button').addEventListener('click', async () => {
        await executeCancellation();
        cancelConfirmationModal.classList.add('hidden');
    });

    $('#modal-cancel-button').addEventListener('click', hideConfirmationModal);
    $('#modal-confirm-button').addEventListener('click', () => handleModalConfirmation(executeFinalization));

    window.addEventListener('beforeunload', saveStateToStorage);

    // Escucha el evento del QR Manager cuando se presiona "Abrir"
    document.addEventListener('qr:open-troquel', async (e) => {
        const { troquelId } = e.detail;
        await switchTab('formulario');
        if (choicesTroqueles && troquelId) {
            choicesTroqueles.setChoiceByValue(String(troquelId));
            state.selectedTroquel = String(troquelId);
            const selectedItem = choicesTroqueles.getValue();
            state.selectedTroquelImage = selectedItem?.customProperties?.imagenUrl || '';
            checkHeaderFields();
        }
    });

    setupTabEvents();
}

function handleSaveButtonClick() {
    const hasCompletedTask = Object.values(state.tasks).some(section => section.some(task => task.status === 'Completado'));
    if (!hasCompletedTask) return showToast('Error', 'Debes marcar al menos una actividad como completada.', 'destructive');
    showConfirmationModal();
}

function checkHeaderFields() {
    const hasTroquel = !!state.selectedTroquel;
    const hasTecnico = !!state.selectedTecnico;

    if (hasTroquel && hasTecnico) {
        startSection.classList.remove('hidden');
        startButton.classList.remove('hidden');
        startMessage.innerHTML = `<span class="inline-flex items-start text-gray-700"><span aria-hidden="true" class="mr-2 mt-[1px]">✓</span><span>Presiona "Iniciar" para registrar tu hora de comienzo.<span class="block text-sm text-gray-500">Es obligatorio iniciar antes de comenzar el mantenimiento.</span></span></span>`;
    } else if (hasTroquel || hasTecnico) {
        startSection.classList.remove('hidden');
        startButton.classList.add('hidden');
        startMessage.innerHTML = `<span class="text-gray-700">⚠ Falta seleccionar ${hasTroquel ? 'el Técnico' : 'el Troquel'}.</span>`;
    } else {
        startSection.classList.add('hidden');
    }
}

function updateSaveButtonStatus() {
    const isEnabled = state.currentMaintenanceId && Object.values(state.tasks).some(section => section.some(task => task.status === 'Completado'));
    saveButton.disabled = !isEnabled;
    saveButton.className = isEnabled
        ? "flex h-12 w-full items-center justify-center rounded-sm button_primary_color px-6 text-base font-medium text-white transition-all hover:bg-orange-700 focus:outline-none"
        : "flex h-12 w-full items-center justify-center rounded-sm button_primary_color px-6 text-base font-medium text-white transition-all opacity-50 cursor-not-allowed focus:outline-none";
}

// ==========================================
// TABS Y NAVEGACIÓN
// ==========================================

const ALL_TABS = ['formulario', 'informe', 'historial', 'qrs'];

function setupTabEvents() {
    ALL_TABS.forEach(tab => {
        $(`#tab-${tab}`)?.addEventListener('click', () => switchTab(tab));
    });
}

async function switchTab(activeTab) {
    // Ocultar todos los tabs y quitar clase active
    ALL_TABS.forEach(tab => {
        $(`#tab-${tab}`)?.classList.remove('active');
        $(`#tab-content-${tab}`)?.classList.add('hidden');
    });

    // Setear la altura real del header como variable CSS para el tab de historial
    const headerEl = document.getElementById('main-header');
    if (headerEl) {
        document.documentElement.style.setProperty('--header-height', `${headerEl.offsetHeight}px`);
    }

    // Manejo de scroll dinámico en body para evitar "brinco" de layout sin dejar hueco visible
    if (['historial', 'qrs'].includes(activeTab)) {
        // Solo calculamos el ancho si el scrollbar está activo actualmente
        if (document.body.style.overflow !== 'hidden') {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.paddingRight = `${scrollbarWidth}px`;
            document.body.style.overflow = 'hidden';
        }
    } else {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    }

    // Mostrar el tab activo
    $(`#tab-${activeTab}`)?.classList.add('active');
    $(`#tab-content-${activeTab}`)?.classList.remove('hidden');

    // Guardar la preferencia para cuando se recargue la página
    localStorage.setItem('activeTab', activeTab);

    // Inicialización diferida (lazy) por tab
    if (activeTab === 'informe') {
        const iframe = $('#power-bi-iframe');
        const isMobile = ('ontouchstart' in window) || window.innerWidth <= 1280;
        if (iframe && !iframe.src) {
            iframe.src = isMobile
                ? "https://app.powerbi.com/view?r=eyJrIjoiZjIxMGNjMGUtZTU4Ny00ZWQxLWIwMGQtZmQzYmQ3ZDU2MGYzIiwidCI6IjY0NWE3NDU1LTkzMGItNDk3Ni1iOTFiLTYzOTAxOGEwZGY5OCJ9"
                : "https://app.powerbi.com/view?r=eyJrIjoiODY0OTQxNTItYzZjMS00ZDRkLWExYzgtMmE4ZjIzNzhlN2Y5IiwidCI6IjY0NWE3NDU1LTkzMGItNDk3Ni1iOTFiLTYzOTAxOGEwZGY5OCJ9";
        }
    }

    if (activeTab === 'historial') {
        const { initHistorial } = await import('./js/pages/historial.js');
        initHistorial();
    }

    if (activeTab === 'qrs') {
        const { initQrManager } = await import('./js/pages/qr-manager.js');
        initQrManager();
    }
}
