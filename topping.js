/* ============================================
   YOOPS - Consumo de Topping
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

// --- State ---
let currentUser = null;
let allArticulos = [];
let todayRecords = []; // Cached for duplicate check

// =============================================
//  DOM Elements
// =============================================

const notLoggedScreen = document.getElementById('notLoggedScreen');
const toppingScreen = document.getElementById('toppingScreen');

const displayUserName = document.getElementById('displayUserName');
const displayUserLocal = document.getElementById('displayUserLocal');

const toppingForm = document.getElementById('toppingForm');
const articuloInput = document.getElementById('articuloInput');
const articuloValue = document.getElementById('articuloValue');
const pesoInput = document.getElementById('pesoInput');
const submitBtn = document.getElementById('submitBtn');
const duplicateHint = document.getElementById('duplicateHint');

const autoLocal = document.getElementById('autoLocal');
const autoUser = document.getElementById('autoUser');
const autoDate = document.getElementById('autoDate');

const recordsBody = document.getElementById('recordsBody');
const emptyState = document.getElementById('emptyState');
const recordsTable = document.getElementById('recordsTable');
const refreshBtn = document.getElementById('refreshBtn');
const todayCount = document.getElementById('todayCount');

const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toastIcon');
const toastTitle = document.getElementById('toastTitle');
const toastMessage = document.getElementById('toastMessage');

let articuloCombo = null;

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
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
}

function formatNumber(num) {
    return Number(num).toLocaleString('es-MX');
}

function getTodayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getTodayDisplay() {
    const now = new Date();
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return now.toLocaleDateString('es-MX', options);
}

function switchScreen(screenId) {
    [notLoggedScreen, toppingScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// =============================================
//  Auth
// =============================================

function loadSession() {
    const saved = localStorage.getItem('yoops_session');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { return null; }
    }
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
            `${SUPABASE_URL}/rest/v1/articulos?select=ARTICULO&order=ARTICULO.asc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('Error al cargar artículos');
        allArticulos = await res.json();

    const items = allArticulos.map(a => a.ARTICULO);
    if (!articuloCombo) {
        articuloCombo = new SearchableCombo({
            inputEl: articuloInput,
            valueEl: articuloValue,
            dropdownEl: document.getElementById('articuloDropdown'),
            listEl: document.getElementById('articuloList'),
            containerId: 'articuloCombobox',
            items: items,
            onSelect: (value) => checkDuplicateOnSelect(value)
        });
    } else {
        articuloCombo.setItems(items);
    }
    } catch (err) {
        console.error('Error loading articulos:', err);
        showToast('error', 'Error', 'No se pudieron cargar los artículos');
    }
}

// =============================================
//  Duplicate Check
// =============================================

function isDuplicateToday(articulo) {
    return todayRecords.some(
        r => r.articulo === articulo && r.local === currentUser.nombre_local
    );
}

function checkDuplicateOnSelect(articulo) {
    if (isDuplicateToday(articulo)) {
        duplicateHint.textContent = `⚠️ "${articulo}" ya fue registrado hoy`;
        duplicateHint.style.color = '#f87171';
        duplicateHint.classList.add('visible');
    } else {
        duplicateHint.textContent = '';
        duplicateHint.classList.remove('visible');
    }
}

// =============================================
//  Records
// =============================================

async function loadRecords() {
    try {
        const today = getTodayISO();
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/consumo_topping_v2?fecha=eq.${today}&select=*&order=created_at.desc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('Error al cargar registros');
        todayRecords = await res.json();
        renderRecords(todayRecords);
        todayCount.textContent = todayRecords.length;
    } catch (err) {
        console.error('Error loading records:', err);
        showToast('error', 'Error', 'No se pudieron cargar los registros');
    }
}

async function createRecord(data) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/consumo_topping_v2`,
        { method: 'POST', headers: HEADERS, body: JSON.stringify(data) }
    );
    if (!res.ok) {
        const body = await res.text();
        if (body.includes('duplicate') || body.includes('unique') || body.includes('23505')) {
            throw new Error('DUPLICADO');
        }
        console.error('Supabase error:', body);
        throw new Error('Error al crear registro');
    }
    return res.json();
}

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
        tr.style.animationDelay = `${index * 0.03}s`;

        // Parse tag from article name
        const tagMatch = record.articulo.match(/\(([^)]+)\)\s*$/);
        let displayName = record.articulo;
        let tagHtml = '';
        if (tagMatch) {
            displayName = record.articulo.replace(tagMatch[0], '').trim();
            tagHtml = `<span class="art-tag">${tagMatch[1]}</span>`;
        }

        tr.innerHTML = `
            <td><span class="row-index">${index + 1}</span></td>
            <td><span class="articulo-cell">${displayName}${tagHtml}</span></td>
            <td><span class="peso-value">${formatNumber(record.peso)}</span></td>
            <td>${record.creado_por || '—'}</td>
            <td><span class="hora-value">${formatTime(record.hora)}</span></td>
        `;
        recordsBody.appendChild(tr);
    });
}

// =============================================
//  Form Submit
// =============================================

toppingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const articulo = articuloValue.value;
    const peso = parseFloat(pesoInput.value);

    if (!articulo || !peso) {
        showToast('error', 'Campos incompletos', 'Selecciona un artículo e ingresa el peso');
        return;
    }

    if (peso <= 0) {
        showToast('error', 'Peso inválido', 'El peso debe ser mayor a 0');
        return;
    }

    // Client-side duplicate check
    if (isDuplicateToday(articulo)) {
        showToast('error', 'Duplicado', `"${articulo}" ya fue registrado hoy en ${currentUser.nombre_local}`);
        return;
    }

    submitBtn.classList.add('loading');

    try {
        await createRecord({
            articulo,
            peso,
            local: currentUser.nombre_local,
            creado_por: currentUser.usuario
        });

        showToast('success', '¡Registrado!', `${articulo} — ${formatNumber(peso)}g`);

        pesoInput.value = '';
        if (articuloCombo) articuloCombo.reset();
        duplicateHint.textContent = '';
        duplicateHint.classList.remove('visible');

        await loadRecords();
    } catch (err) {
        if (err.message === 'DUPLICADO') {
            showToast('error', 'Duplicado', `"${articulo}" ya fue registrado hoy en este local`);
        } else {
            console.error('Error creating record:', err);
            showToast('error', 'Error', 'No se pudo registrar. Intenta de nuevo.');
        }
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

    // Auto-detected info
    autoLocal.textContent = user.nombre_local;
    autoUser.textContent = user.usuario;
    autoDate.textContent = getTodayDisplay();

    switchScreen('toppingScreen');

    await loadArticulos();
    await loadRecords();
}

init();
