/* ============================================
   YOOPS - Shared Utility Functions
   Included by all pages
   ============================================ */

// --- HTML Escaping (XSS Prevention) ---
function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// --- Toast Notifications ---
function showToast(type, title, message) {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastTitle = document.getElementById('toastTitle');
    const toastMessage = document.getElementById('toastMessage');
    toastIcon.textContent = type === 'success' ? '✅' : '❌';
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    toast.classList.remove('toast-error');
    if (type === 'error') toast.classList.add('toast-error');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// --- Formatting ---
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

// --- Date Utilities ---
function getTodayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getLocalTime() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function getTodayDisplay() {
    const now = new Date();
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return now.toLocaleDateString('es-MX', options);
}

function getDateDDMMYY() {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;
}

// --- Session Management ---
function loadSession() {
    const saved = localStorage.getItem('yoops_session');
    if (saved) {
        try { return JSON.parse(saved); }
        catch { return null; }
    }
    return null;
}

function saveSession(user) {
    localStorage.setItem('yoops_session', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('yoops_session');
}

// --- Session Verification ---
async function verifySession(user) {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/usuarios?usuario=eq.${encodeURIComponent(user.usuario)}&activo=eq.true&select=usuario,nombre_local,rol`,
            { headers: HEADERS }
        );
        const rows = await res.json();
        if (rows.length === 0) {
            clearSession();
            return null;
        }
        const verified = { ...user, ...rows[0] };
        saveSession(verified);
        return verified;
    } catch (e) {
        return user; // Network error — use cached session
    }
}

// --- Error Display ---
function showError(el, msg) {
    el.textContent = msg;
    el.classList.add('visible');
}

function clearError(el) {
    el.textContent = '';
    el.classList.remove('visible');
}
