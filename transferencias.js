/* ============================================
   YOOPS - Transferencias
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

const LOCALES = ['Plaza Numa', 'Grand Plaza', 'Rio de Piedras', 'Laboratorio'];

let currentUser = null;
let currentTab = 'enviar';
let selectedTransfer = null; // for modal

// =============================================
//  DOM
// =============================================

const notLoggedScreen = document.getElementById('notLoggedScreen');
const transferenciasScreen = document.getElementById('transferenciasScreen');
const displayUserName = document.getElementById('displayUserName');
const displayUserLocal = document.getElementById('displayUserLocal');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const pendingBadge = document.getElementById('pendingBadge');

// Send form
const enviarForm = document.getElementById('enviarForm');
const productoInput = document.getElementById('productoInput');
const productoValue = document.getElementById('productoValue');
const productoDropdown = document.getElementById('productoDropdown');
const productoList = document.getElementById('productoList');
const destinoSelect = document.getElementById('destinoSelect');
const pesoEnvio = document.getElementById('pesoEnvio');
const notasEnvio = document.getElementById('notasEnvio');
const enviarBtn = document.getElementById('enviarBtn');

// Auto info
const autoLocalEnvio = document.getElementById('autoLocalEnvio');
const autoUserEnvio = document.getElementById('autoUserEnvio');
const autoDateEnvio = document.getElementById('autoDateEnvio');

// Pending
const pendientesList = document.getElementById('pendientesList');
const emptyPendientes = document.getElementById('emptyPendientes');
const refreshPendientes = document.getElementById('refreshPendientes');

// History
const historialList = document.getElementById('historialList');
const emptyHistorial = document.getElementById('emptyHistorial');
const historialCount = document.getElementById('historialCount');
const refreshHistorial = document.getElementById('refreshHistorial');

// Modal
const recibirModal = document.getElementById('recibirModal');
const closeModal = document.getElementById('closeModal');
const cancelRecibir = document.getElementById('cancelRecibir');
const confirmarRecibir = document.getElementById('confirmarRecibir');
const modalProducto = document.getElementById('modalProducto');
const modalOrigen = document.getElementById('modalOrigen');
const modalEnviadoPor = document.getElementById('modalEnviadoPor');
const modalPesoEnvio = document.getElementById('modalPesoEnvio');
const pesoRecepcion = document.getElementById('pesoRecepcion');
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

function formatTime(timeStr) {
    if (!timeStr) return '—';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    return `${h % 12 || 12}:${parts[1]} ${h >= 12 ? 'PM' : 'AM'}`;
}

function getTodayISO() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function getTodayDisplay() {
    return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function switchScreen(id) {
    [notLoggedScreen, transferenciasScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

// =============================================
//  Tab Navigation
// =============================================

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        currentTab = tab;

        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        tabContents.forEach(tc => tc.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');

        if (tab === 'recibir') loadPendientes();
        if (tab === 'historial') loadHistorial();
    });
});

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
//  Populate Destination Select
// =============================================

function populateDestinos() {
    destinoSelect.innerHTML = '<option value="" disabled selected>Selecciona destino...</option>';
    LOCALES.forEach(local => {
        if (local !== currentUser.nombre_local) {
            const opt = document.createElement('option');
            opt.value = local;
            opt.textContent = `📍 ${local}`;
            destinoSelect.appendChild(opt);
        }
    });
}

// =============================================
//  Load Articulos from DB
// =============================================

let allArticulos = [];

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
//  Searchable Combobox Logic
// =============================================

let highlightedIdx = -1;

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

        // Highlight matching text
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

function openDropdown() {
    renderArticulosList(productoInput.value);
    productoDropdown.classList.remove('hidden');
}

function closeDropdown() {
    productoDropdown.classList.add('hidden');
    highlightedIdx = -1;
}

// Input events
productoInput.addEventListener('focus', openDropdown);

productoInput.addEventListener('input', () => {
    productoValue.value = ''; // Clear selection when typing
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
        closeDropdown();
    }
});

function updateHighlight(items) {
    items.forEach((el, i) => {
        el.classList.toggle('highlighted', i === highlightedIdx);
        if (i === highlightedIdx) el.scrollIntoView({ block: 'nearest' });
    });
}

// Click outside to close
document.addEventListener('click', (e) => {
    if (!e.target.closest('#productoCombobox')) {
        closeDropdown();
    }
});

// =============================================
//  API
// =============================================

async function createTransfer(data) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/transferencias_v2`,
        { method: 'POST', headers: HEADERS, body: JSON.stringify(data) }
    );
    if (!res.ok) throw new Error('Error al crear transferencia');
    return res.json();
}

async function updateTransfer(id, data) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/transferencias_v2?id=eq.${id}`,
        { method: 'PATCH', headers: HEADERS, body: JSON.stringify(data) }
    );
    if (!res.ok) throw new Error('Error al actualizar transferencia');
    return res.json();
}

// Load transfers pending for MY local (I need to receive)
async function loadPendientes() {
    try {
        const myLocal = currentUser.nombre_local;
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/transferencias_v2?local_destino=eq.${encodeURIComponent(myLocal)}&estado=eq.pendiente&select=*&order=created_at.desc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('Error');
        const records = await res.json();
        renderPendientes(records);

        // Also check for transfers I SENT that are pending (show in badge)
        const resSent = await fetch(
            `${SUPABASE_URL}/rest/v1/transferencias_v2?local_origen=eq.${encodeURIComponent(myLocal)}&estado=eq.pendiente&select=id`,
            { headers: HEADERS }
        );

        // Update badge with incoming pending
        if (records.length > 0) {
            pendingBadge.textContent = records.length;
            pendingBadge.classList.remove('hidden');
        } else {
            pendingBadge.classList.add('hidden');
        }
    } catch (err) {
        console.error('Error loading pendientes:', err);
    }
}

async function loadHistorial() {
    try {
        const today = getTodayISO();
        const myLocal = currentUser.nombre_local;
        // Show all transfers involving my local today
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/transferencias_v2?fecha=eq.${today}&or=(local_origen.eq.${encodeURIComponent(myLocal)},local_destino.eq.${encodeURIComponent(myLocal)})&select=*&order=created_at.desc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('Error');
        const records = await res.json();
        renderHistorial(records);
        historialCount.textContent = records.length;
    } catch (err) {
        console.error('Error loading historial:', err);
    }
}

// =============================================
//  Render Pending Transfers
// =============================================

function renderPendientes(records) {
    pendientesList.innerHTML = '';
    if (records.length === 0) {
        pendientesList.style.display = 'none';
        emptyPendientes.classList.add('visible');
        return;
    }
    pendientesList.style.display = 'flex';
    emptyPendientes.classList.remove('visible');

    records.forEach((r, idx) => {
        const card = createTransferCard(r, idx, true);
        pendientesList.appendChild(card);
    });
}

// =============================================
//  Render History
// =============================================

function renderHistorial(records) {
    historialList.innerHTML = '';
    if (records.length === 0) {
        historialList.style.display = 'none';
        emptyHistorial.classList.add('visible');
        return;
    }
    historialList.style.display = 'flex';
    emptyHistorial.classList.remove('visible');

    records.forEach((r, idx) => {
        const card = createTransferCard(r, idx, false);
        historialList.appendChild(card);
    });
}

// =============================================
//  Create Transfer Card
// =============================================

function createTransferCard(r, idx, showReceiveBtn) {
    const card = document.createElement('div');
    card.className = 'transfer-card';
    card.style.animationDelay = `${idx * 0.05}s`;

    const estadoClass = r.estado === 'pendiente' ? 'estado-pendiente' : 'estado-completado';
    const estadoLabel = r.estado === 'pendiente' ? '⏳ Pendiente' : '✅ Completado';

    const isMyLocal = r.local_destino === currentUser.nombre_local;
    const canReceive = showReceiveBtn && r.estado === 'pendiente' && isMyLocal;

    card.innerHTML = `
        <div class="transfer-card-header">
            <span class="transfer-producto">🍦 ${r.producto}</span>
            <span class="transfer-estado ${estadoClass}">${estadoLabel}</span>
        </div>
        <div class="transfer-body">
            <div class="transfer-local-box">
                <div class="transfer-local-label">Origen</div>
                <div class="transfer-local-name">${r.local_origen}</div>
                <div class="transfer-peso">${r.peso_envio ? formatNumber(r.peso_envio) + ' g' : '—'}</div>
                <div class="transfer-local-label" style="margin-top:2px;font-size:0.6rem;">👤 ${r.creado_por}</div>
            </div>
            <div class="transfer-arrow">→</div>
            <div class="transfer-local-box">
                <div class="transfer-local-label">Destino</div>
                <div class="transfer-local-name">${r.local_destino}</div>
                <div class="transfer-peso ${r.peso_recepcion ? '' : 'transfer-peso-empty'}">${r.peso_recepcion ? formatNumber(r.peso_recepcion) + ' g' : 'Sin confirmar'}</div>
                <div class="transfer-local-label" style="margin-top:2px;font-size:0.6rem;">👤 ${r.recibido_por || '—'}</div>
            </div>
        </div>
        <div class="transfer-footer">
            <div class="transfer-meta">
                <span>🕐 ${formatTime(r.hora_envio)}</span>
                ${r.notas ? `<span>📝 ${r.notas}</span>` : ''}
            </div>
            ${canReceive ? `<button class="btn-recibir" data-id="${r.id}">📥 Recibir</button>` : ''}
        </div>
    `;

    if (canReceive) {
        card.querySelector('.btn-recibir').addEventListener('click', () => openReceiveModal(r));
    }

    return card;
}

// =============================================
//  Receive Modal
// =============================================

function openReceiveModal(transfer) {
    selectedTransfer = transfer;
    modalProducto.textContent = transfer.producto;
    modalOrigen.textContent = transfer.local_origen;
    modalEnviadoPor.textContent = transfer.creado_por;
    modalPesoEnvio.textContent = `${formatNumber(transfer.peso_envio)} g`;
    pesoRecepcion.value = '';
    pesDiff.classList.add('hidden');
    recibirModal.classList.remove('hidden');
    pesoRecepcion.focus();
}

function closeReceiveModal() {
    selectedTransfer = null;
    recibirModal.classList.add('hidden');
    pesoRecepcion.value = '';
    pesDiff.classList.add('hidden');
}

closeModal.addEventListener('click', closeReceiveModal);
cancelRecibir.addEventListener('click', closeReceiveModal);

// Close modal on overlay click
recibirModal.addEventListener('click', (e) => {
    if (e.target === recibirModal) closeReceiveModal();
});

// Live diff calculation
pesoRecepcion.addEventListener('input', () => {
    if (!selectedTransfer) return;
    const recibido = parseFloat(pesoRecepcion.value) || 0;
    const enviado = selectedTransfer.peso_envio || 0;

    if (recibido <= 0) {
        pesDiff.classList.add('hidden');
        return;
    }

    const diff = recibido - enviado;
    const percent = enviado > 0 ? ((diff / enviado) * 100).toFixed(1) : 0;

    if (Math.abs(diff) <= 10) {
        pesDiff.className = 'pes-diff pes-diff-ok';
        pesDiff.textContent = `✅ Coincide (diferencia: ${diff > 0 ? '+' : ''}${formatNumber(diff)} g)`;
    } else {
        pesDiff.className = 'pes-diff pes-diff-warn';
        pesDiff.textContent = `⚠️ Diferencia: ${diff > 0 ? '+' : ''}${formatNumber(diff)} g (${percent}%)`;
    }
    pesDiff.classList.remove('hidden');
});

// Confirm receive
confirmarRecibir.addEventListener('click', async () => {
    if (!selectedTransfer) return;
    const peso = parseFloat(pesoRecepcion.value);

    if (!peso || peso <= 0) {
        showToast('error', 'Peso inválido', 'Ingresa el peso recibido');
        return;
    }

    confirmarRecibir.classList.add('loading');

    try {
        const now = new Date();
        const horaRecepcion = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        await updateTransfer(selectedTransfer.id, {
            peso_recepcion: peso,
            recibido_por: currentUser.usuario,
            hora_recepcion: horaRecepcion,
            estado: 'completado',
            updated_at: now.toISOString()
        });

        showToast('success', '¡Recibido!', `${selectedTransfer.producto} confirmado`);
        closeReceiveModal();
        await loadPendientes();
    } catch (err) {
        console.error('Error receiving:', err);
        showToast('error', 'Error', 'No se pudo confirmar la recepción');
    } finally {
        confirmarRecibir.classList.remove('loading');
    }
});

// =============================================
//  Send Form
// =============================================

enviarForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const producto = productoValue.value;
    const destino = destinoSelect.value;
    const peso = parseFloat(pesoEnvio.value);
    const notas = notasEnvio.value.trim();

    if (!producto || !destino) {
        showToast('error', 'Campos requeridos', 'Selecciona producto y destino');
        return;
    }

    if (!peso || peso <= 0) {
        showToast('error', 'Peso inválido', 'Ingresa un peso válido');
        return;
    }

    enviarBtn.classList.add('loading');

    try {
        await createTransfer({
            producto,
            local_origen: currentUser.nombre_local,
            local_destino: destino,
            peso_envio: peso,
            creado_por: currentUser.usuario,
            estado: 'pendiente',
            notas: notas || null
        });

        showToast('success', '¡Enviado!', `${producto} → ${destino}`);
        enviarForm.reset();
        productoValue.value = '';
    } catch (err) {
        console.error('Send error:', err);
        showToast('error', 'Error', 'No se pudo crear la transferencia');
    } finally {
        enviarBtn.classList.remove('loading');
    }
});

// Refresh buttons
refreshPendientes.addEventListener('click', async () => {
    refreshPendientes.classList.add('spinning');
    await loadPendientes();
    setTimeout(() => refreshPendientes.classList.remove('spinning'), 600);
});

refreshHistorial.addEventListener('click', async () => {
    refreshHistorial.classList.add('spinning');
    await loadHistorial();
    setTimeout(() => refreshHistorial.classList.remove('spinning'), 600);
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
    displayUserName.textContent = user.usuario;
    displayUserLocal.textContent = user.nombre_local;
    autoLocalEnvio.textContent = user.nombre_local;
    autoUserEnvio.textContent = user.usuario;
    autoDateEnvio.textContent = getTodayDisplay();

    populateDestinos();
    await loadArticulos();
    switchScreen('transferenciasScreen');
    await loadPendientes();
}

init();
