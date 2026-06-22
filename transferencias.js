/* ============================================
   YOOPS - Transferencias (Solo Laboratorio)
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
let allArticulos = [];
let highlightedIdx = -1;

// =============================================
//  DOM
// =============================================

const notLoggedScreen = document.getElementById('notLoggedScreen');
const noAccessScreen = document.getElementById('noAccessScreen');
const mainScreen = document.getElementById('mainScreen');
const displayUserName = document.getElementById('displayUserName');
const displayUserLocal = document.getElementById('displayUserLocal');

// Form
const nuevoForm = document.getElementById('nuevoForm');
const productoInput = document.getElementById('productoInput');
const productoValue = document.getElementById('productoValue');
const productoDropdown = document.getElementById('productoDropdown');
const productoList = document.getElementById('productoList');
const destinoSelect = document.getElementById('destinoSelect');
const pesoInput = document.getElementById('pesoInput');
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
    [notLoggedScreen, noAccessScreen, mainScreen].forEach(s => s.classList.add('hidden'));
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
//  Populate Destinos
// =============================================

function populateDestinos() {
    destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona destino...</option>';
    LOCALES_TIENDA.forEach(local => {
        const opt = document.createElement('option');
        opt.value = local;
        opt.textContent = `📍 ${local}`;
        destinoSelect.appendChild(opt);
    });
}

// =============================================
//  Load Records (Today)
// =============================================

async function loadRecords() {
    try {
        const today = getTodayISO();
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/transferencias_v2?created_at=gte.${today}T00:00:00&created_at=lt.${today}T23:59:59&select=*&order=created_at.desc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('Error loading records');
        const records = await res.json();
        renderRecords(records);
        recordCount.textContent = records.length;
    } catch (err) {
        console.error('Error loading records:', err);
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

    records.forEach((r, idx) => {
        const card = createRecordCard(r, idx);
        recordsList.appendChild(card);
    });
}

function createRecordCard(r, idx) {
    const card = document.createElement('div');
    card.className = 'transfer-card';
    card.style.animationDelay = `${idx * 0.05}s`;

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
                <div class="weight-label">Transferencia</div>
                <div class="weight-value ${transVal ? 'weight-highlight' : 'weight-empty'}">
                    ${transVal || 'Sin registrar'}
                </div>
            </div>
            <div class="weight-box">
                <div class="weight-label">Recepción</div>
                <div class="weight-value ${recepVal ? 'weight-highlight' : 'weight-empty'}">
                    ${recepVal || 'Sin confirmar'}
                </div>
            </div>
        </div>
        <div class="transfer-footer">
            <div class="transfer-meta">
                <span>📍 ${r.local_destino}</span>
                <span>👤 ${r.creado_por}</span>
                <span>🕐 ${formatDateTime(r.created_at)}</span>
            </div>
        </div>
    `;

    return card;
}

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

    const destino = destinoSelect.value;
    if (!destino) {
        showToast('error', 'Destino requerido', 'Selecciona el local de destino');
        return;
    }

    const peso = parseFloat(pesoInput.value);
    if (!peso || peso <= 0) {
        showToast('error', 'Peso inválido', 'Ingresa un peso válido');
        return;
    }

    submitBtn.classList.add('loading');

    try {
        const record = {
            producto,
            local_destino: destino,
            transferencia: peso,
            creado_por: currentUser.usuario,
            creado_por_rol: 'produccion',
            estado: 'pendiente'
        };

        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/transferencias_v2`,
            { method: 'POST', headers: HEADERS, body: JSON.stringify(record) }
        );
        if (!res.ok) throw new Error('Error al crear registro');

        showToast('success', '¡Registrado!', `${producto} → ${destino}`);
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

    // Solo Laboratorio tiene acceso
    if (user.nombre_local !== 'Laboratorio') {
        switchScreen('noAccessScreen');
        return;
    }

    currentUser = user;
    displayUserName.textContent = user.usuario;
    displayUserLocal.textContent = user.nombre_local;
    autoUser.textContent = user.usuario;
    autoLocal.textContent = user.nombre_local;
    autoDate.textContent = getTodayDisplay();

    populateDestinos();
    await loadArticulos();
    switchScreen('mainScreen');
    await loadRecords();
}

init();
