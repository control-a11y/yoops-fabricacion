/* ============================================
   YOOPS - Supabase Configuration
   Shared across all pages
   ============================================ */

const SUPABASE_URL = 'https://wqnonkjdkplzzovedanr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indxbm9ua2pka3BsenpvdmVkYW5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwOTczMDcsImV4cCI6MjA5NjY3MzMwN30.h4mzHITI0cka8G8SlZEL1MfQjSLF7ZnWl0b3-2BCywQ';

const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

// --- Sabor mapping (shared across fabricacion + limpieza) ---
const SABOR_MAP = {
    natural: { emoji: '🥛', label: 'Natural', code: 'NAT' },
    taro:    { emoji: '🟣', label: 'Taro',    code: 'TAR' },
    carbon:  { emoji: '⚫', label: 'Carbón',  code: 'CAR' },
    vegano:  { emoji: '🌱', label: 'Vegano',  code: 'VEG' },
    asaid:   { emoji: '🫐', label: 'Açaí',    code: 'ACA' }
};

const SABORES_DISPLAY = Object.entries(SABOR_MAP).map(([key, info]) => `${info.emoji} ${info.label}`);
const SABOR_REVERSE = {};
Object.entries(SABOR_MAP).forEach(([key, info]) => { SABOR_REVERSE[`${info.emoji} ${info.label}`] = key; });
