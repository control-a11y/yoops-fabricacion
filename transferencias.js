/* ============================================
   YOOPS - Transferencias (Bidireccional + Auditoría)
   (config.js + utils.js loaded before this file)
   ============================================ */

const LOCALES_TIENDA = ['Plaza Numa', 'Grand Plaza', 'Rio de Piedras'];

let currentUser = null;
let isLab = false;       // true = Laboratorio (producción)
let allArticulos = [];
let selectedRecord = null;
let editingTransferId = null;
let allRecords = [];
let highlightedIdx = -1;

// =============================================
//  DOM
// =============================================

const notLoggedScreen = document.getElementById('notLoggedScreen');
const mainScreen = document.getElementById('mainScreen');
const roleSubtitle = document.getElementById('roleSubtitle');
const roleBadge = document.getElementById('roleBadge');
const displayUserName = document.getElementById('displayUserName');
const displayUserLocal = document.getElementById('displayUserLocal');

// Alert
const alertBanner = document.getElementById('alertBanner');
const alertText = document.getElementById('alertText');

// Form
const nuevoForm = document.getElementById('nuevoForm');
const productoInput = document.getElementById('productoInput');
const productoValue = document.getElementById('productoValue');
const productoDropdown = document.getElementById('productoDropdown');
const productoList = document.getElementById('productoList');
const destinoGroup = document.getElementById('destinoGroup');
const destinoSelect = document.getElementById('destinoSelect');
const pesoInput = document.getElementById('pesoInput');
const pesoLabel = document.getElementById('pesoLabel');
const submitBtn = document.getElementById('submitBtn');

const autoUser = document.getElementById('autoUser');
const autoLocal = document.getElementById('autoLocal');
const autoDate = document.getElementById('autoDate');

// Records
const recordsList = document.getElementById('recordsList');
const emptyState = document.getElementById('emptyState');
const recordCount = document.getElementById('recordCount');
const refreshBtn = document.getElementById('refreshBtn');

// Modal
const addWeightModal = document.getElementById('addWeightModal');
const closeModal = document.getElementById('closeModal');
const cancelModal = document.getElementById('cancelModal');
const confirmModal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalProducto = document.getElementById('modalProducto');
const modalDestino = document.getElementById('modalDestino');
const modalCreadoPor = document.getElementById('modalCreadoPor');
const modalPesoInput = document.getElementById('modalPesoInput');
const modalPesoLabel = document.getElementById('modalPesoLabel');

// Toast is now handled by utils.js showToast()

// =============================================
//  Utilities (shared ones in utils.js)
// =============================================

function formatDateTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function switchScreen(id) {
    [notLoggedScreen, mainScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// =============================================
//  Auth
// =============================================

// loadSession and verifySession now come from utils.js

// =============================================
//  Load Articulos
// =============================================

async function loadArticulos() {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/articulos?select=ARTICULO&order=ARTICULO.asc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('fail');
        const data = await res.json();
        allArticulos = data.map(a => a.ARTICULO).filter(Boolean);
    } catch (err) {
        allArticulos = [];
    }
}

// =============================================
//  Searchable Combobox
// =============================================

function renderArticulosList(filter = '') {
    productoList.innerHTML = '';
    const query = filter.toLowerCase().trim();
    const filtered = query
        ? allArticulos.filter(a => a.toLowerCase().includes(query))
        : allArticulos;

    if (filtered.length === 0) {
        productoList.innerHTML = '<div class="searchable-no-results">Sin resultados</div>';
        return;
    }

    filtered.forEach((name, idx) => {
        const item = document.createElement('div');
        item.className = 'searchable-item';
        if (name === productoValue.value) item.classList.add('selected');
        item.dataset.value = name;
        item.dataset.idx = idx;

        if (query) {
            const lowerName = name.toLowerCase();
            const matchStart = lowerName.indexOf(query);
            if (matchStart >= 0) {
                const before = name.substring(0, matchStart);
                const match = name.substring(matchStart, matchStart + query.length);
                const after = name.substring(matchStart + query.length);
                item.innerHTML = `${before}<mark>${match}</mark>${after}`;
            } else {
                item.textContent = name;
            }
        } else {
            item.textContent = name;
        }

        item.addEventListener('click', () => selectArticulo(name));
        productoList.appendChild(item);
    });
    highlightedIdx = -1;
}

function selectArticulo(name) {
    productoInput.value = name;
    productoValue.value = name;
    productoDropdown.classList.add('hidden');
    highlightedIdx = -1;
}

productoInput.addEventListener('focus', () => {
    renderArticulosList(productoInput.value);
    productoDropdown.classList.remove('hidden');
});

productoInput.addEventListener('input', () => {
    productoValue.value = '';
    renderArticulosList(productoInput.value);
    productoDropdown.classList.remove('hidden');
});

productoInput.addEventListener('keydown', (e) => {
    const items = productoList.querySelectorAll('.searchable-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        highlightedIdx = Math.min(highlightedIdx + 1, items.length - 1);
        updateHighlight(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlightedIdx = Math.max(highlightedIdx - 1, 0);
        updateHighlight(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIdx >= 0 && items[highlightedIdx]) {
            selectArticulo(items[highlightedIdx].dataset.value);
        }
    } else if (e.key === 'Escape') {
        productoDropdown.classList.add('hidden');
    }
});

function updateHighlight(items) {
    items.forEach((el, i) => {
        el.classList.toggle('highlighted', i === highlightedIdx);
        if (i === highlightedIdx) el.scrollIntoView({ block: 'nearest' });
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('#productoCombobox')) {
        productoDropdown.classList.add('hidden');
    }
});

// =============================================
//  Setup UI by Role
// =============================================

function setupRoleUI() {
    if (isLab) {
        roleSubtitle.textContent = 'Producción → Envío a locales';
        roleBadge.textContent = '📤 ENVÍO';
        roleBadge.className = 'role-badge role-badge-lab';
        pesoLabel.textContent = 'Peso de transferencia';

        destinoGroup.style.display = 'block';
        destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona destino...</option>';
        LOCALES_TIENDA.forEach(local => {
            const opt = document.createElement('option');
            opt.value = local;
            opt.textContent = `📍 ${local}`;
            destinoSelect.appendChild(opt);
        });
    } else {
        roleSubtitle.textContent = `Recepción → ${currentUser.nombre_local}`;
        roleBadge.textContent = '📥 RECEPCIÓN';
        roleBadge.className = 'role-badge role-badge-store';
        pesoLabel.textContent = 'Peso recibido';
        destinoGroup.style.display = 'none';
    }
}

// =============================================
//  Load Records
// =============================================

async function loadRecords() {
    try {
        const today = getTodayISO();
        let url;

        if (isLab) {
            // Lab sees ALL transfers of today
            url = `${SUPABASE_URL}/rest/v1/transferencias_v2?created_at=gte.${today}T00:00:00&created_at=lt.${today}T23:59:59&select=*&order=created_at.desc`;
        } else {
            // Store sees only transfers TO their local
            url = `${SUPABASE_URL}/rest/v1/transferencias_v2?local_destino=eq.${encodeURIComponent(currentUser.nombre_local)}&created_at=gte.${today}T00:00:00&created_at=lt.${today}T23:59:59&select=*&order=created_at.desc`;
        }

        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) throw new Error('fail');
        const records = await res.json();

        renderRecords(records);
        updateAlert(records);
        recordCount.textContent = records.length;
    } catch (err) {
        console.error('Error loading records:', err);
    }
}

// =============================================
//  Alert Banner
// =============================================

function updateAlert(records) {
    let pendingCount;
    if (isLab) {
        // Lab: records where transferencia is null (store registered first)
        pendingCount = records.filter(r => r.transferencia == null).length;
    } else {
        // Store: records where recepcion is null (lab sent, store hasn't confirmed)
        pendingCount = records.filter(r => r.recepcion == null).length;
    }

    if (pendingCount > 0) {
        alertText.textContent = `⚡ ${pendingCount} pendiente${pendingCount > 1 ? 's' : ''} de tu registro`;
        alertBanner.classList.remove('hidden');
    } else {
        alertBanner.classList.add('hidden');
    }
}

// =============================================
//  Render Records
// =============================================

function renderRecords(records) {
    allRecords = records;
    recordsList.innerHTML = '';

    if (records.length === 0) {
        recordsList.style.display = 'none';
        emptyState.classList.add('visible');
        return;
    }

    recordsList.style.display = 'flex';
    emptyState.classList.remove('visible');

    // Sort: needs-my-weight first
    const sorted = [...records].sort((a, b) => {
        const aNeedsMine = isLab ? (a.transferencia == null) : (a.recepcion == null);
        const bNeedsMine = isLab ? (b.transferencia == null) : (b.recepcion == null);
        if (aNeedsMine && !bNeedsMine) return -1;
        if (!aNeedsMine && bNeedsMine) return 1;
        return 0;
    });

    sorted.forEach((r, idx) => recordsList.appendChild(createRecordCard(r, idx)));

    // Attach edit-transfer listeners
    document.querySelectorAll('.btn-edit-transfer').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const record = allRecords.find(r => String(r.id) === id);
            if (record) enterEditTransfer(record);
        });
    });
}

function canEditTransfer(record) {
    if (!record.created_at) return false;
    const createdDate = record.created_at.slice(0, 10);
    const today = getTodayISO();
    return createdDate === today && record.creado_por === currentUser.usuario;
}

function createRecordCard(r, idx) {
    const card = document.createElement('div');
    card.className = 'transfer-card';
    card.style.animationDelay = `${idx * 0.05}s`;

    const needsMine = isLab ? (r.transferencia == null) : (r.recepcion == null);
    if (needsMine) card.classList.add('needs-attention');

    const estadoClass = r.estado === 'completado' ? 'estado-completado' : 'estado-pendiente';
    const estadoLabel = r.estado === 'completado' ? '✅ Completado' : '⏳ Pendiente';

    // === VISIBILITY RULES ===
    // Each side ONLY sees their own weight.
    // The other side's weight shows "✓ Registrado" (exists) or "Pendiente" (null).
    // This prevents parties from coordinating values.

    let col1Label, col1Value, col1Class;
    let col2Label, col2Value, col2Class;

    if (isLab) {
        // LAB column 1: Transferencia (MY weight — visible)
        col1Label = 'Transferencia (Envío)';
        if (r.transferencia != null) {
            col1Value = `${formatNumber(r.transferencia)} g`;
            col1Class = 'weight-highlight';
        } else {
            col1Value = 'Sin registrar';
            col1Class = 'weight-empty';
        }

        // LAB column 2: Recepción (THEIR weight — hidden value)
        col2Label = 'Recepción (Tienda)';
        if (r.recepcion != null) {
            col2Value = '✓ Registrado';
            col2Class = 'weight-confirmed';
        } else {
            col2Value = 'Pendiente';
            col2Class = 'weight-empty';
        }
    } else {
        // STORE column 1: Transferencia (THEIR weight — hidden value)
        col1Label = 'Transferencia (Lab)';
        if (r.transferencia != null) {
            col1Value = '✓ Registrado';
            col1Class = 'weight-confirmed';
        } else {
            col1Value = 'Pendiente';
            col1Class = 'weight-empty';
        }

        // STORE column 2: Recepción (MY weight — visible)
        col2Label = 'Recepción (Mi peso)';
        if (r.recepcion != null) {
            col2Value = `${formatNumber(r.recepcion)} g`;
            col2Class = 'weight-highlight';
        } else {
            col2Value = 'Sin registrar';
            col2Class = 'weight-empty';
        }
    }

    card.innerHTML = `
        <div class="transfer-card-header">
            <span class="transfer-producto">📦 ${escapeHtml(r.producto)}</span>
            <span class="transfer-estado ${estadoClass}">${estadoLabel}</span>
        </div>
        <div class="transfer-weights">
            <div class="weight-box">
                <div class="weight-label">${col1Label}</div>
                <div class="weight-value ${col1Class}">${col1Value}</div>
            </div>
            <div class="weight-box">
                <div class="weight-label">${col2Label}</div>
                <div class="weight-value ${col2Class}">${col2Value}</div>
            </div>
        </div>
        <div class="transfer-footer">
            <div class="transfer-meta">
                <span>📍 ${escapeHtml(r.local_destino)}</span>
                <span>👤 ${escapeHtml(r.creado_por)}</span>
                <span>🕐 ${formatDateTime(r.created_at)}</span>
            </div>
            <div class="transfer-actions">
                ${canEditTransfer(r) ? `<button class="btn-edit-transfer" data-id="${r.id}" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}
                ${needsMine ? `<button class="btn-add-weight" data-id="${r.id}">+ Agregar peso</button>` : ''}
            </div>
        </div>
    `;

    if (needsMine) {
        card.querySelector('.btn-add-weight').addEventListener('click', () => openModal(r));
    }

    return card;
}

// =============================================
//  Modal: Add Missing Weight
// =============================================

function openModal(record) {
    selectedRecord = record;
    modalProducto.textContent = record.producto;
    modalDestino.textContent = record.local_destino;
    modalCreadoPor.textContent = record.creado_por;

    if (isLab) {
        modalTitle.textContent = 'Registrar Peso de Transferencia';
        modalPesoLabel.textContent = 'Peso que se envió';
    } else {
        modalTitle.textContent = 'Registrar Peso de Recepción';
        modalPesoLabel.textContent = 'Peso que recibiste';
    }

    modalPesoInput.value = '';
    addWeightModal.classList.remove('hidden');
    modalPesoInput.focus();
}

function closeModalFn() {
    selectedRecord = null;
    addWeightModal.classList.add('hidden');
    modalPesoInput.value = '';
}

closeModal.addEventListener('click', closeModalFn);
cancelModal.addEventListener('click', closeModalFn);
addWeightModal.addEventListener('click', (e) => {
    if (e.target === addWeightModal) closeModalFn();
});

confirmModal.addEventListener('click', async () => {
    if (!selectedRecord) return;
    const peso = parseFloat(modalPesoInput.value);

    if (!peso || peso <= 0) {
        showToast('error', 'Peso inválido', 'Ingresa un peso válido');
        return;
    }

    confirmModal.classList.add('loading');

    try {
        const updateData = {};

        if (isLab) {
            updateData.transferencia = peso;
        } else {
            updateData.recepcion = peso;
        }

        // If the other side already registered → completado
        const otherWeight = isLab ? selectedRecord.recepcion : selectedRecord.transferencia;
        if (otherWeight != null) {
            updateData.estado = 'completado';
        }

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/transferencias_v2?id=eq.${selectedRecord.id}`,
            { method: 'PATCH', headers: HEADERS, body: JSON.stringify(updateData) }
        );
        if (!res.ok) throw new Error('fail');

        showToast('success', '¡Peso registrado!', `${selectedRecord.producto} actualizado`);
        closeModalFn();
        await loadRecords();
    } catch (err) {
        showToast('error', 'Error', 'No se pudo guardar');
    } finally {
        confirmModal.classList.remove('loading');
    }
});

// =============================================
//  Edit Transfer (same-day)
// =============================================

function enterEditTransfer(record) {
    editingTransferId = record.id;
    productoInput.value = record.producto;
    productoValue.value = record.producto;
    if (isLab && destinoSelect) {
        destinoSelect.value = record.local_destino;
    }
    pesoInput.value = isLab ? (record.transferencia || '') : (record.recepcion || '');
    document.getElementById('submitBtnText').textContent = 'Guardar Cambios';
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    nuevoForm.closest('.card').classList.add('editing');
    nuevoForm.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditTransfer() {
    editingTransferId = null;
    nuevoForm.reset();
    productoInput.value = '';
    productoValue.value = '';
    document.getElementById('submitBtnText').textContent = isLab ? 'Registrar Transferencia' : 'Registrar Recepción';
    document.getElementById('cancelEditBtn').classList.add('hidden');
    nuevoForm.closest('.card').classList.remove('editing');
}

document.getElementById('cancelEditBtn').addEventListener('click', exitEditTransfer);

// =============================================
//  New Record Form
// =============================================

nuevoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const producto = productoValue.value;
    if (!producto) {
        showToast('error', 'Artículo requerido', 'Selecciona un artículo de la lista');
        return;
    }

    const peso = parseFloat(pesoInput.value);
    if (!peso || peso <= 0) {
        showToast('error', 'Peso inválido', 'Ingresa un peso válido');
        return;
    }

    let destino;
    if (isLab) {
        destino = destinoSelect.value;
        if (!destino) {
            showToast('error', 'Destino requerido', 'Selecciona el local de destino');
            return;
        }
    } else {
        destino = currentUser.nombre_local;
    }
    const local_destino = destino;

    submitBtn.classList.add('loading');

    if (editingTransferId) {
        // ---- EDIT MODE ----
        try {
            const updateData = { producto };
            if (isLab) {
                updateData.transferencia = peso;
                updateData.local_destino = destino;
            } else {
                updateData.recepcion = peso;
            }
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/transferencias_v2?id=eq.${editingTransferId}`,
                { method: 'PATCH', headers: HEADERS, body: JSON.stringify(updateData) }
            );
            if (!res.ok) throw new Error('Error al actualizar');
            showToast('success', '¡Actualizado!', `${producto} actualizado`);
            exitEditTransfer();
            await loadRecords();
        } catch (err) {
            showToast('error', 'Error', 'No se pudo actualizar el registro');
        } finally {
            submitBtn.classList.remove('loading');
        }
    } else {
        // ---- CREATE MODE ----
        // Check for duplicate product+destination today
        try {
            const today = getTodayISO();
            const dupUrl = `${SUPABASE_URL}/rest/v1/transferencias_v2?producto=eq.${encodeURIComponent(producto)}&local_destino=eq.${encodeURIComponent(local_destino)}&created_at=gte.${today}T00:00:00&created_at=lt.${today}T23:59:59&select=id`;
            const dupRes = await fetch(dupUrl, { headers: HEADERS });
            const existing = await dupRes.json();
            if (existing.length > 0) {
                showToast('error', 'Duplicado', `"${producto}" → ${local_destino} ya fue registrado hoy`);
                submitBtn.classList.remove('loading');
                return;
            }
        } catch (e) {}

        try {
            const record = {
                producto,
                local_destino,
                creado_por: currentUser.usuario,
                creado_por_rol: isLab ? 'produccion' : 'tienda',
                estado: 'pendiente'
            };

            if (isLab) {
                record.transferencia = peso;
                // recepcion = null → store must confirm
            } else {
                record.recepcion = peso;
                // transferencia = null → lab must register what they sent
            }

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/transferencias_v2`,
                { method: 'POST', headers: HEADERS, body: JSON.stringify(record) }
            );
            if (!res.ok) throw new Error('fail');

            showToast('success', '¡Registrado!', `${producto} → ${local_destino}`);
            nuevoForm.reset();
            productoValue.value = '';
            await loadRecords();
        } catch (err) {
            showToast('error', 'Error', 'No se pudo crear el registro');
        } finally {
            submitBtn.classList.remove('loading');
        }
    }
});

// Refresh
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
    if (!session || !session.id) { switchScreen('notLoggedScreen'); return; }
    const user = await verifySession(session);
    if (!user) {
        switchScreen('notLoggedScreen');
        return;
    }

    currentUser = user;
    isLab = user.nombre_local === 'Laboratorio';

    displayUserName.textContent = user.usuario;
    displayUserLocal.textContent = user.nombre_local;
    autoUser.textContent = user.usuario;
    autoLocal.textContent = user.nombre_local;
    autoDate.textContent = getTodayDisplay();

    setupRoleUI();
    await loadArticulos();
    switchScreen('mainScreen');
    await loadRecords();
}

init();
