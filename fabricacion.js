/* ============================================
   YOOPS - Fabricación de Yogurt
   Application Logic for fabricacion.html
   Requires: config.js, utils.js, searchable-combo.js
   ============================================ */

let currentUser = null;
let editingId = null;
let saborCombo = null;

// --- Local code mapping ---
const LOCAL_CODE_MAP = {
    'Plaza Numa':      'PN',
    'Grand Plaza':     'GP',
    'Rio de Piedras':  'RP',
    'Laboratorio':     'LAB'
};

// =============================================
//  DOM Elements
// =============================================

const notLoggedScreen = document.getElementById('notLoggedScreen');
const fabricacionScreen = document.getElementById('fabricacionScreen');
const displayUserName = document.getElementById('displayUserName');
const displayUserLocal = document.getElementById('displayUserLocal');

const fabricacionForm = document.getElementById('fabricacionForm');
const saborInput = document.getElementById('saborInput');
const saborValue = document.getElementById('saborValue');
const pesoInput = document.getElementById('pesoInput');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const recordsBody = document.getElementById('recordsBody');
const emptyState = document.getElementById('emptyState');
const recordsTable = document.getElementById('recordsTable');
const refreshBtn = document.getElementById('refreshBtn');
const todayCount = document.getElementById('todayCount');

// =============================================
//  Utility Functions
// =============================================

function switchScreen(screenId) {
    [notLoggedScreen, fabricacionScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// =============================================
//  ID Generation: FAB-{LOCAL}-{SABOR}-{DDMMYY}-{SEQ}
// =============================================

function getLocalCode(localName) {
    return LOCAL_CODE_MAP[localName] || localName.substring(0, 2).toUpperCase();
}

function getSaborCode(sabor) {
    const info = SABOR_MAP[sabor];
    return info ? info.code : sabor.substring(0, 3).toUpperCase();
}

async function generateFabId(localName, sabor) {
    const localCode = getLocalCode(localName);
    const saborCode = getSaborCode(sabor);
    const dateStr = getDateDDMMYY();
    const prefix = `FAB-${localCode}-${saborCode}-${dateStr}`;

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/fabricacion_yogurt?id_fab=like.${encodeURIComponent(prefix + '%')}&select=id_fab&order=id_fab.desc&limit=1`,
            { headers: HEADERS }
        );

        if (res.ok) {
            const records = await res.json();
            if (records.length > 0 && records[0].id_fab) {
                const lastId = records[0].id_fab;
                const parts = lastId.split('-');
                const lastSeq = parseInt(parts[parts.length - 1], 10) || 0;
                return `${prefix}-${String(lastSeq + 1).padStart(2, '0')}`;
            }
        }
    } catch (e) {
        console.error('Error querying for next ID:', e);
    }

    return `${prefix}-01`;
}

// =============================================
//  API Call
// =============================================

async function loadRecords() {
    try {
        const today = getTodayISO();
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/fabricacion_yogurt?fecha=eq.${today}&select=*&order=created_at.desc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('Error al cargar registros');
        const records = await res.json();
        renderRecords(records);
        todayCount.textContent = records.length;
    } catch (err) {
        console.error('Error loading records:', err);
        showToast('error', 'Error', 'No se pudieron cargar los registros');
    }
}

async function createRecord(data) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/fabricacion_yogurt`,
        { method: 'POST', headers: HEADERS, body: JSON.stringify(data) }
    );
    if (!res.ok) {
        const errorBody = await res.text();
        console.error('Supabase error:', errorBody);
        throw new Error('Error al crear registro');
    }
    return res.json();
}

async function updateRecord(id, data) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/fabricacion_yogurt?id=eq.${id}`,
        { method: 'PATCH', headers: HEADERS, body: JSON.stringify(data) }
    );
    if (!res.ok) {
        const errorBody = await res.text();
        console.error('Update error:', errorBody);
        throw new Error('Error al actualizar registro');
    }
    return res.json();
}

// =============================================
//  Form Modes
// =============================================

function enterEditMode(record) {
    editingId = record.id;
    const saborInfo = SABOR_MAP[record.sabor];
    const display = saborInfo ? `${saborInfo.emoji} ${saborInfo.label}` : record.sabor;
    saborInput.value = display;
    saborValue.value = display;
    pesoInput.value = record.cantidad;
    submitBtnText.textContent = 'Guardar Cambios';
    cancelEditBtn.classList.remove('hidden');
    document.querySelector('.form-card').classList.add('editing');
    document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
    editingId = null;
    fabricacionForm.reset();
    if (saborCombo) saborCombo.reset();
    submitBtnText.textContent = 'Registrar Fabricación';
    cancelEditBtn.classList.add('hidden');
    document.querySelector('.form-card').classList.remove('editing');
}

cancelEditBtn.addEventListener('click', exitEditMode);

// =============================================
//  Render
// =============================================

function renderRecords(records) {
    recordsBody.innerHTML = '';

    if (records.length === 0) {
        recordsTable.style.display = 'none';
        emptyState.classList.add('visible');
        return;
    }

    recordsTable.style.display = 'table';
    emptyState.classList.remove('visible');

    records.forEach((record, index) => {
        const tr = document.createElement('tr');
        tr.style.animationDelay = `${index * 0.05}s`;
        const saborInfo = SABOR_MAP[record.sabor] || { emoji: '🍦', label: record.sabor };

        const isToday = record.fecha === getTodayISO();
        tr.innerHTML = `
            <td>
                <span class="sabor-badge sabor-${escapeHtml(record.sabor)}">
                    ${escapeHtml(saborInfo.emoji)} ${escapeHtml(saborInfo.label)}
                </span>
            </td>
            <td><span class="peso-value">${formatNumber(record.cantidad)}</span></td>
            <td>${escapeHtml(record.creado_por) || '\u2014'}</td>
            <td><span class="hora-value">${formatTime(record.hora)}</span></td>
            <td>${isToday ? `<button class="btn-edit-record" data-idx="${index}" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}</td>
        `;
        tr._recordData = record;
        recordsBody.appendChild(tr);
    });

    // Attach edit listeners
    recordsBody.querySelectorAll('.btn-edit-record').forEach(btn => {
        const idx = parseInt(btn.dataset.idx);
        const tr = btn.closest('tr');
        btn.addEventListener('click', () => enterEditMode(tr._recordData));
    });
}

// =============================================
//  Form Submission & Handlers
// =============================================

fabricacionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saborDisplay = saborValue.value;
    const sabor = SABOR_REVERSE[saborDisplay] || saborDisplay;
    const cantidad = parseFloat(pesoInput.value);

    if (!sabor || !cantidad) {
        showToast('error', 'Campos incompletos', 'Selecciona un sabor e ingresa el peso');
        return;
    }

    if (cantidad <= 0) {
        showToast('error', 'Peso inválido', 'El peso debe ser mayor a 0');
        return;
    }

    submitBtn.classList.add('loading');

    try {
        if (editingId) {
            await updateRecord(editingId, { sabor, cantidad });
            const saborInfo = SABOR_MAP[sabor] || { emoji: '🍦', label: sabor };
            showToast('success', '¡Actualizado!', `${saborInfo.emoji} ${formatNumber(cantidad)}g`);
            exitEditMode();
        } else {
            const id_fab = await generateFabId(currentUser.nombre_local, sabor);
            const data = {
                id_fab,
                sabor,
                cantidad,
                local: currentUser.nombre_local,
                creado_por: currentUser.usuario,
                fecha: getTodayISO(),
                hora: getLocalTime()
            };
            await createRecord(data);
            const saborInfo = SABOR_MAP[sabor] || { emoji: '🍦', label: sabor };
            showToast('success', '¡Registrado!', `${id_fab} — ${saborInfo.emoji} ${formatNumber(cantidad)}g`);
            if (saborCombo) saborCombo.reset();
            pesoInput.value = '';
            pesoInput.focus();
        }

        await loadRecords();
    } catch (err) {
        console.error('Error creating record:', err);
        showToast('error', 'Error', 'No se pudo crear el registro. Intenta de nuevo.');
    } finally {
        submitBtn.classList.remove('loading');
    }
});

refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('spinning');
    await loadRecords();
    setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
});

// =============================================
//  Init
// =============================================

async function init() {
    const session = loadSession();
    if (!session) {
        switchScreen('notLoggedScreen');
        return;
    }

    const user = await verifySession(session);
    if (!user) {
        switchScreen('notLoggedScreen');
        return;
    }

    // Laboratorio check: laboratory users are not allowed to access fabrication
    if (user.nombre_local === 'Laboratorio') {
        alert('Acceso denegado: El local Laboratorio no realiza fabricación directa.');
        window.location.href = 'index.html';
        return;
    }

    currentUser = user;
    displayUserName.textContent = user.usuario;
    displayUserLocal.textContent = user.nombre_local;

    switchScreen('fabricacionScreen');

    saborCombo = new SearchableCombo({
        inputEl: saborInput,
        valueEl: saborValue,
        dropdownEl: document.getElementById('saborDropdown'),
        listEl: document.getElementById('saborList'),
        containerId: 'saborCombobox',
        items: SABORES_DISPLAY
    });

    await loadRecords();
}

init();
