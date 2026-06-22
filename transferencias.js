/* ============================================
   YOOPS - Transferencias (Bidireccional)
   Application Logic
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
let isProduccion = false; // true = Laboratorio, false = tienda
let allArticulos = [];
let selectedRecord = null;
let highlightedIdx = -1;

// =============================================
//  DOM
// =============================================

const notLoggedScreen = document.getElementById('notLoggedScreen');
const mainScreen = document.getElementById('mainScreen');
const roleSubtitle = document.getElementById('roleSubtitle');
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

// Auto info
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
const modalOtroPesoLabel = document.getElementById('modalOtroPesoLabel');
const modalOtroPeso = document.getElementById('modalOtroPeso');
const modalPesoInput = document.getElementById('modalPesoInput');
const modalPesoLabel = document.getElementById('modalPesoLabel');
const pesDiff = document.getElementById('pesDiff');

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
    const d = new Date(ts);
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
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
        console.error('Session error:', e);
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
        if (!res.ok) throw new Error('Error loading articulos');
        const data = await res.json();
        allArticulos = data.map(a => a.ARTICULO).filter(Boolean);
    } catch (err) {
        console.error('Error loading articulos:', err);
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
    if (isProduccion) {
        // Producción → envía, campo = transferencia
        roleSubtitle.textContent = 'Producción → Envío a locales';
        pesoLabel.textContent = 'Peso de transferencia';
        destinoGroup.style.display = 'block';

        // Populate destinos (all stores)
        destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona destino...</option>';
        LOCALES_TIENDA.forEach(local => {
            const opt = document.createElement('option');
            opt.value = local;
            opt.textContent = `📍 ${local}`;
            destinoSelect.appendChild(opt);
        });
    } else {
        // Tienda → recibe, campo = recepcion
        roleSubtitle.textContent = `Recepción → ${currentUser.nombre_local}`;
        pesoLabel.textContent = 'Peso de recepción';
        destinoGroup.style.display = 'none';
        destinoSelect.removeAttribute('required');
    }
}

// =============================================
//  API: Load Records (Today)
// =============================================

async function loadRecords() {
    try {
        const today = getTodayISO();
        let url;

        if (isProduccion) {
            // Producción sees ALL today's transfers
            url = `${SUPABASE_URL}/rest/v1/transferencias_v2?created_at=gte.${today}T00:00:00&created_at=lt.${today}T23:59:59&select=*&order=created_at.desc`;
        } else {
            // Store sees only transfers to their local
            url = `${SUPABASE_URL}/rest/v1/transferencias_v2?local_destino=eq.${encodeURIComponent(currentUser.nombre_local)}&created_at=gte.${today}T00:00:00&created_at=lt.${today}T23:59:59&select=*&order=created_at.desc`;
        }

        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) throw new Error('Error loading records');
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

    if (isProduccion) {
        // Records where transferencia is null (store created first, I need to add my weight)
        pendingCount = records.filter(r => r.transferencia == null).length;
    } else {
        // Records where recepcion is null (production created first, I need to add my weight)
        pendingCount = records.filter(r => r.recepcion == null).length;
    }

    if (pendingCount > 0) {
        alertText.textContent = `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''} de tu peso`;
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

    // Sort: items needing my weight first
    const sorted = [...records].sort((a, b) => {
        const aNeedsMine = isProduccion ? (a.transferencia == null) : (a.recepcion == null);
        const bNeedsMine = isProduccion ? (b.transferencia == null) : (b.recepcion == null);
        if (aNeedsMine && !bNeedsMine) return -1;
        if (!aNeedsMine && bNeedsMine) return 1;
        return 0;
    });

    sorted.forEach((r, idx) => {
        const card = createRecordCard(r, idx);
        recordsList.appendChild(card);
    });
}

function createRecordCard(r, idx) {
    const card = document.createElement('div');
    card.className = 'transfer-card';
    card.style.animationDelay = `${idx * 0.05}s`;

    // Determine if this card needs the current user's attention
    const needsMine = isProduccion ? (r.transferencia == null) : (r.recepcion == null);

    if (needsMine) card.classList.add('needs-attention');

    const estadoClass = r.estado === 'pendiente' ? 'estado-pendiente' : 'estado-completado';
    const estadoLabel = r.estado === 'pendiente' ? '⏳ Pendiente' : '✅ Completado';

    const transVal = r.transferencia != null ? `${formatNumber(r.transferencia)} g` : null;
    const recepVal = r.recepcion != null ? `${formatNumber(r.recepcion)} g` : null;

    card.innerHTML = `
        <div class="transfer-card-header">
            <span class="transfer-producto">📦 ${r.producto}</span>
            <span class="transfer-estado ${estadoClass}">${estadoLabel}</span>
        </div>
        <div class="transfer-weights">
            <div class="weight-box">
                <div class="weight-label">Transferencia (Envío)</div>
                <div class="weight-value ${transVal ? 'weight-highlight' : 'weight-empty'}">
                    ${transVal || 'Sin registrar'}
                </div>
            </div>
            <div class="weight-box">
                <div class="weight-label">Recepción</div>
                <div class="weight-value ${recepVal ? 'weight-highlight' : 'weight-empty'}">
                    ${recepVal || 'Sin registrar'}
                </div>
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
        card.querySelector('.btn-add-weight').addEventListener('click', () => openAddWeightModal(r));
    }

    return card;
}

// =============================================
//  Modal: Add Missing Weight
// =============================================

function openAddWeightModal(record) {
    selectedRecord = record;

    modalProducto.textContent = record.producto;
    modalDestino.textContent = record.local_destino;
    modalCreadoPor.textContent = record.creado_por;

    if (isProduccion) {
        // I'm production, need to add transferencia. The store already put recepcion.
        modalTitle.textContent = 'Agregar Peso de Transferencia';
        modalPesoLabel.textContent = 'Peso de transferencia';
        modalOtroPesoLabel.textContent = 'Peso recepción (tienda)';
        modalOtroPeso.textContent = record.recepcion != null ? `${formatNumber(record.recepcion)} g` : '—';
    } else {
        // I'm store, need to add recepcion. Production already put transferencia.
        modalTitle.textContent = 'Agregar Peso de Recepción';
        modalPesoLabel.textContent = 'Peso de recepción';
        modalOtroPesoLabel.textContent = 'Peso transferencia (producción)';
        modalOtroPeso.textContent = record.transferencia != null ? `${formatNumber(record.transferencia)} g` : '—';
    }

    modalPesoInput.value = '';
    pesDiff.classList.add('hidden');
    addWeightModal.classList.remove('hidden');
    modalPesoInput.focus();
}

function closeAddWeightModal() {
    selectedRecord = null;
    addWeightModal.classList.add('hidden');
    modalPesoInput.value = '';
    pesDiff.classList.add('hidden');
}

closeModal.addEventListener('click', closeAddWeightModal);
cancelModal.addEventListener('click', closeAddWeightModal);
addWeightModal.addEventListener('click', (e) => {
    if (e.target === addWeightModal) closeAddWeightModal();
});

// Live diff
modalPesoInput.addEventListener('input', () => {
    if (!selectedRecord) return;
    const myPeso = parseFloat(modalPesoInput.value) || 0;
    const otherPeso = isProduccion
        ? (selectedRecord.recepcion || 0)
        : (selectedRecord.transferencia || 0);

    if (myPeso <= 0 || otherPeso <= 0) {
        pesDiff.classList.add('hidden');
        return;
    }

    const diff = myPeso - otherPeso;
    const percent = otherPeso > 0 ? ((diff / otherPeso) * 100).toFixed(1) : 0;

    if (Math.abs(diff) <= 10) {
        pesDiff.className = 'pes-diff pes-diff-ok';
        pesDiff.textContent = `✅ Coincide (diferencia: ${diff > 0 ? '+' : ''}${formatNumber(diff)} g)`;
    } else {
        pesDiff.className = 'pes-diff pes-diff-warn';
        pesDiff.textContent = `⚠️ Diferencia: ${diff > 0 ? '+' : ''}${formatNumber(diff)} g (${percent}%)`;
    }
    pesDiff.classList.remove('hidden');
});

// Confirm
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

        if (isProduccion) {
            updateData.transferencia = peso;
        } else {
            updateData.recepcion = peso;
        }

        // Check if both weights will be present → completado
        const otherWeight = isProduccion ? selectedRecord.recepcion : selectedRecord.transferencia;
        if (otherWeight != null) {
            updateData.estado = 'completado';
        }

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/transferencias_v2?id=eq.${selectedRecord.id}`,
            { method: 'PATCH', headers: HEADERS, body: JSON.stringify(updateData) }
        );
        if (!res.ok) throw new Error('Error');

        showToast('success', '¡Peso registrado!', `${selectedRecord.producto} actualizado`);
        closeAddWeightModal();
        await loadRecords();
    } catch (err) {
        console.error('Error:', err);
        showToast('error', 'Error', 'No se pudo guardar el peso');
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
    if (isProduccion) {
        local_destino = destinoSelect.value;
        if (!local_destino) {
            showToast('error', 'Destino requerido', 'Selecciona el local de destino');
            return;
        }
    } else {
        local_destino = currentUser.nombre_local;
    }

    submitBtn.classList.add('loading');

    try {
        const record = {
            producto,
            local_destino,
            creado_por: currentUser.usuario,
            creado_por_rol: isProduccion ? 'produccion' : 'tienda',
            estado: 'pendiente'
        };

        if (isProduccion) {
            record.transferencia = peso;
            // recepcion stays null
        } else {
            record.recepcion = peso;
            // transferencia stays null
        }

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/transferencias_v2`,
            { method: 'POST', headers: HEADERS, body: JSON.stringify(record) }
        );
        if (!res.ok) throw new Error('Error al crear registro');

        showToast('success', '¡Registrado!', `${producto} → ${local_destino}`);
        nuevoForm.reset();
        productoValue.value = '';
        await loadRecords();
    } catch (err) {
        console.error('Error:', err);
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
    isProduccion = user.nombre_local === 'Laboratorio';

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
