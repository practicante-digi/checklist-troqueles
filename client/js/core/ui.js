import { state } from "./state.js";

// --- Utilidades del DOM ---
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

// Contenedor principal del UI (Acordeón)
const accordionContainer = $('#accordion-container');

// --- PLANTILLAS Y CONFIGURACIÓN REUSABLE DE CHOICES.JS ---
export function getChoicesTroquelConfig(isFilter = false) {
    return {
        searchEnabled: true,
        searchFields: ['label', 'value', 'customProperties.codigo', 'customProperties.cliente', 'customProperties.numeroParte'],
        searchPlaceholderValue: 'Buscar troquel, cliente o # de parte...',
        itemSelectText: '',
        shouldSort: false,
        allowHTML: true,
        placeholder: true,
        callbackOnCreateTemplates: function (template) {
            return {
                // Template del ítem seleccionado: muestra solo el código
                item: function (classNames, data) {
                    const codigo = data.customProperties?.codigo || data.label;
                    const isPlaceholder = data.placeholder || data.value === '';
                    const placeholderClass = isPlaceholder ? 'choices__placeholder' : '';
                    const customStyles = isPlaceholder ? 'opacity: 1; font-weight: 500; color: #373a36;' : '';
                    return template(`
                        <div class="${classNames.item} ${data.highlighted ? classNames.highlightedState : classNames.itemSelectable} ${placeholderClass}" style="${customStyles}" data-item data-id="${data.id}" data-value="${data.value}" ${data.active ? 'aria-selected="true"' : ''} ${data.disabled ? 'aria-disabled="true"' : ''}>
                            ${codigo}
                        </div>
                    `);
                },
                // Template del dropdown: tarjeta completa con imagen y cliente
                choice: function (classNames, data) {
                    if (data.value === '') return template(`<div style="display: none;" data-choice data-value="${data.value}"></div>`);

                    const cliente = data.customProperties?.cliente || 'Sin cliente asignado';
                    const codigo = data.customProperties?.codigo || data.label;
                    const tieneDemanda = data.customProperties?.tieneDemanda;
                    const imagenUrl = data.customProperties?.imagenUrl || null;
                    const numeroParte = data.customProperties?.numeroParte || '';

                    const badgeDemanda = tieneDemanda === 0 ? `<span style="background-color: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; flex-shrink: 0; white-space: nowrap;">SIN DEMANDA</span>` : '';
                    const renderThumbnail = imagenUrl
                        ? `<img src="${imagenUrl}" alt="Troquel" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><span style="display: none; color: #9ca3af; font-size: 1.25rem;">⚙️</span>`
                        : `<span style="color: #9ca3af; font-size: 1.25rem;">⚙️</span>`;

                    const renderNumeroParte = numeroParte ? `<span style="font-size: 0.75rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${numeroParte}</span>` : '';

                    return template(`
                        <div class="${classNames.item} ${classNames.itemChoice} ${classNames.itemSelectable}" data-select-text="${this.config.itemSelectText}" data-choice data-id="${data.id}" data-value="${data.value}" data-choice-selectable>
                            <div style="display: flex; align-items: center; gap: 12px; width: 100%; padding: ${isFilter ? '4px 8px' : '8px 12px'}; box-sizing: border-box;">
                                <div style="flex-shrink: 0; width: ${isFilter ? '48px' : '64px'}; height: ${isFilter ? '48px' : '64px'}; background-color: #f3f4f6; border-radius: 6px; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; overflow: hidden;">${renderThumbnail}</div>
                                <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                        <span style="font-weight: 700; color: #1f2937; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${codigo}</span>
                                        ${badgeDemanda}
                                    </div>
                                    <span style="font-size: 0.75rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${cliente}</span>
                                    ${renderNumeroParte}
                                </div>
                            </div>
                        </div>
                    `);
                }
            };
        }
    };
}

export function formatTroquelOptions(troquelesData, valueField = 'idTroquel', filterMode = false) {
    const defaultOption = { value: '', label: filterMode ? 'Todos los troqueles' : 'Seleccionar troquel', selected: true, disabled: !filterMode, placeholder: true };
    const options = troquelesData.map(t => ({
        value: String(t[valueField]),
        label: `${t.Codigo}${t.Cliente ? ' ' + t.Cliente : ''}${t.ClaveMaterial ? ' ' + t.ClaveMaterial : ''}`,
        customProperties: {
            codigo: t.Codigo,
            cliente: t.Cliente,
            tieneDemanda: t.TieneDemanda,
            imagenUrl: t.ClaveMaterial ? `/api/troqueles/imagen/${t.ClaveMaterial}` : null,
            numeroParte: t.ClaveMaterial,
        }
    }));
    return [defaultOption, ...options];
}

// --- CONTROL DE VISTAS ---
// Una sola función para manejar qué se ve y qué no
export function toggleMaintenanceLayout(isActive) {
    const elements = {
        selectors: $('#selectors-section'),
        start: $('#start-section'),
        accordion: $('#accordion-container'),
        saveBtn: $('#save-button-container'),
        headerControls: $('#header-active-controls')
    };

    if (isActive) {
        elements.selectors.classList.add('hidden');
        elements.start.classList.add('hidden');
        elements.accordion.classList.remove('hidden');
        elements.saveBtn.classList.remove('hidden');
        elements.headerControls.classList.remove('hidden');
        document.body.classList.add('mantenimiento-activo');
    } else {
        elements.selectors.classList.remove('hidden');
        elements.start.classList.remove('hidden');
        elements.accordion.classList.add('hidden');
        elements.saveBtn.classList.add('hidden');
        elements.headerControls.classList.add('hidden');
        document.body.classList.remove('mantenimiento-activo');
    }
}

export function updateHeaderInfo(troquel, tecnico) {
    $('#header-troquel-display').textContent = troquel || '-';
    $('#header-tecnico-display').textContent = tecnico || '-';
}

// --- NOTIFICACIONES (TOASTS) ---
export function showToast(title, description, variant = 'info', duration = 4000) {
    const toast = $('#toast');
    const toastTitle = $('#toast-title');
    const toastDescription = $('#toast-description');
    const toastIcon = $('#toast-icon');
    const toastIconContainer = $('#toast-icon-container');

    toastTitle.textContent = title;
    toastDescription.textContent = description;
    toastIconContainer.className = 'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full mr-4';

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

    toastIcon.innerHTML = config.icon;
    toastIconContainer.classList.add(config.containerClass, 'toast-icon-animate');

    const content = toast.querySelector('.flex-1');
    if (content) content.classList.add('toast-content-animate');

    toast.classList.add('show');

    setTimeout(() => { hideToast(); }, duration);
}

export function hideToast() {
    const toast = $('#toast');
    const toastIconContainer = $('#toast-icon-container');

    toast.classList.remove('show');
    setTimeout(() => {
        toastIconContainer.classList.remove('toast-icon-animate');
        const content = toast.querySelector('.flex-1');
        if (content) content.classList.remove('toast-content-animate');
    }, 400);
}

export function getStatusCssClass(status) {
    const statusMap = {
        'Completado': 'realizado',
        'No Completado': 'no-realizado',
        'No Aplica': 'no-aplica'
    };
    return statusMap[status] || status;
}

// --- RENDERIZADO HTML (ACORDEONES) ---
export function renderAccordions(onCheckboxChange) {
    accordionContainer.innerHTML = '';

    const sections = [
        { title: 'Mantenimiento Preventivo', key: 'preventivo' },
        { title: 'Mantenimiento Correctivo', key: 'correctivo' },
        { title: 'Previo de Producción', key: 'antesProduccion' }
    ];

    accordionContainer.innerHTML = sections.map(section =>
        createTaskSectionHtml(section.title, section.key)
    ).join('');

    sections.forEach(section => {
        const tasks = state.tasks[section.key] || [];
        const taskListElement = $(`[data-task-list-for="${section.key}"]`);

        if (!taskListElement) return;

        if (tasks.length > 0) {
            const fragment = document.createDocumentFragment();
            tasks.forEach(task => {
                // Le pasamos la función "onCheckboxChange" para que main.js se encargue de la lógica
                fragment.appendChild(createTaskRowHtml(task, section.key, onCheckboxChange));
            });
            taskListElement.appendChild(fragment);
        } else {
            taskListElement.innerHTML = '<p class="text-sm text-gray-500 p-4">No hay actividades para esta sección.</p>';
        }
    });
}

function createTaskSectionHtml(title, sectionKey) {
    return `
        <div class="rounded-sm border border-gray-300 bg-white shadow-sm">
            <button class="accordion-trigger flex w-full items-center justify-between px-4 py-3 text-lg font-bold focus:outline-none" data-target="#accordion-content-${sectionKey}">
                ${title}
                <svg class="accordion-chevron h-6 w-6 text-gray-500 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div id="accordion-content-${sectionKey}" class="accordion-content px-4">
                <div class="task-list space-y-0 px-4" data-task-list-for="${sectionKey}"></div>
                
                <div class="section-comment-container mt-6 px-4 pb-6 border-t border-gray-100 pt-4 transition-all duration-300" id="comment-container-${sectionKey}">
                    <label class="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        Observaciones
                    </label>
                    <textarea 
                        id="comment-textarea-${sectionKey}"
                        class="section-comment-textarea w-full rounded-sm p-3 text-sm shadow-sm outline-none transition-all"
                        placeholder="Escribe aquí notas generales sobre esta sección..."
                        data-section="${sectionKey}"
                    ></textarea>
                </div>
            </div>
        </div>
    `;
}

function createTaskRowHtml(task, sectionKey, onCheckboxChange) {
    const taskRowTemplate = document.querySelector('#task-row-template');
    if (!taskRowTemplate) return document.createTextNode('Error: Template no encontrado.');

    const clone = taskRowTemplate.content.cloneNode(true);
    const rowElement = clone.querySelector('.task-row');
    const labelSpan = clone.querySelector('.task-label');
    const checkbox = clone.querySelector('.task-checkbox');

    rowElement.dataset.taskId = task.id;
    labelSpan.textContent = task.label;

    checkbox.dataset.section = sectionKey;
    checkbox.dataset.taskId = task.id;
    checkbox.checked = task.status === 'Completado';

    // Disparamos el evento hacia arriba (a main.js) cuando cambie
    checkbox.addEventListener('change', () => {
        if(onCheckboxChange) onCheckboxChange(checkbox);
    });

    // Permite hacer clic en toda la fila, no solo en el cuadrito
    rowElement.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox') {
            checkbox.checked = !checkbox.checked;
            if(onCheckboxChange) onCheckboxChange(checkbox);
        }
    });

    return rowElement;
}