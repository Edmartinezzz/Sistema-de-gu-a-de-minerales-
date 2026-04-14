// Configuraci├â┬│n de API Din├â┬ímica para Previews y Producci├â┬│n
let API_BASE = '';
if (window.location.protocol === 'file:' || (window.location.hostname === 'localhost' && window.location.port !== '3000' && window.location.port !== '8080')) {
    // Si corre desde Android APK (file://) usamos la URL de producci├â┬│n
    API_BASE = 'https://sistema-de-gu-a-de-minerales.vercel.app/api';
} else {
    // Si corre en la web (Vercel Prod, Vercel Previews, Localhost), usamos el origen relativo
    API_BASE = window.location.origin + '/api';
}
let currentUser = null;
let authToken = null;
let tasaBCV = 36.50; // Tasa por defecto
let systemConfig = {
    modulo_pagos_habilitado: 'false'
};

// Variable global para el esc├â┬íner
let html5QrCode = null;

// ===== INICIALIZACI├âÔÇ£N =====
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar si hay token guardado
    authToken = localStorage.getItem('authToken');

    if (authToken) {
        // Cargar configuraci├â┬│n solo si hay token
        await Promise.all([
            refreshTasaBCV(),
            refreshSystemConfig()
        ]);
        verifyToken();
    } else {
        showPage('login-page');
    }

    // Event Listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // QR Scanner Listeners
    const btnScan = document.getElementById('btn-scan-qr');
    if (btnScan) btnScan.addEventListener('click', startScanner);
    
    const btnStopScan = document.getElementById('btn-stop-scan');
    if (btnStopScan) btnStopScan.addEventListener('click', stopScanner);

    // Notification Toggle
    const notifBtn = document.getElementById('notification-btn');
    if (notifBtn) {
        notifBtn.addEventListener('click', toggleNotifications);
    }

    // Close notifications on click outside
    document.addEventListener('click', (e) => {
        const popover = document.getElementById('notification-popover');
        const btn = document.getElementById('notification-btn');
        if (popover && popover.classList.contains('active') && btn && !popover.contains(e.target) && !btn.contains(e.target)) {
            popover.classList.remove('active');
        }
    });

    // Navigation handlers
    setupNavigation();

    // Mobile menu toggle
    const menuToggle = document.getElementById('menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }
});

// ===== NAVEGACI├âÔÇ£N =====
function setupNavigation() {
    // Observer for dynamically added links
    const navContainer = document.getElementById('sidebar-nav');
    if (navContainer) {
        navContainer.addEventListener('click', (e) => {
            const link = e.target.closest('.nav-link');
            if (link) {
                // Si tiene onclick, dejar que act├â┬║e
                if (link.getAttribute('onclick')) return;

                if (link.dataset.section) {
                    e.preventDefault();
                    const section = link.dataset.section;
                    navigateToSection(section);
                }
            }
        });
    }

    // Mobile navigation
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) {
                navigateToSection(section);
            }
        });
    });

    // Sidebar User Profile Click
    const sidebarUser = document.querySelector('.sidebar-user');
    if (sidebarUser) {
        sidebarUser.style.cursor = 'pointer';
        sidebarUser.addEventListener('click', () => {
            if (currentUser && currentUser.role === 'empresa') {
                navigateToSection('perfil');
            }
        });
    }
}

function renderSidebar(role) {
    const navContainer = document.getElementById('sidebar-nav');
    if (!navContainer) return;

    let menuHtml = '';

    if (role === 'master') {
        // MEN├â┼í ADMINISTRADOR (MASTER)
        menuHtml = `
            <div class="nav-item">
                <a href="#" class="nav-link active" data-section="inicio">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span>Panel General</span>
                </a>
            </div>
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="guias">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span>Todas las Gu├â┬¡as</span>
                </a>
            </div>
            ${systemConfig.modulo_pagos_habilitado === 'true' ? `
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="pagos">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    <span>Pagos por Verificar</span>
                    <span class="nav-badge" id="pagos-badge" style="display: none;">0</span>
                </a>
            </div>
            ` : ''}
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="mapa">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
                    <span>Monitor Satelital</span>
                </a>
            </div>
            
            ${systemConfig.modulo_pagos_habilitado === 'true' ? `
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="deudas">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span>Deudas y Recargos</span>
                </a>
            </div>
            ` : ''}
            
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="usuarios">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    <span>Crear Empresa</span>
                </a>
            </div>

            <div class="nav-item">
                <a href="#" class="nav-link" data-section="minerales">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2l-5.5 9h11L12 2z"/>
                        <path d="M6 11l-4 7h11l-7-7z"/>
                        <path d="M18 11l4 7h-11l7-7z"/>
                        <path d="M12 22v-4"/>
                    </svg>
                    <span>Gesti├â┬│n de Minerales</span>
                </a>
            </div>
            
            <div class="nav-divider" style="height: 1px; background: rgba(0,0,0,0.1); margin: 10px 0;"></div>
        `;
    } else if (role === 'fiscalizador') {
        // MEN├â┼í FISCALIZADOR
        menuHtml = `
            <div class="nav-item">
                <a href="#" class="nav-link active" data-section="inicio">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span>Fiscalizaci├â┬│n</span>
                </a>
            </div>
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="perfil">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>Seguridad</span>
                </a>
            </div>
            <div class="nav-divider" style="height: 1px; background: rgba(0,0,0,0.1); margin: 10px 0;"></div>
        `;
    } else {
        // MEN├â┼í EMPRESA
        menuHtml = `
            <div class="nav-item">
                <a href="#" class="nav-link active" data-section="inicio">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span>Mi Panel</span>
                </a>
            </div>
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="guias">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    <span>Mis Gu├â┬¡as</span>
                </a>
            </div>
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="solicitar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <span>Solicitar Gu├â┬¡a</span>
                </a>
            </div>
            ${systemConfig.modulo_pagos_habilitado === 'true' ? `
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="pagos">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    <span>Mis Pagos</span>
                </a>
            </div>
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="deudas">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span>Mis Deudas</span>
                </a>
            </div>
            ` : ''}
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="perfil">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>Perfil</span>
                </a>
            </div>
            <div class="nav-divider" style="height: 1px; background: rgba(0,0,0,0.1); margin: 10px 0;"></div>
            <!-- 
            <div class="nav-item">
                <a href="#" class="nav-link" data-section="chofer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                    <span>Modo Chofer (Ruta)</span>
                </a>
            </div>
            -->
        `;
    }

    navContainer.innerHTML = menuHtml;
}

// Variables globales para Tracking
let trackingInterval = null;
let mapInstance = null;

function navigateToSection(section) {
    // Update active states
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.section === section);
    });

    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    // Detener tracking si salimos del modo chofer (opcional, pero mejor dejarlo activo si se quiere background)
    // if (section !== 'chofer' && trackingInterval) { ... } 

    // Update breadcrumb
    updateBreadcrumb(section);

    // Load section content
    loadSectionContent(section);

    // Close sidebar on mobile
    if (window.innerWidth <= 1024) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            toggleSidebar();
        }
    }
}

function updateBreadcrumb(section) {
    const breadcrumb = document.getElementById('breadcrumb');
    const sectionNames = {
        'inicio': 'Inicio',
        'guias': 'Mis Gu├â┬¡as',
        'solicitar': 'Solicitar Gu├â┬¡a',
        'pagos': 'Pagos',
        'deudas': 'Deudas y Recargos',
        'historial': 'Historial',
        'admin': 'Administraci├â┬│n',
        'minerales': 'Gesti├â┬│n de Minerales'
    };

    breadcrumb.innerHTML = `
        <div class="breadcrumb-item">
            <a href="#" onclick="navigateToSection('inicio'); return false;">Inicio</a>
        </div>
        ${section !== 'inicio' ? `
            <span class="breadcrumb-separator">├óÔé¼┬║</span>
            <div class="breadcrumb-item">
                <span>${sectionNames[section] || section}</span>
            </div>
        ` : ''}
    `;
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function loadSectionContent(section) {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    switch (section) {
        case 'inicio':
            if (currentUser && currentUser.role === 'fiscalizador') {
                renderDashboardFiscalizador(content);
            } else {
                loadDashboard(content);
            }
            break;
        case 'guias':
            loadGuiasSection(content);
            break;
        case 'solicitar':
            if (currentUser.role === 'fiscalizador') {
                content.innerHTML = '<div class="error-message">Acceso denegado</div>';
            } else {
                mostrarFormularioGuia();
                if (document.querySelectorAll('.nav-link.active').length === 0) {
                    loadDashboard(content);
                }
            }
            break;
        case 'pagos':
            loadPagosSection(content);
            break;
        case 'perfil':
            renderCambiarClave(content);
            break;
        case 'admin':
            if (currentUser.role === 'master') {
                loadAdminDashboard(content);
            } else {
                content.innerHTML = '<div class="error-message">Acceso denegado</div>';
            }
            break;
        case 'usuarios':
            if (currentUser.role === 'master') {
                renderUsuarios(content);
            } else {
                content.innerHTML = '<div class="error-message">Acceso denegado</div>';
            }
            break;
        case 'minerales':
            if (currentUser.role === 'master') {
                renderMinerales(content);
            } else {
                content.innerHTML = '<div class="error-message">Acceso denegado</div>';
            }
            break;
        case 'chofer':
            loadChoferMode(content);
            break;
        case 'mapa':
            loadMasterMap(content);
            break;
        case 'confirmaciones':
            loadConfirmacionesSection(content);
            break;
        case 'deudas':
            loadDeudasSection(content);
            break;
        case 'usuarios':
            if (currentUser.role === 'master') {
                renderUsuarios(content);
            } else {
                content.innerHTML = '<div class="error-message">Acceso denegado</div>';
            }
            break;
        default:
            loadDashboard();
    }
}

// ===== AUTENTICACI├âÔÇ£N =====
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('login-error');

    errorDiv.style.display = 'none';
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);

            showPage('dashboard-page');
            
            // Redirigir seg├â┬║n rol
            if (currentUser.role === 'empresa_destinataria') {
                loadConfirmacionPage();
            } else if (currentUser.role === 'fiscalizador') {
                navigateToSection('inicio');
            } else {
                loadDashboard();
            }
        } else {
            errorDiv.textContent = data.error || 'Error al iniciar sesi├â┬│n';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error de conexi├â┬│n. Intente nuevamente.';
        errorDiv.style.display = 'block';
    } finally {
        showLoading(false);
    }
}

async function verifyToken() {
    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            showPage('dashboard-page');

            // Redirigir seg├â┬║n rol
            if (currentUser.role === 'empresa_destinataria') {
                loadConfirmacionPage();
            } else if (currentUser.role === 'fiscalizador') {
                navigateToSection('inicio');
            } else {
                loadDashboard();
            }
        } else {
            localStorage.removeItem('authToken');
            authToken = null;
            showPage('login-page');
        }
    } catch (error) {
        localStorage.removeItem('authToken');
        authToken = null;
        showPage('login-page');
    } finally {
        showLoading(false);
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
    } catch (error) {
        console.error('Error al cerrar sesi├â┬│n:', error);
    }

    // Restaurar visibilidad de elementos UI antes de cerrar sesi├â┬│n
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('.top-header');
    const mobileNav = document.querySelector('.mobile-nav');
    if (sidebar) sidebar.style.display = '';
    if (header) header.style.display = '';
    if (mobileNav) mobileNav.style.display = '';

    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    showPage('login-page');
    document.getElementById('login-form').reset();
}

// ===== DASHBOARD =====
async function loadDashboard() {
    // Si es empresa_destinataria, cargar su p├â┬ígina espec├â┬¡fica
    if (currentUser.role === 'empresa_destinataria') {
        loadConfirmacionPage();
        return;
    }

    // Asegurar que sidebar y header est├â┬®n visibles (pueden haberse ocultado)
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('.top-header');
    const mobileNav = document.querySelector('.mobile-nav');
    if (sidebar) sidebar.style.display = '';
    if (header) header.style.display = '';
    if (mobileNav) mobileNav.style.display = '';

    // Update user info in sidebar
    const avatar = document.getElementById('user-avatar');
    const username = document.getElementById('sidebar-username');
    const role = document.getElementById('sidebar-role');

    if (avatar && username && role) {
        avatar.textContent = currentUser.username.charAt(0).toUpperCase();
        username.textContent = currentUser.username;
        role.textContent = currentUser.role === 'master' ? 'Administrador' : currentUser.empresa_nombre;
    }

    // Render sidebar based on role
    renderSidebar(currentUser.role);

    const dashboardContent = document.getElementById('dashboard-content');

    if (currentUser.role === 'master') {
        await loadMasterDashboard(dashboardContent);
    } else {
        await loadEmpresaDashboard(dashboardContent);
    }
}

async function loadMasterDashboard(container) {
    showLoading(true);

    try {
        // Cargar estad├â┬¡sticas
        const statsResponse = await apiRequest('/reportes/estadisticas');
        const stats = statsResponse.estadisticas;

        // Cargar pagos pendientes
        const pagosResponse = await apiRequest('/pagos/pendientes');
        const pagosPendientes = pagosResponse.pagos;

        // Cargar gu├â┬¡as recientes (aumentado para admin)
        const guiasResponse = await apiRequest('/guias?limit=50');
        const guias = guiasResponse.guias;

        // Update notification badges
        updateNotificationBadge(stats.pagos_pendientes);

        // Guardar datos para el modal de ingresos
        window.lastDashboardStats = stats;

        container.innerHTML = `
            <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; margin-bottom: 30px;">
                <div>
                    <h1 class="dashboard-title">Panel de Administraci├â┬│n</h1>
                    <p class="dashboard-subtitle">Control de minerales del Estado La Guaira</p>
                    <button class="btn btn-danger btn-sm" onclick="purgarSistema()" style="margin-top: 10px; background: #dc3545; border: none; font-weight: 600; padding: 8px 15px; border-radius: 8px; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 10px rgba(220, 53, 69, 0.2);">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        Purgar Sistema
                    </button>
                </div>
                
                <div class="card" style="margin: 0; padding: 15px 25px; border-left: 4px solid #6f42c1; display: flex; align-items: center; gap: 20px; background: white; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 14px; font-weight: 700; color: #333;">M├â┬│dulo de Pagos y Cobranzas</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${systemConfig.modulo_pagos_habilitado === 'true' ? '#27ae60' : '#e74c3c'};"></span>
                            <span style="font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase;">${systemConfig.modulo_pagos_habilitado === 'true' ? 'Activado' : 'Desactivado'}</span>
                        </div>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-pagos" ${systemConfig.modulo_pagos_habilitado === 'true' ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>

            <div class="stats-grid">
                <div class="stat-card stat-primary">
                    <div class="stat-header">
                        <h3 class="stat-title">Empresas Activas</h3>
                        <div class="stat-icon">├░┼©┬Å┬ó</div>
                    </div>
                    <div class="stat-value">${stats.empresas_activas}</div>
                    <div class="stat-change">Empresas registradas</div>
                </div>
                
                ${systemConfig.modulo_pagos_habilitado === 'true' ? `
                <div class="stat-card stat-warning">
                    <div class="stat-header">
                        <h3 class="stat-title">Pagos Pendientes</h3>
                        <div class="stat-icon">├ó┬Å┬│</div>
                    </div>
                    <div class="stat-value">${stats.pagos_pendientes}</div>
                    <div class="stat-change">Pendientes de verificaci├â┬│n</div>
                </div>
                ` : ''}

                <div class="stat-card stat-info">
                    <div class="stat-header">
                        <h3 class="stat-title">Gu├â┬¡as Este Mes</h3>
                        <div class="stat-icon">├░┼©ÔÇ£ÔÇ×</div>
                    </div>
                    <div class="stat-value">${stats.guias_mes}</div>
                    <div class="stat-change">Gu├â┬¡as emitidas</div>
                </div>

                ${systemConfig.modulo_pagos_habilitado === 'true' ? `
                <div class="stat-card stat-success" id="income-stat-card" onclick="mostrarDetalleIngresos()" style="cursor: pointer; position: relative; transition: all 0.3s ease;">
                    <div class="stat-header">
                        <h3 class="stat-title" id="income-stat-title">Ingresos del Mes</h3>
                        <div class="stat-icon">├░┼©ÔÇÖ┬░</div>
                    </div>
                    <div class="stat-value" id="income-stat-value">Bs. ${formatNumber(stats.ingresos_mes)}</div>
                    <div class="stat-change" id="income-stat-footer">Ver desglose detallado</div>
                    <div style="position: absolute; top: 10px; right: 10px; font-size: 10px; background: rgba(255,255,255,0.5); padding: 2px 6px; border-radius: 10px; color: var(--system-green); font-weight: 700;">├░┼©ÔÇ£┼á VER M├â┬üS</div>
                </div>
                ` : ''}
            </div>



            <!-- CONTROL DE TASA BCV -->
            <div class="card" style="background: #f0f7ff; border: 1px solid #cce5ff; margin-bottom: 25px;">
                <div class="card-body" style="display: flex; align-items: center; justify-content: space-between; padding: 15px 20px;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <div style="font-size: 24px;">├░┼©ÔÇ£╦å</div>
                        <div>
                            <h3 style="margin: 0; font-size: 16px; color: #004085;">Control de Tasa BCV</h3>
                            <p style="margin: 0; font-size: 13px; color: #004085; opacity: 0.8;">Tasa actual en el sistema: <strong id="current-tasa-display">${tasaBCV.toFixed(2)}</strong> Bs/$</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="manual-tasa-input" class="form-control" step="0.01" value="${tasaBCV}" style="width: 120px; font-weight: 600;">
                        <button class="btn btn-primary" onclick="actualizarTasaManual()">Actualizar Tasa</button>
                    </div>
                </div>
            </div>

            ${systemConfig.modulo_pagos_habilitado === 'true' && pagosPendientes.length > 0 ? `
                <div class="card" style="background: white; border-radius: 16px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                    <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h2 class="card-title" style="font-size: 18px; font-weight: 600;">Pagos Pendientes de Verificaci├â┬│n</h2>
                        <span class="badge badge-warning">${pagosPendientes.length} pendiente(s)</span>
                    </div>
                    <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Gu├â┬¡a</th>
                                <th>Empresa</th>
                                <th>Monto</th>
                                <th>Banco</th>
                                <th>Referencia</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pagosPendientes.map(pago => `
                                <tr>
                                    <td data-label="Gu├â┬¡a">${formatNumeroGuia(pago.numero_guia)}</td>
                                    <td data-label="Empresa">${pago.empresa_nombre}</td>
                                    <td data-label="Monto">Bs. ${formatNumber(pago.monto)}</td>
                                    <td data-label="Banco">${pago.banco}</td>
                                    <td data-label="Referencia">${pago.numero_referencia}</td>
                                    <td data-label="Acciones">
                                        <button class="btn btn-success btn-sm" onclick="verificarPago('${pago.id}')">Verificar</button>
                                        <button class="btn btn-danger btn-sm" onclick="rechazarPago('${pago.id}')">Rechazar</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>
                </div>
            ` : '<div class="info-message">├ó┼ôÔÇ£ No hay pagos pendientes de verificaci├â┬│n.</div>'}

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">├░┼©ÔÇ£ÔÇ╣ Gu├â┬¡as Recientes</h2>
                    <button class="btn btn-primary btn-sm" onclick="navigateToSection('guias')">Ver Todas</button>
                </div>
                <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>N├â┬║mero</th>
                            <th>Empresa</th>
                            <th>Mineral</th>
                            <th>Observaci├â┬│n</th>
                            <th>Estado</th>
                            ${systemConfig.modulo_pagos_habilitado === 'true' ? '<th>Pendiente</th>' : ''}
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${guias.map(guia => {
                            const pendiente = Math.max(0, (parseFloat(guia.monto_pagar) + parseFloat(guia.recargo_mora || 0)) - parseFloat(guia.monto_pagado || 0));
                            return `
                                <tr>
                                    <td data-label="N├â┬║mero">${guia.numero_guia}</td>
                                    <td data-label="Empresa">${guia.empresa_nombre}</td>
                                    <td data-label="Mineral">${guia.tipo_mineral}</td>
                                    <td data-label="Observaci├â┬│n">
                                        <div style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: #666;" title="${guia.observaciones || ''}">
                                            ${guia.observaciones || '<span style="color:#ccc;">Sin obs.</span>'}
                                        </div>
                                    </td>
                                    <td data-label="Estado">${getEstadoBadge(guia.estado)}</td>
                                    ${systemConfig.modulo_pagos_habilitado === 'true' ? `
                                    <td data-label="Pendiente" style="font-weight: 700; color: ${pendiente > 0 ? '#e74c3c' : '#27ae60'};">
                                        ${pendiente > 0 ? `Bs. ${formatNumber(pendiente)}` : 'Saldado'}
                                    </td>
                                    ` : ''}
                                    <td data-label="Acciones">
                                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                            ${guia.estado === 'activa' ? `
                                                <button class="btn btn-warning btn-sm" onclick="marcarUsada('${guia.id}')" style="padding: 4px 8px; font-size: 11px;">Usada</button>
                                                <button class="btn btn-danger btn-sm" onclick="anularGuia('${guia.id}')" style="padding: 4px 8px; font-size: 11px;">Anular</button>
                                            ` : ''}
                                            <button class="btn btn-sm" onclick="eliminarGuia('${guia.id}', '${guia.numero_guia}')" style="padding: 4px 8px; font-size: 11px; background: #2c2c2c; color: white; border: none; border-radius: 4px;">├░┼©ÔÇöÔÇÿ├»┬©┬Å Eliminar</button>
                                            ${systemConfig.modulo_pagos_habilitado === 'true' && pendiente > 0 ? `
                                                <button class="btn btn-primary btn-sm" onclick="exonerarGuia('${guia.id}')" style="padding: 4px 8px; font-size: 11px; background: #6f42c1;">Exonerar</button>
                                            ` : ''}
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                </div>
            </div>
        `;
        // Agregar listener para el toggle de pagos
        const togglePagos = document.getElementById('toggle-pagos');
        if (togglePagos) {
            togglePagos.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                const success = await updateSystemConfig('modulo_pagos_habilitado', String(enabled));
                if (success) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Configuraci├â┬│n actualizada',
                        text: `El m├â┬│dulo de pagos ha sido ${enabled ? 'habilitado' : 'deshabilitado'}.`,
                        timer: 2000,
                        showConfirmButton: false
                    }).then(() => {
                        window.location.reload();
                    });
                } else {
                    e.target.checked = !enabled;
                }
            });
        }

    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar el dashboard.</div>';
    } finally {
        showLoading(false);
    }
}

// ===== MODO CHOFER (TRACKING) =====
async function loadChoferMode(container) {
    // Verificar si tiene gu├â┬¡a activa
    let guiaActiva = null;
    try {
        const response = await apiRequest('/guias');
        const guias = response.guias;
        guiaActiva = guias.find(g => g.estado === 'activa');
    } catch (e) {
        console.error("Error buscando gu├â┬¡as", e);
    }

    if (!guiaActiva) {
        container.innerHTML = `
            <div class="dashboard-header">
                <h1 class="dashboard-title">├░┼©┼í┼í Modo Chofer</h1>
            </div>
            <div class="card">
                <div class="card-body text-center" style="padding: 40px;">
                    <h3>├óÔÇ║ÔÇØ No tienes ninguna gu├â┬¡a ACTIVA</h3>
                    <p>Necesitas una gu├â┬¡a con pago verificado y estado 'activa' para iniciar el rastreo.</p>
                    <button class="btn btn-primary mt-3" onclick="navigateToSection('guias')">Ver mis gu├â┬¡as</button>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="dashboard-header">
            <h1 class="dashboard-title">├░┼©┼í┼í En Ruta</h1>
            <p class="dashboard-subtitle">Gu├â┬¡a ${formatNumeroGuia(guiaActiva.numero_guia)} - ${guiaActiva.tipo_mineral}</p>
        </div>

        <div class="card">
            <div class="card-body text-center" style="padding: 40px;">
                <div id="tracking-status-icon" style="font-size: 64px; margin-bottom: 20px;">├ó┬¡ÔÇó</div>
                <h2 id="tracking-status-text">Esperando se├â┬▒al GPS...</h2>
                <p class="text-muted">Por favor, mant├â┬®n esta pantalla abierta durante todo el viaje.</p>
                
                <div id="tracking-details" style="margin-top: 20px; font-family: monospace; display: none;">
                    <div>Lat: <span id="track-lat">--</span></div>
                    <div>Lng: <span id="track-lng">--</span></div>
                    <div>├â┼íltima act: <span id="track-time">--</span></div>
                </div>

                <div style="margin-top: 30px;">
                    <button id="btn-toggle-tracking" class="btn btn-success btn-lg" onclick="toggleTracking('${guiaActiva.id}')">
                        INICIAR VIAJE
                    </button>
                </div>
            </div>
        </div>
    `;
}

function toggleTracking(guiaId) {
    if (trackingInterval) {
        // DETENER
        stopTracking();
    } else {
        // INICIAR
        startTracking(guiaId);
    }
}

function startTracking(guiaId) {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalizaci├â┬│n.");
        return;
    }

    const btn = document.getElementById('btn-toggle-tracking');
    const icon = document.getElementById('tracking-status-icon');
    const text = document.getElementById('tracking-status-text');
    const details = document.getElementById('tracking-details');

    btn.textContent = "DETENER VIAJE";
    btn.classList.remove('btn-success');
    btn.classList.add('btn-danger');

    icon.textContent = "├░┼©ÔÇ£┬í";
    text.textContent = "Buscando sat├â┬®lites...";

    // Solicitar permiso y watch
    const geoOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, speed, accuracy } = position.coords;

            // Actualizar UI
            icon.textContent = "├░┼©┼©┬ó";
            text.textContent = "TRANSMITIENDO UBICACI├âÔÇ£N";
            text.style.color = "#28a745";

            details.style.display = 'block';
            document.getElementById('track-lat').textContent = latitude.toFixed(6);
            document.getElementById('track-lng').textContent = longitude.toFixed(6);
            document.getElementById('track-time').textContent = new Date().toLocaleTimeString();

            // Enviar a servidor (Throttle: cada 30s)
            // Aqu├â┬¡ usamos un flag simple o timestamp para no saturar
            const now = Date.now();
            if (!window.lastSent || (now - window.lastSent > 30000)) {
                sendLocationUpdate(guiaId, latitude, longitude, speed, accuracy);
                window.lastSent = now;
            }
        },
        (error) => {
            console.error("Error GPS:", error);
            icon.textContent = "├ó┼í┬á├»┬©┬Å";
            text.textContent = "Error de GPS: " + error.message;
            text.style.color = "#dc3545";
        },
        geoOptions
    );

    // Guardamos ID para limpiar
    window.currentWatchId = watchId;
    trackingInterval = true; // Flag simple
}

function stopTracking() {
    if (window.currentWatchId) {
        navigator.geolocation.clearWatch(window.currentWatchId);
        window.currentWatchId = null;
    }
    trackingInterval = null;
    window.lastSent = null;

    const btn = document.getElementById('btn-toggle-tracking');
    const icon = document.getElementById('tracking-status-icon');
    const text = document.getElementById('tracking-status-text');

    if (btn) {
        btn.textContent = "REANUDAR VIAJE";
        btn.classList.add('btn-success');
        btn.classList.remove('btn-danger');
        icon.textContent = "├ó┬¡ÔÇó";
        text.textContent = "Transmisi├â┬│n detenida";
        text.style.color = "inherit";
    }
}

async function sendLocationUpdate(guiaId, lat, lng, speed, accuracy) {
    try {
        await apiRequest('/tracking/update', 'POST', {
            guia_id: guiaId,
            lat,
            lng,
            velocidad: speed,
            precision: accuracy
        });
        console.log("├░┼©ÔÇ£┬ì Ubicaci├â┬│n enviada");
    } catch (e) {
        console.error("Error enviando ubicaci├â┬│n", e);
    }
}

// ===== MASTER MAP DASHBOARD =====
async function loadMasterMap(container) {
    container.innerHTML = `
        <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h1 class="dashboard-title">├░┼©ÔÇö┬║├»┬©┬Å Monitor Satelital</h1>
                <p class="dashboard-subtitle">Seguimiento en tiempo real</p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="loadMasterMap(document.getElementById('dashboard-content'))">├░┼©ÔÇØÔÇ× Actualizar</button>
        </div>
        <div class="card" style="height: 600px; padding: 0; overflow: hidden;">
            <div id="map" style="width: 100%; height: 100%;"></div>
        </div>
    `;

    // Esperar a que renderice DOM
    setTimeout(async () => {
        // Inicializar Mapa
        // Coordenadas Estado La Guaira aprox
        const map = L.map('map').setView([10.599, -66.935], 11);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '├é┬® OpenStreetMap contributors'
        }).addTo(map);

        // Cargar posiciones
        try {
            const response = await apiRequest('/tracking/last-positions');
            const positions = response.positions;

            positions.forEach(pos => {
                const marker = L.marker([pos.lat, pos.lng]).addTo(map);

                const popupContent = `
                    <div style="min-width: 200px;">
                        <strong>${pos.empresa}</strong><br>
                        Gu├â┬¡a: ${formatNumeroGuia(pos.numero_guia)}<br>
                        Placa: ${pos.vehiculo_placa}<br>
                        <small>├░┼©ÔÇóÔÇÖ ${new Date(pos.timestamp).toLocaleTimeString()}</small><br>
                        <hr style="margin: 5px 0;">
                        <button class="btn btn-primary btn-sm" style="width: 100%" 
                            onclick="verDetalleGuiaMaster('${pos.guia_id}')">
                            Ver Detalles / Cerrar
                        </button>
                    </div>
                `;
                marker.bindPopup(popupContent);
            });

            if (positions.length > 0) {
                // Centrar mapa en grupos
                const group = new L.featureGroup(Object.values(map._layers).filter(l => l.getLatLng));
                map.fitBounds(group.getBounds().pad(0.1));
            }

        } catch (e) {
            console.error("Error cargando mapa", e);
        }
    }, 100);
}

// Funci├â┬│n auxiliar para redirigir desde mapa
window.verDetalleGuiaMaster = function (guiaId) {
    // Implementar vista de detalle espec├â┬¡fica o usar modal
    // Por ahora simulamos b├â┬║squeda
    loadDetalleGuiaMaster(guiaId);
};

// Cargar vista detalle para Master (con bot├â┬│n de cierre remoto)
async function loadDetalleGuiaMaster(guiaId) {
    const container = document.getElementById('dashboard-content');
    showLoading(true);

    try {
        const response = await apiRequest(`/guias/${guiaId}`);
        const guia = response.guia;

        container.innerHTML = `
            <div class="dashboard-header">
                <div>
                    <h1 class="dashboard-title">Detalle de Gu├â┬¡a ${formatNumeroGuia(guia.numero_guia)}</h1>
                    <button class="btn btn-outline btn-sm" onclick="loadMasterMap(document.getElementById('dashboard-content'))">├ó┬¼ÔÇª Volver al Mapa</button>
                </div>
            </div>

            <div class="card">
                <div class="card-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <h3>Estado</h3>
                            <div style="font-size: 1.5rem;">${getEstadoBadge(guia.estado)}</div>
                        </div>
                        <div class="stat-card">
                            <h3>Empresa (Origen)</h3>
                            <p>${guia.empresa_razon_social}</p>
                            <small>${guia.empresa_rif}</small>
                        </div>
                        <div class="stat-card">
                            <h3>Cliente (Destino)</h3>
                            <p>${guia.cliente_nombre || 'N/A'}</p>
                            <small>${guia.cliente_rif || ''}</small>
                        </div>
                        <div class="stat-card">
                            <h3>Transporte</h3>
                            <p>${guia.vehiculo_placa}</p>
                            <small>${guia.conductor_nombre}</small>
                        </div>
                    </div>

                    <hr>

                    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 20px;">
                        ${guia.estado === 'activa' ? `
                            <button class="btn btn-danger btn-lg" onclick="cerrarGuiaRemoto('${guia.id}')">
                                ├░┼©ÔÇ║ÔÇÿ CONFIRMAR LLEGADA Y CERRAR
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="descargarGuia('${guia.id}')">Ver PDF</button>
                    </div>
                </div>
            </div>
        `;

    } catch (e) {
        console.error(e);
        alert("Error cargando detalle");
    } finally {
        showLoading(false);
    }
}

async function cerrarGuiaRemoto(guiaId) {
    if (!confirm("├é┬┐CONFIRMA que el transporte ha llegado a su destino?\n\nEsta acci├â┬│n cerrar├â┬í la gu├â┬¡a permanentemente.")) return;

    showLoading(true);
    try {
        // Enviar coordenadas simuladas (remoto) o nulas
        const response = await apiRequest(`/guias/${guiaId}/fiscalizar`, 'POST', {
            lat: null,
            lng: null
        });

        if (response.success) {
            alert(response.message);
            loadDetalleGuiaMaster(guiaId); // Recargar
        } else {
            alert(response.message);
        }
    } catch (e) {
        alert("Error cerrando gu├â┬¡a: " + e.message);
    } finally {
        showLoading(false);
    }
}

async function loadEmpresaDashboard(container) {
    showLoading(true);

    try {
        // Cargar gu├â┬¡as de la empresa
        const guiasResponse = await apiRequest('/guias');
        const guias = guiasResponse.guias;

        // Cargar historial de pagos
        const pagosResponse = await apiRequest('/pagos/historial');
        const pagos = pagosResponse.pagos;

        // Contar gu├â┬¡as por estado
        const guiasActivas = guias.filter(g => g.estado === 'activa').length;
        const guiasPendientes = guias.filter(g => g.estado === 'pendiente_pago' || g.estado === 'pago_pendiente_verificacion').length;

        container.innerHTML = `
            <div class="dashboard-header">
                <h1 class="dashboard-title">Panel de Empresa</h1>
                <p class="dashboard-subtitle">Bienvenido, ${currentUser.empresa_nombre}</p>
                <button class="btn btn-primary mt-2" onclick="mostrarFormularioGuia()">
                    <span>├ó┼¥ÔÇó</span>
                    Solicitar Nueva Gu├â┬¡a
                </button>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card stat-primary">
                    <div class="stat-header">
                        <h3 class="stat-title">Gu├â┬¡as Solicitadas</h3>
                        <div class="stat-icon">├░┼©ÔÇ£ÔÇ×</div>
                    </div>
                    <div class="stat-value">${guias.length}</div>
                    <div class="stat-change">Total de solicitudes</div>
                </div>
                <div class="stat-card stat-warning">
                    <div class="stat-header">
                        <h3 class="stat-title">Pendientes</h3>
                        <div class="stat-icon">├ó┬Å┬│</div>
                    </div>
                    <div class="stat-value">${guiasPendientes}</div>
                    <div class="stat-change">Por pagar o verificar</div>
                </div>
            </div>

            ${guias.length > 0 ? `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">├░┼©ÔÇ£ÔÇ× Mis Gu├â┬¡as de Movilizaci├â┬│n</h2>
                    </div>
                    <div class="card-body">
                        ${guias.slice(0, 5).map(guia => `
                            <div class="guia-card">
                                <div class="guia-card-header">
                                    <div>
                                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                            <div class="guia-number" style="margin-bottom: 0;">${formatNumeroGuia(guia.numero_guia)}</div>
                                            ${guia.estado === 'activa' || guia.estado === 'pendiente_pago' || guia.estado === 'pago_pendiente_verificacion' ? `
                                                <button class="btn btn-success btn-sm" onclick="descargarGuia('${guia.id}')" style="padding: 4px 10px; font-size: 11px; height: fit-content; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(52, 199, 89, 0.2);">
                                                    <span style="font-size: 12px;">├░┼©ÔÇ£┬Ñ</span> PDF
                                                </button>
                                            ` : ''}
                                        </div>
                                        <div>${getEstadoBadge(guia.estado)}</div>
                                    </div>
                                    <div class="guia-qr">
                                        <div style="font-size: 12px; text-align: center; color: #6c757d;">
                                            ├░┼©ÔÇ£┬▒<br>QR Code
                                        </div>
                                    </div>
                                </div>
                                <div class="guia-body">
                                    <div class="guia-info-row">
                                        <span class="guia-info-label">Mineral:</span>
                                        <span class="guia-info-value">${guia.tipo_mineral}</span>
                                    </div>
                                    <div class="guia-info-row">
                                        <span class="guia-info-label">Cantidad:</span>
                                        <span class="guia-info-value">${guia.cantidad} ${guia.unidad}</span>
                                    </div>
                                    <div class="guia-info-row">
                                        <span class="guia-info-label">Fecha:</span>
                                        <span class="guia-info-value">${formatDate(guia.created_at)}</span>
                                    </div>
                                    ${guia.monto_pagar ? `
                                        <div class="guia-info-row">
                                            <span class="guia-info-label">Monto:</span>
                                            <span class="guia-info-value">Bs. ${formatNumber(guia.monto_pagar)}</span>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="guia-footer">
                                    <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                                        ${(parseFloat(guia.monto_pagado || 0) < (parseFloat(guia.monto_pagar) + parseFloat(guia.monto_recargo || 0))) ? `
                                            <button class="btn btn-primary btn-sm" onclick="subirComprobante('${guia.id}', ${(parseFloat(guia.monto_pagar) + parseFloat(guia.monto_recargo || 0)) - parseFloat(guia.monto_pagado || 0)})">
                                                <span>├░┼©ÔÇÖ┬│</span> Pagar
                                            </button>
                                        ` : `
                                            <span class="badge badge-success">├ó┼ôÔÇª Pagada</span>
                                        `}

                                        ${guia.estado === 'pago_pendiente_verificacion' ? `
                                            <span class="badge badge-info">├ó┬Å┬│ En Verificaci├â┬│n</span>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ${guias.length > 5 ? `
                        <div class="card-footer">
                            <button class="btn btn-outline btn-sm" onclick="navigateToSection('guias')">
                                Ver todas las gu├â┬¡as (${guias.length})
                            </button>
                        </div>
                    ` : ''}
                </div>
            ` : `
                <div class="card">
                    <div class="card-body text-center" style="padding: 60px 20px;">
                        <div style="font-size: 64px; margin-bottom: 20px;">├░┼©ÔÇ£ÔÇ×</div>
                        <h3 style="color: #6c757d; margin-bottom: 10px;">No tienes gu├â┬¡as registradas</h3>
                        <p style="color: #adb5bd; margin-bottom: 30px;">Solicita tu primera gu├â┬¡a de movilizaci├â┬│n</p>
                        <button class="btn btn-primary" onclick="mostrarFormularioGuia()">
                            <span>├ó┼¥ÔÇó</span>
                            Solicitar Nueva Gu├â┬¡a
                        </button>
                    </div>
                </div>
            `}

            <div id="modal-container"></div>
        `;

    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar el dashboard.</div>';
    } finally {
        showLoading(false);
    }
}

// ===== SECCIONES ADICIONALES =====
async function loadGuiasSection(container) {
    showLoading(true);
    try {
        const guiasResponse = await apiRequest('/guias');
        const guias = guiasResponse.guias;

        if (currentUser.role === 'master') {
            // VISTA ADMINISTRADOR (Agrupada por Empresa)
            const empresasMap = {};
            let deudaTotalFisica = 0;

            guias.forEach(guia => {
                if (!empresasMap[guia.empresa_id]) {
                    empresasMap[guia.empresa_id] = {
                        nombre: guia.empresa_nombre,
                        rif: guia.empresa_rif,
                        guias: [],
                        deudaBs: 0
                    };
                }
                empresasMap[guia.empresa_id].guias.push(guia);
                
                const totalRequerido = parseFloat(guia.monto_pagar || 0) + parseFloat(guia.monto_recargo || 0);
                const pagado = parseFloat(guia.monto_pagado || 0);
                const pendiente = Math.max(0, totalRequerido - pagado);
                
                if (pendiente > 0) {
                    empresasMap[guia.empresa_id].deudaBs += pendiente;
                    deudaTotalFisica += pendiente;
                }
            });

            container.innerHTML = `
                <div class="dashboard-header">
                    <h1 class="dashboard-title">├░┼©┬Å┬ó Gesti├â┬│n de Gu├â┬¡as</h1>
                    <p class="dashboard-subtitle">Visualizaci├â┬│n consolidada por empresas</p>
                </div>

                <div class="stats-grid">
                    ${systemConfig.modulo_pagos_habilitado === 'true' ? `
                    <div class="stat-card stat-danger">
                        <div class="stat-header">
                            <span class="stat-title">DEUDA TOTAL POR COBRAR</span>
                            <div class="stat-icon">├░┼©ÔÇÖ┬░</div>
                        </div>
                        <div class="stat-value">Bs. ${formatNumber(deudaTotalFisica)}</div>
                        <div class="stat-change">Sumatoria de todas las empresas</div>
                    </div>
                    ` : ''}
                    <div class="stat-card stat-primary">
                        <div class="stat-header">
                            <span class="stat-title">EMPRESAS ACTIVAS</span>
                            <div class="stat-icon">├░┼©┬Å┬¡</div>
                        </div>
                        <div class="stat-value">${Object.keys(empresasMap).length}</div>
                        <div class="stat-change">Con gu├â┬¡as generadas</div>
                    </div>
                </div>

                ${Object.values(empresasMap).map(empresa => `
                    <div class="empresa-group-card card" style="margin-bottom: 30px;">
                        <div class="card-header" style="background: #f8f9fa; border-left: 6px solid ${empresa.deudaBs > 0 ? '#CF142B' : '#34C759'};">
                            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                                <div>
                                    <h3 style="margin: 0; font-size: 18px; color: #1a1a1a;">${empresa.nombre}</h3>
                                    <small style="color: #666; font-weight: 600;">RIF: ${empresa.rif}</small>
                                </div>
                                ${systemConfig.modulo_pagos_habilitado === 'true' ? `
                                <div style="text-align: right;">
                                    <div style="font-size: 12px; color: #666; font-weight: 600; text-transform: uppercase;">Deuda Pendiente</div>
                                    <div style="font-size: 20px; font-weight: 800; color: ${empresa.deudaBs > 0 ? '#CF142B' : '#34C759'};">
                                        Bs. ${formatNumber(empresa.deudaBs)}
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="card-body" style="padding: 15px;">
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px;">
                                ${empresa.guias.map(guia => `
                                    <div class="guia-card compact" style="padding: 12px; border: 1px solid #efefef; border-radius: 12px; background: white;">
                                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                                            <div>
                                                <span style="font-weight: 700; font-size: 14px; color: #1a5f7a;">${formatNumeroGuia(guia.numero_guia)}</span>
                                                <div style="font-size: 11px; color: #888;">${formatDate(guia.created_at)}</div>
                                            </div>
                                            ${getEstadoBadge(guia.estado)}
                                        </div>
                                        <div style="margin: 10px 0; font-size: 13px;">
                                            <div><strong>Mineral:</strong> ${guia.tipo_mineral}</div>
                                            <div><strong>Cantidad:</strong> ${guia.cantidad} ${guia.unidad}</div>
                                            <div style="margin-top: 4px; display: flex; flex-direction: column; gap: 2px;">
                                                ${systemConfig.modulo_pagos_habilitado === 'true' ? `
                                                    <div style="color: #666;">Monto Base: Bs. ${formatNumber(guia.monto_pagar)}</div>
                                                    ${parseFloat(guia.monto_recargo) > 0 ? `<div style="color: #e74c3c;">Recargo (10%): Bs. ${formatNumber(guia.monto_recargo)}</div>` : ''}
                                                    ${parseFloat(guia.monto_pagado) > 0 ? `<div style="color: #27ae60;">Abonado: Bs. ${formatNumber(guia.monto_pagado)}</div>` : ''}
                                                    <div style="color: #1a5f7a; font-weight: 800; border-top: 1px solid #eee; padding-top: 4px; margin-top: 2px;">
                                                        Pendiente: Bs. ${formatNumber(Math.max(0, (parseFloat(guia.monto_pagar) + parseFloat(guia.monto_recargo || 0)) - parseFloat(guia.monto_pagado || 0)))}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                        <div style="display: flex; gap: 6px;">
                                            <button class="btn btn-outline btn-sm" onclick="descargarGuia('${guia.id}')" style="flex: 1; padding: 4px;">PDF</button>
                                            ${guia.estado === 'pago_pendiente_verificacion' ? `
                                                <button class="btn btn-primary btn-sm" onclick="navigateToSection('pagos')" style="flex: 1; padding: 4px; background: #FF9500;">Ver Pago</button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('')}
            `;
        } else {
            // VISTA EMPRESA
            container.innerHTML = `
                <div class="dashboard-header">
                    <h1 class="dashboard-title">├░┼©ÔÇ£ÔÇ× Mis Gu├â┬¡as</h1>
                    <p class="dashboard-subtitle">Todas tus gu├â┬¡as de movilizaci├â┬│n</p>
                </div>
                
                <div class="guias-container">
                    <div class="guias-main">
                        ${guias.length > 0 ? `
                            <div class="card">
                                <div class="card-body">
                                    ${guias.map(guia => `
                                        <div class="guia-card">
                                            <div class="guia-card-header">
                                                <div>
                                                    <div class="guia-number">${formatNumeroGuia(guia.numero_guia)}</div>
                                                    <div style="margin-top: 8px;">${getEstadoBadge(guia.estado)}</div>
                                                </div>
                                                <div class="guia-qr" onclick="window.open('/verificar/${guia.id}', '_blank')" style="cursor: pointer;">
                                                    <div style="font-size: 12px; text-align: center; color: #6c757d;">
                                                        ├░┼©ÔÇ£┬▒<br>QR Code
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="guia-body">
                                                <div class="guia-info-row">
                                                    <span class="guia-info-label">Mineral:</span>
                                                    <span class="guia-info-value">${guia.tipo_mineral}</span>
                                                </div>
                                                <div class="guia-info-row">
                                                    <span class="guia-info-label">Cantidad:</span>
                                                    <span class="guia-info-value">${guia.cantidad} ${guia.unidad}</span>
                                                </div>
                                                <div class="guia-info-row">
                                                    <span class="guia-info-label">Fecha:</span>
                                                    <span class="guia-info-value">${formatDate(guia.created_at)}</span>
                                                </div>
                                            </div>
                                            <div class="guia-footer">
                                                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                                                    ${guia.estado === 'activa' || guia.estado === 'pendiente_pago' || guia.estado === 'pago_pendiente_verificacion' ? `
                                                        <button class="btn btn-success btn-sm" onclick="descargarGuia('${guia.id}')">
                                                            <span>├░┼©ÔÇ£┬Ñ</span> PDF
                                                        </button>
                                                    ` : ''}
                                                    
                                                    ${systemConfig.modulo_pagos_habilitado === 'true' ? `
                                                        ${(parseFloat(guia.monto_pagado || 0) < (parseFloat(guia.monto_pagar) + parseFloat(guia.monto_recargo || 0))) ? `
                                                            <button class="btn btn-primary btn-sm" onclick="subirComprobante('${guia.id}', ${(parseFloat(guia.monto_pagar) + parseFloat(guia.monto_recargo || 0)) - parseFloat(guia.monto_pagado || 0)})">
                                                                <span>├░┼©ÔÇÖ┬│</span> Pagar
                                                            </button>
                                                        ` : `
                                                            <span class="badge badge-success">├ó┼ôÔÇª Pagada</span>
                                                        `}

                                                        ${guia.estado === 'pago_pendiente_verificacion' ? `
                                                            <span class="badge badge-info">├ó┬Å┬│ En Verificaci├â┬│n</span>
                                                        ` : ''}
                                                    ` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : `
                            <div class="info-message">No hay gu├â┬¡as registradas</div>
                        `}
                    </div>

                    ${systemConfig.modulo_pagos_habilitado === 'true' ? `
                    <div class="guias-sidebar">
                        <div class="bank-card">
                            <div class="bank-card-header">
                                <div class="bank-card-title">Datos para Pago</div>
                                <div class="bank-card-name">La Guaira - Minerales</div>
                            </div>
                            <div class="bank-card-body">
                                <div class="bank-detail">
                                    <span class="bank-label">Banco:</span>
                                    <span class="bank-value">Banco de Venezuela</span>
                                </div>
                                <div class="bank-detail">
                                    <span class="bank-label">Titular:</span>
                                    <span class="bank-value">GOBIERNO DEL ESTADO LA GUAIRA</span>
                                </div>
                                <div class="bank-detail">
                                    <span class="bank-label">RIF:</span>
                                    <span class="bank-value">G-20000100-3</span>
                                </div>
                                <div class="bank-detail">
                                    <span class="bank-label">Cuenta:</span>
                                    <span class="bank-value">0102-0000-00-0000000000</span>
                                </div>
                            </div>
                        </div>

                        <div class="card" style="margin-top: 20px; border-left: 4px solid var(--system-orange); padding: 16px;">
                            <h4 style="font-size: 14px; margin-bottom: 8px; color: var(--system-orange);">├óÔÇ×┬╣├»┬©┬Å Informaci├â┬│n Importante</h4>
                            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
                                Las gu├â┬¡as pueden descargarse de 8:00 AM a 6:00 PM. 
                                <strong>Los pagos deben realizarse antes de las 6:00 PM</strong> para evitar recargos por retraso.
                            </p>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading guias:', error);
        container.innerHTML = '<div class="error-message">Error al cargar las gu├â┬¡as</div>';
    } finally {
        showLoading(false);
    }
}

async function loadPagosSection(container) {
    showLoading(true);

    try {
        const isMaster = currentUser.role === 'master';
        const endpoint = isMaster ? '/pagos/pendientes' : '/pagos/historial';
        const response = await apiRequest(endpoint);
        const pagos = response.pagos;

        container.innerHTML = `
            <div class="dashboard-header">
                <h1 class="dashboard-title">${isMaster ? '├░┼©ÔÇÖ┬│ Pagos por Verificar' : '├░┼©ÔÇÖ┬│ Mis Pagos'}</h1>
                <p class="dashboard-subtitle">${isMaster ? 'Listado de comprobantes de pago pendientes de aprobaci├â┬│n' : 'Historial de pagos realizados'}</p>
            </div>

            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="card-title">${isMaster ? 'Comprobantes Pendientes' : 'Historial de Pagos'}</h2>
                    <span class="badge ${isMaster ? 'badge-info' : 'badge-primary'}">${pagos.length} Registro(s)</span>
                </div>

                ${pagos.length === 0 ? `
                    <div class="card-body text-center" style="padding: 40px;">
                        <p style="color: #999;">No hay pagos registrados para mostrar.</p>
                    </div>
                ` : `
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha Registro</th>
                                    ${isMaster ? '<th>Empresa</th>' : ''}
                                    <th>Gu├â┬¡a</th>
                                    <th>Banco / Referencia</th>
                                    <th>Monto</th>
                                    <th>Estado</th>
                                    ${isMaster ? '<th>Acciones</th>' : ''}
                                </tr>
                            </thead>
                            <tbody>
                                ${pagos.map(pago => {
            const statusClass = pago.estado === 'verificado' ? 'status-active' : (pago.estado === 'rechazado' ? 'status-expired' : 'status-pending');
            const statusLabel = pago.estado === 'verificado' ? 'Verificado' : (pago.estado === 'rechazado' ? 'Rechazado' : 'Pendiente');

            return `
                                    <tr>
                                        <td>${formatDate(pago.created_at)}<br><small style="color: #888;">${new Date(pago.created_at).toLocaleTimeString()}</small></td>
                                        ${isMaster ? `<td>${pago.empresa_nombre}<br><small style="color: #888;">${pago.empresa_rif}</small></td>` : ''}
                                        <td>${formatNumeroGuia(pago.numero_guia)}</td>
                                        <td>${pago.banco}<br><small style="color: #888;">Ref: ${pago.numero_referencia}</small></td>
                                        <td style="font-weight: 600;">Bs. ${formatNumber(pago.monto)}</td>
                                        <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                                        ${isMaster ? `
                                        <td>
                                            <div style="display: flex; flex-direction: column; gap: 5px;">
                                                <button class="btn btn-primary btn-sm" onclick="verComprobante('${pago.comprobante_url}')">
                                                    ├░┼©ÔÇ£┬© Ver Captura
                                                </button>
                                                <div style="display: flex; gap: 5px;">
                                                    <button class="btn btn-success btn-sm" style="flex: 1;" onclick="verificarPago('${pago.id}')">
                                                        ├ó┼ôÔÇª Aprobar
                                                    </button>
                                                    <button class="btn btn-danger btn-sm" style="flex: 1;" onclick="rechazarPago('${pago.id}')">
                                                        ├ó┬Ø┼Æ Rechazar
                                                    </button>
                                                </div>
                                            </div>
                                        </td>` : ''}
                                    </tr>
                                `;
        }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;

    } catch (error) {
        container.innerHTML = `<div class="error-message">Error al cargar la secci├â┬│n de pagos.</div>`;
        console.error(error);
    } finally {
        showLoading(false);
    }
}

function verComprobante(url) {
    if (!url) return alert('No hay comprobante disponible');

    // Si es una URL absoluta (Supabase), usarla tal cual
    if (url.startsWith('http')) {
        window.open(url, '_blank');
        return;
    }

    // De lo contrario, asegurar que tenga el slash inicial para rutas relativas
    const fullUrl = url.startsWith('/') ? url : `/${url}`;
    window.open(fullUrl, '_blank');
}

async function loadDeudasSection(container) {
    if (systemConfig.modulo_pagos_habilitado === 'false') {
        container.innerHTML = `
            <div class="dashboard-header">
                <h1 class="dashboard-title">├░┼©ÔÇÖ┬░ Deudas y Recargos</h1>
            </div>
            <div class="card" style="padding: 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">├░┼©ÔÇ║┬í├»┬©┬Å</div>
                <h2>M├â┬│dulo Deshabilitado</h2>
                <p style="color: #666; margin-top: 10px;">El sistema de pagos y cobranzas ha sido desactivado temporalmente por el administrador.</p>
                <button class="btn btn-primary mt-3" onclick="navigateToSection('inicio')">Volver al Inicio</button>
            </div>
        `;
        return;
    }

    showLoading(true);

    try {
        const isMaster = currentUser.role === 'master';
        const response = await apiRequest('/guias/deudas');
        const deudas = response.deudas;

        // Calcular total general (restando abonos)
        const totalNeto = deudas.reduce((sum, d) => sum + (parseFloat(d.monto_pagar) || 0), 0);
        const totalAbonado = deudas.reduce((sum, d) => sum + (parseFloat(d.monto_pagado) || 0), 0);
        const totalRecargos = deudas.reduce((sum, d) => sum + (parseFloat(d.monto_recargo) || 0), 0);
        const totalGeneral = Math.max(0, (totalNeto + totalRecargos) - totalAbonado);

        container.innerHTML = `
            <div class="dashboard-header">
                <h1 class="dashboard-title">${isMaster ? '├ó┼íÔÇô├»┬©┬Å Control de Deudas y Recargos' : '├ó┼íÔÇô├»┬©┬Å Mis Deudas'}</h1>
                <p class="dashboard-subtitle">${isMaster ? 'Seguimiento de gu├â┬¡as pendientes con recargos por mora' : 'Estado de cuenta de tus gu├â┬¡as pendientes de pago'}</p>
            </div>

            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
                <div class="stat-card">
                    <div class="stat-value">${deudas.length}</div>
                    <div class="stat-label">Gu├â┬¡as Pendientes</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value" style="color: var(--system-orange);">Bs. ${formatNumber(totalRecargos)}</div>
                    <div class="stat-label">Total Recargos (10%)</div>
                </div>
                <div class="stat-card" style="background: var(--primary-color); color: white; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                        <div class="stat-value">Bs. ${formatNumber(totalGeneral)}</div>
                        <div class="stat-label" style="color: rgba(255,255,255,0.8);">Total Deuda Consolidada</div>
                    </div>
                    ${!isMaster && totalGeneral > 0 ? `
                        <button class="btn btn-primary" style="margin-top: 12px; width: 100%; font-weight: 700; background: white; color: var(--primary-color); border: none; border-radius: 12px; padding: 12px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" 
                                onclick="subirComprobante('deuda_total', ${totalGeneral})"
                                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.2)'"
                                onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.1)'">
                            ├░┼©ÔÇÖ┬│ Pagar Deuda Total
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="card-title">Detalle de Deuda por Gu├â┬¡a</h2>
                    <span class="badge badge-primary">${deudas.length} Registro(s)</span>
                </div>

                ${deudas.length === 0 ? `
                    <div class="card-body text-center" style="padding: 40px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">├ó┼ôÔÇª</div>
                        <p style="color: #666; font-size: 18px; font-weight: 600;">├é┬íNo tienes deudas pendientes!</p>
                        <p style="color: #999;">Todas tus gu├â┬¡as solicitadas han sido pagadas o no hay registros.</p>
                    </div>
                ` : `
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha Solicitud</th>
                                    ${isMaster ? '<th>Empresa</th>' : ''}
                                    <th>Gu├â┬¡a</th>
                                    <th>Monto Base</th>
                                    <th>Recargo (10%)</th>
                                    <th>Abonado</th>
                                    <th>Pendiente</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${deudas.map(guia => {
                                    const totalRequerido = parseFloat(guia.monto_pagar) + parseFloat(guia.monto_recargo || 0);
                                    const abonado = parseFloat(guia.monto_pagado || 0);
                                    const pendiente = totalRequerido - abonado;
                                    const tieneRecargo = parseFloat(guia.monto_recargo) > 0;
                                    
                                    return `
                                        <tr>
                                            <td>
                                                ${formatDate(guia.created_at)}
                                                <br><small style="color: ${tieneRecargo ? '#e74c3c' : '#888'}; font-weight: ${tieneRecargo ? '700' : '400'};">
                                                    ${tieneRecargo ? '├ó┼í┬á├»┬©┬Å M├â┬üS DE 24H' : '├ó┬Å┬▒├»┬©┬Å En plazo'}
                                                </small>
                                            </td>
                                            ${isMaster ? `<td>${guia.empresa_nombre}</td>` : ''}
                                            <td>${guia.numero_guia}</td>
                                            <td>Bs. ${formatNumber(guia.monto_pagar)}</td>
                                            <td style="color: ${tieneRecargo ? '#e74c3c' : '#888'};">
                                                Bs. ${formatNumber(guia.monto_recargo || 0)}
                                            </td>
                                            <td style="color: #27ae60; font-weight: 600;">
                                                Bs. ${formatNumber(abonado)}
                                            </td>
                                            <td style="font-weight: 800; color: ${pendiente > 0 ? '#e67e22' : 'var(--primary-color)'};">
                                                Bs. ${formatNumber(pendiente)}
                                            </td>
                                            <td>
                                                <button class="btn btn-primary btn-sm" onclick="subirComprobante('${guia.id}', ${pendiente})">
                                                    ├░┼©ÔÇÖ┬│ ${abonado > 0 ? 'Abonar' : 'Pagar'}
                                                </button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
            
            <div class="card" style="margin-top: 24px; background: #fffcf0; border: 1px solid #ffeeba;">
                <div class="card-body" style="display: flex; gap: 16px; align-items: flex-start; padding: 20px;">
                    <div style="font-size: 24px;">├░┼©ÔÇØÔÇØ</div>
                    <div>
                        <h4 style="color: #856404; margin-bottom: 4px; font-weight: 700;">Pol├â┬¡tica de Recargos</h4>
                        <p style="font-size: 13px; color: #856404; line-height: 1.5; margin: 0;">
                            Recuerde que dispone de <strong>24 horas</strong> desde la solicitud de la gu├â┬¡a para realizar el pago. 
                            Pasado este tiempo, el sistema aplica autom├â┬íticamente un recargo del <strong>10%</strong> sobre el monto total de la gu├â┬¡a por concepto de mora administrativa.
                        </p>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading deudas:', error);
        container.innerHTML = '<div class="error-message">Error al cargar la secci├â┬│n de deudas</div>';
    } finally {
        showLoading(false);
    }
}



// ===== NOTIFICACIONES =====
function updateNotificationBadge(count) {
    const badge = document.getElementById('notification-badge');
    const pagosBadge = document.getElementById('pagos-badge');
    const mobilePagosBadge = document.getElementById('mobile-pagos-badge');

    if (count > 0) {
        if (badge) {
            badge.textContent = count;
            badge.style.display = 'block';
        }
        if (pagosBadge) {
            pagosBadge.textContent = count;
            pagosBadge.style.display = 'inline-flex';
        }
        if (mobilePagosBadge) {
            mobilePagosBadge.textContent = count;
            mobilePagosBadge.style.display = 'block';
        }
    } else {
        if (badge) badge.style.display = 'none';
        if (pagosBadge) pagosBadge.style.display = 'none';
        if (mobilePagosBadge) mobilePagosBadge.style.display = 'none';
    }
}


// ===== FUNCIONES DE GU├â┬ìAS =====
// Lista de materiales disponibles
let MATERIALES_DISPONIBLES = [
    'Piedra Picada', 'Arrocillo', 'Arena 2"', 'Arena 2/4', 'Arena 5"',
    'Agregado 4/8', 'Agregado 8/15', 'Agregado 5/15', 'Agregado 15/25',
    'Arena Integral', 'Granz├â┬│n', 'P100', 'P3000', 'Coraza',
    'Arena Cernida', 'Canto Rodado', 'Polvillo', 'Arena Amarilla', 'Arena Lavada', 'Otros'
];

async function mostrarFormularioGuia() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/minerales`);
        const data = await response.json();
        
        if (data.success && data.minerales && data.minerales.length > 0) {
            MATERIALES_DISPONIBLES = data.minerales.map(m => m.nombre);
        }
    } catch (err) {
        console.error('Error al cargar minerales din├ímicos:', err);
    } finally {
        showLoading(false);
    }

    const materialesOptions = MATERIALES_DISPONIBLES.map(m =>
        `<option value="${m}">${m}</option>`
    ).join('');

    const modalHtml = `
        <div class="modal-overlay" id="guia-modal-overlay" onclick="cerrarModalGuia()">
            <div class="modal-content" id="guia-modal-content" onclick="event.stopPropagation()" style="max-width: 900px; width: 95%; max-height: 90vh; transition: max-width 0.3s ease;">
                <div class="modal-header">
                    <h2 style="margin: 0; color: #1a5f7a; font-size: 24px;">Solicitar Gu├â┬¡a de Movilizaci├â┬│n</h2>
                    <button class="close-modal" onclick="cerrarModalGuia()">├âÔÇö</button>
                </div>
                <div class="modal-body" style="max-height: calc(90vh - 140px); overflow-y: auto; display: flex; gap: 20px;">
                    <!-- LEFT COLUMN: FORM -->
                    <div id="guia-form-container" style="flex: 1; min-width: 0;">
                        <form id="guia-form" onsubmit="event.preventDefault(); previsualizarGuia();">
                            <!-- DESCRIPCI├âÔÇ£N DEL MATERIAL -->
                        <div style="margin-bottom: 25px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #1a5f7a; padding-bottom: 5px;">
                                <h4 style="margin: 0; color: #1a5f7a; font-size: 18px;">
                                    Descripci├â┬│n de Materiales
                                </h4>
                                <button type="button" class="btn btn-outline btn-sm" onclick="agregarFilaMaterial()">
                                    + Agregar Material
                                </button>
                            </div>
                            
                            <div id="materiales-container">
                                <!-- Las filas de materiales se agregar├â┬ín aqu├â┬¡ din├â┬ímicamente -->
                            </div>
                            
                            <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 600; color: #495057;">Impuesto Total Estimado:</span>
                                    <span id="total-impuesto-estimado" style="font-size: 18px; font-weight: 700; color: #1a5f7a;">Bs. 0.00</span>
                                </div>
                                <small class="text-muted" id="precio-referencia-base" style="display: block; margin-top: 5px;">
                                    Impuesto (2.5%): Calculado sobre el valor total de la carga a tasa BCV.
                                </small>
                            </div>
                        </div>

                        <!-- DATOS DEL CLIENTE -->
                        <div style="margin-bottom: 25px;">
                            <h4 style="margin: 20px 0 15px; color: #1a5f7a; border-bottom: 2px solid #1a5f7a; padding-bottom: 5px; font-size: 18px;">
                                Datos del Cliente
                            </h4>
                            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px;">
                                <div class="form-group">
                                    <label>Raz├â┬│n Social / Nombre *</label>
                                    <input type="text" name="cliente_nombre" class="form-control" required placeholder="Nombre de la empresa o persona">
                                </div>
                                <div class="form-group">
                                    <label>RIF / C├â┬®dula *</label>
                                    <input type="text" name="cliente_rif" class="form-control" required placeholder="Ej: J-12345678-9">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Direcci├â┬│n Fiscal *</label>
                                <input type="text" name="cliente_direccion" class="form-control" required placeholder="Direcci├â┬│n legal del cliente">
                            </div>
                        </div>

                        <!-- RUTAS DE TRASLADO -->
                        <div style="margin-bottom: 25px;">
                            <h4 style="margin: 20px 0 15px; color: #1a5f7a; border-bottom: 2px solid #1a5f7a; padding-bottom: 5px; font-size: 18px;">
                                Rutas de Traslado
                            </h4>
                            <div class="form-group">
                                <label>Direcci├â┬│n de Origen *</label>
                                <input type="text" name="origen" class="form-control" required placeholder="Direcci├â┬│n completa del origen">
                            </div>
                            <div class="form-group">
                                <label>Direcci├â┬│n de Destino *</label>
                                <input type="text" name="destino" class="form-control" required placeholder="Direcci├â┬│n completa del destino">
                            </div>
                        </div>

                        <!-- DATOS DEL VEH├â┬ìCULO -->
                        <div style="margin-bottom: 25px;">
                            <h4 style="margin: 20px 0 15px; color: #1a5f7a; border-bottom: 2px solid #1a5f7a; padding-bottom: 5px; font-size: 18px;">
                                Datos del Veh├â┬¡culo
                            </h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div class="form-group">
                                    <label>Marca *</label>
                                    <input type="text" name="vehiculo_marca" class="form-control" required placeholder="Ej: Ford, Chevrolet">
                                </div>
                                <div class="form-group">
                                    <label>Modelo *</label>
                                    <input type="text" name="vehiculo_modelo" class="form-control" required placeholder="Ej: F-350, NPR">
                                </div>
                                <div class="form-group">
                                    <label>Color *</label>
                                    <input type="text" name="vehiculo_color" class="form-control" required placeholder="Ej: Blanco, Rojo">
                                </div>
                                <div class="form-group">
                                    <label>Placa *</label>
                                    <input type="text" name="vehiculo_placa" class="form-control" required placeholder="Ej: A1B2C3D" style="text-transform: uppercase;">
                                </div>
                                <div class="form-group">
                                    <label>Tipo de Carrocer├â┬¡a *</label>
                                    <select name="vehiculo_carroceria" class="form-control" required>
                                        <option value="">Seleccione...</option>
                                        <option value="Volteo">Volteo</option>
                                        <option value="Plataforma">Plataforma</option>
                                        <option value="Cava">Cava</option>
                                        <option value="Cisterna">Cisterna</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- DATOS DEL CONDUCTOR -->
                        <div style="margin-bottom: 25px;">
                            <h4 style="margin: 20px 0 15px; color: #1a5f7a; border-bottom: 2px solid #1a5f7a; padding-bottom: 5px; font-size: 18px;">
                                Datos del Conductor
                            </h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                <div class="form-group">
                                    <label>Nombres y Apellidos *</label>
                                    <input type="text" name="conductor_nombre" class="form-control" required placeholder="Nombre completo del conductor">
                                </div>
                                <div class="form-group">
                                    <label>C├â┬®dula de Identidad *</label>
                                    <input type="text" name="conductor_cedula" class="form-control" required placeholder="Ej: V-12345678">
                                </div>
                            </div>
                        </div>

                        <!-- OBSERVACIONES -->
                        <div style="margin-bottom: 25px;">
                            <h4 style="margin: 20px 0 15px; color: #1a5f7a; border-bottom: 2px solid #1a5f7a; padding-bottom: 5px; font-size: 18px;">
                                Observaciones
                            </h4>
                            <div class="form-group">
                                <textarea name="observaciones" class="form-control" rows="3" placeholder="Observaciones adicionales (opcional)"></textarea>
                            </div>
                        </div>
                    </form>
                </div>
                
                <!-- RIGHT COLUMN: PREVIEW PANE -->
                <div id="guia-preview-container" style="flex: 1; display: none; border-left: 1px solid #ccc; padding-left: 20px; flex-direction: column; min-width: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h4 style="margin: 0; color: #1a5f7a; font-size: 18px;">Previsualizaci├â┬│n</h4>
                    </div>
                    <div id="preview-loading" style="display: none; text-align: center; padding: 40px; color: #666;">
                        <div class="spinner"></div> Generando vista previa...
                    </div>
                    <iframe id="pdf-preview-iframe" style="width: 100%; height: 100%; min-height: 500px; border: 1px solid #ddd; background: #f5f5f5; border-radius: 8px;"></iframe>
                </div>
            </div>

            <div class="modal-footer" id="modal-footer-normal">
                <button type="button" class="btn btn-secondary" onclick="cerrarModalGuia()">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="previsualizarGuia()" style="background: #007aff; padding: 10px 20px;">├░┼©ÔÇ£ÔÇ× Previsualizar Gu├â┬¡a</button>
            </div>
            <div class="modal-footer" id="modal-footer-preview" style="display: none;">
                <button type="button" class="btn btn-secondary" onclick="cancelarPrevisualizacion()">├ó┬¼ÔÇª Volver a Editar</button>
                <button type="button" class="btn btn-success" onclick="solicitarGuiaDefinitiva()" style="background: #28a745; padding: 10px 20px;">├ó┼ôÔÇª Generar Gu├â┬¡a Definitiva</button>
            </div>
        </div>
    </div>
    `;

    document.getElementById('modal-container').innerHTML = modalHtml;

    // Agregar la primera fila de material autom├â┬íticamente
    agregarFilaMaterial();
}

function cerrarModalGuia() {
    const modal = document.getElementById('guia-modal-overlay');
    if (modal) {
        modal.remove();
    }
    document.getElementById('modal-container').innerHTML = '';
}

// Guarda temporalmente los datos del formulario si la previsualizaci├â┬│n es exitosa
let tempGuiaData = null;

async function previsualizarGuia() {
    const form = document.getElementById('guia-form');
    if (!form) {
        alert('Error: No se encontr├â┬│ el formulario');
        return;
    }

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    const tipos = document.getElementsByName('material_tipo[]');
    const cantidades = document.getElementsByName('material_cantidad[]');
    const unidades = document.getElementsByName('material_unidad[]');
    const precios = document.getElementsByName('material_precio[]');
    const precios_bs = document.getElementsByName('material_precio_bs[]');

    const materiales = [];
    for (let i = 0; i < tipos.length; i++) {
        if (tipos[i].value && cantidades[i].value) {
            materiales.push({
                nombre: tipos[i].value,
                cantidad: parseFloat(cantidades[i].value),
                unidad: unidades[i].value,
                precio_unitario: parseFloat(precios[i].value) || 0,
                precio_unitario_bs: parseFloat(precios_bs[i].value.replace(/\./g, '').replace(',', '.')) || 0,
                precio_unitario_bs_text: precios_bs[i].value.trim()
            });
        }
    }

    if (materiales.length === 0) {
        alert('Debe agregar al menos un material con su cantidad.');
        return;
    }

    data.materiales = materiales;
    tempGuiaData = data; // Lo guardamos para la solicitud definitiva

    // UI Changes para mostrar preview
    document.getElementById('guia-modal-content').style.maxWidth = '1400px';
    document.getElementById('guia-preview-container').style.display = 'flex';
    document.getElementById('modal-footer-normal').style.display = 'none';
    document.getElementById('modal-footer-preview').style.display = 'flex';
    
    // Bloquear formulario
    Array.from(form.elements).forEach(el => el.disabled = true);
    
    const iframe = document.getElementById('pdf-preview-iframe');
    const loading = document.getElementById('preview-loading');
    
    iframe.style.display = 'none';
    loading.style.display = 'block';

    try {
        const response = await fetch(`${API_BASE}/guias/previsualizar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Error al generar la vista previa');
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        iframe.src = objectUrl;
        loading.style.display = 'none';
        iframe.style.display = 'block';

    } catch (error) {
        alert('Error en previsualizaci├â┬│n: ' + error.message);
        cancelarPrevisualizacion();
    }
}

function cancelarPrevisualizacion() {
    document.getElementById('guia-modal-content').style.maxWidth = '900px';
    document.getElementById('guia-preview-container').style.display = 'none';
    document.getElementById('modal-footer-normal').style.display = 'flex';
    document.getElementById('modal-footer-preview').style.display = 'none';
    
    const form = document.getElementById('guia-form');
    Array.from(form.elements).forEach(el => el.disabled = false);
    
    // Limpiar iframe
    document.getElementById('pdf-preview-iframe').src = '';
}

async function solicitarGuiaDefinitiva() {
    if (!tempGuiaData) {
        alert('No hay datos guardados. Intente nuevamente.');
        return;
    }

    const data = tempGuiaData;

    showLoading(true);

    try {
        const response = await apiRequest('/guias/solicitar', 'POST', data);

        if (response.success) {
            if (response.details) {
                alert(`├ó┼í┬á├»┬©┬Å ${response.message}\n\nDetalles del error PDF: ${response.details}\n\n├░┼©ÔÇ£ÔÇ╣ N├â┬║mero de Gu├â┬¡a: ${response.guia.numero_guia}\n├░┼©ÔÇÖ┬░ Tasa BCV: ${response.guia.tasa_bcv} Bs./$\n├░┼©ÔÇÖ┬Á Monto: Bs. ${formatNumber(response.guia.monto_pagar)}`);
            } else {
                alert(`├ó┼ôÔÇª Gu├â┬¡a solicitada exitosamente.\n\n├░┼©ÔÇ£ÔÇ╣ N├â┬║mero de Gu├â┬¡a: ${response.guia.numero_guia}\n├░┼©ÔÇÖ┬░ Tasa BCV Aplicada: ${response.guia.tasa_bcv} Bs./$\n├░┼©ÔÇÖ┬Á Monto Total a Pagar: Bs. ${formatNumber(response.guia.monto_pagar)}\n├░┼©┬Å┬ª Banco: ${response.guia.banco}\n├░┼©ÔÇÖ┬│ Cuenta: ${response.guia.cuenta}\n\nPor favor, realice el pago y suba el comprobante.`);
            }
            cerrarModalGuia();
            loadDashboard();
        }
    } catch (error) {
        alert('Error al solicitar gu├â┬¡a: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function subirComprobante(guiaId, monto) {
    const modalHtml = `
        <div class="modal-overlay active" id="pago-modal-overlay">
            <div class="modal-content floating-anim" style="max-width: 500px; border-radius: 24px; overflow: hidden; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                <div class="modal-header" style="border: none; padding: 24px 24px 10px;">
                    <h2 style="font-size: 24px; font-weight: 800; color: #1a1a1a;">Subir Comprobante de Pago</h2>
                    <button class="close-modal" onclick="cerrarModal('pago-modal-overlay')">├âÔÇö</button>
                </div>
                <div class="modal-body" style="padding: 0 24px 24px;">
                    <form id="pago-form" enctype="multipart/form-data">
                        <input type="hidden" name="guia_id" value="${guiaId}">
                        
                        <div class="form-group" style="margin-bottom: 20px; padding: 15px; background: #f0f7ff; border-radius: 12px; border: 1px solid #cce5ff;">
                            <label style="font-size: 13px; font-weight: 700; color: #004085; margin-bottom: 8px; display: block;">Monto a reportar (puedes editarlo para abonos parciales) *</label>
                            <div style="display: flex; align-items: center; background: white; padding: 5px 15px; border-radius: 8px; border: 2px solid #007aff;">
                                <span style="font-weight: 800; color: #007aff; margin-right: 5px;">Bs.</span>
                                <input type="number" name="monto" value="${monto.toFixed(2)}" step="0.01" min="0.01" required 
                                       style="border: none; outline: none; width: 100%; font-size: 18px; font-weight: 800; color: #1a1a1a;">
                            </div>
                            <small style="color: #666; display: block; margin-top: 5px;">Monto total pendiente: <strong>Bs. ${formatNumber(monto)}</strong></small>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; display: block;">Banco *</label>
                            <input type="text" name="banco" class="form-control" placeholder="Ej: Banco de Venezuela" required style="background: #f8f9fa; border-radius: 12px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; display: block;">N├â┬║mero de Referencia *</label>
                            <input type="text" name="numero_referencia" class="form-control" placeholder="Ej: 00123456" required style="background: #f8f9fa; border-radius: 12px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 16px;">
                            <label style="font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; display: block;">Fecha de Pago *</label>
                            <input type="date" name="fecha_pago" class="form-control" required style="background: #f8f9fa; border-radius: 12px;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 10px;">
                            <label style="font-size: 13px; font-weight: 700; color: #1a1a1a; margin-bottom: 6px; display: block;">Comprobante (imagen o PDF) *</label>
                            <div style="position: relative; overflow: hidden; background: #f8f9fa; border: 1px solid #E5E5E7; border-radius: 12px; padding: 12px;">
                                <input type="file" name="comprobante" accept="image/*,.pdf" required style="font-size: 13px; color: #666;">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer" style="background: #fcfcfc; border-top: 1px solid #f0f0f0; padding: 16px 24px; display: flex; gap: 12px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="cerrarModal('pago-modal-overlay')" style="border-radius: 12px; min-width: 100px; background: #8E8E93; border: none;">Cancelar</button>
                    <button class="btn btn-primary" onclick="enviarComprobante()" style="border-radius: 12px; min-width: 120px; background: #007AFF; border: none; box-shadow: 0 4px 12px rgba(0,122,255,0.3);">Enviar</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modal-container').innerHTML = modalHtml;
}

async function enviarComprobante() {
    const form = document.getElementById('pago-form');
    const formData = new FormData(form);

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/pagos/subir-comprobante`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert('Comprobante subido exitosamente. Pendiente de verificaci├â┬│n.');
            cerrarModal('pago-modal-overlay');
            loadDashboard();
        } else {
            alert('Error: ' + data.error + (data.details ? '\n\nDetalles: ' + data.details : ''));
        }
    } catch (error) {
        alert('Error al subir comprobante: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function descargarGuia(guiaId) {
    // Si estamos en entorno Capacitor/M├â┬│vil, usamos el navegador del sistema para las descargas
    // Esto evita que el WebView bloquee el Blob o no sepa qu├â┬® hacer con el archivo
    if (window.Capacitor && window.Capacitor.getPlatform() !== 'web') {
        const downloadUrl = `${API_BASE}/guias/${guiaId}/pdf?token=${authToken}`;
        window.open(downloadUrl, '_system');
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/guias/${guiaId}/pdf`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `guia_${guiaId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            const data = await response.json();
            alert('Error: ' + data.error);
        }
    } catch (error) {
        alert('Error al descargar gu├â┬¡a');
    } finally {
        showLoading(false);
    }
}

// La funci├â┬│n calcularImpuestoEstimado ha sido movida al final del archivo para manejar m├â┬║ltiples materiales.


async function rechazarPago(pagoId) {
    const motivo = prompt('Ingrese el motivo del rechazo:');
    if (!motivo) return;

    showLoading(true);

    try {
        const response = await apiRequest(`/pagos/${pagoId}/rechazar`, 'PUT', { notas_rechazo: motivo });

        if (response.success) {
            alert('Pago rechazado.');
            loadDashboard();
        }
    } catch (error) {
        alert('Error al rechazar pago');
    } finally {
        showLoading(false);
    }
}

async function marcarUsada(guiaId) {
    if (!confirm('├é┬┐Marcar esta gu├â┬¡a como usada?')) return;

    showLoading(true);

    try {
        const response = await apiRequest(`/guias/${guiaId}/marcar-usada`, 'PUT');

        if (response.success) {
            alert('Gu├â┬¡a marcada como usada.');
            loadDashboard();
        }
    } catch (error) {
        alert('Error al marcar gu├â┬¡a');
    } finally {
        showLoading(false);
    }
}

async function exonerarGuia(id) {
    if (!confirm('├é┬┐Est├â┬í seguro de que desea exonerar el pago de esta gu├â┬¡a? Esta acci├â┬│n marcar├â┬í la gu├â┬¡a como pagada totalmente y no se podr├â┬í revertir.')) {
        return;
    }

    showLoading(true);
    try {
        const response = await apiRequest(`/guias/${id}/exonerar`, 'PUT');

        if (response.success) {
            Swal.fire({
                icon: 'success',
                title: '├é┬íExonerada!',
                text: 'La gu├â┬¡a ha sido exonerada exitosamente.',
                timer: 2000,
                showConfirmButton: false
            });
            loadDashboard(); // Recargar el dashboard
        }
    } catch (error) {
        console.error('Error al exonerar gu├â┬¡a:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo procesar la exoneraci├â┬│n.'
        });
    } finally {
        showLoading(false);
    }
}

async function anularGuia(guiaId) {
    const motivo = prompt('Ingrese el motivo de anulaci├â┬│n:');
    if (!motivo) return;

    showLoading(true);

    try {
        const response = await apiRequest(`/guias/${guiaId}/anular`, 'PUT', { motivo });

        if (response.success) {
            alert('Gu├â┬¡a anulada.');
            loadDashboard();
        }
    } catch (error) {
        alert('Error al anular gu├â┬¡a');
    } finally {
        showLoading(false);
    }
}

async function eliminarGuia(guiaId, numeroGuia) {
    const { value: clave } = await Swal.fire({
        title: '├░┼©ÔÇöÔÇÿ├»┬©┬Å Eliminar Gu├â┬¡a Permanentemente',
        html: `<p style="margin-bottom:12px;">Esta acci├â┬│n <strong>no se puede deshacer</strong>. Se eliminar├â┬í la gu├â┬¡a <strong>${numeroGuia}</strong> de forma definitiva.</p>
               <p>Ingresa la clave de administrador para continuar:</p>`,
        input: 'password',
        inputPlaceholder: 'Clave de administrador',
        showCancelButton: true,
        confirmButtonText: 'Eliminar definitivamente',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2c2c2c',
        inputAttributes: { autocomplete: 'off' }
    });

    if (!clave) return;

    showLoading(true);
    try {
        const response = await apiRequest(`/guias/${guiaId}`, 'DELETE', { clave_admin: clave });
        if (response.success) {
            Swal.fire('├ó┼ôÔÇª Eliminada', `La gu├â┬¡a ${numeroGuia} fue eliminada permanentemente.`, 'success');
            loadDashboard();
        } else {
            throw new Error(response.error || 'Error al eliminar');
        }
    } catch (error) {
        Swal.fire('Error', error.message || 'No se pudo eliminar la gu├â┬¡a.', 'error');
    } finally {
        showLoading(false);
    }
}

// ===== GESTI├âÔÇ£N DE USUARIOS (MASTER) =====
function mostrarModalCrearUsuario(event) {
    if (event) event.preventDefault();

    const modalHtml = `
        <div class="modal-overlay active" id="usuario-modal-overlay">
            <div class="modal-content floating-anim" style="max-width: 600px; border-radius: 28px; overflow: hidden; border: 1px solid rgba(255,255,255,0.4); box-shadow: 0 24px 50px rgba(0,0,0,0.25);">
                <div class="modal-header" style="border: none; padding: 28px 28px 10px; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="font-size: 26px; font-weight: 800; color: #1a1a1a; letter-spacing: -0.5px;">Registrar Nueva Empresa</h2>
                    <button class="close-modal" onclick="cerrarModal('usuario-modal-overlay')" style="background: #f0f0f0; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; font-size: 20px; color: #666; cursor: pointer;">├âÔÇö</button>
                </div>
                
                <div class="modal-body" style="padding: 0 28px 28px;">
                    <form id="usuario-form">
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; display: block;">Nombre de Empresa (Raz├â┬│n Social) *</label>
                            <input type="text" name="razon_social" class="form-control" placeholder="Ej: Cantera El Valle C.A." required 
                                style="background: #f8f9fa; border: 1px solid #E5E5E7; border-radius: 14px; padding: 12px 16px; font-size: 15px; width: 100%;">
                            <small style="color: #8E8E93; font-size: 12px; margin-top: 6px; display: block;">Este ser├â┬í el nombre de usuario para iniciar sesi├â┬│n.</small>
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 20px;">
                            <label style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; display: block;">RIF *</label>
                            <input type="text" name="rif" class="form-control" placeholder="Ej: J-12345678-9" required 
                                style="background: #f8f9fa; border: 1px solid #E5E5E7; border-radius: 14px; padding: 12px 16px; font-size: 15px; width: 100%;">
                        </div>
                        
                        <div class="form-group" style="margin-bottom: 10px;">
                            <label style="font-size: 14px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; display: block;">Contrase├â┬▒a *</label>
                            <input type="password" name="password" class="form-control" required 
                                style="background: #f8f9fa; border: 1px solid #E5E5E7; border-radius: 14px; padding: 12px 16px; font-size: 15px; width: 100%;">
                        </div>
                    </form>
                </div>
                
                <div class="modal-footer" style="background: #fcfcfc; border-top: 1px solid #f0f0f0; padding: 20px 28px; display: flex; gap: 14px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="cerrarModal('usuario-modal-overlay')" 
                        style="border-radius: 14px; min-width: 120px; background: #8E8E93; border: none; padding: 12px; font-weight: 600;">Cancelar</button>
                    <button class="btn btn-primary" onclick="registrarUsuario()" 
                        style="border-radius: 14px; min-width: 160px; background: #007AFF; border: none; padding: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,122,255,0.3);">Registrar Empresa</button>
                </div>
            </div>
        </div>
    `;

    const container = document.getElementById('modal-container');
    if (container) {
        container.innerHTML = modalHtml;
    } else {
        console.error('No se encontr├â┬│ el contenedor de modales');
    }
}

async function registrarUsuario() {
    const form = document.getElementById('usuario-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    if (!data.razon_social || !data.rif || !data.password) {
        alert('Por favor complete todos los campos.');
        return;
    }

    showLoading(true);

    try {
        const response = await apiRequest('/auth/register-company', 'POST', data);

        if (response.success) {
            alert('Empresa registrada exitosamente.\n\nUsuario: ' + data.razon_social + '\nContrase├â┬▒a: ' + '*'.repeat(data.password.length));
            cerrarModal('usuario-modal-overlay');
            loadDashboard(); // Recargar para actualizar estad├â┬¡sticas si las hubiera
        }
    } catch (error) {
        alert('Error al registrar empresa: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function refreshSystemConfig() {
    try {
        // A├â┬▒adir cache-buster para asegurar que siempre traiga el estado real del Kill Switch
        const response = await apiRequest(`/sistema/config?_t=${new Date().getTime()}`);
        if (response.success) {
            systemConfig = { ...systemConfig, ...response.config };
            console.log('├ó┼íÔäó├»┬©┬Å Configuraci├â┬│n cargada:', systemConfig);
        }
    } catch (error) {
        // Silenciar errores de autenticaci├â┬│n durante la carga inicial
        if (error.message && (error.message.includes('401') || error.message.includes('403') || error.message.includes('Token'))) {
            return;
        }
        console.error('Error al cargar configuraci├â┬│n:', error);
    }
}

async function updateSystemConfig(clave, valor) {
    try {
        const response = await apiRequest(`/sistema/config/${clave}`, 'PUT', { valor });
        if (response.success) {
            systemConfig[clave] = String(valor);
            return true;
        }
    } catch (error) {
        console.error('Error al actualizar configuraci├â┬│n:', error);
        alert('Error al actualizar configuraci├â┬│n: ' + error.message);
    }
    return false;
}

// ===== UTILIDADES =====
async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        }
    };

    if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
    }

    return data;
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function showLoading(show) {
    const loadingScreen = document.getElementById('loading-screen');
    if (show) {
        loadingScreen.classList.add('active');
    } else {
        loadingScreen.classList.remove('active');
    }
}

function cerrarModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
    }

    // Si se pasa un selector gen├â┬®rico o si queremos limpiar el contenedor
    if (!modal && modalId.startsWith('.')) {
        const modalByClass = document.querySelector(modalId);
        if (modalByClass) modalByClass.remove();
    }

    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
}

function getEstadoBadge(estado) {
    const badges = {
        'pendiente_pago': '<span class="badge badge-warning">Pendiente Pago</span>',
        'pago_pendiente_verificacion': '<span class="badge badge-info">Pago Pendiente</span>',
        'activa': '<span class="badge badge-success">Activa</span>',
        'vencida': '<span class="badge badge-secondary">Vencida</span>',
        'anulada': '<span class="badge badge-danger">Anulada</span>',
        'usada': '<span class="badge badge-secondary">Usada</span>'
    };
    return badges[estado] || estado;
}

function formatNumber(num) {
    return parseFloat(num).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formatea el n├â┬║mero de gu├â┬¡a con el prefijo de la empresa y el s├â┬¡mbolo # al inicio
 */
function formatNumeroGuia(numeroGuia, prefix = '') {
    if (!numeroGuia) return '';
    
    // Si ya es un string formateado (ej: "#N01"), retornarlo tal cual
    const strNum = String(numeroGuia);
    if (strNum.startsWith('#')) {
        return strNum;
    }

    const num = strNum.padStart(2, '0');
    const pref = prefix ? String(prefix).toUpperCase().trim() : '';
    
    return `#${pref}${num}`;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-VE');
}

// ===== EMPRESA DESTINATARIA - FORMULARIO DE CONFIRMACI├âÔÇ£N =====
async function loadConfirmacionPage() {
    const dashboardContent = document.getElementById('dashboard-content');

    // Ocultar sidebar, header y nav m├â┬│vil para empresas destinatarias
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('.top-header');
    const mobileNav = document.querySelector('.mobile-nav');
    if (sidebar) sidebar.style.display = 'none';
    if (header) header.style.display = 'none';
    if (mobileNav) mobileNav.style.display = 'none';

    dashboardContent.innerHTML = `
        <div style="max-width: 600px; margin: 40px auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="width: 80px; height: 3px; background: linear-gradient(90deg, #FFCE00 0%, #CE1126 50%, #003DA5 100%); margin: 0 auto 20px;"></div>
                <h1 style="font-size: 28px; font-weight: 600; color: #1a1a1a; margin-bottom: 8px;">Estado La Guaira</h1>
                <h2 style="font-size: 20px; font-weight: 400; color: #666; margin-bottom: 20px;">Sistema de Control de Minerales</h2>
                <p style="color: #888; font-size: 14px;">Confirmaci├â┬│n de Llegada de Mineral</p>
            </div>

            <div class="card" style="background: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                <form id="form-confirmacion" enctype="multipart/form-data">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #333;">Hora de Llegada</label>
                        <input type="datetime-local" id="hora_llegada" name="hora_llegada" required 
                               style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #333;">Nombre de la Empresa que Confirma</label>
                        <input type="text" id="nombre_empresa_confirmante" name="nombre_empresa_confirmante" 
                               value="${currentUser.empresaNombre || ''}" required placeholder="Ingrese el nombre de la empresa"
                               style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #333;">C├â┬│digo de la Gu├â┬¡a</label>
                        <input type="text" id="codigo_guia" name="codigo_guia" required placeholder="Ejemplo: #1254786"
                               style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;">
                        <small style="color: #888; font-size: 12px;">Ingrese el c├â┬│digo que aparece en la gu├â┬¡a f├â┬¡sica (puede incluir o no el s├â┬¡mbolo #)</small>
                    </div>

                    <div class="form-group" style="margin-bottom: 20px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #333;">Mineral Recibido</label>
                        <input type="text" id="mineral_recibido" name="mineral_recibido" required placeholder="Ejemplo: Arena lavada"
                               style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px;">
                    </div>

                    <div class="form-group" style="margin-bottom: 25px;">
                        <label style="display: block; font-weight: 500; margin-bottom: 8px; color: #333;">
                            Foto de la Gu├â┬¡a <span style="color: #e53e3e;">*</span>
                        </label>
                        <div style="border: 2px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; background: #fafafa;">
                            <input type="file" id="foto_guia" name="foto_guia" accept="image/jpeg,image/png" required
                                   onchange="previewImage(this)"
                                   style="display: none;">
                            <label for="foto_guia" style="cursor: pointer;">
                                <div id="preview-container">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2" style="margin: 0 auto 10px;">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                        <circle cx="8.5" cy="8.5" r="1.5"/>
                                        <polyline points="21 15 16 10 5 21"/>
                                    </svg>
                                    <p style="color: #666; font-size: 14px; margin: 0;">Haga clic para seleccionar una foto</p>
                                    <p style="color: #999; font-size: 12px; margin: 5px 0 0;">JPG o PNG (m├â┬íx. 10MB)</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div id="confirmacion-error" class="error-message" style="display: none; margin-bottom: 15px; padding: 12px; background: #fee; border-radius: 8px; color: #c00;"></div>

                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; padding: 15px; font-size: 16px; font-weight: 600;">
                        ├ó┼ôÔÇ£ Confirmar Llegada del Mineral
                    </button>
                </form>

                <div style="margin-top: 20px; text-align: center;">
                    <button class="btnbtn-outline btn-sm" onclick="handleLogout()" style="color: #666; border: none; background: none; cursor: pointer; font-size: 14px;">
                        Cerrar Sesi├â┬│n
                    </button>
                </div>
            </div>

            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                <p>Sistema Oficial del Gobierno del Estado La Guaira</p>
                <p>├é┬® 2026 - Todos los derechos reservados</p>
            </div>
        </div>
    `;

    // Event listener para el formulario
    document.getElementById('form-confirmacion').addEventListener('submit', handleSubmitConfirmacion);
}

function previewImage(input) {
    const preview = document.getElementById('preview-container');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.innerHTML = `
                <img src="${e.target.result}" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
                <p style="color: #28a745; font-size: 14px; margin-top: 10px;">├ó┼ôÔÇ£ Foto cargada</p>
            `;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function handleSubmitConfirmacion(e) {
    e.preventDefault();

    const errorDiv = document.getElementById('confirmacion-error');
    errorDiv.style.display = 'none';

    const form = document.getElementById('form-confirmacion');
    const formData = new FormData(form);

    // Validar que se haya seleccionado una foto
    if (!formData.get('foto_guia') || formData.get('foto_guia').size === 0) {
        errorDiv.textContent = 'Debe adjuntar una foto de la gu├â┬¡a.';
        errorDiv.style.display = 'block';
        return;
    }

    showLoading(true);

    try {
        const response = await fetch(`${API_BASE}/confirmaciones`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // Mostrar mensaje de ├â┬®xito
            mostrarMensajeExito();
        } else {
            errorDiv.textContent = data.error || 'Error al enviar confirmaci├â┬│n.';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error de conexi├â┬│n. Intente nuevamente.';
        errorDiv.style.display = 'block';
    } finally {
        showLoading(false);
    }
}

function mostrarMensajeExito() {
    const dashboardContent = document.getElementById('dashboard-content');
    dashboardContent.innerHTML = `
        <div style="max-width: 500px; margin: 100px auto; text-align: center; padding: 40px;">
            <div style="width: 100px; height: 100px; margin: 0 auto 30px; background: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
            <h1 style="font-size: 32px; font-weight: 600; color: #28a745; margin-bottom: 15px;">├é┬íConfirmaci├â┬│n Exitosa!</h1>
            <p style="font-size: 18px; color: #666; margin-bottom: 30px;">
                Gracias por confirmar la llegada del mineral
            </p>
            <p style="font-size: 14px; color: #999; margin-bottom: 30px;">
                Su confirmaci├â┬│n ha sido registrada y est├â┬í siendo procesada por el sistema.
            </p>
            <button class="btn btn-primary" onclick="loadConfirmacionPage()">
                Registrar Otra Confirmaci├â┬│n
            </button>
        </div>
    `;
}

// ===== ADMIN - SECCI├âÔÇ£N DE CONFIRMACIONES =====
async function loadConfirmacionesSection(container) {
    showLoading(true);

    try {
        const response = await apiRequest('/confirmaciones');
        const confirmaciones = response.confirmaciones;

        container.innerHTML = `
            <div class="dashboard-header">
                <h1 class="dashboard-title">├░┼©ÔÇ£ÔÇ╣ Confirmaciones de Llegada</h1>
                <p class="dashboard-subtitle">Historial de confirmaciones con fotos de gu├â┬¡as</p>
            </div>

            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h2 class="card-title">Confirmaciones Registradas</h2>
                    <span class="badge badge-info">${confirmaciones.length} total</span>
                </div>

                ${confirmaciones.length === 0 ? `
                    <div class="card-body text-center" style="padding: 40px;">
                        <p style="color: #999;">No hay confirmaciones registradas a├â┬║n.</p>
                    </div>
                ` : `
                    <div class="table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Gu├â┬¡a</th>
                                    <th>Empresa Destinataria</th>
                                    <th>Mineral</th>
                                    <th>Validaci├â┬│n</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${confirmaciones.map(conf => `
                                    <tr>
                                        <td data-label="Fecha">${formatDate(conf.created_at)}<br><small style="color: #888;">${new Date(conf.created_at).toLocaleTimeString()}</small></td>
                                        <td data-label="Gu├â┬¡a">${formatNumeroGuia(conf.numero_guia)}</td>
                                        <td data-label="Empresa Dest.">${conf.empresa_dest_nombre}<br><small style="color: #888;">${conf.empresa_dest_rif}</small></td>
                                        <td data-label="Mineral">${conf.mineral_recibido}</td>
                                        <td data-label="Validaci├â┬│n">${getValidacionBadge(conf.foto_validada, conf.validacion_confianza)}</td>
                                        <td data-label="Acciones">
                                            <div style="display: flex; gap: 5px;">
                                                <button class="btn btn-primary btn-sm" onclick="verConfirmacion('${conf.id}')">
                                                    Ver Detalles
                                                </button>
                                                <button class="btn btn-outline btn-sm" onclick="window.open('${API_BASE}/confirmaciones/${conf.id}/foto', '_blank')" title="Ver Foto Original">
                                                    ├░┼©ÔÇ£┬© Ver Foto
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;

    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar confirmaciones.</div>';
    } finally {
        showLoading(false);
    }
}

function getValidacionBadge(validada, confianza) {
    if (validada && confianza >= 70) {
        return `<span class="badge badge-success">├ó┼ôÔÇª Validada (${confianza}%)</span>`;
    } else if (validada && confianza >= 50) {
        return `<span class="badge badge-warning">├ó┼í┬á├»┬©┬Å Parcial (${confianza}%)</span>`;
    } else {
        return `<span class="badge badge-danger">├ó┬Ø┼Æ Rechazada (${confianza || 0}%)</span>`;
    }
}

async function verConfirmacion(confirmacionId) {
    showLoading(true);

    try {
        const response = await apiRequest(`/confirmaciones/${confirmacionId}`);
        const conf = response.confirmacion;

        const modalContainer = document.getElementById('modal-container');
        modalContainer.innerHTML = `
            <div class="modal-overlay" onclick="cerrarModal('modal-confirmacion')">
                <div class="modal-dialog" onclick="event.stopPropagation()" style="max-width: 800px;">
                    <div class="modal-header">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 600;">Detalle de Confirmaci├â┬│n #${conf.id.substring(0, 8)}</h2>
                        <button onclick="cerrarModal('modal-confirmacion')" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
                    </div>
                    <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                            <div>
                                <h3 style="font-size: 14px; color: #888; margin-bottom: 5px;">Fecha de Confirmaci├â┬│n</h3>
                                <p style="font-size: 16px; font-weight: 500;">${formatDate(conf.created_at)} ${new Date(conf.created_at).toLocaleTimeString()}</p>
                            </div>
                            <div>
                                <h3 style="font-size: 14px; color: #888; margin-bottom: 5px;">Hora de Llegada</h3>
                                <p style="font-size: 16px; font-weight: 500;">${new Date(conf.hora_llegada).toLocaleString()}</p>
                            </div>
                            <div>
                                <h3 style="font-size: 14px; color: #888; margin-bottom: 5px;">Gu├â┬¡a</h3>
                                <p style="font-size: 16px; font-weight: 500;">${formatNumeroGuia(conf.numero_guia)}</p>
                            </div>
                            <div>
                                <h3 style="font-size: 14px; color: #888; margin-bottom: 5px;">Empresa Destinataria</h3>
                                <p style="font-size: 16px; font-weight: 500;">${conf.empresa_dest_nombre}</p>
                                <small style="color: #888;">${conf.empresa_dest_rif}</small>
                            </div>
                            <div style="grid-column: 1 / -1;">
                                <h3 style="font-size: 14px; color: #888; margin-bottom: 5px;">Mineral Recibido</h3>
                                <p style="font-size: 16px; font-weight: 500;">${conf.mineral_recibido}</p>
                            </div>
                        </div>

                        <hr style="border: none; height: 1px; background: #eee; margin: 20px 0;">

                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 10px;">Validaci├â┬│n Autom├â┬ítica</h3>
                            <div style="background: ${conf.foto_validada ? '#e8f5e9' : '#ffebee'}; padding: 15px; border-radius: 8px;">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                                    ${conf.foto_validada ? '<span style="font-size: 24px;">├ó┼ôÔÇª</span>' : '<span style="font-size: 24px;">├ó┬Ø┼Æ</span>'}
                                    <span style="font-size: 18px; font-weight: 600;">Confianza: ${conf.validacion_confianza}%</span>
                                </div>
                                <p style="margin: 0; font-size: 14px; color: #666;">
                                    ${conf.coincidencia_numero_guia ? '├ó┼ôÔÇ£ N├â┬║mero de gu├â┬¡a coincide con el ingresado' : '├ó┼í┬á No se pudo verificar el n├â┬║mero de gu├â┬¡a en la foto'}
                                </p>
                            </div>
                        </div>

                        <div style="margin-bottom: 20px;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 10px;">Foto de la Gu├â┬¡a</h3>
                            <div style="text-align: center; background: #f5f5f5; padding: 20px; border-radius: 8px;">
                                <img src="${API_BASE}/confirmaciones/${conf.id}/foto" 
                                     style="max-width: 100%; max-height: 400px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
                                     onclick="window.open(this.src, '_blank')">
                                <p style="margin-top: 10px; font-size: 12px; color: #888;">Haga clic en la imagen para ampliar</p>
                            </div>
                        </div>

                        ${conf.texto_extraido ? `
                            <div style="margin-bottom: 20px;">
                                <details>
                                    <summary style="cursor: pointer; font-weight: 600; margin-bottom: 10px;">Texto Extra├â┬¡do (OCR)</summary>
                                    <div style="background: #fafafa; padding: 15px; border-radius: 8px; font-family: monospace; font-size: 12px; white-space: pre-wrap; max-height: 200px; overflow-y: auto;">
${conf.texto_extraido}
                                    </div>
                                </details>
                            </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="cerrarModal('modal-confirmacion')">Cerrar</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-confirmacion').style.display = 'block';

    } catch (error) {
        alert('Error al cargar confirmaci├â┬│n: ' + error.message);
    } finally {
        showLoading(false);
    }
}


// ===== UI UTILITIES =====
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlayId = 'sidebar-overlay';
    let overlay = document.getElementById(overlayId);

    sidebar.classList.toggle('active');

    if (sidebar.classList.contains('active')) {
        // Mostrar overlay
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = overlayId;
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(4px);
                z-index: 150;
                animation: fadeIn 0.3s;
            `;
            overlay.onclick = toggleSidebar; // Click outside to close
            document.body.appendChild(overlay);
        }
    } else {
        // Ocultar overlay
        if (overlay) {
            overlay.remove();
        }
    }
}

// ===== PERFIL DE EMPRESA =====
async function loadProfileSection(container) {
    // Si es Master, mostrar perfil b├â┬ísico sin llamar a la API de empresas
    if (currentUser.role === 'master') {
        container.innerHTML = `
            <div class="dashboard-header">
                <h1 class="dashboard-title">├░┼©ÔÇÿ┬ñ Perfil de Administrador</h1>
                <p class="dashboard-subtitle">Informaci├â┬│n de la cuenta</p>
            </div>

            <div class="card">
                <div class="card-body">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 30px;">
                        <div style="width: 120px; height: 120px; border-radius: 50%; background: var(--system-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: 700; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            ${currentUser.username.charAt(0).toUpperCase()}
                        </div>
                        
                        <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 5px;">${currentUser.username}</h2>
                        <span class="badge badge-primary">Administrador Master</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        <div class="info-group">
                            <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 5px;">Rol de Usuario</label>
                            <div style="font-size: 16px; padding: 12px; background: #f9f9fa; border-radius: 8px;">Administrador del Sistema</div>
                        </div>
                        <div class="info-group">
                            <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 5px;">Estado</label>
                            <div style="font-size: 16px; padding: 12px; background: #f9f9fa; border-radius: 8px;">Activo</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    showLoading(true);
    try {
        const response = await apiRequest('/empresas/perfil');
        const empresa = response.empresa;

        // URL del logo o placeholder
        const logoSrc = empresa.logo_url || 'https://via.placeholder.com/150?text=Logo';

        container.innerHTML = `
            <div class="dashboard-header">
                <h1 class="dashboard-title">├░┼©ÔÇÿ┬ñ Perfil de Empresa</h1>
                <p class="dashboard-subtitle">Gestiona la identidad de tu empresa</p>
            </div>

            <div class="card">
                <div class="card-body">
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 30px;">
                        <div style="position: relative; margin-bottom: 20px;">
                            <img src="${logoSrc}" alt="Logo Empresa" 
                                 style="width: 150px; height: 150px; object-fit: contain; border-radius: 50%; border: 4px solid #f0f0f5; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            
                            <button onclick="document.getElementById('logo-input').click()" 
                                    style="position: absolute; bottom: 0; right: 0; background: var(--system-blue); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            </button>
                            <input type="file" id="logo-input" accept="image/*" style="display: none;" onchange="subirLogo(this)">
                        </div>
                        
                        <h2 style="font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 5px;">${empresa.razon_social}</h2>
                        <span class="badge badge-success">Empresa Verificada</span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        <div class="info-group">
                            <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 5px;">Raz├â┬│n Social / Nombre</label>
                            <div style="font-size: 16px; padding: 12px; background: #f9f9fa; border-radius: 8px;">${empresa.razon_social}</div>
                        </div>
                        <div class="info-group">
                            <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 5px;">RIF</label>
                            <div style="font-size: 16px; padding: 12px; background: #f9f9fa; border-radius: 8px;">${empresa.rif}</div>
                        </div>
                        <div class="info-group">
                            <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 5px;">Tel├â┬®fono</label>
                            <div style="font-size: 16px; padding: 12px; background: #f9f9fa; border-radius: 8px;">${empresa.telefono || 'No registrado'}</div>
                        </div>
                        <div class="info-group">
                            <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 5px;">Email</label>
                            <div style="font-size: 16px; padding: 12px; background: #f9f9fa; border-radius: 8px;">${empresa.email || 'No registrado'}</div>
                        </div>
                        <div class="info-group" style="grid-column: 1 / -1;">
                            <label style="display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; margin-bottom: 5px;">Direcci├â┬│n Fiscal</label>
                            <div style="font-size: 16px; padding: 12px; background: #f9f9fa; border-radius: 8px;">${empresa.direccion || 'No registrada'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

    } catch (error) {
        container.innerHTML = '<div class="error-message">Error al cargar perfil</div>';
        console.error(error);
    } finally {
        showLoading(false);
    }
}

async function subirLogo(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const formData = new FormData();
        formData.append('logo', file);

        showLoading(true);

        try {
            const response = await fetch(`${API_BASE}/empresas/perfil/logo`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${authToken}` },
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert('Logo actualizado correctamente');
                // Recargar secci├â┬│n para ver cambios
                loadProfileSection(document.getElementById('dashboard-content'));
            } else {
                alert('Error al subir logo: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexi├â┬│n al subir imagen');
        } finally {
            showLoading(false);
        }
    }
}

async function verificarPago(pagoId) {
    if (!confirm('├é┬┐Est├â┬í seguro de que desea verificar este pago? Esta acci├â┬│n activar├â┬í la gu├â┬¡a de movilizaci├â┬│n.')) return;

    showLoading(true);

    try {
        const response = await apiRequest(`/pagos/${pagoId}/verificar`, 'PUT');

        if (response.success) {
            alert('Pago verificado exitosamente. La gu├â┬¡a ha sido activada.');
            loadPagosSection(document.getElementById('dashboard-content'));
        } else {
            alert('Error: ' + response.error);
        }
    } catch (error) {
        alert('Error al verificar pago: ' + error.message);
    } finally {
        showLoading(false);
    }
}

async function rechazarPago(pagoId) {
    const motivo = prompt('Por favor, ingrese el motivo del rechazo:');
    if (!motivo) return;

    showLoading(true);

    try {
        const response = await apiRequest(`/pagos/${pagoId}/rechazar`, 'PUT', { notas_rechazo: motivo });

        if (response.success) {
            alert('Pago rechazado correctamente.');
            loadPagosSection(document.getElementById('dashboard-content'));
        } else {
            alert('Error: ' + response.error);
        }
    } catch (error) {
        alert('Error al rechazar pago: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// ===== FUNCIONES DE MATERIALES (DIN├â┬üMICO) =====

function agregarFilaMaterial() {
    const container = document.getElementById('materiales-container');
    if (!container) return;

    const rowId = 'material-row-' + Date.now();

    const materialesOptions = MATERIALES_DISPONIBLES.map(m =>
        `<option value="${m}">${m}</option>`
    ).join('');

    const row = document.createElement('div');
    row.id = rowId;
    row.className = 'material-row';
    row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1.2fr 1.2fr 1fr auto; gap: 10px; margin-bottom: 10px; align-items: end; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #eee;';

    row.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 12px; margin-bottom: 4px;">Tipo de Mineral</label>
            <select name="material_tipo[]" class="form-control" required onchange="calcularImpuestoEstimado()">
                <option value="">Seleccione...</option>
                ${materialesOptions}
            </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 12px; margin-bottom: 4px;">Cantidad</label>
            <input type="number" step="0.01" name="material_cantidad[]" class="form-control" required placeholder="0.00" onchange="calcularImpuestoEstimado()" onkeyup="calcularImpuestoEstimado()">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 12px; margin-bottom: 4px;">P. Unit. (Bs)</label>
            <input type="text" name="material_precio_bs[]" class="form-control" placeholder="Ej: 5.869,55">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 12px; margin-bottom: 4px;">Precio ($)</label>
            <input type="number" step="0.01" name="material_precio[]" class="form-control" required placeholder="0.00" onchange="calcularImpuestoEstimado()" onkeyup="calcularImpuestoEstimado()">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 12px; margin-bottom: 4px;">Unidad</label>
            <select name="material_unidad[]" class="form-control" required onchange="calcularImpuestoEstimado()">
                <option value="toneladas">Ton</option>
                <option value="m├é┬│">m├é┬│</option>
                <option value="kg">kg</option>
            </select>
        </div>
        <button type="button" class="btn btn-danger btn-sm" onclick="eliminarFilaMaterial('${rowId}')" style="margin-bottom: 0; padding: 8px 10px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
        </button>
    `;

    container.appendChild(row);
    calcularImpuestoEstimado();
}

function eliminarFilaMaterial(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        const rows = document.querySelectorAll('.material-row');
        if (rows.length > 1) {
            row.remove();
            calcularImpuestoEstimado();
        } else {
            alert('Debe incluir al menos un material en la gu├â┬¡a.');
        }
    }
}

function calcularImpuestoEstimado() {
    const cantidades = document.getElementsByName('material_cantidad[]');
    const precios = document.getElementsByName('material_precio[]');
    const totalDisplay = document.getElementById('total-impuesto-estimado');
    if (!totalDisplay) return;

    let totalVentaUSD = 0;
    for (let i = 0; i < cantidades.length; i++) {
        const cant = parseFloat(cantidades[i].value) || 0;
        const prec = parseFloat(precios[i].value) || 0;
        totalVentaUSD += cant * prec;
    }

    const totalImpuestoUSD = totalVentaUSD * 0.025; // 2.5% Costo de la Gu├â┬¡a
    const totalImpuestoBS = totalImpuestoUSD * tasaBCV;

    totalDisplay.innerHTML = `
        <div style="text-align: right; padding: 10px; background: rgba(26, 95, 122, 0.05); border-radius: 8px;">
            <div style="font-size: 13px; color: #666;">Valor Carga: $${formatNumber(totalVentaUSD)} | Tasa: ${tasaBCV}</div>
            <div style="font-size: 14px; color: #1a5f7a; font-weight: 600;">Costo Gu├â┬¡a (2.5%): $${formatNumber(totalImpuestoUSD)} USD</div>
            <div style="font-size: 20px; color: #28a745; font-weight: 800; margin-top: 4px;">
                TOTAL A PAGAR: Bs. ${formatNumber(totalImpuestoBS)}
            </div>
            <small style="color: #666; display: block; margin-top: 4px;">* Este es el monto que la empresa debe transferir por el servicio de gu├â┬¡a.</small>
        </div>
    `;
}
/**
 * Actualiza la tasa BCV manualmente desde el dashboard master
 */
async function actualizarTasaManual() {
    const tasaInput = document.getElementById('manual-tasa-input');
    if (!tasaInput) return;

    const nuevaTasa = parseFloat(tasaInput.value);
    if (isNaN(nuevaTasa) || nuevaTasa <= 0) {
        alert('Por favor ingrese una tasa v├â┬ílida');
        return;
    }

    if (!confirm(`├é┬┐Est├â┬í seguro de cambiar la tasa oficial a ${nuevaTasa} Bs?`)) return;

    showLoading(true);
    try {
        const response = await apiRequest('/sistema/tasa', 'PUT', { tasa: nuevaTasa.toString() });
        if (response.success) {
            tasaBCV = nuevaTasa;
            alert('Tasa actualizada exitosamente');
            // Actualizar todos los elementos que muestren la tasa si existen
            const tasaEl = document.getElementById('current-tasa-display');
            if (tasaEl) tasaEl.innerText = tasaBCV.toFixed(2);
            loadDashboard(); // Recargar para actualizar c├â┬ílculos
        }
    } catch (error) {
        alert('Error al actualizar tasa: ' + error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Obtiene la tasa BCV desde el servidor
 */
async function refreshTasaBCV() {
    try {
        const response = await fetch(`${API_BASE}/sistema/tasa`);
        const data = await response.json();
        if (data.success) {
            tasaBCV = parseFloat(data.tasa_bcv);
            console.log('Tasa BCV cargada:', tasaBCV);
        }
    } catch (e) {
        console.error('Error cargando tasa:', e);
    }
}

/**
 * Muestra el modal con el desglose mensual de ingresos
 */
window.mostrarDetalleIngresos = function () {
    const stats = window.lastDashboardStats;
    if (!stats) {
        console.error('No hay estad├â┬¡sticas cargadas para mostrar el detalle.');
        return;
    }

    const meses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const modalHtml = `
        <div class="modal-overlay active" id="income-detail-modal">
            <div class="modal-content floating-anim" style="max-width: 600px; border-radius: 20px;">
                <div class="modal-header">
                    <h2 class="card-title" style="margin:0; font-size: 20px; font-weight: 800;">├░┼©ÔÇ£┼á Hist├â┬│rico de Ingresos</h2>
                    <button class="close-modal" onclick="cerrarModal('income-detail-modal')">├âÔÇö</button>
                </div>
                <div class="modal-body" style="padding: 20px;">
                    <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; display: grid;">
                        <div class="stat-card stat-success" style="padding: 15px; background: rgba(52, 199, 89, 0.1); border: 1px solid rgba(52, 199, 89, 0.2); border-radius: 12px;">
                            <div class="stat-title" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1a7a33;">ESTE MES</div>
                            <div class="stat-value" style="font-size: 20px; font-weight: 800; color: #1a7a33;">Bs. ${formatNumber(stats.ingresos_mes)}</div>
                        </div>
                        <div class="stat-card stat-primary" style="padding: 15px; background: rgba(0, 122, 255, 0.1); border: 1px solid rgba(0, 122, 255, 0.2); border-radius: 12px;">
                            <div class="stat-title" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #0056b3;">TOTAL HIST├âÔÇ£RICO</div>
                            <div class="stat-value" style="font-size: 20px; font-weight: 800; color: #0056b3;">Bs. ${formatNumber(stats.ingresos_totales)}</div>
                        </div>
                    </div>

                    <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px; color: #1d1d1f;">Desglose Mensual</h3>
                    <div class="table-wrapper" style="max-height: 250px; overflow-y: auto; border: 1px solid #eee; border-radius: 12px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <thead style="position: sticky; top: 0; background: #f5f5f7; z-index: 1;">
                                <tr>
                                    <th style="padding: 12px; text-align: left; border-bottom: 1px solid #eee; color: #86868b;">Mes / A├â┬▒o</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; color: #86868b;">Monto Recaudado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${stats.desglose_mensual && stats.desglose_mensual.length > 0 ?
            stats.desglose_mensual.map(d => `
                                        <tr>
                                            <td style="padding: 12px; border-bottom: 1px solid #eee; color: #1d1d1f;">
                                                <span style="font-weight: 600;">${meses[parseInt(d.mes) - 1]}</span> ${d.anio}
                                            </td>
                                            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee; font-weight: 700; color: #1a7a33;">
                                                Bs. ${formatNumber(d.total)}
                                            </td>
                                        </tr>
                                    `).join('') :
            '<tr><td colspan="2" style="padding: 30px; text-align: center; color: #86868b;">No hay pagos verificados registrados a├â┬║n.</td></tr>'
        }
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer" style="padding: 15px 20px; background: #f5f5f7;">
                    <button class="btn btn-primary" onclick="cerrarModal('income-detail-modal')" style="width: 100%; border-radius: 12px; font-weight: 700;">Cerrar Ventana</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modal-container').innerHTML = modalHtml;
};

// ===== NOTIFICATION SYSTEM =====
function toggleNotifications() {
    const popover = document.getElementById('notification-popover');
    if (!popover) return;

    const isActive = popover.classList.contains('active');

    if (isActive) {
        popover.classList.remove('active');
    } else {
        popover.classList.add('active');
        // Animation reset
        popover.style.animation = 'none';
        popover.offsetHeight; /* trigger reflow */
        popover.style.animation = 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
        loadNotificationsContent();
    }
}

async function loadNotificationsContent() {
    const list = document.getElementById('notification-list');
    if (!list) return;

    list.innerHTML = '<div class="empty-notifications"><div class="loader" style="width:24px;height:24px;border-width:2px;margin:0 auto;"></div></div>';

    // Simular peque├â┬▒a carga para UX
    await new Promise(r => setTimeout(r, 400));

    let notifications = [];

    try {
        if (currentUser.role === 'master') {
            // Para Master: Mostrar pagos pendientes
            const res = await apiRequest('/pagos/pendientes');
            if (res.pagos && res.pagos.length > 0) {
                notifications = res.pagos.map(p => ({
                    title: 'Pago por Verificar',
                    desc: `${p.empresa_nombre} report├â┬│ pago de Bs. ${formatNumber(p.monto)}`,
                    time: p.created_at,
                    type: 'warning',
                    icon: '├░┼©ÔÇÖ┬░'
                }));
            }
        } else {
            // Para Empresas: Mostrar estado reciente de gu├â┬¡as (Mock por ahora o basado en datos locales)
            // Intentamos buscar gu├â┬¡as recientes usads/anuladas
            try {
                const res = await apiRequest('/guias?limit=5');
                if (res.guias) {
                    notifications = res.guias.slice(0, 5).map(g => {
                        let type = 'info';
                        let msg = `Gu├â┬¡a #${g.numero_guia} creada`;
                        let icon = '├░┼©ÔÇ£ÔÇ×';

                        if (g.estado === 'activa') { type = 'success'; msg = `Gu├â┬¡a #${g.numero_guia} APROBADA y Activa`; icon = '├ó┼ôÔÇª'; }
                        if (g.estado === 'usada') { type = 'info'; msg = `Gu├â┬¡a #${g.numero_guia} completada`; icon = '├░┼©┼í┼í'; }
                        if (g.estado === 'anulada') { type = 'danger'; msg = `Gu├â┬¡a #${g.numero_guia} ANULADA`; icon = '├ó┬Ø┼Æ'; }
                        if (g.estado === 'pendiente_pago') { type = 'warning'; msg = `Gu├â┬¡a #${g.numero_guia} pendiente de pago`; icon = '├ó┬Å┬│'; }

                        return {
                            title: 'Actualizaci├â┬│n de Gu├â┬¡a',
                            desc: msg,
                            time: g.updated_at || g.created_at,
                            type: type,
                            icon: icon
                        };
                    });
                }
            } catch (e) { }
        }
    } catch (e) {
        console.error("Error loading notifications:", e);
    }

    if (notifications.length === 0) {
        list.innerHTML = `
            <div class="empty-notifications">
                <div style="font-size: 24px; margin-bottom: 10px;">├░┼©ÔÇ£┬¡</div>
                No tienes notificaciones nuevas
            </div>`;
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item type-${n.type || 'info'}">
            <div class="notification-icon">${n.icon || 'i'}</div>
            <div class="notification-content">
                <div class="notification-title">${n.title}</div>
                <div class="notification-desc">${n.desc}</div>
                <div class="notification-time">${formatTimeAgo(new Date(n.time))}</div>
            </div>
        </div>
    `).join('');
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Hace un momento';
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} h`;
    return date.toLocaleDateString();
}

// ===== QR SCANNER LOGIC (PUBLIC) =====
async function startScanner() {
    const container = document.getElementById('qr-reader-container');
    const loginForm = document.getElementById('login-form');
    
    if (!container || !loginForm) return;

    container.style.display = 'block';
    loginForm.style.display = 'none';

    // Inicializar el lector
    html5QrCode = new Html5Qrcode("qr-reader");
    
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config,
            onScanSuccess
        );
    } catch (err) {
        console.error("Error al iniciar esc├â┬íner:", err);
        Swal.fire({
            title: 'Error de C├â┬ímara',
            text: 'No se pudo acceder a la c├â┬ímara. Por favor, aseg├â┬║rese de dar los permisos necesarios en su dispositivo.',
            icon: 'error',
            confirmButtonColor: '#1a5f7a'
        });
        stopScanner();
    }
}

function onScanSuccess(decodedText) {
    stopScanner();
    
    try {
        // Formato: https://.../verificar/ID?v=HASH
        const url = new URL(decodedText);
        const pathParts = url.pathname.split('/');
        const guiaId = pathParts[pathParts.length - 1];
        const hash = url.searchParams.get('v');
        
        if (guiaId && guiaId.length > 20) {
            verificarGuiaPublica(guiaId, hash);
        } else {
            Swal.fire('C├â┬│digo Inv├â┬ílido', 'El QR no corresponde a una gu├â┬¡a del sistema.', 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'El c├â┬│digo escaneado no es una URL de verificaci├â┬│n v├â┬ílida.', 'error');
    }
}

async function stopScanner() {
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
        } catch (e) {
            console.error("Error al detener el esc├â┬íner:", e);
        }
        html5QrCode = null;
    }
    
    document.getElementById('qr-reader-container').style.display = 'none';
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.style.display = 'block';
}

async function verificarGuiaPublica(guiaId, hash) {
    showLoadingScreen(true, 'Consultando base de datos oficial...');
    

    try {
        const response = await fetch(`${API_BASE}/guias/public/verificar/${guiaId}?v=${hash || ''}`);
        const data = await response.json();
        
        if (data.success) {
            const g = data.guia;
            const statusColor = data.autentica ? '#28a745' : '#dc3545';
            const statusBg = data.autentica ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)';

            Swal.fire({
                title: 'Verificaci├â┬│n de Gu├â┬¡a',
                html: `
                    <div style="text-align: left; font-size: 14px; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
                        <div style="text-align: center; margin-bottom: 20px; padding: 15px; border-radius: 12px; background: ${statusBg}; border: 2.5px solid ${statusColor}; color: ${statusColor}; font-weight: 800; font-size: 16px; letter-spacing: 0.5px;">
                            ${data.autentica ? '├ó┼ôÔÇª GU├â┬ìA AUT├âÔÇ░NTICA' : '├ó┼í┬á├»┬©┬Å FIRMA DIGITAL NO V├â┬üLIDA'}
                            ${!data.autentica ? '<br><small style="font-weight: 400; font-size: 11px;">Este documento podr├â┬¡a ser una falsificaci├â┬│n o el c├â┬│digo es inv├â┬ílido.</small>' : ''}
                        </div>
                        <p style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>N├é┬░ Gu├â┬¡a:</strong> ${g.numero_guia}</p>
                        <p style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>Estado:</strong> <span style="background: ${g.estado === 'activa' ? '#e6f4ea' : '#fce8e6'}; color: ${g.estado === 'activa' ? '#1e8e3e' : '#d93025'}; padding: 2px 8px; border-radius: 20px; font-weight: 800; font-size: 11px;">${g.estado.toUpperCase()}</span></p>
                        <p style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>Empresa:</strong> ${g.empresa_nombre}</p>
                        <p style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>Cliente:</strong> ${g.cliente_nombre || 'N/A'}<br><small style="color: #666; font-weight: 400;">├░┼©ÔÇ£ÔÇ× RIF/C.I: ${g.cliente_rif || 'N/A'}</small></p>
                        <p style="margin-bottom: 12px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>Placa:</strong> <span style="font-family: monospace; font-size: 15px; background: #eee; padding: 1px 6px; border-radius: 4px;">${g.vehiculo_placa}</span></p>
                        
                        <div style="margin-top: 15px; padding: 15px; background: #fdfdfd; border-radius: 16px; border: 1px solid #eee; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                            <h4 style="margin: 0 0 12px; font-size: 13px; color: #1a5f7a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #1a5f7a; padding-bottom: 6px; display: inline-block;">├░┼©ÔÇ£┬ª Minerales Transportados</h4>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                ${g.materiales && g.materiales.length > 0 ? 
                                    g.materiales.map(m => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 8px 12px; border-radius: 8px; border: 1px solid #f0f0f0;">
                                            <span style="font-weight: 600; color: #333; font-size: 13px;">${m.nombre}</span>
                                            <span style="background: #e8f0fe; color: #1a73e8; padding: 3px 10px; border-radius: 30px; font-size: 11px; font-weight: 800;">${m.cantidad} ${m.unidad || 'Ton'}</span>
                                        </div>
                                    `).join('') :
                                    `<div style="color: #666; font-style: italic;">No hay informaci├â┬│n detallada de materiales</div>`
                                }
                            </div>
                        </div>
                    </div>
                `,
                icon: data.autentica ? 'success' : 'warning',
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#1a5f7a'
            });
        } else {
            Swal.fire('No Registrada', 'Esta gu├â┬¡a no existe en el sistema oficial de la Gobernaci├â┬│n.', 'error');
        }
    } catch (error) {
        console.error('Error verificando:', error);
        Swal.fire('Error', 'No se pudo conectar con el servidor de verificaci├â┬│n.', 'error');
    } finally {
        showLoadingScreen(false);
    }
}

function showLoadingScreen(show, text = 'Cargando...') {
    const loader = document.getElementById('loading-screen');
    if (!loader) return;
    
    const p = loader.querySelector('p');
    if (p) p.innerText = text;
    
    if (show) loader.classList.add('active');
    else loader.classList.remove('active');
}

// ===== ADMINISTRACI├âÔÇ£N DE USUARIOS (CREAR Y GESTIONAR) =====
function renderUsuarios(container) {
    container.innerHTML = `
        <div class="content-header">
            <h2 class="content-title">Gesti├â┬│n de Usuarios</h2>
        </div>
        
        <div class="stats-grid" style="grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 2rem;">
            <!-- Formulario de Creaci├â┬│n -->
            <div class="stat-card">
                <h3 id="form-user-title">Crear Nuevo Acceso</h3>
                <p style="color: #666; margin-bottom: 20px; font-size: 14px;">Seleccione el rol y complete los datos requeridos.</p>
                
                <form id="form-crear-usuario" onsubmit="crearUsuario(event)" style="display: flex; flex-direction: column; gap: 15px;">
                    <div class="form-group">
                        <label>Tipo de Usuario (Rol) *</label>
                        <select id="nuevo-usuario-role" class="form-control" required onchange="ajustarCamposRegistro(this.value)">
                            <option value="empresa">Empresa (Cantera)</option>
                            <option value="contribuyente">Contribuyente (Payer)</option>
                            <option value="fiscalizador">Fiscalizador (Gobierno)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label id="label-username">Nombre de Usuario / Raz├â┬│n Social *</label>
                        <input type="text" id="nuevo-usuario-username" class="form-control" required placeholder="Ej: Agregados La Guaira C.A. o Nombre del Fiscal">
                    </div>
                    
                    <div id="group-letra" class="form-group">
                        <label class="form-label">Letra de C├â┬│digo (Prefijo)</label>
                        <input type="text" id="nuevo-usuario-letra" class="form-control" placeholder="Ej: N (Para N01)" maxlength="5">
                        <small style="color: #888;">Esta letra aparecer├â┬í antes del n├â┬║mero de gu├â┬¡a.</small>
                    </div>

                    <div id="group-empresa-padre" class="form-group" style="display: none;">
                        <label>Empresa Vinculada *</label>
                        <select id="nuevo-usuario-empresa-padre" class="form-control">
                            <option value="">Seleccione una empresa...</option>
                        </select>
                        <small style="color: #666;">El aliado compartir├â┬í gu├â┬¡as, codificaci├â┬│n y pagos con esta empresa.</small>
                    </div>

                    <div id="group-rif" class="form-group">
                        <label>RIF *</label>
                        <input type="text" id="nuevo-usuario-rif" class="form-control" placeholder="Ej: J-12345678-9">
                    </div>
                    
                    <div class="form-group">
                        <label>Contrase├â┬▒a Provisional *</label>
                        <input type="password" id="nuevo-usuario-password" class="form-control" required placeholder="Min. 6 caracteres">
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="margin-top: 10px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <line x1="20" y1="8" x2="20" y2="14" />
                            <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                        Crear Usuario
                    </button>
                </form>
            </div>

            <!-- Resumen R├â┬ípido -->
            <div class="stat-card" style="display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; background: linear-gradient(135deg, #1a5f7a 0%, #0d2b38 100%); color: white;">
                <div style="font-size: 40px; margin-bottom: 10px;">├░┼©ÔÇÿ┬Ñ</div>
                <h3 style="color: white; margin-bottom: 5px;">Control de Usuarios</h3>
                <p style="opacity: 0.8; font-size: 13px;">Como administrador Master, puedes habilitar o deshabilitar accesos en tiempo real para mantener la seguridad del sistema.</p>
            </div>
        </div>

        <!-- Lista de Usuarios -->
        <div class="stat-card" style="overflow-x: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin:0;">Usuarios Registrados</h3>
                <button class="btn btn-secondary btn-sm" onclick="renderListaUsuarios()">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l5.64 5.64A9 9 0 0 0 20.49 15"/></svg>
                    Actualizar
                </button>
            </div>
            <div id="lista-usuarios-container">
                <div style="text-align: center; padding: 20px; color: #666;">Cargando usuarios...</div>
            </div>
        </div>
    `;

    // Cargar la lista inicialmente
    renderListaUsuarios();
}

function ajustarCamposRegistro(role) {
    const groupRif = document.getElementById('group-rif');
    const groupLetra = document.getElementById('group-letra');
    const groupPadre = document.getElementById('group-empresa-padre');
    const labelUsername = document.getElementById('label-username');
    const inputRif = document.getElementById('nuevo-usuario-rif');
    const selectPadre = document.getElementById('nuevo-usuario-empresa-padre');

    if (role === 'fiscalizador') {
        groupRif.style.display = 'none';
        groupLetra.style.display = 'none';
        groupPadre.style.display = 'none';
        inputRif.required = false;
        selectPadre.required = false;
        labelUsername.innerText = 'Nombre Completo del Fiscalizador *';
    } else if (role === 'contribuyente') {
        groupRif.style.display = 'none';
        groupLetra.style.display = 'none';
        groupPadre.style.display = 'block';
        inputRif.required = false;
        selectPadre.required = true;
        labelUsername.innerText = 'Nombre del Aliado (Usuario) *';
    } else {
        groupRif.style.display = 'block';
        groupLetra.style.display = 'block';
        groupPadre.style.display = 'none';
        inputRif.required = true;
        selectPadre.required = false;
        labelUsername.innerText = 'Raz├â┬│n Social de la Empresa *';
    }
}

async function renderListaUsuarios() {
    const container = document.getElementById('lista-usuarios-container');
    if (!container) return;

    try {
        const response = await fetch(API_BASE + '/auth/users', {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        if (data.users.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px;">No hay usuarios registrados.</div>';
            return;
        }

        // Poblaci├â┬│n del dropdown de Empresa Vinculada (Aliados)
        const selectPadre = document.getElementById('nuevo-usuario-empresa-padre');
        if (selectPadre) {
            const empresasUnicas = Array.from(new Map(data.users.filter(u => u.role === 'empresa' && u.empresa_id).map(u => [u.empresa_id, u])).values());
            let optionsHTML = '<option value="">Seleccione una empresa...</option>';
            empresasUnicas.forEach(emp => {
                optionsHTML += `<option data-rif="${emp.rif}" value="${emp.empresa_id}">${emp.empresa_nombre || emp.username} (RIF: ${emp.rif || 'N/A'})</option>`;
            });
            selectPadre.innerHTML = optionsHTML;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Usuario / Raz├â┬│n Social</th>
                        <th>Prefix</th>
                        <th>Rol</th>
                        <th>Identificaci├â┬│n (RIF)</th>
                        <th>Estado</th>
                        <th>Acci├â┬│n</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.users.map(u => `
                        <tr>
                            <td style="font-weight: 600;">${u.username}</td>
                            <td><span style="font-family: monospace; font-weight: 800; color: #1a5f7a;">${u.codigo_letra || '-'}</span></td>
                            <td><span class="badge ${u.role === 'empresa' ? 'bg-info' : u.role === 'fiscalizador' ? 'bg-warning' : 'bg-primary'}">${u.role.toUpperCase()}</span></td>
                            <td style="font-family: monospace;">${u.rif || 'N/A'}</td>
                            <td>
                                <span class="badge ${u.activo ? 'bg-success' : 'bg-danger'}">
                                    ${u.activo ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </td>
                            <td>
                                <div style="display: flex; gap: 5px;">
                                    ${u.role === 'empresa' && u.empresa_id ? `
                                        <button class="btn btn-primary btn-sm" onclick="editarEmpresa('${u.empresa_id}', '${u.empresa_nombre || u.username}', '${u.codigo_letra || ''}')" title="Editar Empresa">
                                            ├ó┼ô┬Å├»┬©┬Å
                                        </button>
                                    ` : ''}
                                    ${u.role === 'contribuyente' && u.empresa_id ? `
                                        <button class="btn btn-info btn-sm" onclick="vincularAliado('${u.id}', '${u.empresa_id}')" title="Vincular a Empresa">
                                            ├░┼©ÔÇØÔÇö
                                        </button>
                                    ` : ''}
                                    ${u.role !== 'master' ? `
                                        <button class="btn btn-secondary btn-sm" onclick="cambiarClaveUsuario('${u.id}', '${u.username}')" title="Cambiar Contrase├â┬▒a">
                                            ├░┼©ÔÇØÔÇÿ
                                        </button>
                                    ` : ''}
                                    <button class="btn ${u.activo ? 'btn-danger' : 'btn-success'} btn-sm" onclick="toggleUserStatus('${u.id}', ${u.activo})">
                                        ${u.activo ? 'Desactivar' : 'Activar'}
                                    </button>
                                    <button class="btn btn-danger btn-sm" onclick="eliminarUsuario('${u.id}')" title="Borrar Registros del Usuario" style="background-color: #dc3545; border-color: #dc3545;">
                                        ├░┼©ÔÇöÔÇÿ├»┬©┬Å
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        container.innerHTML = `<div style="color: red; padding: 20px;">Error: ${error.message}</div>`;
    }
}

async function cambiarClaveUsuario(userId, username) {
    const { value: nuevaContrasena } = await Swal.fire({
        title: `Cambiar Clave de ${username}`,
        input: 'password',
        inputLabel: 'Nueva Contrase├â┬▒a',
        inputPlaceholder: 'Ingresa la nueva contrase├â┬▒a',
        showCancelButton: true,
        confirmButtonText: 'Guardar Clave',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value || value.length < 6) {
                return 'La contrase├â┬▒a debe tener al menos 6 caracteres';
            }
        }
    });

    if (nuevaContrasena) {
        try {
            const response = await apiRequest(`/auth/users/${userId}/password`, 'PUT', { nueva_contrasena: nuevaContrasena });
            if (response.success) {
                Swal.fire({
                    icon: 'success',
                    title: '├é┬íContrase├â┬▒a Actualizada!',
                    text: `La contrase├â┬▒a de ${username} ha sido cambiada correctamente.`,
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        } catch (error) {
            Swal.fire('Error', 'No se pudo cambiar la contrase├â┬▒a: ' + error.message, 'error');
        }
    }
}

async function toggleUserStatus(userId, currentStatus) {
    const newStatus = !currentStatus;
    const confirm = await Swal.fire({
        title: '├é┬┐Est├â┬ís seguro?',
        text: `El usuario ser├â┬í ${newStatus ? 'activado' : 'desactivado'} y ${newStatus ? 'podr├â┬í' : 'NO podr├â┬í'} entrar al sistema.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#1a5f7a',
        cancelButtonColor: '#d33',
        confirmButtonText: 'S├â┬¡, cambiar estado'
    });

    if (confirm.isConfirmed) {
        try {
            const response = await fetch(`${API_BASE}/auth/toggle-status/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify({ activo: newStatus })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            Swal.fire('Actualizado', data.message, 'success');
            renderListaUsuarios();

        } catch (error) {
            console.error('Error toggling status:', error);
            Swal.fire('Error', error.message, 'error');
        }
    }
}

async function eliminarUsuario(userId) {
    const confirm = await Swal.fire({
        title: '├ó┼í┬á├»┬©┬Å ├é┬┐Eliminar Usuario?',
        text: "La eliminaci├â┬│n ser├â┬í permanente. Si el usuario ya factur├â┬│ / cre├â┬│ gu├â┬¡as, el sistema denegar├â┬í la eliminaci├â┬│n para no da├â┬▒ar los registros hist├â┬│ricos.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#aaa',
        confirmButtonText: 'S├â┬¡, Eliminar de la lista'
    });

    if (confirm.isConfirmed) {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/auth/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + authToken }
            });
            const data = await response.json();
            
            if (!data.success) {
                // Si backend manda error 400 por Foreign Key, lo lanzamos para que se atrape abajo
                throw new Error(data.error);
            }
            
            Swal.fire('Eliminado', 'Usuario borrado exitosamente.', 'success');
            renderListaUsuarios();
        } catch (error) {
            console.error('Error eliminando usuario:', error);
            Swal.fire('Acci├â┬│n Reprobada', error.message, 'error');
        } finally {
            showLoading(false);
        }
    }
}

async function crearUsuario(event) {
    event.preventDefault();
    
    const role = document.getElementById('nuevo-usuario-role').value;
    const username = document.getElementById('nuevo-usuario-username').value.trim();
    let rif = document.getElementById('nuevo-usuario-rif').value.trim();
    let letra = document.getElementById('nuevo-usuario-letra').value.trim();
    const password = document.getElementById('nuevo-usuario-password').value;
    
    if (role === 'contribuyente') {
        const selectPadre = document.getElementById('nuevo-usuario-empresa-padre');
        const selectedOption = selectPadre.options[selectPadre.selectedIndex];
        rif = selectedOption ? selectedOption.getAttribute('data-rif') : '';
        letra = ''; // El backend/db usa la codificaci├â┬│n de la empresa padre
        
        if (!rif) {
            return Swal.fire('Error', 'Debe seleccionar una Empresa Vinculada para este Aliado.', 'error');
        }
    }

    if (password.length < 6) {
        return Swal.fire('Error', 'La contrase├â┬▒a debe tener al menos 6 caracteres.', 'error');
    }
    
    const btnSubmit = event.target.querySelector('button[type="submit"]');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.innerHTML = 'Procesando...';
    btnSubmit.disabled = true;
    
    try {
        const response = await fetch(API_BASE + '/auth/register-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({
                username,
                password,
                role,
                razon_social: username, 
                rif: role === 'fiscalizador' ? null : rif,
                codigo_letra: letra
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al crear usuario');
        
        Swal.fire('├âÔÇ░xito', data.message, 'success');
        event.target.reset();
        renderListaUsuarios();
        
    } catch (error) {
        console.error('Error creando usuario:', error);
        Swal.fire('Error', error.message, 'error');
    } finally {
        btnSubmit.innerHTML = originalText;
        btnSubmit.disabled = false;
    }
}

async function editarEmpresa(empresaId, nombreActual, letraActual) {
    const { value: formValues } = await Swal.fire({
        title: '├ó┼ô┬Å├»┬©┬Å Editar Empresa',
        html: `
            <div style="text-align: left;">
                <label style="display: block; font-weight: 600; margin-bottom: 5px;">Raz├â┬│n Social</label>
                <input id="edit-nombre" class="swal2-input" value="${nombreActual}" style="margin: 0 0 15px 0; width: 100%;">
                
                <label style="display: block; font-weight: 600; margin-bottom: 5px;">Letra de C├â┬│digo (Prefijo)</label>
                <input id="edit-letra" class="swal2-input" value="${letraActual}" style="margin: 0 0 5px 0; width: 100%;" maxlength="5">
                <small style="color: #888;">Ejemplo: N (generar├â┬í gu├â┬¡as como N01, N02...)</small>

                <hr style="margin: 15px 0;">
                <label style="display: block; font-weight: 600; margin-bottom: 5px;">Nueva Contrase├â┬▒a <span style="color:#888; font-weight:400;">(dejar vac├â┬¡o para no cambiar)</span></label>
                <input id="edit-password" type="password" class="swal2-input" placeholder="Nueva contrase├â┬▒a..." style="margin: 0; width: 100%;">
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Guardar Cambios',
        cancelButtonText: 'Cancelar',
        preConfirm: () => {
            const newPass = document.getElementById('edit-password').value.trim();
            if (newPass && newPass.length < 6) {
                Swal.showValidationMessage('La contrase├â┬▒a debe tener al menos 6 caracteres');
                return false;
            }
            return {
                razon_social: document.getElementById('edit-nombre').value.trim(),
                codigo_letra: document.getElementById('edit-letra').value.trim(),
                nueva_contrasena: newPass || null
            };
        }
    });

    if (formValues) {
        if (!formValues.razon_social) {
            return Swal.fire('Error', 'La Raz├â┬│n Social es obligatoria.', 'error');
        }

        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/auth/empresas/${empresaId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify(formValues)
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            Swal.fire('├âÔÇ░xito', 'Empresa actualizada correctamente.', 'success');
            renderListaUsuarios(); // Recargar lista
        } catch (error) {
            console.error('Error al editar empresa:', error);
            Swal.fire('Error', error.message, 'error');
        } finally {
            showLoading(false);
        }
    }
}

async function vincularAliado(userId, currentEmpresaId) {
    const selectPadre = document.getElementById('nuevo-usuario-empresa-padre');
    let opcionesEmpresas = selectPadre ? selectPadre.innerHTML : '<option value="">No se pudieron cargar las empresas</option>';

    const { value: empresaId } = await Swal.fire({
        title: '├░┼©ÔÇØÔÇö Vincular Aliado',
        html: `
            <div style="text-align: left;">
                <label style="display: block; font-weight: 600; margin-bottom: 5px;">Seleccione la Empresa Ra├â┬¡z</label>
                <select id="vincular-empresa-select" class="swal2-select" style="display: flex; width: 100%; margin: 0;">
                    ${opcionesEmpresas}
                </select>
                <small style="color: #666; margin-top: 10px; display: block;">Este usuario aliado depender├â┬í y compartir├â┬í las gu├â┬¡as de la empresa seleccionada.</small>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Vincular',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            const selectEl = document.getElementById('vincular-empresa-select');
            if (selectEl && currentEmpresaId) {
                selectEl.value = currentEmpresaId;
            }
        },
        preConfirm: () => {
            const val = document.getElementById('vincular-empresa-select').value;
            if (!val) {
                Swal.showValidationMessage('Debe seleccionar una empresa');
                return false;
            }
            return val;
        }
    });

    if (empresaId) {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/auth/users/${userId}/vincular`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify({ empresa_id: empresaId })
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error);

            Swal.fire('├âÔÇ░xito', data.message, 'success');
            renderListaUsuarios(); // Recargar lista
        } catch (error) {
            console.error('Error al vincular aliado:', error);
            Swal.fire('Error', error.message, 'error');
        } finally {
            showLoading(false);
        }
    }
}

// ===== DASHBOARD FISCALIZADOR =====
// ===== DASHBOARD FISCALIZADOR =====
function renderDashboardFiscalizador(container) {
    container.innerHTML = `
        <div class="content-header">
            <h2 class="content-title">Panel de Fiscalizaci├â┬│n</h2>
        </div>
        
        <div class="stats-grid" style="grid-template-columns: 1fr;">
            <div class="stat-card">
                <h3>Verificaci├â┬│n R├â┬ípida</h3>
                <p style="color: #666; margin-bottom: 20px;">Use el esc├â┬íner para verificar gu├â┬¡as en puntos de control.</p>
                <div style="display: flex; flex-direction: column; gap: 15px; align-items: center; padding: 20px; border: 2px dashed #1a5f7a; border-radius: 12px; background: rgba(26, 95, 122, 0.05);">
                    <div style="font-size: 48px;">├░┼©ÔÇ£┬À</div>
                    <button class="btn btn-primary" onclick="startFiscalizadorScanner()">
                        <span>├░┼©ÔÇØ┬ì</span> Escanear C├â┬│digo QR
                    </button>
                    <p style="font-size: 12px; color: #666;">Permite registrar la verificaci├â┬│n oficial en el sistema.</p>
                </div>
            </div>
        </div>

        <div class="stat-card" style="margin-top: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">
                <div>
                    <h3 style="margin:0;">Mi Historial de Verificaciones</h3>
                    <p style="color: #666; margin:0; font-size: 13px;">Filtre sus verificaciones por periodo.</p>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap;">
                    <div class="form-group" style="margin:0;">
                        <label style="font-size: 12px;">Desde:</label>
                        <input type="date" id="historial-start-date" class="form-control">
                    </div>
                    <div class="form-group" style="margin:0;">
                        <label style="font-size: 12px;">Hasta:</label>
                        <input type="date" id="historial-end-date" class="form-control">
                    </div>
                    <button class="btn btn-secondary" onclick="loadHistorialVerificaciones()">
                        <span>├░┼©ÔÇØ┬ì</span> Filtrar
                    </button>
                    <button class="btn btn-success" onclick="descargarReporteVerificaciones()">
                        <span>├░┼©ÔÇ£ÔÇ×</span> Descargar PDF
                    </button>
                </div>
            </div>
            <div id="historial-verificaciones-tabla">
                <div class="info-message">Cargando historial...</div>
            </div>
        </div>

        <!-- Contenedor flotante para el esc├â┬íner del fiscalizador -->
        <div id="fiscalizador-scanner-modal" class="modal" style="display:none; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); align-items:center; justify-content:center;">
             <div style="width: 90%; max-width: 500px; background: #fff; border-radius: 12px; overflow: hidden; position: relative;">
                <div style="padding: 15px; background: #1a5f7a; color: #fff; display: flex; justify-content: space-between;">
                    <h3 style="margin:0; font-size: 16px;">Esc├â┬íner de Fiscalizaci├â┬│n</h3>
                    <span onclick="stopFiscalizadorScanner()" style="cursor:pointer; font-weight:bold;">├ó┼ôÔÇó</span>
                </div>
                <div id="fiscalizador-qr-reader" style="width: 100%;"></div>
                <div style="padding: 15px; text-align: center;">
                    <p style="font-size: 13px; color: #666;">Enfoque el c├â┬│digo QR de la gu├â┬¡a para verificarla.</p>
                    <button class="btn btn-secondary" onclick="stopFiscalizadorScanner()" style="width:100%;">Cancelar</button>
                </div>
             </div>
        </div>
    `;
    
    // Cargar historial
    loadHistorialVerificaciones();
}

async function obtenerReporteEstadistico() {
    const start = document.getElementById('stats-start-date').value;
    const end = document.getElementById('stats-end-date').value;
    const resultDiv = document.getElementById('stats-result');
    const countDiv = document.getElementById('stats-total-count');

    if (!start || !end) {
        return Swal.fire('Atenci├â┬│n', 'Seleccione ambas fechas para filtrar.', 'info');
    }

    try {
        const response = await fetch(`${API_BASE}/stats/guias-count?startDate=${start}&endDate=${end}`, {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        resultDiv.style.display = 'block';
        countDiv.innerText = data.total;

    } catch (error) {
        console.error('Error stats:', error);
        Swal.fire('Error', error.message, 'error');
    }
}

// ===== GESTI├âÔÇ£N DE SEGURIDAD (CAMBIAR CLAVE) =====
function renderCambiarClave(container) {
    container.innerHTML = `
        <div class="content-header">
            <h2 class="content-title">Seguridad de la Cuenta</h2>
        </div>
        
        <div class="stats-grid" style="grid-template-columns: 1fr; max-width: 500px;">
            <div class="stat-card">
                <h3>Cambiar Contrase├â┬▒a</h3>
                <p style="color: #666; margin-bottom: 20px; font-size: 14px;">Actualice su contrase├â┬▒a peri├â┬│dicamente para mantener su cuenta segura.</p>
                
                <form onsubmit="handleCambiarClave(event)" style="display: flex; flex-direction: column; gap: 15px;">
                    <div class="form-group">
                        <label>Contrase├â┬▒a Actual</label>
                        <input type="password" id="pass-actual" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Nueva Contrase├â┬▒a</label>
                        <input type="password" id="pass-nueva" class="form-control" required minlength="6" placeholder="Min. 6 caracteres">
                    </div>
                    <div class="form-group">
                        <label>Confirmar Nueva Contrase├â┬▒a</label>
                        <input type="password" id="pass-confirm" class="form-control" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary">Actualizar Contrase├â┬▒a</button>
                </form>
            </div>
        </div>
    `;
}

async function handleCambiarClave(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('pass-actual').value;
    const newPassword = document.getElementById('pass-nueva').value;
    const confirmPassword = document.getElementById('pass-confirm').value;

    if (newPassword !== confirmPassword) {
        return Swal.fire('Error', 'Las contrase├â┬▒as nuevas no coinciden.', 'error');
    }

    try {
        const response = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        Swal.fire('├âÔÇ░xito', 'Su contrase├â┬▒a ha sido actualizada.', 'success');
        event.target.reset();

    } catch (error) {
        console.error('Error pass:', error);
        Swal.fire('Error', error.message, 'error');
    }
}

// ===== L├âÔÇ£GICA DE ESCANEO Y VERIFICACI├âÔÇ£N (FISCALIZADOR) =====
let fiscalizadorScanner = null;

async function startFiscalizadorScanner() {
    const modal = document.getElementById('fiscalizador-scanner-modal');
    modal.style.display = 'flex';

    fiscalizadorScanner = new Html5Qrcode("fiscalizador-qr-reader");
    
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    try {
        await fiscalizadorScanner.start(
            { facingMode: "environment" }, 
            config,
            onFiscalizadorScanSuccess
        );
    } catch (err) {
        console.error("Error al iniciar esc├â┬íner fiscalizador:", err);
        Swal.fire('Error', 'No se pudo acceder a la c├â┬ímara.', 'error');
        stopFiscalizadorScanner();
    }
}

function stopFiscalizadorScanner() {
    const modal = document.getElementById('fiscalizador-scanner-modal');
    if (modal) modal.style.display = 'none';
    
    if (fiscalizadorScanner) {
        fiscalizadorScanner.stop().then(() => {
            fiscalizadorScanner.clear();
            fiscalizadorScanner = null;
        }).catch(err => console.error("Error al detener esc├â┬íner:", err));
    }
}

async function onFiscalizadorScanSuccess(decodedText) {
    stopFiscalizadorScanner();
    
    try {
        const url = new URL(decodedText);
        const pathParts = url.pathname.split('/');
        const guiaId = pathParts[pathParts.length - 1];

        if (!guiaId || guiaId.length < 20) {
            throw new Error('C├â┬│digo QR no v├â┬ílido para el sistema.');
        }

        Swal.fire({
            title: 'Verificando Gu├â┬¡a...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const response = await fetch(`${API_BASE}/guias/oficial/verificar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({ guiaId, ubicacion: 'Punto de Control Movil' })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        // Mostrar modal detallado igual al del login
        const g = data.guia;
        const statusColor = '#28a745';
        const statusBg = 'rgba(40, 167, 69, 0.1)';

        Swal.fire({
            title: 'Verificaci├â┬│n de Gu├â┬¡a',
            html: `
                <div style="text-align: left; font-size: 14px; font-family: 'Inter', system-ui, -apple-system, sans-serif;">
                    <div style="text-align: center; margin-bottom: 20px; padding: 15px; border-radius: 12px; background: ${statusBg}; border: 2.5px solid ${statusColor}; color: ${statusColor}; font-weight: 800; font-size: 16px; letter-spacing: 0.5px;">
                        ├ó┼ôÔÇª GU├â┬ìA VERIFICADA Y REGISTRADA
                    </div>
                    <p style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>N├é┬░ Gu├â┬¡a:</strong> ${g.numero_guia}</p>
                    <p style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>Estado:</strong> <span style="background: ${g.estado === 'activa' ? '#e6f4ea' : '#fce8e6'}; color: ${g.estado === 'activa' ? '#1e8e3e' : '#d93025'}; padding: 2px 8px; border-radius: 20px; font-weight: 800; font-size: 11px;">${g.estado.toUpperCase()}</span></p>
                    <p style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>Empresa:</strong> ${g.empresa_nombre}</p>
                    <p style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>Cliente:</strong> ${g.cliente_nombre || 'N/A'}<br><small style="color: #666; font-weight: 400;">├░┼©ÔÇ£ÔÇ× RIF/C.I: ${g.cliente_rif || 'N/A'}</small></p>
                    <p style="margin-bottom: 12px; border-bottom: 1px dashed #eee; padding-bottom: 4px;"><strong>Placa:</strong> <span style="font-family: monospace; font-size: 15px; background: #eee; padding: 1px 6px; border-radius: 4px;">${g.vehiculo_placa}</span></p>
                    
                    <div style="margin-top: 15px; padding: 15px; background: #fdfdfd; border-radius: 16px; border: 1px solid #eee; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                        <h4 style="margin: 0 0 12px; font-size: 13px; color: #1a5f7a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #1a5f7a; padding-bottom: 6px; display: inline-block;">├░┼©ÔÇ£┬ª Minerales Transportados</h4>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${g.materiales && g.materiales.length > 0 ? 
                                g.materiales.map(m => `
                                    <div style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 8px 12px; border-radius: 8px; border: 1px solid #f0f0f0;">
                                        <span style="font-weight: 600; color: #333; font-size: 13px;">${m.nombre}</span>
                                        <span style="background: #e8f0fe; color: #1a73e8; padding: 3px 10px; border-radius: 30px; font-size: 11px; font-weight: 800;">${m.cantidad} ${m.unidad || 'Ton'}</span>
                                    </div>
                                `).join('') :
                                `<div style="background: white; padding: 8px 12px; border-radius: 8px; border: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 600; color: #333; font-size: 13px;">${g.tipo_mineral}</span>
                                    <span style="background: #e8f0fe; color: #1a73e8; padding: 3px 10px; border-radius: 30px; font-size: 11px; font-weight: 800;">${g.cantidad || '--'}</span>
                                </div>`
                            }
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#1a5f7a'
        });

        loadHistorialVerificaciones();

    } catch (error) {
        console.error('Error en escaneo fiscalizador:', error);
        Swal.fire('Error', error.message || 'Error al procesar el c├â┬│digo.', 'error');
    }
}

async function loadHistorialVerificaciones() {
    const tableContainer = document.getElementById('historial-verificaciones-tabla');
    if (!tableContainer) return;

    const start = document.getElementById('historial-start-date')?.value || '';
    const end = document.getElementById('historial-end-date')?.value || '';

    try {
        let url = `${API_BASE}/guias/oficial/verificaciones`;
        if (start || end) {
            url += `?startDate=${start}&endDate=${end}`;
        }

        const response = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });
        const data = await response.json();

        if (!data.success) throw new Error(data.error);

        if (data.verificaciones.length === 0) {
            tableContainer.innerHTML = '<div class="info-message">A├â┬║n no ha verificado ninguna gu├â┬¡a.</div>';
            return;
        }

        tableContainer.innerHTML = `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Gu├â┬¡a #</th>
                            <th>Veh├â┬¡culo</th>
                            <th>Material</th>
                            <th>Empresa</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.verificaciones.map(v => `
                            <tr>
                                <td>${new Date(v.fecha_verificacion).toLocaleString('es-VE')}</td>
                                <td><strong>${v.numero_guia}</strong></td>
                                <td><span class="badge badge-info">${v.vehiculo_placa}</span></td>
                                <td>${v.tipo_mineral}</td>
                                <td>${v.empresa_nombre}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

    } catch (error) {
        console.error('Error load historial:', error);
        tableContainer.innerHTML = '<div class="error-message">Error al cargar el historial.</div>';
    }
}

async function descargarReporteVerificaciones() {
    const start = document.getElementById('historial-start-date')?.value;
    const end = document.getElementById('historial-end-date')?.value;

    if (!start || !end) {
        return Swal.fire('Atenci├â┬│n', 'Seleccione un rango de fechas (Desde/Hasta) para generar el PDF.', 'info');
    }

    // Si estamos en entorno Capacitor/M├â┬│vil, usamos el navegador del sistema para las descargas
    if (window.Capacitor && window.Capacitor.getPlatform() !== 'web') {
        const downloadUrl = `${API_BASE}/reportes/verificaciones-pdf?startDate=${start}&endDate=${end}&token=${authToken}`;
        window.open(downloadUrl, '_system');
        Swal.close();
        return;
    }

    try {
        Swal.fire({
            title: 'Generando PDF...',
            text: 'Espere un momento por favor.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const response = await fetch(`${API_BASE}/reportes/verificaciones-pdf?startDate=${start}&endDate=${end}`, {
            headers: { 'Authorization': 'Bearer ' + authToken }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Error al descargar el PDF.');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-verificaciones-${new Date().getTime()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        Swal.close();

    } catch (error) {
        console.error('Error descarga PDF:', error);
        Swal.fire('Error', error.message, 'error');
    }
}

async function purgarSistema() {
    const { value: password } = await Swal.fire({
        title: '├ó┼í┬á├»┬©┬Å ACCI├âÔÇ£N CR├â┬ìTICA',
        html: `
            <div style="text-align: left; background: #fff8f8; padding: 15px; border-radius: 10px; border: 1px solid #ffccba; font-size: 14px; line-height: 1.5;">
                <p style="margin-bottom: 10px; color: #dc3545; font-weight: 700;">Esta acci├â┬│n ELIMINAR├â┬ü TODAS LAS GU├â┬ìAS, PAGOS Y RASTREOS del sistema de forma permanente.</p>
                <ul style="margin-left: 20px; color: #333;">
                    <li><strong>SE BORRAR├â┬ü</strong>: Gu├â┬¡as, Pagos, Verificaciones, Tracking, Confirmaciones.</li>
                    <li><strong style="color: #27ae60;">NO SE BORRAR├â┬ü</strong>: Usuarios ni Empresas (sus cuentas seguir├â┬ín activas).</li>
                </ul>
            </div>
            <p style="margin-top: 15px; font-size: 13px;">Ingrese la contrase├â┬▒a de seguridad para continuar:</p>
        `,
        input: 'password',
        inputPlaceholder: 'Contrase├â┬▒a de seguridad',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off'
        },
        showCancelButton: true,
        confirmButtonText: 'ELIMINAR GU├â┬ìAS',
        confirmButtonColor: '#dc3545',
        cancelButtonText: 'Cancelar'
    });

    if (!password) return;

    if (password !== '2708') {
        return Swal.fire('Error', 'Contrase├â┬▒a incorrecta. Acci├â┬│n cancelada por seguridad.', 'error');
    }

    const { isConfirmed } = await Swal.fire({
        title: '├é┬┐Est├â┬í TOTALMENTE seguro?',
        text: "Se borrar├â┬ín absolutamente todos los registros de gu├â┬¡as y pagos. Los usuarios y empresas NO sufrir├â┬ín cambios.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'S├â┬¡, borrar todas las gu├â┬¡as',
        cancelButtonText: 'No, cancelar'
    });

    if (!isConfirmed) return;

    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/guias/purgar`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (data.success) {
            await Swal.fire({
                icon: 'success',
                title: 'Sistema Purgado',
                text: data.message,
                confirmButtonText: 'Entendido'
            });
            window.location.reload();
        } else {
            throw new Error(data.error || 'Error al purgar el sistema');
        }
    } catch (error) {
        console.error('Error al purgar:', error);
        Swal.fire('Error', error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ===== GESTI├ôN DE MINERALES =====
async function renderMinerales(container) {
    showLoading(true);

    try {
        const response = await apiRequest('/minerales/todos');
        const minerales = response.minerales;

        container.innerHTML = `
            <div class="dashboard-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <div>
                    <h1 class="dashboard-title">Gesti├│n de Minerales</h1>
                    <p class="dashboard-subtitle">Administre los tipos de minerales disponibles en el sistema</p>
                </div>
                <button class="btn btn-primary" onclick="mostrarModalNuevoMineral()">
                    + Nuevo Mineral
                </button>
            </div>

            <div class="card">
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Nombre del Mineral</th>
                                <th>Estado</th>
                                <th>Fecha Registro</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="minerales-table-body">
                            ${minerales.length === 0 ? '<tr><td colspan="4" style="text-align: center;">No hay minerales registrados</td></tr>' : 
                                minerales.map(m => `
                                <tr>
                                    <td data-label="Nombre">${m.nombre}</td>
                                    <td data-label="Estado">
                                        <span class="badge ${m.activo ? 'badge-success' : 'badge-danger'}">
                                            ${m.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td data-label="Registro">${new Date(m.created_at).toLocaleDateString()}</td>
                                    <td data-label="Acciones">
                                        <div style="display: flex; gap: 10px;">
                                            <button class="btn btn-sm ${m.activo ? 'btn-outline' : 'btn-success'}" 
                                                onclick="toggleMineralStatus('${m.id}', ${m.activo})">
                                                ${m.activo ? 'Desactivar' : 'Activar'}
                                            </button>
                                            <button class="btn btn-danger btn-sm" onclick="eliminarMineral('${m.id}', '${m.nombre}')">
                                                Borrar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error al cargar minerales:', error);
        container.innerHTML = '<div class="error-message">Error al cargar la lista de minerales</div>';
    } finally {
        showLoading(false);
    }
}

async function mostrarModalNuevoMineral() {
    const { value: nombre } = await Swal.fire({
        title: 'Agregar Nuevo Mineral',
        input: 'text',
        inputLabel: 'Nombre del Mineral',
        inputPlaceholder: 'Ej: Arena de Rio, Granito...',
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value) {
                return 'El nombre es requerido';
            }
        }
    });

    if (nombre) {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/minerales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ nombre })
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire('Guardado', 'El mineral ha sido registrado correctamente', 'success');
                renderMinerales(document.getElementById('dashboard-content'));
            } else {
                throw new Error(data.error || 'Error al guardar');
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        } finally {
            showLoading(false);
        }
    }
}

async function toggleMineralStatus(id, currentStatus) {
    const result = await Swal.fire({
        title: '┬┐Cambiar estado?',
        text: `┬┐Est├í seguro de ${currentStatus ? 'desactivar' : 'activar'} este mineral?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'S├¡, cambiar',
        cancelButtonText: 'No, cancelar'
    });

    if (result.isConfirmed) {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/minerales/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ activo: !currentStatus })
            });

            const data = await response.json();

            if (data.success) {
                renderMinerales(document.getElementById('dashboard-content'));
            } else {
                throw new Error(data.error || 'Error al actualizar');
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        } finally {
            showLoading(false);
        }
    }
}

async function eliminarMineral(id, nombre) {
    const result = await Swal.fire({
        title: '┬┐Eliminar mineral?',
        text: `Est├í a punto de eliminar permanentemente el mineral "${nombre}". Esta acci├│n no se puede deshacer.`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: 'S├¡, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
        showLoading(true);
        try {
            const response = await fetch(`${API_BASE}/minerales/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire('Eliminado', 'El mineral ha sido borrado', 'success');
                renderMinerales(document.getElementById('dashboard-content'));
            } else {
                throw new Error(data.error || 'Error al eliminar');
            }
        } catch (error) {
            Swal.fire('Error', error.message, 'error');
        } finally {
            showLoading(false);
        }
    }
}
