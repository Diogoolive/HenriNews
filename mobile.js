// ============================================================
// HENRINEWS - COMPORTAMENTO RESPONSIVO / MENU MOBILE
// Este arquivo não altera a conexão com o Supabase.
// ============================================================

function renderMobileIcons() {
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const button = document.getElementById('mobile-menu-btn');

    if (!menu || !button) return;

    const willOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    button.setAttribute('aria-expanded', String(willOpen));

    button.innerHTML = willOpen
        ? '<i data-lucide="x" class="w-6 h-6"></i>'
        : '<i data-lucide="menu" class="w-6 h-6"></i>';

    renderMobileIcons();
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const button = document.getElementById('mobile-menu-btn');

    if (!menu || !button) return;

    menu.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<i data-lucide="menu" class="w-6 h-6"></i>';
    renderMobileIcons();
}

function mobileNavigate(tabId) {
    if (typeof window.switchTab === 'function') {
        window.switchTab(tabId);
    }
    closeMobileMenu();
}

function syncMobileAuthUI() {
    const desktopBadge = document.getElementById('user-status-badge');
    const desktopAction = document.getElementById('auth-action-btn');
    const desktopRegister = document.getElementById('auth-register-btn');
    const desktopAdmin = document.getElementById('nav-admin-btn');

    const mobileBadge = document.getElementById('mobile-user-status-badge');
    const mobileAction = document.getElementById('mobile-auth-action-btn');
    const mobileRegister = document.getElementById('mobile-auth-register-btn');
    const mobileAdmin = document.getElementById('mobile-admin-btn');

    if (desktopBadge && mobileBadge) {
        mobileBadge.textContent = desktopBadge.textContent || 'Visitante';
        const isAdminBadge = desktopBadge.classList.contains('bg-amber-500');
        mobileBadge.className = isAdminBadge
            ? 'text-xs bg-amber-500 text-slate-900 px-2 py-1 rounded font-bold truncate'
            : 'text-xs bg-indigo-800 px-2 py-1 rounded text-indigo-200 font-medium truncate';
    }

    if (desktopRegister && mobileRegister) {
        mobileRegister.classList.toggle('hidden', desktopRegister.classList.contains('hidden'));
    }

    if (desktopAdmin && mobileAdmin) {
        mobileAdmin.classList.toggle('hidden', desktopAdmin.classList.contains('hidden'));
    }

    if (desktopAction && mobileAction) {
        const isLogout = (desktopAction.textContent || '').trim().toLowerCase() === 'sair';
        mobileAction.textContent = isLogout ? 'Sair' : 'Entrar';
        mobileAction.onclick = isLogout
            ? () => {
                closeMobileMenu();
                if (typeof window.handleLogout === 'function') window.handleLogout();
            }
            : () => mobileNavigate('login');
    }

    renderMobileIcons();
}

function observeDesktopAuthUI() {
    const targets = [
        document.getElementById('user-status-badge'),
        document.getElementById('auth-action-btn'),
        document.getElementById('auth-register-btn'),
        document.getElementById('nav-admin-btn')
    ].filter(Boolean);

    if (!targets.length || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => syncMobileAuthUI());
    targets.forEach(target => {
        observer.observe(target, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true,
            attributeFilter: ['class']
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    syncMobileAuthUI();
    observeDesktopAuthUI();

    document.addEventListener('click', event => {
        const menu = document.getElementById('mobile-menu');
        const button = document.getElementById('mobile-menu-btn');

        if (!menu || !button || menu.classList.contains('hidden')) return;
        if (menu.contains(event.target) || button.contains(event.target)) return;

        closeMobileMenu();
    });
});

window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        closeMobileMenu();
    }
});
