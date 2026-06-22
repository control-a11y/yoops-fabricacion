/* ============================================
   YOOPS - Transferencias (Bidireccional + Auditoría)
   ============================================ */

const SUPABASE_URL = 'https://wqnonkjdkplzzovedanr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxbm9ua2pka3BsenpvdmVkYW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwOTczMDcsImV4cCI6MjA5NjY3MzMwN30.h4mzHITI0cka8G8SlZEL1MfQjSLF7ZnWl0b3-2BCywQ';

const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

const LOCALES_TIENDA = ['Plaza Numa', 'Grand Plaza', 'Rio de Piedras'];

let currentUser = null;
let isLab = false;       // true = Laboratorio (producción)
let allArticulos = [];
let selectedRecord = null;
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

// Toast
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastTitle = document.getElementById('toastTitle');
const toastMessage = document.getElementById('toastMessage');

// =============================================
//  Utilities
// =============================================

function showToast(type, title, message) {
    toastIcon.textContent = type === 'success' ? '✅' : '❌';
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toast.classList.remove('toast-error');
    if (type === 'error') toast.classList.add('toast-error');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function formatNumber(num) {
    if (num === null || num === undefined) return '—';
    return Number(num).toLocaleString('es-MX');
}

function getTodayISO() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function getTodayDisplay() {
    return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

function loadSession() {
    const s = localStorage.getItem('yoops_session');
    if (s) { try { return JSON.parse(s); } catch (e) { return null; } }
    return null;
}

async function verifySession() {
    const session = loadSession();
    if (!session || !session.id) return null;
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${session.id}&activo=eq.true&select=*`,
            { headers: HEADERS }
        );
        if (!res.ok) return null;
        const users = await res.json();
        return users.length > 0 ? users[0] : null;
    } catch (e) {
        return null;
    }
}

// =============================================
//  Load Articulos
// =============================================

async function loadArticulos() {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/articulos?select="ARTICULO"&order="ARTICULO".asc`,
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
            <span class="transfer-producto">📦 ${r.producto}</span>
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
                <span>📍 ${r.local_destino}</span>
                <span>👤 ${r.creado_por}</span>
                <span>🕐 ${formatDateTime(r.created_at)}</span>
            </div>
            ${needsMine ? `<button class="btn-add-weight" data-id="${r.id}">+ Agregar peso</button>` : ''}
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

    let local_destino;
    if (isLab) {
        local_destino = destinoSelect.value;
        if (!local_destino) {
            showToast('error', 'Destino requerido', 'Selecciona el local de destino');
            return;
        }
    } else {
        local_destino = currentUser.nombre_local;
    }

    submitBtn.classList.add('loading');

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
    const user = await verifySession();
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
