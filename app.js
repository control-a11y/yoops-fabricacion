/* ============================================
   YOOPS - Panel Principal (Hub & Auth)
   Application Logic with Auth + Dashboard
   ============================================ */

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
const displayUserName = document.getElementById('displayUserName');
const displayUserLocal = document.getElementById('displayUserLocal');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const dashboardCard = document.getElementById('dashboardCard');
const dashboardGrid = document.getElementById('dashboardGrid');

// =============================================
//  Utility Functions
// =============================================

function switchScreen(screenId) {
    [loginScreen, registerScreen, selectLocalScreen, appScreen].forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
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

    // Ocultar/Mostrar elementos según rol
    const isLab = user.nombre_local === 'Laboratorio';
    const navFabricacion = document.getElementById('navFabricacion');
    const navTopping = document.getElementById('navTopping');
    const navLimpieza = document.getElementById('navLimpieza');

    if (isLab) {
        if (dashboardCard) dashboardCard.style.display = 'none';
        if (navFabricacion) navFabricacion.style.display = 'none';
        if (navTopping) navTopping.style.display = 'none';
        if (navLimpieza) navLimpieza.style.display = 'none';
    } else {
        if (dashboardCard) dashboardCard.style.display = '';
        if (navFabricacion) navFabricacion.style.display = '';
        if (navTopping) navTopping.style.display = '';
        if (navLimpieza) navLimpieza.style.display = '';
    }

    if (!isLab) {
        loadDashboard(user.nombre_local);
    }
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
//  Dashboard
// =============================================

async function loadDashboard(localName) {
    if (!dashboardGrid) return;
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/limpieza_v2?local=eq.${encodeURIComponent(localName)}&order=fecha.desc,hora.desc`,
            { headers: HEADERS }
        );
        if (!res.ok) throw new Error('Error al cargar inventario');
        const cleanings = await res.json();

        // Get the latest record for each flavor
        const latestBySabor = {};
        cleanings.forEach(c => {
            if (!latestBySabor[c.sabor]) {
                latestBySabor[c.sabor] = c;
            }
        });

        // Render each flavor in SABOR_MAP
        dashboardGrid.innerHTML = '';
        
        let hasData = false;
        Object.entries(SABOR_MAP).forEach(([key, info]) => {
            const cleaning = latestBySabor[key];
            if (cleaning) {
                hasData = true;
                const ext = parseFloat(cleaning.producto_extraido) || 0;
                const final = parseFloat(cleaning.mezcla_final) || 0;
                const total = ext + final;

                const item = document.createElement('div');
                item.className = 'dashboard-item';
                item.innerHTML = `
                    <span style="font-size: 1.5rem;">${escapeHtml(info.emoji)}</span>
                    <span class="dashboard-sabor">${escapeHtml(info.label)}</span>
                    <span class="dashboard-peso">${formatNumber(total)} g</span>
                `;
                dashboardGrid.appendChild(item);
            } else {
                const item = document.createElement('div');
                item.className = 'dashboard-item';
                item.style.opacity = '0.5';
                item.innerHTML = `
                    <span style="font-size: 1.5rem;">${escapeHtml(info.emoji)}</span>
                    <span class="dashboard-sabor">${escapeHtml(info.label)}</span>
                    <span class="dashboard-peso" style="color: var(--text-muted);">0 g</span>
                `;
                dashboardGrid.appendChild(item);
            }
        });

        if (!hasData) {
            dashboardGrid.innerHTML = '<div class="dashboard-empty">No hay registros de limpieza previos para este local</div>';
        }

    } catch (err) {
        console.error('Error loading dashboard:', err);
        dashboardGrid.innerHTML = '<div class="dashboard-empty">⚠️ Error al cargar el inventario del comienzo del día</div>';
    }
}

// --- Refresh ---
refreshBtn.addEventListener('click', async () => {
    refreshBtn.classList.add('spinning');
    if (currentUser && currentUser.nombre_local !== 'Laboratorio') {
        await loadDashboard(currentUser.nombre_local);
    }
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
