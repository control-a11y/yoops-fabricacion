/* ============================================
   YOOPS - Fabricación de Yogurt
   Application Logic with Auth + Custom IDs
   (config.js + utils.js loaded before this file)
   ============================================ */

let saborCombo = null;

// --- Local code mapping ---
const LOCAL_CODE_MAP = {
    'Plaza Numa':      'PN',
    'Grand Plaza':     'GP',
    'Rio de Piedras':  'RP',
    'Laboratorio':     'LAB'
};

// --- Known locales from the DB ---
let LOCALES = [];

// --- Current user session ---
let currentUser = null;

// =============================================
//  DOM Elements
// =============================================

// Screens
const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const selectLocalScreen = document.getElementById('selectLocalScreen');
const appScreen = document.getElementById('appScreen');

// Login
const loginForm = document.getElementById('loginForm');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const togglePass = document.getElementById('togglePass');
const showRegisterBtn = document.getElementById('showRegisterBtn');

// Register
const registerForm = document.getElementById('registerForm');
const regUser = document.getElementById('regUser');
const regPass = document.getElementById('regPass');
const regLocal = document.getElementById('regLocal');
const registerBtn = document.getElementById('registerBtn');
const registerError = document.getElementById('registerError');
const showLoginBtn = document.getElementById('showLoginBtn');

// Select Local
const selectLocalForm = document.getElementById('selectLocalForm');
const assignLocal = document.getElementById('assignLocal');
const selectLocalError = document.getElementById('selectLocalError');
const selectLocalUserName = document.getElementById('selectLocalUserName');

// App
const fabricacionForm = document.getElementById('fabricacionForm');
const saborInput = document.getElementById('saborInput');
const saborValue = document.getElementById('saborValue');
const pesoInput = document.getElementById('pesoInput');
const submitBtn = document.getElementById('submitBtn');
const recordsBody = document.getElementById('recordsBody');
const emptyState = document.getElementById('emptyState');
const recordsTable = document.getElementById('recordsTable');
const refreshBtn = document.getElementById('refreshBtn');
const todayCount = document.getElementById('todayCount');
const displayUserName = document.getElementById('displayUserName');
const displayUserLocal = document.getElementById('displayUserLocal');
const logoutBtn = document.getElementById('logoutBtn');

// Toast is now handled by utils.js showToast()

// =============================================
//  Utility Functions (shared ones in utils.js)
// =============================================

function switchScreen(screenId) {
    [loginScreen, registerScreen, selectLocalScreen, appScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// =============================================
//  ID Generation: FAB-{LOCAL}-{SABOR}-{DDMMYY}-{SEQ}
// =============================================

/**
 * Get the local code from the local name
 */
function getLocalCode(localName) {
    return LOCAL_CODE_MAP[localName] || localName.substring(0, 2).toUpperCase();
}

/**
 * Get the sabor code
 */
function getSaborCode(sabor) {
    const info = SABOR_MAP[sabor];
    return info ? info.code : sabor.substring(0, 3).toUpperCase();
}

/**
 * Generate the next sequential ID for a given local + sabor + date
 * Queries existing records to find the next number
 */
async function generateFabId(localName, sabor) {
    const localCode = getLocalCode(localName);
    const saborCode = getSaborCode(sabor);
    const dateStr = getDateForId();

    // The prefix to search for: FAB-PN-NAT-190626
    const prefix = `FAB-${localCode}-${saborCode}-${dateStr}`;

    // Query existing records with this prefix to find the max sequence number
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/fabricacion_yogurt?id_fab=like.${encodeURIComponent(prefix + '%')}&select=id_fab&order=id_fab.desc&limit=1`,
            { headers: HEADERS }
        );

        if (res.ok) {
            const records = await res.json();
            if (records.length > 0 && records[0].id_fab) {
                // Extract the sequence number from the last ID
                const lastId = records[0].id_fab;
                const parts = lastId.split('-');
                const lastSeq = parseInt(parts[parts.length - 1], 10) || 0;
                return `${prefix}-${String(lastSeq + 1).padStart(2, '0')}`;
            }
        }
    } catch (e) {
        console.error('Error querying for next ID:', e);
    }

    // First record with this prefix
    return `${prefix}-01`;
}

// =============================================
//  Locales
// =============================================

async function loadLocales() {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/locales?activo=eq.true&select=id,nombre&order=nombre.asc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('Error al cargar locales');
        LOCALES = await res.json();
    } catch (e) {
        console.error('Error loading locales:', e);
        LOCALES = [
            { id: '1', nombre: 'Plaza Numa' },
            { id: '2', nombre: 'Grand Plaza' },
            { id: '3', nombre: 'Rio de Piedras' },
            { id: '4', nombre: 'Laboratorio' }
        ];
    }

    populateLocalSelect(regLocal);
    populateLocalSelect(assignLocal);
}

function populateLocalSelect(selectEl) {
    while (selectEl.options.length > 1) selectEl.remove(1);
    LOCALES.forEach(local => {
        const opt = document.createElement('option');
        opt.value = local.nombre;
        opt.textContent = `📍 ${local.nombre}`;
        selectEl.appendChild(opt);
    });
}

function isValidLocal(nombreLocal) {
    return LOCALES.some(l => l.nombre === nombreLocal);
}

// =============================================
//  Auth / Session
// =============================================

function saveSessionLocal(user) {
    currentUser = user;
    saveSession(user);
}

function clearSessionLocal() {
    currentUser = null;
    clearSession();
}

async function loginUser_api(usuario, contrasena) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?usuario=eq.${encodeURIComponent(usuario)}&contrasena=eq.${encodeURIComponent(contrasena)}&activo=eq.true&select=*`,
        { headers: HEADERS }
    );
    if (!res.ok) throw new Error('Error de conexión');
    const users = await res.json();
    if (users.length === 0) return null;
    return users[0];
}

async function registerUser_api(usuario, contrasena, nombre_local) {
    const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?usuario=eq.${encodeURIComponent(usuario)}&select=id`,
        { headers: HEADERS }
    );
    if (!checkRes.ok) throw new Error('Error de conexión');
    const existing = await checkRes.json();
    if (existing.length > 0) throw new Error('USUARIO_EXISTE');

    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios`,
        {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ usuario, contrasena, nombre_local, activo: true })
        }
    );
    if (!res.ok) throw new Error('Error al crear usuario');
    const result = await res.json();
    return result[0];
}

async function updateUserLocal(userId, nombre_local) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${userId}`,
        {
            method: 'PATCH',
            headers: HEADERS,
            body: JSON.stringify({ nombre_local })
        }
    );
    if (!res.ok) throw new Error('Error al actualizar local');
    const result = await res.json();
    return result[0];
}

// =============================================
//  Auth Flow
// =============================================

function enterApp(user) {
    saveSessionLocal(user);
    displayUserName.textContent = user.usuario;
    displayUserLocal.textContent = user.nombre_local;
    switchScreen('appScreen');

    // Show admin nav if user is admin
    const adminNav = document.getElementById('adminNav');
    if (user.rol === 'administrador') {
        adminNav.classList.remove('hidden');
    } else {
        adminNav.classList.add('hidden');
    }

    // Laboratorio: ocultar vistas de tienda (fabricación, topping, limpieza)
    const isLab = user.nombre_local === 'Laboratorio';
    const formCard = document.getElementById('formCard');
    const recordsSection = document.getElementById('recordsSection');
    const navTopping = document.getElementById('navTopping');
    const navLimpieza = document.getElementById('navLimpieza');

    if (isLab) {
        if (formCard) formCard.style.display = 'none';
        if (recordsSection) recordsSection.style.display = 'none';
        if (navTopping) navTopping.style.display = 'none';
        if (navLimpieza) navLimpieza.style.display = 'none';
    } else {
        if (formCard) formCard.style.display = '';
        if (recordsSection) recordsSection.style.display = '';
        if (navTopping) navTopping.style.display = '';
        if (navLimpieza) navLimpieza.style.display = '';
    }

    // Initialize sabor combobox
    if (!isLab && !saborCombo) {
        saborCombo = new SearchableCombo({
            inputEl: saborInput,
            valueEl: saborValue,
            dropdownEl: document.getElementById('saborDropdown'),
            listEl: document.getElementById('saborList'),
            containerId: 'saborCombobox',
            items: SABORES_DISPLAY
        });
    }

    if (!isLab) loadRecords();
}

// --- Login Form ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(loginError);

    const usuario = loginUser.value.trim();
    const contrasena = loginPass.value;

    if (!usuario || !contrasena) {
        showError(loginError, 'Ingresa usuario y contraseña');
        return;
    }

    loginBtn.classList.add('loading');

    try {
        const user = await loginUser_api(usuario, contrasena);
        if (!user) {
            showError(loginError, '❌ Usuario o contraseña incorrectos');
            return;
        }

        if (!isValidLocal(user.nombre_local)) {
            currentUser = user;
            selectLocalUserName.textContent = user.usuario;
            switchScreen('selectLocalScreen');
        } else {
            enterApp(user);
        }
    } catch (err) {
        console.error('Login error:', err);
        showError(loginError, '❌ Error de conexión. Intenta de nuevo.');
    } finally {
        loginBtn.classList.remove('loading');
    }
});

// --- Register Form ---
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(registerError);

    const usuario = regUser.value.trim();
    const contrasena = regPass.value;
    const nombre_local = regLocal.value;

    if (!usuario || !contrasena || !nombre_local) {
        showError(registerError, 'Completa todos los campos');
        return;
    }

    if (contrasena.length < 3) {
        showError(registerError, 'La contraseña debe tener al menos 3 caracteres');
        return;
    }

    registerBtn.classList.add('loading');

    try {
        const user = await registerUser_api(usuario, contrasena, nombre_local);
        showToast('success', '¡Cuenta creada!', `Bienvenido ${usuario}`);
        enterApp(user);
    } catch (err) {
        if (err.message === 'USUARIO_EXISTE') {
            showError(registerError, '❌ Ese usuario ya existe. Elige otro.');
        } else {
            console.error('Register error:', err);
            showError(registerError, '❌ Error al crear la cuenta. Intenta de nuevo.');
        }
    } finally {
        registerBtn.classList.remove('loading');
    }
});

// --- Select Local Form ---
selectLocalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError(selectLocalError);

    const nombre_local = assignLocal.value;
    if (!nombre_local) {
        showError(selectLocalError, 'Selecciona un local');
        return;
    }

    try {
        await updateUserLocal(currentUser.id, nombre_local);
        currentUser.nombre_local = nombre_local;
        showToast('success', '¡Local asignado!', `Ahora estás en ${nombre_local}`);
        enterApp(currentUser);
    } catch (err) {
        console.error('Update local error:', err);
        showError(selectLocalError, '❌ Error al asignar local. Intenta de nuevo.');
    }
});

// --- Toggle Password Visibility ---
togglePass.addEventListener('click', () => {
    const isPassword = loginPass.type === 'password';
    loginPass.type = isPassword ? 'text' : 'password';
    togglePass.querySelector('.eye-open').style.display = isPassword ? 'none' : 'block';
    togglePass.querySelector('.eye-closed').style.display = isPassword ? 'block' : 'none';
});

// --- Navigation ---
showRegisterBtn.addEventListener('click', () => {
    clearError(loginError);
    switchScreen('registerScreen');
});
showLoginBtn.addEventListener('click', () => {
    clearError(registerError);
    switchScreen('loginScreen');
});

// --- Logout ---
logoutBtn.addEventListener('click', () => {
    clearSessionLocal();
    loginUser.value = '';
    loginPass.value = '';
    clearError(loginError);
    switchScreen('loginScreen');
    showToast('success', 'Sesión cerrada', 'Hasta pronto 👋');
});

// =============================================
//  Fabrication Records
// =============================================

async function loadRecords() {
    try {
        const today = getTodayISO();
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/fabricacion_yogurt?fecha=eq.${today}&select=*&order=created_at.desc`,
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
        `${SUPABASE_URL}/rest/v1/fabricacion_yogurt`,
        { method: 'POST', headers: HEADERS, body: JSON.stringify(data) }
    );
    if (!res.ok) {
        const errorBody = await res.text();
        console.error('Supabase error:', errorBody);
        throw new Error('Error al crear registro');
    }
    return res.json();
}

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
        tr.style.animationDelay = `${index * 0.05}s`;
        const saborInfo = SABOR_MAP[record.sabor] || { emoji: '🍦', label: record.sabor };
        const displayId = record.id_fab || '—';

        tr.innerHTML = `
            <td><span class="id-badge" title="${escapeHtml(displayId)}">${escapeHtml(displayId)}</span></td>
            <td>
                <span class="sabor-badge sabor-${escapeHtml(record.sabor)}">
                    ${escapeHtml(saborInfo.emoji)} ${escapeHtml(saborInfo.label)}
                </span>
            </td>
            <td><span class="peso-value">${formatNumber(record.cantidad)}</span></td>
            <td>${escapeHtml(record.creado_por) || '—'}</td>
            <td><span class="hora-value">${formatTime(record.hora)}</span></td>
        `;
        recordsBody.appendChild(tr);
    });
}

// --- Fabrication Form ---
fabricacionForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saborDisplay = saborValue.value;
    const sabor = SABOR_REVERSE[saborDisplay] || saborDisplay;
    const cantidad = parseFloat(pesoInput.value);

    if (!sabor || !cantidad) {
        showToast('error', 'Campos incompletos', 'Selecciona un sabor e ingresa el peso');
        return;
    }

        // Check for duplicate sabor today
        const today = getTodayISO();
        try {
            const dupRes = await fetch(
                `${SUPABASE_URL}/rest/v1/fabricacion_yogurt?sabor=eq.${encodeURIComponent(sabor)}&local=eq.${encodeURIComponent(currentUser.nombre_local)}&fecha=eq.${today}&select=id`,
                { headers: HEADERS }
            );
            const existing = await dupRes.json();
            if (existing.length > 0) {
                showToast('error', 'Duplicado', `"${sabor}" ya fue registrado hoy`);

                return;
            }
        } catch (e) { console.error('Duplicate check failed:', e); }

    if (cantidad <= 0) {
        showToast('error', 'Peso inválido', 'El peso debe ser mayor a 0');
        return;
    }

    submitBtn.classList.add('loading');

    try {
        // Generate the custom ID
        const id_fab = await generateFabId(currentUser.nombre_local, sabor);

        const data = {
            id_fab,
            sabor,
            cantidad,
            local: currentUser.nombre_local,
            creado_por: currentUser.usuario
        };

        await createRecord(data);

        const saborInfo = SABOR_MAP[sabor] || { emoji: '🍦', label: sabor, code: 'UNK' };
        showToast('success', '¡Registrado!', `${id_fab} — ${saborInfo.emoji} ${formatNumber(cantidad)}g`);

        if (saborCombo) saborCombo.reset();
        pesoInput.value = '';
        pesoInput.focus();

        await loadRecords();
    } catch (err) {
        console.error('Error creating record:', err);
        showToast('error', 'Error', 'No se pudo crear el registro. Intenta de nuevo.');
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
//  Initialization
// =============================================

async function init() {
    await loadLocales();

    const session = loadSession();
    if (session && session.id && session.nombre_local) {
        try {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/usuarios?id=eq.${session.id}&activo=eq.true&select=*`,
                { headers: HEADERS }
            );
            if (res.ok) {
                const users = await res.json();
                if (users.length > 0) {
                    const user = users[0];
                    if (isValidLocal(user.nombre_local)) {
                        enterApp(user);
                        return;
                    } else {
                        currentUser = user;
                        selectLocalUserName.textContent = user.usuario;
                        switchScreen('selectLocalScreen');
                        return;
                    }
                }
            }
        } catch (e) {
            console.error('Session validation error:', e);
        }
        clearSessionLocal();
    }

    switchScreen('loginScreen');
}

init();
