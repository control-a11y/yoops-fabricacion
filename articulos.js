/* ============================================
   YOOPS - Artículos Admin
   Application Logic
   (config.js + utils.js loaded before this file)
   ============================================ */

// --- State ---
let currentUser = null;
let allArticulos = [];
let editingArticulo = null; // Original name when editing, null when adding

// =============================================
//  DOM Elements
// =============================================

const accessDeniedScreen = document.getElementById('accessDeniedScreen');
const notLoggedScreen = document.getElementById('notLoggedScreen');
const articulosScreen = document.getElementById('articulosScreen');
const deniedUserInfo = document.getElementById('deniedUserInfo');

// App
const displayUserName = document.getElementById('displayUserName');
const totalArticulos = document.getElementById('totalArticulos');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const addBtn = document.getElementById('addBtn');
const articulosList = document.getElementById('articulosList');
const emptyState = document.getElementById('emptyState');
const emptySubtext = document.getElementById('emptySubtext');

// Add/Edit Modal
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalClose = document.getElementById('modalClose');
const articuloForm = document.getElementById('articuloForm');
const articuloInput = document.getElementById('articuloInput');
const modalError = document.getElementById('modalError');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');

// Delete Modal
const deleteOverlay = document.getElementById('deleteOverlay');
const deleteItemName = document.getElementById('deleteItemName');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');

// Toast is now handled by utils.js showToast()

// =============================================
//  Utility Functions (shared ones in utils.js)
// =============================================

function showModalError(msg) {
    modalError.textContent = msg;
    modalError.classList.add('visible');
}

function clearModalError() {
    modalError.textContent = '';
    modalError.classList.remove('visible');
}

function switchScreen(screenId) {
    [accessDeniedScreen, notLoggedScreen, articulosScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// =============================================
//  Auth Check
// =============================================

// loadSession now comes from utils.js

/**
 * Verify user session and check admin role
 */
async function verifyAdmin() {
    const session = loadSession();

    if (!session || !session.id) {
        switchScreen('notLoggedScreen');
        return null;
    }

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/rpc/validar_sesion_fabricacion`,
            { method: 'POST', headers: HEADERS, body: JSON.stringify({ p_id: session.id }) }
        );

        if (!res.ok) throw new Error('Error de conexión');

        const users = await res.json();
        if (users.length === 0) {
            switchScreen('notLoggedScreen');
            return null;
        }

        const user = users[0];

        if (user.rol !== 'administrador') {
            deniedUserInfo.textContent = `Sesión: ${user.usuario} (${user.rol})`;
            switchScreen('accessDeniedScreen');
            return null;
        }

        return user;
    } catch (e) {
        console.error('Auth error:', e);
        switchScreen('notLoggedScreen');
        return null;
    }
}

// =============================================
//  API Functions
// =============================================

async function fetchArticulos() {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/articulos?select=ARTICULO&order=ARTICULO.asc`,
        { headers: HEADERS }
    );
    if (!res.ok) throw new Error('Error al cargar artículos');
    return res.json();
}

async function createArticulo(nombre) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/articulos`,
        {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ ARTICULO: nombre })
        }
    );
    if (!res.ok) {
        const body = await res.text();
        if (body.includes('duplicate') || body.includes('unique') || body.includes('already exists') || body.includes('23505')) {
            throw new Error('DUPLICADO');
        }
        throw new Error('Error al crear artículo');
    }
    return res.json();
}

async function updateArticulo(oldName, newName) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/articulos?ARTICULO=eq.${encodeURIComponent(oldName)}`,
        {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ ARTICULO: newName })
        }
    );
    if (!res.ok) {
        const body = await res.text();
        if (body.includes('duplicate') || body.includes('unique') || body.includes('23505')) {
            throw new Error('DUPLICADO');
        }
        throw new Error('Error al actualizar artículo');
    }
    return res.json();
}

async function deleteArticulo(nombre) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/articulos?ARTICULO=eq.${encodeURIComponent(nombre)}`,
        {
            method: 'DELETE',
            headers: HEADERS
        }
    );
    if (!res.ok) throw new Error('Error al eliminar artículo');
    return true;
}

// =============================================
//  Render
// =============================================

function renderArticulos(articulos) {
    articulosList.innerHTML = '';

    if (articulos.length === 0) {
        articulosList.style.display = 'none';
        emptyState.classList.add('visible');
        emptySubtext.textContent = searchInput.value
            ? `No hay resultados para "${searchInput.value}"`
            : 'Agrega tu primer artículo';
        return;
    }

    articulosList.style.display = 'flex';
    emptyState.classList.remove('visible');

    articulos.forEach((art, index) => {
        const name = art.ARTICULO;
        const row = document.createElement('div');
        row.className = 'articulo-row';
        row.style.animationDelay = `${index * 0.02}s`;

        // Check if name has a tag like (MP)
        const tagMatch = name.match(/\(([^)]+)\)\s*$/);
        let displayName = name;
        if (tagMatch) {
            displayName = name.replace(tagMatch[0], '').trim();
        }
        row.innerHTML = `
            <span class="articulo-index">${index + 1}</span>
            <span class="articulo-name">${escapeHtml(displayName)}${tagMatch ? `<span class="articulo-tag">${escapeHtml(tagMatch[1])}</span>` : ''}</span>
            <div class="articulo-actions">
                <button class="btn-art-action btn-art-edit" title="Editar" data-name="${encodeURIComponent(name)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn-art-action btn-art-delete" title="Eliminar" data-name="${encodeURIComponent(name)}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
            </div>
        `;

        articulosList.appendChild(row);
    });

    // Attach event listeners
    articulosList.querySelectorAll('.btn-art-edit').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = decodeURIComponent(btn.dataset.name);
            openEditModal(name);
        });
    });

    articulosList.querySelectorAll('.btn-art-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = decodeURIComponent(btn.dataset.name);
            openDeleteModal(name);
        });
    });
}

function filterAndRender() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = query
        ? allArticulos.filter(a => a.ARTICULO.toLowerCase().includes(query))
        : allArticulos;
    renderArticulos(filtered);
}

// =============================================
//  Load Data
// =============================================

async function loadArticulos() {
    try {
        allArticulos = await fetchArticulos();
        totalArticulos.textContent = allArticulos.length;
        filterAndRender();
    } catch (err) {
        console.error('Error loading articulos:', err);
        showToast('error', 'Error', 'No se pudieron cargar los artículos');
    }
}

// =============================================
//  Search
// =============================================

searchInput.addEventListener('input', () => {
    const hasValue = searchInput.value.length > 0;
    searchClear.classList.toggle('hidden', !hasValue);
    filterAndRender();
});

searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.add('hidden');
    searchInput.focus();
    filterAndRender();
});

// =============================================
//  Add/Edit Modal
// =============================================

function openAddModal() {
    editingArticulo = null;
    modalTitle.textContent = '➕ Nuevo Artículo';
    articuloInput.value = '';
    clearModalError();
    modalOverlay.classList.remove('hidden');
    setTimeout(() => articuloInput.focus(), 100);
}

function openEditModal(name) {
    editingArticulo = name;
    modalTitle.textContent = '✏️ Editar Artículo';
    articuloInput.value = name;
    clearModalError();
    modalOverlay.classList.remove('hidden');
    setTimeout(() => {
        articuloInput.focus();
        articuloInput.select();
    }, 100);
}

function closeModal() {
    modalOverlay.classList.add('hidden');
    editingArticulo = null;
    clearModalError();
    modalSaveBtn.classList.remove('loading');
}

addBtn.addEventListener('click', openAddModal);
modalClose.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

articuloForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearModalError();

    const nombre = articuloInput.value.trim().toUpperCase();
    if (!nombre) {
        showModalError('Ingresa un nombre para el artículo');
        return;
    }

    modalSaveBtn.classList.add('loading');

    try {
        if (editingArticulo) {
            // Editing
            if (nombre === editingArticulo) {
                closeModal();
                return;
            }
            await updateArticulo(editingArticulo, nombre);
            showToast('success', '¡Actualizado!', `${nombre}`);
        } else {
            // Adding
            await createArticulo(nombre);
            showToast('success', '¡Agregado!', `${nombre}`);
        }

        closeModal();
        await loadArticulos();
    } catch (err) {
        if (err.message === 'DUPLICADO') {
            showModalError('❌ Ya existe un artículo con ese nombre');
        } else {
            console.error('Save error:', err);
            showModalError('❌ Error al guardar. Intenta de nuevo.');
        }
        modalSaveBtn.classList.remove('loading');
    }
});

// =============================================
//  Delete Modal
// =============================================

let deletingName = null;

function openDeleteModal(name) {
    deletingName = name;
    deleteItemName.textContent = name;
    deleteOverlay.classList.remove('hidden');
}

function closeDeleteModal() {
    deleteOverlay.classList.add('hidden');
    deletingName = null;
}

deleteCancelBtn.addEventListener('click', closeDeleteModal);
deleteOverlay.addEventListener('click', (e) => {
    if (e.target === deleteOverlay) closeDeleteModal();
});

deleteConfirmBtn.addEventListener('click', async () => {
    if (!deletingName) return;

    try {
        await deleteArticulo(deletingName);
        showToast('success', '¡Eliminado!', `${deletingName}`);
        closeDeleteModal();
        await loadArticulos();
    } catch (err) {
        console.error('Delete error:', err);
        showToast('error', 'Error', 'No se pudo eliminar el artículo');
        closeDeleteModal();
    }
});

// =============================================
//  Keyboard Shortcuts
// =============================================

document.addEventListener('keydown', (e) => {
    // Escape to close modals
    if (e.key === 'Escape') {
        if (!modalOverlay.classList.contains('hidden')) closeModal();
        if (!deleteOverlay.classList.contains('hidden')) closeDeleteModal();
    }

    // Ctrl+N to add new
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (modalOverlay.classList.contains('hidden') && !articulosScreen.classList.contains('hidden')) {
            openAddModal();
        }
    }

    // Ctrl+F or / to focus search
    if (e.key === '/' && document.activeElement !== searchInput && document.activeElement !== articuloInput) {
        e.preventDefault();
        searchInput.focus();
    }
});

// =============================================
//  Initialization
// =============================================

async function init() {
    const user = await verifyAdmin();
    if (!user) return;

    currentUser = user;
    displayUserName.textContent = user.usuario;

    await loadArticulos();
    switchScreen('articulosScreen');
}

init();
