// --- Estado Global ---
const state = {
    selectedTroquel: "",
    selectedTecnico: "",
    currentMaintenanceId: null, // ID del mantenimiento iniciado
    isSaving: false,
    tasks: {
        preventivo: [],
        correctivo: [],
        antesProduccion: []
    },
    timer: { seconds: 0, isRunning: false } // Estado del temporizador
};

// --- Selectores del DOM ---
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// --- Función auxiliar para mapear status a clases CSS ---
function getStatusCssClass(status) {
    const statusMap = {
        'Completado': 'realizado',
        'No Completado': 'no-realizado',
        'No Aplica': 'no-aplica'
    };
    return statusMap[status] || status;
}

const troquelesSelect = $('#troquelesSelect');
const techSelect = $('#tech-select');
const accordionContainer = $('#accordion-container');
const saveButton = $('#save-button');
const saveButtonText = $('#save-button-text');
const saveButtonLoading = $('#save-button-loading');
const saveButtonContainer = $('#save-button-container');
const startSection = $('#start-section');
const startMessage = $('#start-message');
const startButton = $('#start-button');

const taskRowTemplate = $('#task-row-template');

let choicesTroqueles;
let choicesTecnicos;

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', initApp);
async function initApp() {
    setHeaderInfo();
    setupEventListeners();

    // Cargar datos base
    try {
        await Promise.all([
            fetchTroqueles(),
            fetchTecnicos(),
            fetchTasks()
        ]);
    } catch (error) {
        showToast("Error fatal", "No se pudieron cargar los datos iniciales. Refresca la página.", "destructive");
        return;
    }

    // Inicializar Choices.js
    choicesTroqueles = new Choices(troquelesSelect, {
        searchEnabled: true,
        itemSelectText: 'Presiona para seleccionar',
        shouldSort: false, // Usar el orden que viene del servidor
    });

    choicesTecnicos = new Choices(techSelect, {
        searchEnabled: true,
        itemSelectText: 'Presiona para seleccionar',
        shouldSort: false,
    });

    // --- Auto-selección desde QR (parámetro ?troquel=ID en la URL) ---
    const urlParams = new URLSearchParams(window.location.search);
    const troquelFromQR = urlParams.get('troquel');

    // Revisar y restaurar estado guardado
    const savedState = localStorage.getItem('inProgressMaintenance');

    if (savedState) {
        const restoredData = JSON.parse(savedState);
        Object.assign(state, restoredData);

        troquelesSelect.value = state.selectedTroquel || "";
        techSelect.value = state.selectedTecnico || "";

        if (state.selectedTroquel) {
            choicesTroqueles.setChoiceByValue(String(state.selectedTroquel));
        }
        if (state.selectedTecnico) {
            choicesTecnicos.setChoiceByValue(String(state.selectedTecnico));
        }

        choicesTroqueles.disable();
        choicesTecnicos.disable();

        accordionContainer.classList.remove('hidden');
        saveButtonContainer.classList.remove('hidden');
        startSection.classList.add('hidden');

        renderAccordions();
        restoreUIState();
        restoreTimer();

        // Asegurar que el estado del botón sea correcto al restaurar
        updateSaveButtonStatus();
    } else if (troquelFromQR) {
        // Auto-selección desde QR: pre-seleccionar el troquel
        choicesTroqueles.setChoiceByValue(String(troquelFromQR));
        state.selectedTroquel = troquelFromQR;
        checkHeaderFields();
    }
}

function setHeaderInfo() {
    const headerDate = $('#header-date');

    function updateDateTime() {
        const now = new Date();
        const formattedDate = now.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const formattedTime = `${hours}:${minutes}:${seconds} ${ampm}`;

        headerDate.innerHTML = `<span class='text-sm font-medium text_primary_color'>${formattedDate}</span>
                                 <span class='ml-4 text-lg font-semibold text_primary_color'>${formattedTime}</span>`;
    }

    updateDateTime();
    setInterval(updateDateTime, 1000);
}

// --- Funciones del Modal de Confirmación ---

// Variables para el contador regresivo
let countdownInterval = null;
let remainingTime = 5;

// --- Nueva función para manejar el clic del botón Finalizar ---
function handleSaveButtonClick() {
    // Realizar validaciones ANTES de mostrar cualquier modal
    const validationResult = validateFormBeforeFinalize();

    if (validationResult.isValid) {
        // Si la validación pasa, mostrar el modal de confirmación
        showConfirmationModal();
    } else {
        // Si hay errores, mostrar el toast/modal de error correspondiente
        handleValidationError(validationResult);
    }
}

// --- Función para validar el formulario antes de finalizar ---
function validateFormBeforeFinalize() {
    // 1. Verificar que al menos una sección esté completa
    const sections = ['preventivo', 'correctivo', 'antesProduccion'];
    let hasCompleteSection = false;

    for (const sectionKey of sections) {
        const tasks = state.tasks[sectionKey] || [];
        const allTasksCompleted = tasks.length > 0 && tasks.every(task =>
            task.status !== null &&
            task.comment?.trim() !== ''
        );

        if (allTasksCompleted) {
            hasCompleteSection = true;
            break;
        }
    }

    if (!hasCompleteSection) {
        return {
            isValid: false,
            type: 'no_complete_section',
            message: 'Debes completar al menos una sección completa del checklist.',
            title: 'Formulario Incompleto'
        };
    }

    // 2. Verificar tareas con estado pero sin comentario
    const allTasks = Object.values(state.tasks).flat();
    const tasksSinComentario = allTasks.filter(task =>
        task.status !== null && (!task.comment || task.comment.trim() === "")
    );

    if (tasksSinComentario.length > 0) {
        const firstProblemTask = tasksSinComentario[0];
        return {
            isValid: false,
            type: 'missing_comment',
            task: firstProblemTask,
            message: `La actividad "${firstProblemTask.label}" está marcada como "${firstProblemTask.status}" pero no tiene comentario.`,
            title: 'Comentario Requerido'
        };
    }

    return { isValid: true };
}

// --- Función para manejar errores de validación ---
function handleValidationError(validationResult) {
    const { type, task, message, title } = validationResult;

    if (type === 'missing_comment' && task) {
        // Caso específico: tarea sin comentario
        const problemRow = document.querySelector(`.task-row[data-task-id="${task.id}"]`);

        // Mostrar toast con información específica
        showToast(title, message, 'destructive');

        if (problemRow) {
            // Abrir la sección si está cerrada
            const accordionContent = problemRow.closest('.accordion-content');
            if (accordionContent && !accordionContent.classList.contains('open')) {
                const trigger = document.querySelector(`[data-target="#${accordionContent.id}"]`);
                trigger?.click();
            }

            // Hacer scroll a la tarea problemática
            setTimeout(() => {
                problemRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Mostrar y enfocar el textarea correspondiente
                const problemTextarea = problemRow.querySelector(`.task-comment-${task.status}`);
                const commentContainer = problemRow.querySelector('.task-comment-container');

                if (problemTextarea && commentContainer) {
                    commentContainer.classList.add('visible');
                    problemTextarea.classList.add('visible');
                    problemTextarea.style.display = 'block';

                    setTimeout(() => {
                        problemTextarea.focus();
                        problemTextarea.classList.add('task-comment-required');

                        // Quitar el estilo de requerido cuando el usuario empiece a escribir
                        const removeRequiredStyle = () => {
                            problemTextarea.classList.remove('task-comment-required');
                            problemTextarea.removeEventListener('input', removeRequiredStyle);
                        };
                        problemTextarea.addEventListener('input', removeRequiredStyle);
                    }, 100);
                }
            }, 100);
        }

    } else if (type === 'no_complete_section') {
        // Caso: no hay ninguna sección completa
        showToast(title, message, 'destructive');

        // Mostrar información más detallada sobre qué falta
        setTimeout(() => {
            showSectionCompletionGuide();
        }, 2000);

    } else {
        // Caso genérico
        showToast(title || 'Error de Validación', message, 'destructive');
    }
}

// --- Función para mostrar guía de completitud de secciones ---
function showSectionCompletionGuide() {
    const sections = [
        { title: 'Mantenimiento Preventivo', key: 'preventivo' },
        { title: 'Mantenimiento Correctivo', key: 'correctivo' },
        { title: 'Previo de Producción', key: 'antesProduccion' }
    ];

    let guideMessage = 'Para finalizar el mantenimiento, debes completar al menos una sección entera:\n\n';

    sections.forEach(section => {
        const tasks = state.tasks[section.key] || [];
        const completedTasks = tasks.filter(task =>
            task.status !== null && task.comment?.trim() !== ''
        );
        const totalTasks = tasks.length;

        const status = completedTasks.length === totalTasks && totalTasks > 0 ?
            'Completa' :
            `Incompleta (${completedTasks.length}/${totalTasks})`;

        guideMessage += `• ${section.title}: ${status}\n`;
    });

    guideMessage += '\nCada actividad necesita:\n1. Seleccionar "Realizado" o "No Realizado"\n2. Agregar un comentario explicativo';

    // Mostrar segundo toast con guía
    setTimeout(() => {
        showToast('Guía de Completitud', guideMessage, 'info');
    }, 500);
}

// --- Función para manejar la confirmación del modal ---
async function handleModalConfirmation() {
    try {
        setTimeout(() => {
            showLoadingScreen();
        }, 300);

        const [success] = await Promise.all([
            executeFinalization(),
            new Promise(resolve => setTimeout(resolve, 2000))
        ]);

        if (success) {
            setTimeout(() => {
                showSuccessScreen();

                // Iniciar contador regresivo
                startSuccessCountdown();
            }, 500);
        } else {
            // Si hay un error, agregar delay antes de ocultar el modal
            setTimeout(() => {
                hideConfirmationModal();
            }, 800);
        }
    } catch (error) {
        setTimeout(() => {
            hideConfirmationModal();
        }, 800);
    }
}

// --- Función para iniciar el contador regresivo ---
function startSuccessCountdown() {
    remainingTime = 5;
    const countdownElement = $('#countdown');
    const closeButton = $('#close-success-modal');

    if (countdownElement) {
        countdownElement.textContent = remainingTime;
    }

    // Configurar el botón de cerrar manualmente
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            clearCountdown();
            hideConfirmationModal();
        });
    }

    // Iniciar el contador
    countdownInterval = setInterval(() => {
        remainingTime--;

        if (countdownElement) {
            countdownElement.textContent = remainingTime;
        }

        if (remainingTime <= 0) {
            clearCountdown();
            hideConfirmationModal();
        }
    }, 1000);
}

// --- Función para limpiar el contador ---
function clearCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}

// --- Configuración de Eventos ---
function setupEventListeners() {
    // Guarda cambios en el estado
    troquelesSelect.addEventListener('change', (e) => {
        state.selectedTroquel = e.target.value;
        checkHeaderFields();
    });

    techSelect.addEventListener('change', (e) => {
        state.selectedTecnico = e.target.value;
        checkHeaderFields();
    });

    // Botón Iniciar
    startButton.addEventListener('click', handleStartMaintenance);

    // Guarda el formulario - ahora con validación previa
    saveButton.addEventListener('click', handleSaveButtonClick);

    // eventos para el acordeón
    accordionContainer.addEventListener('click', (e) => {
        const trigger = e.target.closest('.accordion-trigger');
        const button = e.target.closest('.task-button');

        if (trigger) {
            handleAccordionClick(trigger);
        } else if (button) {
            handleStatusClick(button);
        }
    });

    // Eventos para comentarios
    accordionContainer.addEventListener('input', (e) => {
        const textarea = e.target.closest('.task-comment');
        if (textarea) {
            handleCommentChange(textarea);
        }
    });

    // Toast (Notificación)
    $('#toast-close').addEventListener('click', () => {
        hideToast();
    });

    // --- Actualización del manejador de eventos para el botón Cancelar ---
    const cancelButton = $('#cancel-button');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            cancelConfirmationModal.classList.remove('hidden');
        });


        // --- AÑADE LOS LISTENERS PARA EL NUEVO MODAL DE CANCELACIÓN ---
        modalCancelAbortButton.addEventListener('click', () => {
            cancelConfirmationModal.classList.add('hidden');
        });

        modalCancelConfirmButton.addEventListener('click', async () => {
            await executeCancellation();
            cancelConfirmationModal.classList.add('hidden');
        });

        cancelConfirmationModal.addEventListener('click', (e) => {
            if (e.target === cancelConfirmationModal) {
                cancelConfirmationModal.classList.add('hidden');
            }
        });

        // Guarda el estado si el usuario refresca o cierra la pestaña
        window.addEventListener('beforeunload', () => {
            try {
                if (state.currentMaintenanceId) {
                    localStorage.setItem('inProgressMaintenance', JSON.stringify(state));
                }
            } catch (_) {
                // silencioso
            }
        });

        // --- Eventos para el modal de confirmación ---
        const modalCancelButton = $('#modal-cancel-button');
        const modalConfirmButton = $('#modal-confirm-button');

        modalCancelButton.addEventListener('click', () => {
            hideConfirmationModal();
        });

        modalConfirmButton.addEventListener('click', handleModalConfirmation);

        confirmationModal.addEventListener('click', (e) => {
            if (e.target === confirmationModal) {
                hideConfirmationModal();
            }
        });

        // --- Eventos para las pestañas ---
        setupTabEvents();
    }
}


// FUNCIONES DE CARGA DE DATOS (FETCH)


async function fetchTroqueles() {
    try {
        const response = await fetch('/api/troqueles');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const troqueles = await response.json();
        renderSelect(troquelesSelect, troqueles, 'Seleccionar troquel...', 'idTroquel', 'Codigo');
    } catch (error) {
        showToast("Error al cargar troqueles", "No se pudo conectar al servidor.", "destructive");
    }
}

async function fetchTecnicos() {
    try {
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const tecnicos = await response.json();
        renderSelect(techSelect, tecnicos, 'Seleccionar técnico...', 'idUsuario', 'Nombre');
    } catch (error) {
        showToast('Error al cargar técnicos', "No se pudo conectar al servidor.", 'destructive');
    }
}

async function fetchTasks() {
    try {
        const response = await fetch('/api/actividades');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const tasksData = await response.json();
        state.tasks = tasksData;
        renderAccordions();
    } catch (error) {
        showToast('Error al cargar actividades', "No se pudo cargar el checklist.", 'destructive');
    }
}

// FUNCIONES DE RENDERIZADO


// Función genérica para llenar los <select>
function renderSelect(selectElement, data, placeholder, valueKey, textKey) {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    data.forEach(item => {
        selectElement.innerHTML += `<option value="${item[valueKey]}">${item[textKey]}</option>`;
    });
}

function renderAccordions() {
    // Limpia el contenedor
    accordionContainer.innerHTML = '';

    const sections = [
        { title: 'Mantenimiento Preventivo', key: 'preventivo' },
        { title: 'Mantenimiento Correctivo', key: 'correctivo' },
        { title: 'Previo de Producción', key: 'antesProduccion' }
    ];

    // Renderizar acordeones
    accordionContainer.innerHTML = sections.map(section =>
        createTaskSectionHtml(section.title, section.key)
    ).join('');

    // Llenar cada sección con sus actividades
    sections.forEach(section => {
        const tasks = state.tasks[section.key] || [];
        const taskListElement = $(`[data-task-list-for="${section.key}"]`);

        if (!taskListElement) return;

        if (tasks.length > 0) {
            const fragment = document.createDocumentFragment();
            tasks.forEach(task => {
                fragment.appendChild(createTaskRowHtml(task, section.key));
            });
            taskListElement.appendChild(fragment);
        } else {
            taskListElement.innerHTML = '<p class="text-sm text-gray-500 p-4">No hay actividades para esta sección.</p>';
        }

        checkSectionCompletion(section.key);
    });
}

function createTaskSectionHtml(title, sectionKey) {
    return `
        <div class="rounded-lg border border-gray-300 bg-white shadow-sm">
            <button class="accordion-trigger flex w-full items-center justify-between px-4 py-3 text-lg font-bold focus:outline-none" data-target="#accordion-content-${sectionKey}">
                ${title}
                <svg class="accordion-chevron h-6 w-6 text-gray-500 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div id="accordion-content-${sectionKey}" class="accordion-content px-4">
                <div class="task-list space-y-0 px-4" data-task-list-for="${sectionKey}"></div>
                <div class="h-4"></div>
            </div>
        </div>
    `;
}

function createTaskRowHtml(task, sectionKey) {
    const taskRowTemplate = document.querySelector('#task-row-template');

    if (!taskRowTemplate) {
        return document.createTextNode('Error: Template no encontrado.');
    }

    const clone = taskRowTemplate.content.cloneNode(true);
    const rowElement = clone.querySelector('.task-row');
    const labelSpan = clone.querySelector('.text-base');
    const buttons = clone.querySelectorAll('.task-button');
    const viewCommentBtn = clone.querySelector('.view-comment-btn');
    const commentContainer = clone.querySelector('.task-comment-container');
    const textareaRealizado = clone.querySelector('.task-comment-realizado');
    const textareaNoRealizado = clone.querySelector('.task-comment-no-realizado');

    if (!rowElement || !labelSpan) {
        return document.createTextNode('Error: Elementos faltantes.');
    }

    rowElement.dataset.taskId = task.id;
    labelSpan.textContent = task.label;

    // Configurar botones de estado
    buttons.forEach(btn => {
        btn.dataset.section = sectionKey;
        btn.dataset.taskId = task.id;
    });

    // Configurar botón de ver comentario
    viewCommentBtn.dataset.section = sectionKey;
    viewCommentBtn.dataset.taskId = task.id;

    // Configurar textareas
    [textareaRealizado, textareaNoRealizado].forEach(textarea => {
        textarea.dataset.section = sectionKey;
        textarea.dataset.taskId = task.id;
        textarea.style.display = 'none';
    });

    // Configurar evento para el botón de ver comentario
    viewCommentBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const container = e.target.closest('.task-row').querySelector('.task-comment-container');
        const textarea = e.target.closest('.task-row').querySelector(`.task-comment-${task.status}`);

        if (container) {
            container.classList.toggle('visible');
            if (container.classList.contains('visible') && textarea) {
                textarea.classList.add('visible');
                setTimeout(() => {
                    textarea.focus();
                }, 100);
            } else if (textarea) {
                textarea.classList.remove('visible');
            }
        }
    });

    // Configurar eventos para los botones de estado
    buttons.forEach(button => {
        button.addEventListener('click', (e) => {
            const status = button.dataset.status;
            const otherStatus = status === 'Completado' ? 'No Completado' : 'Completado';
            const textarea = clone.querySelector(`.task-comment-${status}`);
            const otherTextarea = clone.querySelector(`.task-comment-${otherStatus}`);

            if (textarea) {
                textarea.style.display = 'block';
                textarea.classList.add('visible');
                commentContainer.classList.add('visible');

                // Enfocar el textarea después de la animación
                setTimeout(() => {
                    textarea.focus();
                }, 100);
            }

            if (otherTextarea) {
                otherTextarea.style.display = 'none';
                otherTextarea.classList.remove('visible');
            }

            // Mostrar el botón de ver comentario
            viewCommentBtn.classList.remove('hidden');
        });
    });

    return rowElement;
}

// MANEJADORES DE EVENTOS (INTERACTIVIDAD)

function handleAccordionClick(trigger) {
    const content = $(trigger.dataset.target);
    const arrow = trigger.querySelector('.accordion-chevron');

    // Usamos la clase 'open'
    if (content.classList.contains('open')) {
        content.classList.remove('open');
        arrow.classList.remove('rotate-180');
    } else {
        content.classList.add('open');
        arrow.classList.add('rotate-180');
    }
}

function handleStatusClick(button) {
    const { section, taskId, status: newStatus } = button.dataset;
    const taskRow = button.closest('.task-row');
    const task = state.tasks[section].find(t => t.id == taskId);
    if (!task) return;

    const isDeselecting = task.status === newStatus;
    const previousStatus = task.status;
    task.status = isDeselecting ? null : newStatus;

    // Cerrar otros comentarios abiertos
    document.querySelectorAll('.task-comment-container.visible').forEach(container => {
        if (container !== taskRow.querySelector('.task-comment-container')) {
            container.classList.remove('visible');
            container.querySelectorAll('textarea').forEach(ta => ta.classList.remove('visible'));
        }
    });

    // Actualiza el DOM de los botones
    const allButtons = taskRow.querySelectorAll('.task-button');
    allButtons.forEach(btn => {
        btn.classList
        btn.classList.add('border-gray-300', 'bg-white', 'text-gray-700');
    });

    // Elementos del DOM
    const viewCommentBtn = taskRow.querySelector('.view-comment-btn');
    const commentContainer = taskRow.querySelector('.task-comment-container');
    const textarea = taskRow.querySelector(`.task-comment-${getStatusCssClass(newStatus)}`);
    const otherStatus = (newStatus === 'Completado') ? 'No Completado' : 'Completado';
    const otherTextarea = taskRow.querySelector(`.task-comment-${getStatusCssClass(otherStatus)}`);

    if (isDeselecting) {
        // Si se deselecciona, ocultar el contenedor y limpiar
        if (commentContainer) {
            commentContainer.classList.remove('visible');
        }
        if (textarea) {
            textarea.classList.remove('visible');
            textarea.value = "";
        }
        if (viewCommentBtn) {
            viewCommentBtn.classList.add('hidden');
        }
        task.comment = "";
    } else {
        // Si se selecciona, actualizar estilos
        button.classList.add('bg-orange-600', 'text-white', 'border-orange-600');

        // Mostrar el botón de ver comentario
        if (viewCommentBtn) {
            viewCommentBtn.classList.remove('hidden');
        }

        // Asegurarse de que el contenedor sea visible
        if (commentContainer) {
            commentContainer.style.display = 'block';
            commentContainer.classList.add('visible');
        }

        // Ocultar el otro textarea si existe
        if (otherTextarea) {
            otherTextarea.classList.remove('visible');
            otherTextarea.style.display = 'none';
        }

        // Mostrar el textarea correspondiente
        if (textarea) {
            textarea.style.display = 'block';
            textarea.classList.add('visible');

            // Restaurar comentario si existe
            if (task.comment && previousStatus === newStatus) {
                textarea.value = task.comment;
            } else {
                textarea.value = "";
                task.comment = "";
            }

            // Enfocar el textarea
            setTimeout(() => {
                textarea.focus();
                // Hacer scroll suave al textarea si no está visible
                const rect = textarea.getBoundingClientRect();
                const isVisible = (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );

                if (!isVisible) {
                    textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 50);
        }
    }

    validateTaskCommentVisuals(task, taskRow);

    // Verifica si la sección está completa después del cambio
    checkSectionCompletion(section);

    // Persistir estado en LocalStorage
    localStorage.setItem('inProgressMaintenance', JSON.stringify(state));
}

// Verifica si todas las tareas de una sección tienen estado asignado
function checkSectionCompletion(sectionKey) {
    const tasks = state.tasks[sectionKey];

    if (!tasks || tasks.length === 0) {
        return;
    }

    // Una sección está completa solo si TODAS sus tareas tienen estado Y comentario
    const allTasksCompleted = tasks.length > 0 && tasks.every(task =>
        task.status !== null &&
        task.comment?.trim() !== ''
    );

    const accordionButton = document.querySelector(`[data-target="#accordion-content-${sectionKey}"]`);

    if (!accordionButton) {
        return;
    }

    if (allTasksCompleted) {
        accordionButton.classList.add('section-complete');
    } else {
        accordionButton.classList.remove('section-complete', 'section-complete-badge', 'section-complete-bg');
    }

    updateSaveButtonStatus();
}

function updateSaveButtonStatus() {
    const saveButton = $('#save-button');
    if (!saveButton) return;

    // Verificar si hay al menos una sección completamente terminada
    const anySectionComplete = document.querySelector('.accordion-trigger.section-complete');
    saveButton.disabled = !anySectionComplete;

    // Actualizar visualmente el botón
    if (anySectionComplete) {
        saveButton.classList.remove('opacity-50', 'cursor-not-allowed');
        saveButton.classList.add('hover:bg-orange-700');
    } else {
        saveButton.classList.add('opacity-50', 'cursor-not-allowed');
        saveButton.classList.remove('hover:bg-orange-700');
    }
}

function handleCommentChange(textarea) {
    const { section, taskId } = textarea.dataset;
    const task = state.tasks[section].find(t => t.id == taskId);
    if (task) {
        task.comment = textarea.value;
        const taskRow = textarea.closest('.task-row');
        validateTaskCommentVisuals(task, taskRow);
        checkSectionCompletion(section);
        // Persistir estado en LocalStorage
        localStorage.setItem('inProgressMaintenance', JSON.stringify(state));
    }
}

function applyInlineMessage(html) {
    startMessage.classList.remove('fade-in');
    startMessage.innerHTML = html;
    startMessage.offsetWidth; // forzar reflow
    startMessage.classList.add('fade-in');
}

// Verifica si los campos de cabecera están completos
function checkHeaderFields() {
    const hasTroquel = state.selectedTroquel && state.selectedTroquel.trim() !== "";
    const hasTecnico = state.selectedTecnico && state.selectedTecnico.trim() !== "";

    if (hasTroquel && hasTecnico) {
        // Ambos campos completos: mostrar sección y botón
        startSection.classList.remove('hidden');
        startButton.classList.remove('hidden');
        applyInlineMessage(`
            <span class="inline-flex items-start text-gray-700">
                <span aria-hidden="true" class="mr-2 mt-[1px]">✓</span>
                <span>
                    Presiona "Iniciar" para registrar tu hora de comienzo.
                    <span class="block text-sm text-gray-500">Es obligatorio iniciar antes de comenzar el mantenimiento.</span>
                </span>
            </span>
        `);
    } else if (hasTroquel || hasTecnico) {
        // Solo uno completo: mostrar sección pero ocultar botón
        if (hasTroquel) {
            startSection.classList.remove('hidden');
            startButton.classList.add('hidden');
            applyInlineMessage(`
                <span class="inline-flex items-center text-gray-700">
                    <span aria-hidden="true" class="mr-2">⚠</span>
                    <span>Completa <strong> Técnico</strong> para continuar.</span>
                </span>
            `);
        }
        if (hasTecnico) {
            startSection.classList.remove('hidden');
            startButton.classList.add('hidden');
            applyInlineMessage(`
            <span class="inline-flex items-center text-gray-700">
                <span aria-hidden="true" class="mr-2">⚠</span>
                <span>Completa <strong> Troquel </strong> para continuar.</span>
            </span>
        `);
        }
    }
    else {
        // Ninguno completo: ocultar toda la sección
        startSection.classList.add('hidden');
    }
}

// Maneja el clic en el botón Iniciar
async function handleStartMaintenance() {
    // Validar que tengamos los datos necesarios
    if (!state.selectedTroquel || !state.selectedTecnico) {
        return showToast('Error', 'Selecciona troquel y técnico antes de iniciar.', 'destructive');
    }

    // Preparar payload
    const payload = {
        idTroquel: state.selectedTroquel,
        idUsuario: state.selectedTecnico
    };

    // Deshabilitar botón mientras se procesa
    startButton.disabled = true;
    startButton.innerHTML = '<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block"></div> Iniciando...';

    try {
        const response = await fetch('/api/mantenimiento/iniciar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al iniciar el mantenimiento');
        }

        const result = await response.json();

        // Guardar el ID del mantenimiento en el estado
        state.currentMaintenanceId = result.idMantenimiento;

        // Mostrar mensaje de éxito
        showToast('¡Mantenimiento Iniciado!', 'Checklist disponible. Completa las actividades.', 'success');

        // Mostrar el checklist y el botón finalizar
        accordionContainer.classList.remove('hidden');
        saveButtonContainer.classList.remove('hidden');

        // Ocultar la sección de inicio
        startSection.classList.add('hidden');

        // Deshabilitar los selectores para que no se puedan cambiar
        choicesTroqueles.disable();
        choicesTecnicos.disable();

        // Asegurar que el botón inicie deshabilitado
        updateSaveButtonStatus();

        startTimer();

        // Persistir inmediatamente el estado del mantenimiento iniciado
        try {
            localStorage.setItem('inProgressMaintenance', JSON.stringify(state));
        } catch (_) {
            // silencioso
        }
    } catch (error) {
        showToast('Error', error.message, 'destructive');

        // Restaurar botón
        startButton.disabled = false;
        startButton.innerHTML = `
            <svg class="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Iniciar Mantenimiento
        `;
    }
}

// LÓGICA DE GUARDADO (POST)


// --- Definición de showToast - Diseño Modal ---
function showToast(title, description, variant = 'info') {
    const toast = $('#toast');
    const toastTitle = $('#toast-title');
    const toastDescription = $('#toast-description');
    const toastIcon = $('#toast-icon');
    const toastIconContainer = $('#toast-icon-container');

    // Configurar contenido
    toastTitle.textContent = title;
    toastDescription.textContent = description;

    // Limpiar clases previas del contenedor de icono
    toastIconContainer.className = 'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full mr-4';

    // Iconos y estilos según variante
    const iconConfig = {
        success: {
            icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            containerClass: 'toast-icon-success'
        },
        error: {
            icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
            containerClass: 'toast-icon-error'
        },
        destructive: {
            icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
            containerClass: 'toast-icon-destructive'
        },
        info: {
            icon: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
            containerClass: 'toast-icon-info'
        }
    };

    const config = iconConfig[variant] || iconConfig.info;

    // Aplicar icono y estilo
    toastIcon.innerHTML = config.icon;
    toastIconContainer.classList.add(config.containerClass, 'toast-icon-animate');

    // Animar contenido
    const content = toast.querySelector('.flex-1');
    if (content) {
        content.classList.add('toast-content-animate');
    }

    // Mostrar toast
    toast.classList.add('show');

    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        hideToast();
    }, 5000);
}

// --- Función para ocultar el toast de manera controlada ---
function hideToast() {
    const toast = $('#toast');
    const toastIconContainer = $('#toast-icon-container');

    // Ocultar inmediatamente
    toast.classList.remove('show');

    // Limpiar clases de animación después de ocultar
    setTimeout(() => {
        toastIconContainer.classList.remove('toast-icon-animate');
        const content = toast.querySelector('.flex-1');
        if (content) {
            content.classList.remove('toast-content-animate');
        }
    }, 400);
}

// FUNCIONES UTILITARIAS

function setLoading(isLoading) {
    state.isSaving = isLoading;
    saveButton.disabled = isLoading;
    if (isLoading) {
        saveButtonText.style.display = 'none';
        saveButtonLoading.style.display = 'flex';
    } else {
        saveButtonText.style.display = 'block';
        saveButtonLoading.style.display = 'none';
    }
}

async function resetForm() {
    state.selectedTroquel = "";
    state.selectedTecnico = "";
    state.currentMaintenanceId = null;

    // Resetea los <select> ocultos
    troquelesSelect.value = "";
    techSelect.value = "";

    // Habilita y limpia los selectores de Choices.js
    if (choicesTroqueles) {
        choicesTroqueles.enable();
        choicesTroqueles.setChoiceByValue('');
    }
    if (choicesTecnicos) {
        choicesTecnicos.enable();
        choicesTecnicos.setChoiceByValue('');
    }

    // Oculta los contenedores
    accordionContainer.classList.add('hidden');
    saveButtonContainer.classList.add('hidden');
    startSection.classList.add('hidden');

    // Habilita los selectores (esto es un poco redundante pero seguro)
    troquelesSelect.disabled = false;
    techSelect.disabled = false;

    // Limpia las clases de completitud de los acordeones
    document.querySelectorAll('.accordion-trigger').forEach(trigger => {
        trigger.classList.remove('section-complete', 'section-complete-badge', 'section-complete-bg');
    });

    // Elimina el estado guardado en LocalStorage
    localStorage.removeItem('inProgressMaintenance');

    // Resetear botón de iniciar
    const buttonToReset = $('#start-button');
    if (buttonToReset) {
        buttonToReset.disabled = false;
        buttonToReset.innerHTML = `
            <svg class="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Iniciar Mantenimiento
        `;
    }

    try {
        await fetchTasks();
    } catch (e) {        // silencioso
    }

    stopTimer();

    updateSaveButtonStatus();
}

function restoreUIState() {
    Object.keys(state.tasks).forEach(sectionKey => {
        const tasks = state.tasks[sectionKey];
        tasks.forEach(task => {
            const taskRow = document.querySelector(`.task-row[data-task-id="${task.id}"]`);
            if (taskRow) {
                // Elementos del DOM
                const button = taskRow.querySelector(`.task-button[data-status="${task.status}"]`);
                const viewCommentBtn = taskRow.querySelector('.view-comment-btn');
                const commentContainer = taskRow.querySelector('.task-comment-container');
                const textareaRealizado = taskRow.querySelector('.task-comment-realizado');
                const textareaNoRealizado = taskRow.querySelector('.task-comment-no-realizado');

                // Restablecer estilos de botones
                taskRow.querySelectorAll('.task-button').forEach(btn => {
                    btn.classList.remove('bg-orange-600', 'text-white', 'border-orange-600');
                    btn.classList.add('border-gray-300', 'bg-white', 'text-gray-700');
                });

                // Restaurar estado del botón si existe
                if (button) {
                    button.classList.add('bg-orange-600', 'text-white', 'border-orange-600');
                    button.classList.remove('border-gray-300', 'bg-white', 'text-gray-700');
                }

                // Mostrar u ocultar el botón de ver comentario
                if (viewCommentBtn) {
                    if (task.status) {
                        viewCommentBtn.classList.remove('hidden');
                    } else {
                        viewCommentBtn.classList.add('hidden');
                    }
                }

                // Resetear contenedores y textareas
                if (commentContainer) {
                    commentContainer.classList.remove('visible');
                    commentContainer.style.display = '';
                }

                if (textareaRealizado) {
                    textareaRealizado.classList.remove('visible');
                    textareaRealizado.style.display = '';
                    textareaRealizado.value = (task.status === 'Completado') ? (task.comment || "") : "";
                }
                if (textareaNoRealizado) {
                    textareaNoRealizado.classList.remove('visible');
                    textareaNoRealizado.style.display = '';
                    textareaNoRealizado.value = (task.status === 'No Completado') ? (task.comment || "") : "";
                }
            }

            checkSectionCompletion(sectionKey);
        });
        updateSaveButtonStatus();
    });
}

/**
 * Revisa una tarea y aplica/quita el estilo de error obligatorio 
 * al textarea de "No Realizado".
 */
function validateTaskCommentVisuals(task, taskRow) {
    const textareaRealizado = taskRow.querySelector('.task-comment-realizado');
    const textareaNoRealizado = taskRow.querySelector('.task-comment-no-realizado');
    const commentIsEmpty = (!task.comment || task.comment.trim() === '');

    // 1. Validar Textarea de "Realizado"
    if (textareaRealizado) {
        if (task.status === 'Completado' && commentIsEmpty) {
            textareaRealizado.classList.add('task-comment-required');
            textareaRealizado.placeholder = "Comentario obligatorio";
        } else {
            textareaRealizado.classList.remove('task-comment-required');
            textareaRealizado.placeholder = "Agregar detalles para Realizado...";
        }
    }

    // 2. Validar Textarea de "No Realizado"
    if (textareaNoRealizado) {
        if (task.status === 'No Completado' && commentIsEmpty) {
            textareaNoRealizado.classList.add('task-comment-required');
            textareaNoRealizado.placeholder = "Comentario obligatorio";
        } else {
            textareaNoRealizado.classList.remove('task-comment-required');
            textareaNoRealizado.placeholder = "Agregar detalles para No Realizado...";
        }
    }
}

let timerInterval;

function formatTime(seconds) {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(seconds % 60).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
}

function startTimer() {
    const timerElement = $('#header-timer');
    state.timer = { seconds: 0, isRunning: true };

    timerElement.classList.remove('hidden');
    timerInterval = setInterval(() => {
        state.timer.seconds++;
        timerElement.textContent = formatTime(state.timer.seconds);
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    state.timer.isRunning = false;
    const timerElement = $('#header-timer');
    timerElement.classList.add('hidden');
    timerElement.textContent = '00:00:00';
}

function restoreTimer() {
    const timerElement = $('#header-timer');
    if (state.timer?.isRunning) {
        timerElement.classList.remove('hidden');
        timerElement.textContent = formatTime(state.timer.seconds);

        timerInterval = setInterval(() => {
            state.timer.seconds++;
            timerElement.textContent = formatTime(state.timer.seconds);
        }, 1000);
    } else {
        timerElement.classList.add('hidden');
    }
}

// --- Lógica del Modal de Confirmación ---
const confirmationModal = $('#confirmation-modal');
const modalContentSummary = $('#modal-content-summary');
const modalContentLoading = $('#modal-content-loading');
const modalContentSuccess = $('#modal-content-success');
const modalTimerSummary = $('#modal-timer-summary');
const modalSectionsSummary = $('#modal-sections-summary');

const cancelConfirmationModal = $('#cancel-confirmation-modal');
const modalCancelAbortButton = $('#modal-cancel-abort-button');
const modalCancelConfirmButton = $('#modal-cancel-confirm-button');

function showConfirmationModal() {
    // Formatear el tiempo total empleado
    const totalSeconds = state.timer.seconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    modalTimerSummary.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Limpiar el resumen de secciones
    modalSectionsSummary.innerHTML = '';

    // Iterar sobre las secciones y generar el resumen
    const sections = [
        { title: 'Mantenimiento Preventivo', key: 'preventivo' },
        { title: 'Mantenimiento Correctivo', key: 'correctivo' },
        { title: 'Previo de Producción', key: 'antesProduccion' }
    ];

    sections.forEach(section => {
        const triggerButton = document.querySelector(`[data-target="#accordion-content-${section.key}"]`);
        const isComplete = triggerButton?.classList.contains('section-complete');

        const li = document.createElement('li');
        li.className = 'flex items-center gap-2';
        li.innerHTML = `
            <svg class="h-5 w-5 ${isComplete ? 'text-green-500' : 'text-red-500'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isComplete ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M6 18L18 6M6 6l12 12'}"/>
            </svg>
            <span class="text-sm font-medium ${isComplete ? 'text-green-600' : 'text-red-600'}">
                ${section.title}
            </span>
        `;
        modalSectionsSummary.appendChild(li);
    });

    // Mostrar el modal con animación suave
    confirmationModal.classList.remove('hidden');

    // Aplicar animación de entrada
    confirmationModal.style.opacity = '0';
    confirmationModal.style.visibility = 'visible';

    // Forzar reflow y animar
    confirmationModal.offsetHeight;
    confirmationModal.style.transition = 'opacity 0.4s ease-out';
    confirmationModal.style.opacity = '1';
}

// --- Ocultar el Modal de Confirmación ---
function hideConfirmationModal() {
    // Limpiar cualquier contador activo
    clearCountdown();

    // Animar salida del modal
    confirmationModal.style.transition = 'all 0.4s ease-out';
    confirmationModal.style.opacity = '0';
    confirmationModal.style.visibility = 'hidden';

    // Después de la animación, resetear el estado
    setTimeout(() => {
        // Reset modal to initial state
        modalContentSummary.classList.remove('hidden');
        modalContentLoading.classList.add('hidden');
        modalContentSuccess.classList.add('hidden');
        confirmationModal.classList.add('hidden');

        // Resetear estilos inline que pudieron haber sido aplicados
        modalContentSummary.style.opacity = '';
        modalContentSummary.style.transform = '';
        modalContentSummary.style.transition = '';

        modalContentLoading.style.opacity = '';
        modalContentLoading.style.transform = '';
        modalContentLoading.style.transition = '';

        modalContentSuccess.style.opacity = '';
        modalContentSuccess.style.transform = '';
        modalContentSuccess.style.transition = '';

        confirmationModal.style.opacity = '';
        confirmationModal.style.visibility = '';
        confirmationModal.style.transition = '';

        // Resetear el contador
        const countdownElement = $('#countdown');
        if (countdownElement) {
            countdownElement.textContent = '5';
        }
    }, 400);
}

// --- Función para mostrar la pantalla de carga ---
function showLoadingScreen() {
    // Transición suave: ocultar resumen y mostrar carga
    modalContentSummary.style.transition = 'all 0.4s ease-out';
    modalContentSummary.style.opacity = '0';
    modalContentSummary.style.transform = 'translateY(-20px)';

    setTimeout(() => {
        modalContentSummary.classList.add('hidden');
        modalContentLoading.classList.remove('hidden');
        modalContentSuccess.classList.add('hidden');

        // Animar entrada de la pantalla de carga
        modalContentLoading.style.opacity = '0';
        modalContentLoading.style.transform = 'translateY(20px)';

        // Forzar reflow y animar
        modalContentLoading.offsetHeight;
        modalContentLoading.style.transition = 'all 0.4s ease-out';
        modalContentLoading.style.opacity = '1';
        modalContentLoading.style.transform = 'translateY(0)';
    }, 400);
}

// --- Función para mostrar la pantalla de éxito ---
function showSuccessScreen() {
    // Transición suave: ocultar carga y mostrar éxito
    modalContentLoading.style.transition = 'all 0.4s ease-out';
    modalContentLoading.style.opacity = '0';
    modalContentLoading.style.transform = 'translateY(-20px)';

    setTimeout(() => {
        modalContentLoading.classList.add('hidden');
        modalContentSuccess.classList.remove('hidden');

        // Animar entrada de la pantalla de éxito
        modalContentSuccess.style.opacity = '0';
        modalContentSuccess.style.transform = 'translateY(20px) scale(0.95)';

        // Forzar reflow y animar
        modalContentSuccess.offsetHeight;
        modalContentSuccess.style.transition = 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        modalContentSuccess.style.opacity = '1';
        modalContentSuccess.style.transform = 'translateY(0) scale(1)';
    }, 400);
}


// Función simplificada para ejecutar la finalización (sin validaciones previas)
async function executeFinalization() {
    try {
        // Preparar datos para envío (las validaciones ya se hicieron antes)
        const actividadesCompletadas = Object.keys(state.tasks).flatMap(sectionKey => {
            return state.tasks[sectionKey].filter(task => task.status !== null);
        });

        // Enviar al servidor
        const response = await fetch('/api/mantenimiento/finalizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idMantenimiento: state.currentMaintenanceId,
                actividadesCompletadas
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al finalizar el mantenimiento.');
        }

        const result = await response.json();
        await resetForm();
        return true;

    } catch (error) {
        showToast('Error', 'No se pudo finalizar el mantenimiento. Intenta nuevamente.', 'error');
        return false;
    }
}

// --- NUEVA FUNCIÓN (con la lógica que cortaste) ---
async function executeCancellation() {
    if (!state.currentMaintenanceId) {
        showToast('Advertencia', 'No hay un mantenimiento en progreso para cancelar.', 'info');
        return;
    }

    try {
        setLoading(true); // Re-usa setLoading para el botón de finalizar

        // Enviar solicitud DELETE al servidor
        const response = await fetch(`/api/mantenimiento/${state.currentMaintenanceId}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.message || 'Error desconocido al cancelar el mantenimiento.';
            throw new Error(errorMessage);
        }

        // Restablecer el estado y la interfaz de usuario
        state.currentMaintenanceId = null;
        await resetForm();
        localStorage.removeItem('inProgressMaintenance');

        // Restablecer el botón de iniciar mantenimiento
        const startButton = $('#start-button');
        startButton.classList.remove('hidden');

        showToast('Mantenimiento Cancelado', 'El mantenimiento en progreso ha sido cancelado. Puedes iniciar uno nuevo cuando estés listo.', 'success');
    } catch (error) {
        // Forzar limpieza del estado local incluso si el servidor falla
        state.currentMaintenanceId = null;
        localStorage.removeItem('inProgressMaintenance');

        showToast('Error', `No se pudo cancelar el mantenimiento: ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

// --- FUNCIONES PARA EL MANEJO DE PESTAÑAS ---

/**
 * Detecta si el dispositivo es móvil o tablet
 * @returns {boolean} true si es móvil/tablet, false si es desktop
 */
function isMobileOrTablet() {
    // Check 1: User Agent - detecta palabras clave de dispositivos móviles
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/;
    const hasMobileUA = mobileKeywords.test(userAgent);

    // Check 2: Ancho de pantalla - tablets típicamente <= 1280px
    const screenWidth = window.innerWidth;
    const isSmallScreen = screenWidth <= 1280;

    // Check 3: Capacidad táctil
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Retorna true si cumple con criterios de móvil/tablet
    return hasMobileUA || (isSmallScreen && isTouchDevice);
}

// URLs de Power BI según tipo de dispositivo
const POWERBI_URLS = {
    desktop: "https://app.powerbi.com/view?r=eyJrIjoiODY0OTQxNTItYzZjMS00ZDRkLWExYzgtMmE4ZjIzNzhlN2Y5IiwidCI6IjY0NWE3NDU1LTkzMGItNDk3Ni1iOTFiLTYzOTAxOGEwZGY5OCJ9",
    mobile: "https://app.powerbi.com/view?r=eyJrIjoiZjIxMGNjMGUtZTU4Ny00ZWQxLWIwMGQtZmQzYmQ3ZDU2MGYzIiwidCI6IjY0NWE3NDU1LTkzMGItNDk3Ni1iOTFiLTYzOTAxOGEwZGY5OCJ9"
};

function setupTabEvents() {
    const tabFormulario = $('#tab-formulario');
    const tabInforme = $('#tab-informe');

    if (tabFormulario) {
        tabFormulario.addEventListener('click', () => switchTab('formulario'));
    }

    if (tabInforme) {
        tabInforme.addEventListener('click', () => switchTab('informe'));
    }
}

function switchTab(activeTab) {
    // Obtener elementos de las pestañas
    const tabFormulario = $('#tab-formulario');
    const tabInforme = $('#tab-informe');
    const contentFormulario = $('#tab-content-formulario');
    const contentInforme = $('#tab-content-informe');

    // Remover clase activa de todas las pestañas
    [tabFormulario, tabInforme].forEach(tab => {
        if (tab) tab.classList.remove('active');
    });

    // Ocultar todo el contenido
    [contentFormulario, contentInforme].forEach(content => {
        if (content) content.classList.add('hidden');
    });

    // Activar la pestaña seleccionada
    if (activeTab === 'formulario') {
        if (tabFormulario) tabFormulario.classList.add('active');
        if (contentFormulario) contentFormulario.classList.remove('hidden');
    } else if (activeTab === 'informe') {
        if (tabInforme) tabInforme.classList.add('active');
        if (contentInforme) contentInforme.classList.remove('hidden');

        // Opcional: Recargar el iframe de Power BI para asegurar que se cargue correctamente
        refreshPowerBI();
    }
}

function refreshPowerBI() {
    const iframe = $('#power-bi-iframe');
    if (iframe) {
        // Detectar tipo de dispositivo y seleccionar URL apropiada
        const isMobile = isMobileOrTablet();
        const powerBIUrl = isMobile ? POWERBI_URLS.mobile : POWERBI_URLS.desktop;

        console.log('🔍 Dispositivo detectado:', isMobile ? 'Móvil/Tablet' : 'Desktop');
        console.log('📊 Cargando reporte:', isMobile ? 'Mobile' : 'Desktop');
        console.log('🔗 URL:', powerBIUrl);

        // Pequeño delay para permitir que la animación de mostrar termine
        setTimeout(() => {
            iframe.src = powerBIUrl;
        }, 100);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Forzar la visualización del informe Power BI para pruebas
    switchTab('formulario');
});