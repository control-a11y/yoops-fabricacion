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
        document.getElementById('tipoMovimientoGroup').style.display = 'none';
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
        document.getElementById('tipoMovimientoGroup').style.display = 'block';
        roleSubtitle.textContent = `Recepción/Envío → ${currentUser.nombre_local}`;
        roleBadge.textContent = '📥 RECEPCIÓN / 📤 ENVÍO';
        roleBadge.className = 'role-badge role-badge-store';
        
        // Listen to radio changes
        const radios = document.getElementsByName('tipoMovimiento');
        radios.forEach(r => {
            r.addEventListener('change', updateMovimientoUI);
        });
        
        updateMovimientoUI();
    }
}

function updateMovimientoUI() {
    if (isLab) return;
    
    const radios = document.getElementsByName('tipoMovimiento');
    let selected = 'entrada';
    radios.forEach(r => {
        if (r.checked) selected = r.value;
    });
    
    const submitBtnText = document.getElementById('submitBtnText') || { textContent: '' };
    
    if (selected === 'entrada') {
        // Receipt mode
        pesoLabel.textContent = 'Peso recibido';
        destinoGroup.style.display = 'none';
        submitBtnText.textContent = 'Registrar Recepción';
    } else {
        // Sent mode
        pesoLabel.textContent = 'Peso de envío';
        destinoGroup.style.display = 'block';
        submitBtnText.textContent = 'Registrar Transferencia';
        
        // Populate destinoSelect with OTHER stores (excluding currentUser's store)
        destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona destino...</option>';
        LOCALES_TIENDA.forEach(local => {
            if (local !== currentUser.nombre_local) {
                const opt = document.createElement('option');
                opt.value = local;
                opt.textContent = `📍 ${local}`;
                destinoSelect.appendChild(opt);
            }
        });
    }
}

// =============================================
//  Load Records
// =============================================

async function loadRecords() {
    try {
        // Calculate UTC start and end timestamps representing today in local time
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const startISO = startOfDay.toISOString();
        const endISO = endOfDay.toISOString();
        let url;

        if (isLab) {
            // Lab sees ALL transfers of today
            url = `${SUPABASE_URL}/rest/v1/transferencias_v2?created_at=gte.${startISO}&created_at=lt.${endISO}&select=*&order=created_at.desc`;
        } else {
            // Store sees transfers TO their local OR transfers created by users of their local
            let userNames = [currentUser.usuario];
            try {
                const usersRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/usuarios?nombre_local=eq.${encodeURIComponent(currentUser.nombre_local)}&select=usuario`,
                    { headers: HEADERS }
                );
                if (usersRes.ok) {
                    const localUsers = await usersRes.json();
                    const fetchedNames = localUsers.map(u => u.usuario).filter(Boolean);
                    if (fetchedNames.length > 0) {
                        userNames = fetchedNames;
                    }
                }
            } catch (err) {
                console.error('Error fetching local usernames:', err);
            }
            const usersFilter = userNames.map(u => `"${u}"`).join(',');
            url = `${SUPABASE_URL}/rest/v1/transferencias_v2?or=(local_destino.eq.${encodeURIComponent(currentUser.nombre_local)},creado_por.in.(${usersFilter}))&created_at=gte.${startISO}&created_at=lt.${endISO}&select=*&order=created_at.desc`;
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
    let pendingCount = 0;
    records.forEach(r => {
        const isReceiver = (currentUser.nombre_local === r.local_destino);
        if (isLab) {
            if (r.transferencia == null) pendingCount++;
        } else {
            if (isReceiver) {
                if (r.recepcion == null) pendingCount++;
            } else {
                if (r.transferencia == null) pendingCount++;
            }
        }
    });

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
        let aNeedsMine, bNeedsMine;
        if (isLab) {
            aNeedsMine = (a.transferencia == null);
            bNeedsMine = (b.transferencia == null);
        } else {
            const aIsReceiver = (currentUser.nombre_local === a.local_destino);
            const bIsReceiver = (currentUser.nombre_local === b.local_destino);
            aNeedsMine = aIsReceiver ? (a.recepcion == null) : (a.transferencia == null);
            bNeedsMine = bIsReceiver ? (b.recepcion == null) : (b.transferencia == null);
        }
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
    const d = new Date(record.created_at);
    const createdLocalDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const today = getTodayISO();
    return createdLocalDate === today && record.creado_por === currentUser.usuario;
}

function createRecordCard(r, idx) {
    const card = document.createElement('div');
    card.className = 'transfer-card';
    card.style.animationDelay = `${idx * 0.05}s`;

    let needsMine = false;
    const isReceiver = (currentUser.nombre_local === r.local_destino);
    
    if (isLab) {
        needsMine = (r.transferencia == null);
    } else {
        needsMine = isReceiver ? (r.recepcion == null) : (r.transferencia == null);
    }
    
    if (needsMine) card.classList.add('needs-attention');

    const estadoClass = r.estado === 'completado' ? 'estado-completado' : 'estado-pendiente';
    const estadoLabel = r.estado === 'completado' ? '✅ Completado' : '⏳ Pendiente';

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
        if (isReceiver) {
            // STORE as Receiver: Column 1 is Sender weight (hidden), Column 2 is Recepcion (visible)
            col1Label = 'Transferencia (Origen)';
            if (r.transferencia != null) {
                col1Value = '✓ Registrado';
                col1Class = 'weight-confirmed';
            } else {
                col1Value = 'Pendiente';
                col1Class = 'weight-empty';
            }

            col2Label = 'Recepción (Mi peso)';
            if (r.recepcion != null) {
                col2Value = `${formatNumber(r.recepcion)} g`;
                col2Class = 'weight-highlight';
            } else {
                col2Value = 'Sin registrar';
                col2Class = 'weight-empty';
            }
        } else {
            // STORE as Sender: Column 1 is Transferencia (visible), Column 2 is Recepcion (hidden)
            col1Label = 'Transferencia (Mi peso)';
            if (r.transferencia != null) {
                col1Value = `${formatNumber(r.transferencia)} g`;
                col1Class = 'weight-highlight';
            } else {
                col1Value = 'Sin registrar';
                col1Class = 'weight-empty';
            }

            col2Label = 'Recepción (Destino)';
            if (r.recepcion != null) {
                col2Value = '✓ Registrado';
                col2Class = 'weight-confirmed';
            } else {
                col2Value = 'Pendiente';
                col2Class = 'weight-empty';
            }
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

    const isReceiver = (currentUser.nombre_local === record.local_destino);

    if (isLab) {
        modalTitle.textContent = 'Registrar Peso de Transferencia';
        modalPesoLabel.textContent = 'Peso que se envió';
    } else {
        if (isReceiver) {
            modalTitle.textContent = 'Registrar Peso de Recepción';
            modalPesoLabel.textContent = 'Peso que recibiste';
        } else {
            modalTitle.textContent = 'Registrar Peso de Transferencia';
            modalPesoLabel.textContent = 'Peso que se envió';
        }
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
        const isReceiver = (currentUser.nombre_local === selectedRecord.local_destino);

        if (isLab) {
            updateData.transferencia = peso;
        } else {
            if (isReceiver) {
                updateData.recepcion = peso;
            } else {
                updateData.transferencia = peso;
            }
        }

        // If the other side already registered → completado
        const otherWeight = isLab ? selectedRecord.recepcion : (isReceiver ? selectedRecord.transferencia : selectedRecord.recepcion);
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
    
    const isReceiver = (currentUser.nombre_local === record.local_destino);
    
    if (isLab) {
        if (destinoSelect) destinoSelect.value = record.local_destino;
        pesoInput.value = record.transferencia || '';
    } else {
        const tipoMovGroup = document.getElementById('tipoMovimientoGroup');
        if (tipoMovGroup) tipoMovGroup.style.display = 'none'; // Hide type during edit
        
        if (isReceiver) {
            destinoGroup.style.display = 'none';
            pesoInput.value = record.recepcion || '';
        } else {
            destinoGroup.style.display = 'block';
            
            // Populate destinoSelect with OTHER stores (excluding currentUser's store)
            destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona destino...</option>';
            LOCALES_TIENDA.forEach(local => {
                if (local !== currentUser.nombre_local) {
                    const opt = document.createElement('option');
                    opt.value = local;
                    opt.textContent = `📍 ${local}`;
                    destinoSelect.appendChild(opt);
                }
            });
            
            if (destinoSelect) destinoSelect.value = record.local_destino;
            pesoInput.value = record.transferencia || '';
        }
    }
    
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
    
    if (isLab) {
        document.getElementById('submitBtnText').textContent = 'Registrar Transferencia';
    } else {
        const tipoMovGroup = document.getElementById('tipoMovimientoGroup');
        if (tipoMovGroup) tipoMovGroup.style.display = 'block'; // Show type group again
        updateMovimientoUI();
    }
    
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
    let isReceiver = true;
    if (isLab) {
        destino = destinoSelect.value;
        if (!destino) {
            showToast('error', 'Destino requerido', 'Selecciona el local de destino');
            return;
        }
        isReceiver = false;
    } else {
        const radios = document.getElementsByName('tipoMovimiento');
        let selected = 'entrada';
        radios.forEach(r => {
            if (r.checked) selected = r.value;
        });
        
        if (selected === 'entrada') {
            destino = currentUser.nombre_local;
            isReceiver = true;
        } else {
            destino = destinoSelect.value;
            if (!destino) {
                showToast('error', 'Destino requerido', 'Selecciona el local de destino');
                return;
            }
            isReceiver = false;
        }
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
                if (isReceiver) {
                    updateData.recepcion = peso;
                    updateData.local_destino = currentUser.nombre_local;
                } else {
                    updateData.transferencia = peso;
                    updateData.local_destino = destino;
                }
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
            } else {
                if (isReceiver) {
                    record.recepcion = peso;
                } else {
                    record.transferencia = peso;
                }
            }

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/transferencias_v2`,
                { method: 'POST', headers: HEADERS, body: JSON.stringify(record) }
            );
            if (!res.ok) throw new Error('fail');

            showToast('success', '¡Registrado!', `${producto} → ${local_destino}`);
            exitEditTransfer(); // Reset form, type movement UI etc.
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
