/* ============================================
   YOOPS - Consumo de Topping
   Application Logic
   ============================================ */

// Config: SUPABASE_URL, SUPABASE_KEY, HEADERS loaded from config.js
// Utils: showToast, formatTime, formatNumber, getTodayISO, getTodayDisplay,
//        loadSession, verifySession, escapeHtml loaded from utils.js

// --- State ---
let currentUser = null;
let allArticulos = [];
let todayRecords = []; // Cached for duplicate check
let editingId = null;

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
const cancelEditBtn = document.getElementById('cancelEditBtn');
const submitBtnText = document.getElementById('submitBtnText');

let articuloCombo = null;



function switchScreen(screenId) {
    [notLoggedScreen, toppingScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// Auth: loadSession(), verifySession() from utils.js

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
            `${SUPABASE_URL}/rest/v1/consumo_topping_v2?fecha=eq.${today}&local=eq.${encodeURIComponent(currentUser.nombre_local)}&select=*&order=created_at.desc`,
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

async function updateRecord(id, data) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/consumo_topping_v2?id=eq.${id}`,
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
    articuloInput.value = record.articulo;
    articuloValue.value = record.articulo;
    pesoInput.value = record.peso;
    submitBtnText.textContent = 'Guardar Cambios';
    cancelEditBtn.classList.remove('hidden');
    duplicateHint.textContent = '';
    duplicateHint.classList.remove('visible');
    document.querySelector('.form-card').classList.add('editing');
    document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function exitEditMode() {
    editingId = null;
    toppingForm.reset();
    if (articuloCombo) articuloCombo.reset();
    submitBtnText.textContent = 'Registrar Consumo';
    cancelEditBtn.classList.add('hidden');
    duplicateHint.textContent = '';
    duplicateHint.classList.remove('visible');
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
        tr.style.animationDelay = `${index * 0.03}s`;

        // Parse tag from article name
        const safeArticulo = escapeHtml(record.articulo);
        const tagMatch = record.articulo.match(/\(([^)]+)\)\s*$/);
        let displayName = safeArticulo;
        let tagHtml = '';
        if (tagMatch) {
            displayName = escapeHtml(record.articulo.replace(tagMatch[0], '').trim());
            tagHtml = `<span class="art-tag">${escapeHtml(tagMatch[1])}</span>`;
        }

        const isToday = record.fecha === getTodayISO();
        tr.innerHTML = `
            <td><span class="row-index">${index + 1}</span></td>
            <td><span class="articulo-cell">${displayName}${tagHtml}</span></td>
            <td><span class="peso-value">${formatNumber(record.peso)}</span></td>
            <td>${escapeHtml(record.creado_por) || '—'}</td>
            <td><span class="hora-value">${formatTime(record.hora)}</span></td>
            <td>${isToday ? `<button class="btn-edit-record" data-idx="${index}" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>` : ''}</td>
        `;
        tr._recordData = record;
        recordsBody.appendChild(tr);
    });

    // Attach edit listeners
    recordsBody.querySelectorAll('.btn-edit-record').forEach(btn => {
        const tr = btn.closest('tr');
        btn.addEventListener('click', () => enterEditMode(tr._recordData));
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

    // Client-side duplicate check (skip when editing)
    if (!editingId && isDuplicateToday(articulo)) {
        showToast('error', 'Duplicado', `"${articulo}" ya fue registrado hoy en ${currentUser.nombre_local}`);
        return;
    }

    submitBtn.classList.add('loading');

    try {
        if (editingId) {
            await updateRecord(editingId, { articulo, peso });
            showToast('success', '¡Actualizado!', `${articulo} — ${formatNumber(peso)}g`);
            exitEditMode();
        } else {
            await createRecord({
                articulo,
                peso,
                local: currentUser.nombre_local,
                creado_por: currentUser.usuario,
                fecha: getTodayISO(),
                hora: getLocalTime()
            });
            showToast('success', '¡Registrado!', `${articulo} — ${formatNumber(peso)}g`);
            pesoInput.value = '';
            if (articuloCombo) articuloCombo.reset();
            duplicateHint.textContent = '';
            duplicateHint.classList.remove('visible');
        }

        await loadRecords();
    } catch (err) {
        if (err.message === 'DUPLICADO') {
            showToast('error', 'Duplicado', `"${articulo}" ya fue registrado hoy en este local`);
        } else {
            console.error('Error saving record:', err);
            showToast('error', 'Error', 'No se pudo guardar. Intenta de nuevo.');
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
