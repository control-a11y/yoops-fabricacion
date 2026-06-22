/* ============================================
   YOOPS - Limpieza de Máquina
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

const SABOR_MAP = {
    natural: { emoji: '🥛', label: 'Natural' },
    taro:    { emoji: '🟣', label: 'Taro' },
    carbon:  { emoji: '⚫', label: 'Carbón' },
    vegano:  { emoji: '🌱', label: 'Vegano' },
    asaid:   { emoji: '🫐', label: 'Açaí' }
};

let currentUser = null;
let editingId = null; // UUID of the record being edited, null for new

// =============================================
//  DOM
// =============================================

const notLoggedScreen = document.getElementById('notLoggedScreen');
const limpiezaScreen = document.getElementById('limpiezaScreen');
const displayUserName = document.getElementById('displayUserName');
const displayUserLocal = document.getElementById('displayUserLocal');

const limpiezaForm = document.getElementById('limpiezaForm');
const saborSelect = document.getElementById('saborSelect');
const mezclaInicial = document.getElementById('mezclaInicial');
const aguaInicial = document.getElementById('aguaInicial');
const productoExtraido = document.getElementById('productoExtraido');
const mezclaFinal = document.getElementById('mezclaFinal');
const aguaFinal = document.getElementById('aguaFinal');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const cancelEditBtn = document.getElementById('cancelEditBtn');

const autoLocal = document.getElementById('autoLocal');
const autoUser = document.getElementById('autoUser');
const autoDate = document.getElementById('autoDate');

const recordsList = document.getElementById('recordsList');
const emptyState = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');
const todayCount = document.getElementById('todayCount');

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

function formatTime(timeStr) {
    if (!timeStr) return '—';
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const period = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${minutes} ${period}`;
}

function formatNumber(num) {
    if (num === null || num === undefined || num === '') return '—';
    return Number(num).toLocaleString('es-MX');
}

function getTodayISO() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function getTodayDisplay() {
    return new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function switchScreen(id) {
    [notLoggedScreen, limpiezaScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function getVal(el) {
    return el.value !== '' ? parseFloat(el.value) : null;
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
//  API
// =============================================

async function loadRecords() {
    try {
        const today = getTodayISO();
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/limpieza_v2?fecha=eq.${today}&select=*&order=created_at.desc`,
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
        `${SUPABASE_URL}/rest/v1/limpieza_v2`,
        { method: 'POST', headers: HEADERS, body: JSON.stringify(data) }
    );
    if (!res.ok) {
        const body = await res.text();
        console.error('Create error:', body);
        throw new Error('Error al crear registro');
    }
    return res.json();
}

async function updateRecord(id, data) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/limpieza_v2?id=eq.${id}`,
        { method: 'PATCH', headers: HEADERS, body: JSON.stringify(data) }
    );
    if (!res.ok) {
        const body = await res.text();
        console.error('Update error:', body);
        throw new Error('Error al actualizar registro');
    }
    return res.json();
}

// =============================================
//  Edit Mode
// =============================================

function enterEditMode(record) {
    editingId = record.id;

    // Fill form with existing data
    saborSelect.value = record.sabor;
    mezclaInicial.value = record.mezcla_inicial ?? '';
    aguaInicial.value = record.agua_inicial ?? '';
    productoExtraido.value = record.producto_extraido ?? '';
    mezclaFinal.value = record.mezcla_final ?? '';
    aguaFinal.value = record.agua_final ?? '';

    // Update UI
    submitBtnText.textContent = 'Guardar Cambios';
    cancelEditBtn.classList.remove('hidden');

    // Highlight form
    document.querySelector('.form-card').classList.add('editing');

    // Scroll to form
    document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
    editingId = null;

    // Reset form
    limpiezaForm.reset();

    // Update UI
    submitBtnText.textContent = 'Registrar Limpieza';
    cancelEditBtn.classList.add('hidden');

    // Remove highlight
    document.querySelector('.form-card').classList.remove('editing');
}

cancelEditBtn.addEventListener('click', exitEditMode);

// =============================================
//  Check pending fields (for visual indicator)
// =============================================

function hasPendingFields(record) {
    return (
        record.mezcla_inicial === null || record.mezcla_inicial === 0 ||
        record.agua_inicial === null || record.agua_inicial === 0 ||
        record.producto_extraido === null || record.producto_extraido === 0 ||
        record.mezcla_final === null || record.mezcla_final === 0 ||
        record.agua_final === null || record.agua_final === 0
    );
}

// =============================================
//  Render Records as Cards
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
        const saborInfo = SABOR_MAP[r.sabor] || { emoji: '🍦', label: r.sabor };
        const pending = hasPendingFields(r);
        const card = document.createElement('div');
        card.className = `record-card${pending ? ' record-pending' : ''}`;
        card.style.animationDelay = `${idx * 0.05}s`;

        const pendingBadge = pending
            ? '<span class="pending-badge">⏳ Pendiente</span>'
            : '<span class="complete-badge">✓ Completo</span>';

        card.innerHTML = `
            <div class="record-card-header">
                <span class="record-sabor">${saborInfo.emoji} ${saborInfo.label}</span>
                <div class="record-card-right">
                    ${pendingBadge}
                    <button class="btn-edit-record" data-id="${r.id}" title="Editar registro">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                </div>
            </div>
            <div class="record-weights">
                <div class="weight-cell ${r.mezcla_inicial ? '' : 'weight-empty'}">
                    <span class="weight-label">Yogurt Enjuague</span>
                    <span class="weight-value">${formatNumber(r.mezcla_inicial)}</span>
                </div>
                <div class="weight-cell ${r.agua_inicial ? '' : 'weight-empty'}">
                    <span class="weight-label">Agua Inicial</span>
                    <span class="weight-value">${formatNumber(r.agua_inicial)}</span>
                </div>
                <div class="weight-cell ${r.producto_extraido ? '' : 'weight-empty'}">
                    <span class="weight-label">Yogurt Extraído</span>
                    <span class="weight-value">${formatNumber(r.producto_extraido)}</span>
                </div>
                <div class="weight-cell ${r.mezcla_final ? '' : 'weight-empty'}">
                    <span class="weight-label">Mezcla Final</span>
                    <span class="weight-value">${formatNumber(r.mezcla_final)}</span>
                </div>
                <div class="weight-cell ${r.agua_final ? '' : 'weight-empty'}">
                    <span class="weight-label">Agua Final</span>
                    <span class="weight-value">${formatNumber(r.agua_final)}</span>
                </div>
            </div>
            <div class="record-footer">
                <span class="record-meta-item">👤 ${r.creado_por}</span>
                <span class="record-meta-item">🕐 ${formatTime(r.hora)}</span>
            </div>
        `;

        // Store record data for edit
        card._recordData = r;

        recordsList.appendChild(card);
    });

    // Attach edit listeners
    recordsList.querySelectorAll('.btn-edit-record').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            const card = btn.closest('.record-card');
            enterEditMode(card._recordData);
        });
    });
}

// =============================================
//  Form Submit (Create or Update)
// =============================================

limpiezaForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const sabor = saborSelect.value;
    if (!sabor) {
        showToast('error', 'Falta sabor', 'Selecciona el sabor de fabricación');
        return;
    }

    const data = {
        sabor,
        mezcla_inicial: getVal(mezclaInicial) ?? 0,
        agua_inicial: getVal(aguaInicial) ?? 0,
        producto_extraido: getVal(productoExtraido) ?? 0,
        mezcla_final: getVal(mezclaFinal) ?? 0,
        agua_final: getVal(aguaFinal) ?? 0,
    };

    submitBtn.classList.add('loading');

    try {
        const saborInfo = SABOR_MAP[sabor];

        if (editingId) {
            // UPDATE existing record
            await updateRecord(editingId, data);
            showToast('success', '¡Actualizado!', `Limpieza ${saborInfo.emoji} ${saborInfo.label} guardada`);
            exitEditMode();
        } else {
            // CREATE new record
            data.local = currentUser.nombre_local;
            data.creado_por = currentUser.usuario;
            await createRecord(data);
            showToast('success', '¡Registrado!', `Limpieza ${saborInfo.emoji} ${saborInfo.label} guardada`);
            limpiezaForm.reset();
        }

        await loadRecords();
    } catch (err) {
        console.error('Save error:', err);
        showToast('error', 'Error', 'No se pudo guardar. Intenta de nuevo.');
    } finally {
        submitBtn.classList.remove('loading');
    }
});

// --- Refresh ---
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
    displayUserName.textContent = user.usuario;
    displayUserLocal.textContent = user.nombre_local;
    autoLocal.textContent = user.nombre_local;
    autoUser.textContent = user.usuario;
    autoDate.textContent = getTodayDisplay();

    switchScreen('limpiezaScreen');
    await loadRecords();
}

init();
