// ============================================================
// HENRINEWS - JORNAL & BIBLIOTECA ESCOLAR
// Supabase Auth + PostgreSQL + RLS
// ============================================================


// ============================================================
// 1. CONFIGURAÇÃO DO SUPABASE
// ============================================================

const SUPABASE_URL =
    'https://ffggwhdtefummpzfspvb.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
    'sb_publishable_3UVcflML5_szZeiW0DvCzw_vOzTOC_W';


const CONFIGURED =
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');


const db = CONFIGURED
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    )
    : null;


// ============================================================
// 2. ESTADO GERAL
// ============================================================

let currentUser = null;
let currentProfile = null;

let articles = [];
let books = [];
let polls = [];
let myLoans = [];
let myHelpQuestions = [];

let genres = [];
let subgenres = [];

let savedArticleIds = new Set();
let userVotes = new Map();

let adminArticles = [];

let currentFilter = 'all';
let articleReturnTab = 'feed';

let currentLibraryGenreId = null;
let currentLibrarySubgenreId = null;


// ============================================================
// 3. UTILITÁRIOS
// ============================================================

function ensureConfigured() {

    if (CONFIGURED) {
        return true;
    }

    alert(
        'Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.'
    );

    return false;
}


function isAdmin() {

    return currentProfile?.role === 'admin';

}


function escapeHtml(value = '') {

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

}


function safeImage(url) {

    const fallback =
        'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';

    if (!url) {
        return fallback;
    }

    try {

        const parsed =
            new URL(url);

        if (
            parsed.protocol === 'http:' ||
            parsed.protocol === 'https:'
        ) {

            return parsed.href;

        }

        return fallback;

    } catch {

        return fallback;

    }

}


function formatDate(value) {

    if (!value) {
        return '—';
    }

    let date;

    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            String(value)
        )
    ) {

        const [
            year,
            month,
            day
        ] =
            String(value)
                .split('-')
                .map(Number);

        date =
            new Date(
                year,
                month - 1,
                day
            );

    } else {

        date =
            new Date(value);

    }

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return escapeHtml(value);

    }

    return date.toLocaleDateString(
        'pt-BR'
    );

}


function renderIcons() {

    if (
        window.lucide &&
        typeof window.lucide.createIcons === 'function'
    ) {

        window.lucide.createIcons();

    }

}


function redirectUrl() {

    if (
        location.protocol === 'http:' ||
        location.protocol === 'https:'
    ) {

        return (
            location.origin +
            location.pathname
        );

    }

    return undefined;

}


function showError(
    context,
    error
) {

    console.error(
        context,
        error
    );

    alert(
        `${context}: ${
            error?.message ||
            'erro inesperado.'
        }`
    );

}


// ============================================================
// 4. TEMA CLARO / ESCURO
// ============================================================

const THEME_STORAGE_KEY =
    'henrinews_theme';


function getPreferredTheme() {

    const savedTheme =
        localStorage.getItem(
            THEME_STORAGE_KEY
        );


    if (
        savedTheme === 'dark' ||
        savedTheme === 'light'
    ) {

        return savedTheme;

    }


    const systemDark =
        window.matchMedia &&
        window
            .matchMedia(
                '(prefers-color-scheme: dark)'
            )
            .matches;


    return systemDark
        ? 'dark'
        : 'light';

}


function applyTheme(theme) {

    const finalTheme =
        theme === 'dark'
            ? 'dark'
            : 'light';


    document
        .documentElement
        .setAttribute(
            'data-theme',
            finalTheme
        );


    localStorage.setItem(
        THEME_STORAGE_KEY,
        finalTheme
    );


    updateThemeButton();

}


function toggleTheme() {

    const currentTheme =
        document
            .documentElement
            .getAttribute(
                'data-theme'
            ) ||
        'light';


    const newTheme =
        currentTheme === 'dark'
            ? 'light'
            : 'dark';


    applyTheme(
        newTheme
    );

}


function updateThemeButton() {

    const button =
        document.getElementById(
            'theme-toggle-btn'
        );


    if (!button) {
        return;
    }


    const currentTheme =
        document
            .documentElement
            .getAttribute(
                'data-theme'
            ) ||
        'light';


    if (
        currentTheme === 'dark'
    ) {

        button.innerHTML = `

            <i
                data-lucide="sun"
                class="w-4 h-4"
            ></i>

            <span class="hidden lg:inline">
                Modo claro
            </span>
        `;


        button.title =
            'Usar modo claro';

        button.setAttribute(
            'aria-label',
            'Ativar modo claro'
        );

    } else {

        button.innerHTML = `

            <i
                data-lucide="moon"
                class="w-4 h-4"
            ></i>

            <span class="hidden lg:inline">
                Modo escuro
            </span>
        `;


        button.title =
            'Usar modo escuro';

        button.setAttribute(
            'aria-label',
            'Ativar modo escuro'
        );

    }


    renderIcons();

}


function initializeTheme() {

    const theme =
        getPreferredTheme();


    applyTheme(
        theme
    );

}


// ============================================================
// 5. INTERFACE DE AUTENTICAÇÃO
// ============================================================

function updateAuthUI() {

    const badge =
        document.getElementById(
            'user-status-badge'
        );

    const actionBtn =
        document.getElementById(
            'auth-action-btn'
        );

    const adminBtn =
        document.getElementById(
            'nav-admin-btn'
        );

    const registerBtn =
        document.getElementById(
            'auth-register-btn'
        );


    if (
        !badge ||
        !actionBtn ||
        !adminBtn
    ) {

        return;

    }


    if (currentUser) {

        badge.innerText =
            isAdmin()
                ? 'Gestor/Admin'
                : (
                    currentProfile?.full_name ||
                    'Aluno'
                );


        badge.className =
            isAdmin()
                ? 'text-xs bg-amber-500 text-slate-900 px-2 py-1 rounded font-bold'
                : 'text-xs bg-indigo-800 px-2 py-1 rounded text-indigo-200 font-medium';


        actionBtn.innerText =
            'Sair';

        actionBtn.onclick =
            handleLogout;


        registerBtn
            ?.classList
            .add('hidden');


        adminBtn
            .classList
            .toggle(
                'hidden',
                !isAdmin()
            );

    } else {

        badge.innerText =
            'Visitante';


        badge.className =
            'text-xs bg-indigo-800 px-2 py-1 rounded text-indigo-200 font-medium';


        actionBtn.innerText =
            'Entrar';


        actionBtn.onclick =
            () =>
                switchTab(
                    'login'
                );


        registerBtn
            ?.classList
            .remove('hidden');


        adminBtn
            .classList
            .add('hidden');

    }


    renderIcons();

}


// ============================================================
// 6. NAVEGAÇÃO
// ============================================================

function switchTab(tabId) {

    if (
        tabId === 'admin' &&
        !isAdmin()
    ) {

        alert(
            'Área exclusiva para gestores autorizados.'
        );

        tabId =
            'feed';

    }


    document
        .querySelectorAll(
            '.tab-content'
        )
        .forEach(
            element => {

                element
                    .classList
                    .remove('active');

            }
        );


    const target =
        document.getElementById(
            `tab-${tabId}`
        );


    if (target) {

        target
            .classList
            .add('active');

    }


    if (tabId === 'inicio') renderHomeNews();
    if (tabId === 'feed') renderArticles();

    if (tabId === 'biblioteca') {

        const searchInput =
            document.getElementById(
                'lib-search-input'
            );


        if (searchInput) {

            searchInput.value =
                '';

        }


        document
            .getElementById(
                'library-search-section'
            )
            ?.classList
            .add('hidden');


        document
            .getElementById(
                'library-genre-view'
            )
            ?.classList
            .add('hidden');


        document
            .getElementById(
                'library-subgenre-view'
            )
            ?.classList
            .add('hidden');


        document
            .getElementById(
                'library-home'
            )
            ?.classList
            .remove('hidden');


        currentLibraryGenreId =
            null;

        currentLibrarySubgenreId =
            null;


        renderLibrary();

        renderMyLoans();

    }


    if (
        tabId === 'enquetes'
    ) {

        renderPolls();

    }


    if (
        tabId === 'admin'
    ) {

        renderAdminDashboard();

        renderAdminGenreSelect();

        openAdminSection(
            'overview'
        );

    }


    if (
        tabId === 'ajuda'
    ) {

        setupHelpForm();

    }


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });


    renderIcons();

}


// ============================================================
// 7. PERFIL
// ============================================================

async function loadProfile(
    userId
) {

    if (
        !db ||
        !userId
    ) {

        return null;

    }


    const {
        data,
        error
    } =
        await db
            .from('profiles')
            .select(
                'id, full_name, email, role'
            )
            .eq(
                'id',
                userId
            )
            .single();


    if (error) {

        console.warn(
            'Não foi possível carregar o perfil:',
            error.message
        );

        return null;

    }


    return data;

}


async function syncCurrentUser(
    user
) {

    currentUser =
        user ||
        null;


    currentProfile =
        currentUser
            ? await loadProfile(
                currentUser.id
            )
            : null;


    if (
        currentUser &&
        !currentProfile
    ) {

        currentProfile = {

            id:
                currentUser.id,

            full_name:
                currentUser
                    .user_metadata
                    ?.full_name ||
                currentUser
                    .email
                    ?.split('@')[0] ||
                'Aluno',

            email:
                currentUser.email,

            role:
                'student'

        };

    }


    updateAuthUI();


    await Promise.all([
        loadSavedArticles(),
        loadMyLoans(),
        loadUserVotes(),
        loadMyHelpQuestions()
    ]);


    renderArticles();

    renderMyLoans();

    renderPolls();

    renderMyHelpQuestions();

}


// ============================================================
// 8. CADASTRO
// ============================================================

async function handleRegister(e) {

    e.preventDefault();


    if (!ensureConfigured()) {
        return;
    }


    const name =
        document
            .getElementById(
                'register-nome'
            )
            .value
            .trim();


    const email =
        document
            .getElementById(
                'register-email'
            )
            .value
            .trim()
            .toLowerCase();


    const password =
        document
            .getElementById(
                'register-senha'
            )
            .value;


    if (
        password.length < 8
    ) {

        alert(
            'A senha precisa ter pelo menos 8 caracteres.'
        );

        return;

    }


    const options = {

        data: {
            full_name:
                name
        }

    };


    const callback =
        redirectUrl();


    if (callback) {

        options.emailRedirectTo =
            callback;

    }


    const {
        data,
        error
    } =
        await db
            .auth
            .signUp({
                email,
                password,
                options
            });


    if (error) {

        return showError(
            'Não foi possível criar a conta',
            error
        );

    }


    e.target.reset();


    if (data.session) {

        await syncCurrentUser(
            data.user
        );


        alert(
            'Cadastro realizado com sucesso!'
        );


        switchTab(
            'feed'
        );

    } else {

        alert(
            'Cadastro realizado. Confirme o e-mail recebido antes de entrar.'
        );


        switchTab(
            'login'
        );

    }

}


// ============================================================
// 9. LOGIN
// ============================================================

async function handleLogin(e) {

    e.preventDefault();


    if (!ensureConfigured()) {
        return;
    }


    const email =
        document
            .getElementById(
                'login-email'
            )
            .value
            .trim()
            .toLowerCase();


    const password =
        document
            .getElementById(
                'login-senha'
            )
            .value;


    const {
        data,
        error
    } =
        await db
            .auth
            .signInWithPassword({
                email,
                password
            });


    if (error) {

        return showError(
            'Não foi possível entrar',
            error
        );

    }


    await syncCurrentUser(
        data.user
    );


    e.target.reset();


    switchTab(
        'feed'
    );

}


// ============================================================
// 10. LOGOUT
// ============================================================

async function handleLogout() {

    if (!ensureConfigured()) {
        return;
    }


    const {
        error
    } =
        await db
            .auth
            .signOut();


    if (error) {

        return showError(
            'Não foi possível sair',
            error
        );

    }


    currentUser =
        null;

    currentProfile =
        null;

    savedArticleIds =
        new Set();

    userVotes =
        new Map();

    myLoans =
        [];

    myHelpQuestions =
        [];


    updateAuthUI();

    renderArticles();

    renderMyLoans();

    renderPolls();

    renderMyHelpQuestions();


    switchTab(
        'feed'
    );

}


// ============================================================
// 11. RECUPERAÇÃO DE SENHA
// ============================================================

async function handleRecoverPassword(e) {

    e.preventDefault();


    if (!ensureConfigured()) {
        return;
    }


    const email =
        document
            .getElementById(
                'recover-email'
            )
            .value
            .trim()
            .toLowerCase();


    if (!email) {

        alert(
            'Digite seu e-mail.'
        );

        return;

    }


    const recoveryUrl =
        `${window.location.origin}${window.location.pathname}?recovery=1`;


    const {
        error
    } =
        await db
            .auth
            .resetPasswordForEmail(
                email,
                {
                    redirectTo:
                        recoveryUrl
                }
            );


    if (error) {

        return showError(
            'Não foi possível enviar a recuperação de senha',
            error
        );

    }


    alert(
        'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha.'
    );


    switchTab(
        'login'
    );

}


// ============================================================
// 12. NOVA SENHA
// ============================================================

async function handleUpdatePassword(e) {

    e.preventDefault();


    if (!ensureConfigured()) {
        return;
    }


    const password =
        document
            .getElementById(
                'new-password'
            )
            .value;


    const confirmPassword =
        document
            .getElementById(
                'confirm-new-password'
            )
            .value;


    if (
        password.length < 8
    ) {

        alert(
            'A senha precisa ter pelo menos 8 caracteres.'
        );

        return;

    }


    if (
        password !==
        confirmPassword
    ) {

        alert(
            'As duas senhas precisam ser iguais.'
        );

        return;

    }


    const {
        error
    } =
        await db
            .auth
            .updateUser({
                password
            });


    if (error) {

        return showError(
            'Não foi possível atualizar a senha',
            error
        );

    }


    e.target.reset();


    window
        .history
        .replaceState(
            {},
            document.title,
            window.location.pathname
        );


    await db
        .auth
        .signOut();


    currentUser =
        null;

    currentProfile =
        null;


    updateAuthUI();


    alert(
        'Senha alterada com sucesso! Agora entre com sua nova senha.'
    );


    switchTab(
        'login'
    );

}


// ============================================================
// 13. CARREGAR ARTIGOS
// ============================================================

async function loadArticles() {

    if (!db) {
        return;
    }


    const {
        data,
        error
    } =
        await db
            .from('articles')
            .select(
                'id, title, content, image_url, created_at'
            )
            .eq(
                'status',
                'published'
            )
            .order(
                'created_at',
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(
            'Erro ao carregar artigos:',
            error
        );

        return;

    }


    articles = data || [];

    renderHomeNews();

}


// ============================================================
// 14. ARTIGOS SALVOS
// ============================================================

async function loadSavedArticles() {

    savedArticleIds =
        new Set();


    if (
        !db ||
        !currentUser
    ) {

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from(
                'article_saves'
            )
            .select(
                'article_id'
            )
            .eq(
                'user_id',
                currentUser.id
            );


    if (!error) {

        (
            data ||
            []
        )
            .forEach(
                item => {

                    savedArticleIds
                        .add(
                            item.article_id
                        );

                }
            );

    }

}


// ============================================================
// 15. RENDERIZAR ARTIGOS
// ============================================================

// ============================================================
// PÁGINA INICIAL - CAPA JORNALÍSTICA
// ============================================================

function renderHomeNews() {

    const container =
        document.getElementById('home-news-container');

    if (!container) return;


    if (!articles.length) {

        container.innerHTML = `
            <div
                class="
                    bg-white
                    border
                    border-slate-200
                    rounded-2xl
                    p-10
                    text-center
                    text-slate-500
                "
            >
                <i
                    data-lucide="newspaper"
                    class="w-10 h-10 mx-auto mb-3 text-slate-300"
                ></i>

                Nenhuma notícia publicada no momento.
            </div>
        `;

        renderIcons();

        return;
    }


    // As notícias já vêm do Supabase da mais recente
    // para a mais antiga.

    const principal = articles[0];

    const destaque1 =
        articles.length > 1
            ? articles[1]
            : null;

    const destaque2 =
        articles.length > 2
            ? articles[2]
            : null;

    const ultimas =
        articles.slice(3, 9);


    const resumo = (texto, tamanho = 150) => {

        const valor =
            String(texto || '');

        return valor.length > tamanho
            ? `${valor.substring(0, tamanho)}...`
            : valor;

    };


    const noticiaSecundaria = (artigo) => {

        if (!artigo) return '';

        return `
            <article
                class="
                    group
                    cursor-pointer
                    border-b
                    border-slate-200
                    pb-5
                    last:border-b-0
                "
                onclick="viewArticleDetail(${artigo.id}, 'inicio')"
            >

                <img
                    src="${safeImage(artigo.image_url)}"
                    alt="Imagem da notícia"
                    class="
                        w-full
                        h-40
                        object-cover
                        rounded-xl
                        mb-3
                    "
                >

                <span
                    class="
                        text-xs
                        uppercase
                        tracking-wider
                        font-bold
                        text-indigo-600
                    "
                >
                    Destaque
                </span>

                <h2
                    class="
                        text-lg
                        font-extrabold
                        text-slate-900
                        leading-tight
                        mt-1
                        group-hover:text-indigo-600
                        transition
                    "
                >
                    ${escapeHtml(artigo.title)}
                </h2>

                <p
                    class="
                        text-xs
                        text-slate-500
                        mt-2
                    "
                >
                    ${formatDate(artigo.created_at)}
                </p>

            </article>
        `;
    };


    const listaUltimas = ultimas.map(artigo => `

        <article
            class="
                grid
                grid-cols-[110px_1fr]
                md:grid-cols-[180px_1fr]
                gap-4
                py-5
                border-b
                border-slate-200
                cursor-pointer
                group
            "
            onclick="viewArticleDetail(${artigo.id}, 'inicio')"
        >

            <img
                src="${safeImage(artigo.image_url)}"
                alt="Imagem da notícia"
                class="
                    w-full
                    h-24
                    md:h-28
                    object-cover
                    rounded-xl
                "
            >


            <div class="min-w-0">

                <span
                    class="
                        text-xs
                        font-bold
                        uppercase
                        tracking-wider
                        text-indigo-600
                    "
                >
                    Notícias
                </span>


                <h3
                    class="
                        text-base
                        md:text-xl
                        font-extrabold
                        leading-tight
                        text-slate-900
                        mt-1
                        group-hover:text-indigo-600
                        transition
                    "
                >
                    ${escapeHtml(artigo.title)}
                </h3>


                <p
                    class="
                        hidden
                        sm:block
                        text-sm
                        text-slate-500
                        mt-2
                        leading-relaxed
                    "
                >
                    ${escapeHtml(
                        resumo(
                            artigo.content,
                            130
                        )
                    )}
                </p>


                <p
                    class="
                        text-xs
                        text-slate-400
                        mt-2
                    "
                >
                    ${formatDate(artigo.created_at)}
                </p>

            </div>

        </article>

    `).join('');


    container.innerHTML = `

        <!-- ================================================= -->
        <!-- PRINCIPAIS DESTAQUES -->
        <!-- ================================================= -->

        <div
            class="
                grid
                grid-cols-1
                lg:grid-cols-3
                gap-7
                border-b
                border-slate-300
                pb-10
            "
        >


            <!-- NOTÍCIA PRINCIPAL -->

            <article
                class="
                    lg:col-span-2
                    cursor-pointer
                    group
                "
                onclick="viewArticleDetail(${principal.id}, 'inicio')"
            >

                <div
                    class="
                        relative
                        overflow-hidden
                        rounded-2xl
                        bg-slate-900
                    "
                >

                    <img
                        src="${safeImage(principal.image_url)}"
                        alt="Imagem da principal notícia"
                        class="
                            w-full
                            h-[320px]
                            md:h-[470px]
                            object-cover
                            group-hover:scale-[1.02]
                            transition
                            duration-500
                        "
                    >


                    <!-- SOMBRA SOBRE A FOTO -->

                    <div
                        class="
                            absolute
                            inset-0
                            bg-gradient-to-t
                            from-black/90
                            via-black/30
                            to-transparent
                        "
                    ></div>


                    <!-- TEXTO SOBRE A FOTO -->

                    <div
                        class="
                            absolute
                            bottom-0
                            left-0
                            right-0
                            p-5
                            md:p-8
                            text-white
                        "
                    >

                        <span
                            class="
                                inline-block
                                bg-indigo-600
                                px-3
                                py-1
                                rounded-md
                                text-xs
                                font-bold
                                uppercase
                                tracking-wider
                                mb-3
                            "
                        >
                            Principal
                        </span>


                        <h2
                            class="
                                text-2xl
                                md:text-4xl
                                font-extrabold
                                leading-tight
                            "
                        >
                            ${escapeHtml(principal.title)}
                        </h2>


                        <p
                            class="
                                text-sm
                                md:text-base
                                text-slate-200
                                mt-3
                                max-w-2xl
                                hidden
                                sm:block
                            "
                        >
                            ${escapeHtml(
                                resumo(
                                    principal.content,
                                    180
                                )
                            )}
                        </p>


                        <div
                            class="
                                flex
                                items-center
                                gap-2
                                mt-4
                                text-xs
                                text-slate-300
                            "
                        >

                            <i
                                data-lucide="calendar"
                                class="w-4 h-4"
                            ></i>

                            ${formatDate(
                                principal.created_at
                            )}

                        </div>

                    </div>

                </div>

            </article>



            <!-- DESTAQUES MENORES -->

            <div class="space-y-5">

                ${noticiaSecundaria(destaque1)}

                ${noticiaSecundaria(destaque2)}

            </div>

        </div>



        <!-- ================================================= -->
        <!-- ÚLTIMAS NOTÍCIAS -->
        <!-- ================================================= -->

        ${
            ultimas.length
                ? `
                    <section class="pt-9">

                        <div
                            class="
                                flex
                                items-center
                                justify-between
                                gap-4
                                mb-3
                            "
                        >

                            <div>

                                <span
                                    class="
                                        text-xs
                                        uppercase
                                        tracking-widest
                                        font-bold
                                        text-indigo-600
                                    "
                                >
                                    HenriNews
                                </span>


                                <h2
                                    class="
                                        text-2xl
                                        md:text-3xl
                                        font-extrabold
                                        text-slate-900
                                    "
                                >
                                    Últimas notícias
                                </h2>

                            </div>


                            <button
                                onclick="switchTab('feed')"
                                class="
                                    text-sm
                                    font-semibold
                                    text-indigo-600
                                    hover:text-indigo-700
                                    flex
                                    items-center
                                    gap-1
                                "
                            >

                                Ver todas

                                <i
                                    data-lucide="arrow-right"
                                    class="w-4 h-4"
                                ></i>

                            </button>

                        </div>


                        <div>

                            ${listaUltimas}

                        </div>

                    </section>
                `
                : ''
        }


        <!-- ================================================= -->
        <!-- BOTÃO PARA O FEED -->
        <!-- ================================================= -->

        <div class="pt-8 text-center">

            <button
                onclick="switchTab('feed')"
                class="
                    inline-flex
                    items-center
                    gap-2
                    bg-indigo-600
                    hover:bg-indigo-700
                    text-white
                    font-semibold
                    px-6
                    py-3
                    rounded-xl
                    transition
                "
            >

                <i
                    data-lucide="newspaper"
                    class="w-5 h-5"
                ></i>

                Ver todas as notícias no Feed

            </button>

        </div>

    `;


    renderIcons();

}

function renderArticles() {

    const container =
        document.getElementById(
            'articles-container'
        );


    if (!container) {
        return;
    }


    container.innerHTML =
        '';


    let filtered =
        articles;


    if (
        currentFilter === 'saved'
    ) {

        if (!currentUser) {

            container.innerHTML = `
                <div
                    class="
                        col-span-full
                        bg-amber-50
                        text-amber-800
                        p-4
                        rounded-xl
                        text-sm
                    "
                >
                    Faça login para visualizar os artigos salvos.
                </div>
            `;

            return;

        }


        filtered =
            articles.filter(
                article =>
                    savedArticleIds
                        .has(
                            article.id
                        )
            );

    }


    if (
        !filtered.length
    ) {

        container.innerHTML = `
            <div
                class="
                    col-span-full
                    text-slate-400
                    py-12
                    text-center
                    text-sm
                "
            >
                Nenhuma notícia encontrada.
            </div>
        `;

        return;

    }


    filtered.forEach(
        article => {

            const description =
                article.content.length > 115
                    ? `${
                        article.content.substring(
                            0,
                            115
                        )
                    }...`
                    : article.content;


            const card =
                document.createElement(
                    'div'
                );


            card.className =
                'bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition';


            card.innerHTML = `

                <img
                    src="${safeImage(article.image_url)}"
                    class="h-48 w-full object-cover"
                    alt="Capa da notícia"
                >


                <div
                    class="
                        p-5
                        flex-grow
                        flex
                        flex-col
                        justify-between
                        space-y-4
                    "
                >

                    <div class="space-y-2">

                        <h3
                            class="
                                font-bold
                                text-lg
                                text-slate-900
                                leading-tight
                            "
                        >
                            ${escapeHtml(article.title)}
                        </h3>


                        <p
                            class="
                                text-xs
                                text-slate-500
                                leading-relaxed
                            "
                        >
                            ${escapeHtml(description)}
                        </p>

                    </div>


                    <div
                        class="
                            flex
                            items-center
                            justify-between
                            pt-2
                            border-t
                            text-sm
                        "
                    >

                        <button
                            type="button"
                            onclick="viewArticleDetail(${article.id})"
                            class="
                                text-indigo-600
                                font-semibold
                                hover:text-indigo-700
                                flex
                                items-center
                                gap-1
                            "
                        >
                            Ler notícia completa

                            <i
                                data-lucide="arrow-right"
                                class="w-4 h-4"
                            ></i>
                        </button>


                        <button
                            type="button"
                            onclick="toggleSaveArticle(${article.id})"
                            class="
                                ${
                                    savedArticleIds.has(article.id)
                                        ? 'text-amber-500'
                                        : 'text-slate-400 hover:text-slate-600'
                                }
                            "
                        >

                            <i
                                data-lucide="bookmark"
                                class="
                                    w-5
                                    h-5
                                    ${
                                        savedArticleIds.has(article.id)
                                            ? 'fill-current'
                                            : ''
                                    }
                                "
                            ></i>

                        </button>

                    </div>

                </div>
            `;


            container
                .appendChild(
                    card
                );

        }
    );


    renderIcons();

}


function filterArticles(type) {

    currentFilter =
        type;

    renderArticles();

}


// ============================================================
// 16. DETALHE DO ARTIGO
// ============================================================

function viewArticleDetail(id, origin = 'feed') {

    articleReturnTab = origin;

    const art = articles.find(a => a.id === id);

    if (!art) return;

    const container =
        document.getElementById(
            'article-detail-content'
        );


    if (!container) {
        return;
    }


    container.innerHTML = `

        <div class="space-y-6">

            <h1
                class="
                    text-3xl
                    md:text-4xl
                    font-extrabold
                    text-slate-900
                "
            >
                ${escapeHtml(article.title)}
            </h1>


            <img
                src="${safeImage(article.image_url)}"
                class="
                    w-full
                    h-96
                    object-cover
                    rounded-2xl
                "
                alt="Capa da notícia"
            >


            <div
                class="
                    text-slate-700
                    leading-relaxed
                    whitespace-pre-line
                "
            >
                ${escapeHtml(article.content)}
            </div>

        </div>
    `;


    switchTab(
        'artigo-detalhe'
    );

}

function returnFromArticle() {
    switchTab(articleReturnTab || 'feed');
}

// ============================================================
// 17. SALVAR ARTIGO
// ============================================================

async function toggleSaveArticle(id) {

    if (!currentUser) {

        alert(
            'Faça login para salvar artigos.'
        );

        switchTab(
            'login'
        );

        return;

    }


    if (
        savedArticleIds.has(id)
    ) {

        const {
            error
        } =
            await db
                .from(
                    'article_saves'
                )
                .delete()
                .eq(
                    'user_id',
                    currentUser.id
                )
                .eq(
                    'article_id',
                    id
                );


        if (error) {

            return showError(
                'Não foi possível remover o artigo',
                error
            );

        }


        savedArticleIds
            .delete(id);

    } else {

        const {
            error
        } =
            await db
                .from(
                    'article_saves'
                )
                .insert({

                    user_id:
                        currentUser.id,

                    article_id:
                        id

                });


        if (error) {

            return showError(
                'Não foi possível salvar o artigo',
                error
            );

        }


        savedArticleIds
            .add(id);

    }


    renderArticles();

}


// ============================================================
// 18. GÊNEROS
// ============================================================

async function loadGenres() {

    if (!db) {
        return;
    }


    const {
        data,
        error
    } =
        await db
            .from('genres')
            .select(
                'id, name'
            )
            .order(
                'name',
                {
                    ascending:
                        true
                }
            );


    if (error) {

        console.error(
            'Erro ao carregar gêneros:',
            error
        );

        return;

    }


    genres =
        data ||
        [];

}


// ============================================================
// 19. SUBGÊNEROS
// ============================================================

async function loadSubgenres() {

    if (!db) {
        return;
    }


    const {
        data,
        error
    } =
        await db
            .from('subgenres')
            .select(
                'id, genre_id, name'
            )
            .order(
                'name',
                {
                    ascending:
                        true
                }
            );


    if (error) {

        console.error(
            'Erro ao carregar subgêneros:',
            error
        );

        return;

    }


    subgenres =
        data ||
        [];

}


// ============================================================
// 20. LIVROS
// ============================================================

async function loadBooks() {

    if (!db) {
        return;
    }


    const {
        data,
        error
    } =
        await db
            .from('books')
            .select(`
                id,
                title,
                author,
                description,
                total_copies,
                available_copies,
                active,
                created_at,
                genre_id,
                subgenre_id
            `)
            .eq(
                'active',
                true
            )
            .order(
                'created_at',
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(
            'Erro ao carregar livros:',
            error
        );

        return;

    }


    books =
        data ||
        [];

}


// ============================================================
// 21. CARD DO LIVRO
// ============================================================

function createBookCard(
    book,
    extraClasses = ''
) {

    const available =
        Number(
            book.available_copies
        ) > 0;


    const genre =
        genres.find(
            item =>
                Number(item.id) ===
                Number(book.genre_id)
        );


    const subgenre =
        subgenres.find(
            item =>
                Number(item.id) ===
                Number(book.subgenre_id)
        );


    return `

        <div
            class="
                bg-white
                p-5
                rounded-xl
                border
                border-slate-100
                shadow-sm
                flex
                flex-col
                justify-between
                gap-4
                ${extraClasses}
            "
        >

            <div class="space-y-2">

                <div
                    class="
                        flex
                        flex-wrap
                        gap-2
                    "
                >

                    <span
                        class="
                            text-[10px]
                            uppercase
                            font-bold
                            px-2
                            py-1
                            rounded
                            ${
                                available
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                            }
                        "
                    >

                        ${
                            available
                                ? `${book.available_copies} disponível(is)`
                                : 'Indisponível'
                        }

                    </span>


                    ${
                        genre
                            ? `
                                <span
                                    class="
                                        text-[10px]
                                        bg-indigo-50
                                        text-indigo-700
                                        px-2
                                        py-1
                                        rounded
                                    "
                                >
                                    ${escapeHtml(genre.name)}
                                </span>
                            `
                            : ''
                    }

                </div>


                <h3
                    class="
                        font-bold
                        text-slate-900
                    "
                >
                    ${escapeHtml(book.title)}
                </h3>


                <p
                    class="
                        text-xs
                        text-slate-500
                    "
                >
                    Por:
                    ${escapeHtml(book.author)}
                </p>


                ${
                    subgenre
                        ? `
                            <p
                                class="
                                    text-xs
                                    text-indigo-600
                                "
                            >
                                ${escapeHtml(subgenre.name)}
                            </p>
                        `
                        : ''
                }


                ${
                    book.description
                        ? `
                            <p
                                class="
                                    text-xs
                                    text-slate-600
                                "
                            >
                                ${escapeHtml(book.description)}
                            </p>
                        `
                        : ''
                }

            </div>


            <button
                type="button"
                onclick="requestLoan(${book.id})"
                ${available ? '' : 'disabled'}
                class="
                    w-full
                    bg-slate-900
                    hover:bg-slate-800
                    text-white
                    py-2
                    rounded-lg
                    text-xs
                    font-medium
                "
            >

                ${
                    available
                        ? 'Solicitar Empréstimo'
                        : 'Sem Exemplares Disponíveis'
                }

            </button>

        </div>
    `;

}


// ============================================================
// 22. BIBLIOTECA
// ============================================================

function renderLibrary() {

    renderNewBooks();

    renderGenres();

}


// ============================================================
// 23. NOVOS LIVROS
// ============================================================

function renderNewBooks() {

    const container =
        document.getElementById(
            'new-books-container'
        );


    if (!container) {
        return;
    }


    const recent =
        [...books]
            .sort(
                (
                    a,
                    b
                ) =>
                    new Date(
                        b.created_at
                    ) -
                    new Date(
                        a.created_at
                    )
            )
            .slice(
                0,
                8
            );


    if (
        !recent.length
    ) {

        container.innerHTML = `
            <p
                class="
                    text-slate-400
                    py-8
                "
            >
                Nenhum livro cadastrado.
            </p>
        `;

        return;

    }


    container.innerHTML =
        recent
            .map(
                book =>
                    createBookCard(
                        book,
                        'min-w-[260px] max-w-[260px]'
                    )
            )
            .join('');

}


// ============================================================
// 24. LISTAR GÊNEROS
// ============================================================

function renderGenres() {

    const container =
        document.getElementById(
            'genres-container'
        );


    if (!container) {
        return;
    }


    if (!genres.length) {

        container.innerHTML = `
            <p
                class="
                    col-span-full
                    text-slate-400
                "
            >
                Nenhum gênero cadastrado.
            </p>
        `;

        return;

    }


    container.innerHTML =
        genres
            .map(
                genre => {

                    const bookCount =
                        books.filter(
                            book =>
                                Number(book.genre_id) ===
                                Number(genre.id)
                        ).length;


                    const subCount =
                        subgenres.filter(
                            sub =>
                                Number(sub.genre_id) ===
                                Number(genre.id)
                        ).length;


                    return `

                        <button
                            type="button"
                            onclick="openGenre(${genre.id})"
                            class="
                                bg-white
                                border
                                border-slate-200
                                rounded-xl
                                p-5
                                text-left
                                shadow-sm
                                hover:border-indigo-300
                            "
                        >

                            <i
                                data-lucide="book-open"
                                class="
                                    w-6
                                    h-6
                                    text-indigo-600
                                    mb-3
                                "
                            ></i>


                            <h3
                                class="
                                    font-bold
                                    text-slate-900
                                "
                            >
                                ${escapeHtml(genre.name)}
                            </h3>


                            <p
                                class="
                                    text-xs
                                    text-slate-500
                                    mt-1
                                "
                            >
                                ${bookCount} livro(s)
                            </p>


                            <p
                                class="
                                    text-xs
                                    text-slate-400
                                "
                            >
                                ${subCount} subgênero(s)
                            </p>

                        </button>
                    `;

                }
            )
            .join('');


    renderIcons();

}


// ============================================================
// 25. ABRIR GÊNERO
// ============================================================

function openGenre(
    genreId
) {

    const genre =
        genres.find(
            item =>
                Number(item.id) ===
                Number(genreId)
        );


    if (!genre) {
        return;
    }


    currentLibraryGenreId =
        Number(
            genreId
        );

    currentLibrarySubgenreId =
        null;


    document
        .getElementById(
            'library-home'
        )
        ?.classList
        .add('hidden');


    document
        .getElementById(
            'library-subgenre-view'
        )
        ?.classList
        .add('hidden');


    document
        .getElementById(
            'library-genre-view'
        )
        ?.classList
        .remove('hidden');


    const title =
        document.getElementById(
            'current-genre-title'
        );


    if (title) {

        title.textContent =
            genre.name;

    }


    renderSubgenresForGenre(
        genreId
    );


    renderBooksForGenre(
        genreId
    );


    renderIcons();

}


// ============================================================
// 26. SUBGÊNEROS
// ============================================================

function renderSubgenresForGenre(
    genreId
) {

    const container =
        document.getElementById(
            'subgenres-container'
        );


    if (!container) {
        return;
    }


    const filtered =
        subgenres.filter(
            item =>
                Number(item.genre_id) ===
                Number(genreId)
        );


    if (!filtered.length) {

        container.innerHTML = `
            <div
                class="
                    col-span-full
                    bg-slate-50
                    rounded-xl
                    p-5
                    text-sm
                    text-slate-500
                "
            >
                Este gênero ainda não possui subgêneros.
            </div>
        `;

        return;

    }


    container.innerHTML =
        filtered
            .map(
                sub => {

                    const count =
                        books.filter(
                            book =>
                                Number(book.subgenre_id) ===
                                Number(sub.id)
                        ).length;


                    return `

                        <button
                            type="button"
                            onclick="openSubgenre(${sub.id})"
                            class="
                                bg-white
                                border
                                border-slate-200
                                rounded-xl
                                p-4
                                text-left
                            "
                        >

                            <h4
                                class="
                                    font-semibold
                                    text-slate-800
                                "
                            >
                                ${escapeHtml(sub.name)}
                            </h4>


                            <p
                                class="
                                    text-xs
                                    text-slate-500
                                "
                            >
                                ${count} livro(s)
                            </p>

                        </button>
                    `;

                }
            )
            .join('');


    renderIcons();

}


// ============================================================
// 27. LIVROS DO GÊNERO
// ============================================================

function renderBooksForGenre(
    genreId
) {

    const container =
        document.getElementById(
            'genre-books-container'
        );


    if (!container) {
        return;
    }


    const filtered =
        books.filter(
            book =>
                Number(book.genre_id) ===
                Number(genreId)
        );


    if (!filtered.length) {

        container.innerHTML = `
            <p
                class="
                    col-span-full
                    text-center
                    text-slate-400
                    py-10
                "
            >
                Nenhum livro neste gênero.
            </p>
        `;

        return;

    }


    container.innerHTML =
        filtered
            .map(
                book =>
                    createBookCard(
                        book
                    )
            )
            .join('');

}


// ============================================================
// 28. ABRIR SUBGÊNERO
// ============================================================

function openSubgenre(
    subgenreId
) {

    const sub =
        subgenres.find(
            item =>
                Number(item.id) ===
                Number(subgenreId)
        );


    if (!sub) {
        return;
    }


    const genre =
        genres.find(
            item =>
                Number(item.id) ===
                Number(sub.genre_id)
        );


    currentLibraryGenreId =
        Number(
            sub.genre_id
        );

    currentLibrarySubgenreId =
        Number(
            sub.id
        );


    document
        .getElementById(
            'library-home'
        )
        ?.classList
        .add('hidden');


    document
        .getElementById(
            'library-genre-view'
        )
        ?.classList
        .add('hidden');


    document
        .getElementById(
            'library-subgenre-view'
        )
        ?.classList
        .remove('hidden');


    const title =
        document.getElementById(
            'current-subgenre-title'
        );


    const parent =
        document.getElementById(
            'subgenre-parent-name'
        );


    if (title) {

        title.textContent =
            sub.name;

    }


    if (parent) {

        parent.textContent =
            genre?.name ||
            '';

    }


    renderBooksForSubgenre(
        sub.id
    );


    renderIcons();

}


// ============================================================
// 29. LIVROS DO SUBGÊNERO
// ============================================================

function renderBooksForSubgenre(
    subgenreId
) {

    const container =
        document.getElementById(
            'subgenre-books-container'
        );


    if (!container) {
        return;
    }


    const filtered =
        books.filter(
            book =>
                Number(book.subgenre_id) ===
                Number(subgenreId)
        );


    container.innerHTML =
        filtered.length
            ? filtered
                .map(
                    book =>
                        createBookCard(
                            book
                        )
                )
                .join('')
            : `
                <p
                    class="
                        col-span-full
                        text-center
                        text-slate-400
                        py-10
                    "
                >
                    Nenhum livro neste subgênero.
                </p>
            `;

}


// ============================================================
// 30. VOLTAR NA BIBLIOTECA
// ============================================================

function backToLibraryHome() {

    currentLibraryGenreId =
        null;

    currentLibrarySubgenreId =
        null;


    document
        .getElementById(
            'library-genre-view'
        )
        ?.classList
        .add('hidden');


    document
        .getElementById(
            'library-subgenre-view'
        )
        ?.classList
        .add('hidden');


    document
        .getElementById(
            'library-home'
        )
        ?.classList
        .remove('hidden');


    renderIcons();

}


function backToCurrentGenre() {

    if (!currentLibraryGenreId) {

        backToLibraryHome();

        return;

    }


    openGenre(
        currentLibraryGenreId
    );

}


// ============================================================
// 31. PESQUISA DA BIBLIOTECA
// ============================================================

function handleLibrarySearch() {

    const input =
        document.getElementById(
            'lib-search-input'
        );


    const search =
        (
            input?.value ||
            ''
        )
            .trim()
            .toLowerCase();


    const searchSection =
        document.getElementById(
            'library-search-section'
        );


    if (!search) {

        searchSection
            ?.classList
            .add('hidden');


        document
            .getElementById(
                'library-home'
            )
            ?.classList
            .remove('hidden');


        return;

    }


    document
        .getElementById(
            'library-home'
        )
        ?.classList
        .add('hidden');


    document
        .getElementById(
            'library-genre-view'
        )
        ?.classList
        .add('hidden');


    document
        .getElementById(
            'library-subgenre-view'
        )
        ?.classList
        .add('hidden');


    searchSection
        ?.classList
        .remove('hidden');


    renderLibrarySearchResults();

}


function renderLibrarySearchResults() {

    const container =
        document.getElementById(
            'library-search-results'
        );


    if (!container) {
        return;
    }


    const counter =
        document.getElementById(
            'library-search-count'
        );


    const search =
        (
            document
                .getElementById(
                    'lib-search-input'
                )
                ?.value ||
            ''
        )
            .trim()
            .toLowerCase();


    const filter =
        document
            .getElementById(
                'lib-filter-select'
            )
            ?.value ||
        'all';


    const filtered =
        books.filter(
            book => {

                const title =
                    (
                        book.title ||
                        ''
                    )
                        .toLowerCase()
                        .includes(
                            search
                        );


                const author =
                    (
                        book.author ||
                        ''
                    )
                        .toLowerCase()
                        .includes(
                            search
                        );


                const description =
                    (
                        book.description ||
                        ''
                    )
                        .toLowerCase()
                        .includes(
                            search
                        );


                if (
                    filter === 'titulo'
                ) {

                    return title;

                }


                if (
                    filter === 'autor'
                ) {

                    return author;

                }


                if (
                    filter === 'descricao'
                ) {

                    return description;

                }


                return (
                    title ||
                    author ||
                    description
                );

            }
        );


    if (counter) {

        counter.textContent =
            `${filtered.length} livro(s) encontrado(s)`;

    }


    container.innerHTML =
        filtered.length
            ? filtered
                .map(
                    book =>
                        createBookCard(
                            book
                        )
                )
                .join('')
            : `
                <p
                    class="
                        col-span-full
                        text-center
                        text-slate-400
                        py-10
                    "
                >
                    Nenhum livro encontrado.
                </p>
            `;

}


function clearLibrarySearch() {

    const input =
        document.getElementById(
            'lib-search-input'
        );


    if (input) {

        input.value =
            '';

    }


    document
        .getElementById(
            'library-search-section'
        )
        ?.classList
        .add('hidden');


    backToLibraryHome();

}


// ============================================================
// 32. GÊNEROS DO ADMIN
// ============================================================

function renderAdminGenreSelect() {

    const select =
        document.getElementById(
            'admin-book-genre'
        );


    if (!select) {
        return;
    }


    const current =
        select.value;


    select.innerHTML = `

        <option value="">
            Selecione um gênero
        </option>

        ${
            genres
                .map(
                    genre => `
                        <option
                            value="${genre.id}"
                        >
                            ${escapeHtml(genre.name)}
                        </option>
                    `
                )
                .join('')
        }
    `;


    if (
        current &&
        genres.some(
            item =>
                String(item.id) ===
                String(current)
        )
    ) {

        select.value =
            current;

    }


    updateAdminSubgenres();

}


function updateAdminSubgenres() {

    const genreSelect =
        document.getElementById(
            'admin-book-genre'
        );


    const subSelect =
        document.getElementById(
            'admin-book-subgenre'
        );


    if (
        !genreSelect ||
        !subSelect
    ) {

        return;

    }


    const genreId =
        Number(
            genreSelect.value
        );


    subSelect.innerHTML = `
        <option value="">
            Nenhum subgênero
        </option>
    `;


    if (!genreId) {

        subSelect.disabled =
            true;

        return;

    }


    subgenres
        .filter(
            sub =>
                Number(sub.genre_id) ===
                genreId
        )
        .forEach(
            sub => {

                const option =
                    document.createElement(
                        'option'
                    );


                option.value =
                    sub.id;


                option.textContent =
                    sub.name;


                subSelect
                    .appendChild(
                        option
                    );

            }
        );


    subSelect.disabled =
        false;

}


// ============================================================
// 33. EMPRÉSTIMOS DO USUÁRIO
// ============================================================

async function loadMyLoans() {

    myLoans =
        [];


    if (
        !db ||
        !currentUser
    ) {

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from('loans')
            .select(`
                id,
                code,
                status,
                requested_at,
                due_date,
                returned_at,
                books (
                    title,
                    author
                )
            `)
            .eq(
                'user_id',
                currentUser.id
            )
            .order(
                'requested_at',
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(
            'Erro ao carregar empréstimos:',
            error
        );

        return;

    }


    myLoans =
        data ||
        [];

}


function loanStatusLabel(status) {

    return ({
        requested:
            'Solicitado',

        borrowed:
            'Retirado',

        returned:
            'Devolvido',

        cancelled:
            'Cancelado'
    })[status] || status;

}


function renderMyLoans() {

    const container =
        document.getElementById(
            'my-loans-container'
        );


    if (!container) {
        return;
    }


    if (!currentUser) {

        container.innerHTML = `
            <div
                class="
                    bg-slate-100
                    p-4
                    rounded-xl
                    text-sm
                    text-slate-600
                "
            >
                Faça login para acompanhar seus empréstimos.
            </div>
        `;

        return;

    }


    if (!myLoans.length) {

        container.innerHTML = `
            <div
                class="
                    bg-slate-100
                    p-4
                    rounded-xl
                    text-sm
                    text-slate-500
                "
            >
                Você ainda não possui empréstimos.
            </div>
        `;

        return;

    }


    container.innerHTML =
        myLoans
            .map(
                loan => `

                    <div
                        class="
                            bg-white
                            border
                            border-slate-200
                            rounded-xl
                            p-4
                            flex
                            flex-col
                            md:flex-row
                            justify-between
                            gap-3
                        "
                    >

                        <div>

                            <p
                                class="
                                    font-bold
                                    text-slate-900
                                "
                            >
                                ${escapeHtml(
                                    loan.books?.title ||
                                    'Livro'
                                )}
                            </p>


                            <p
                                class="
                                    text-xs
                                    text-slate-500
                                "
                            >
                                Código:
                                ${escapeHtml(loan.code)}

                                •

                                Prazo:
                                ${formatDate(loan.due_date)}
                            </p>

                        </div>


                        <span
                            class="
                                status-pill
                                ${
                                    loan.status === 'returned'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                }
                            "
                        >
                            ${loanStatusLabel(loan.status)}
                        </span>

                    </div>
                `
            )
            .join('');

}


// ============================================================
// 34. SOLICITAR LIVRO
// ============================================================

async function requestLoan(
    bookId
) {

    if (!currentUser) {

        alert(
            'Faça login para solicitar um livro.'
        );

        switchTab(
            'login'
        );

        return;

    }


    const {
        data,
        error
    } =
        await db
            .rpc(
                'request_book_loan',
                {
                    p_book_id:
                        bookId
                }
            );


    if (error) {

        return showError(
            'Não foi possível solicitar o empréstimo',
            error
        );

    }


    const loan =
        Array.isArray(data)
            ? data[0]
            : data;


    const book =
        books.find(
            item =>
                Number(item.id) ===
                Number(bookId)
        );


    const box =
        document.getElementById(
            'loan-details-box'
        );


    if (box) {

        box.innerHTML = `

            <p>
                <b>Voucher:</b>
                ${escapeHtml(loan?.code || '')}
            </p>

            <p>
                <b>Livro:</b>
                ${escapeHtml(book?.title || '')}
            </p>

            <p>
                <b>Autor:</b>
                ${escapeHtml(book?.author || '')}
            </p>

            <p>
                <b>Prazo:</b>
                ${formatDate(loan?.due_date)}
            </p>
        `;

    }


    await Promise.all([
        loadBooks(),
        loadMyLoans()
    ]);


    renderLibrary();

    renderMyLoans();


    switchTab(
        'emprestimo-confirmacao'
    );

}


// ============================================================
// 35. VOTOS DO USUÁRIO
// ============================================================

async function loadUserVotes() {

    userVotes =
        new Map();


    if (
        !db ||
        !currentUser
    ) {

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from(
                'poll_votes'
            )
            .select(
                'poll_id, option_id'
            )
            .eq(
                'user_id',
                currentUser.id
            );


    if (!error) {

        (
            data ||
            []
        )
            .forEach(
                vote => {

                    userVotes
                        .set(
                            vote.poll_id,
                            vote.option_id
                        );

                }
            );

    }

}


// ============================================================
// 36. ENQUETES
// ============================================================

async function loadPolls() {

    if (!db) {
        return;
    }


    const {
        data: pollRows,
        error
    } =
        await db
            .from('polls')
            .select(`
                id,
                question,
                active,
                created_at,
                poll_options (
                    id,
                    label,
                    option_text
                )
            `)
            .eq(
                'active',
                true
            )
            .order(
                'created_at',
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(
            'Erro ao carregar enquetes:',
            error
        );

        return;

    }


    const {
        data: results,
        error: resultError
    } =
        await db
            .rpc(
                'get_poll_results'
            );


    if (resultError) {

        console.error(
            'Erro ao carregar resultados:',
            resultError
        );

    }


    const counts =
        new Map();


    (
        results ||
        []
    )
        .forEach(
            row => {

                counts.set(
                    `${
                        row.poll_id
                    }:${
                        row.option_id
                    }`,
                    Number(
                        row.votes
                    )
                );

            }
        );


    polls =
        (
            pollRows ||
            []
        )
            .map(
                poll => ({

                    ...poll,

                    poll_options:
                        (
                            poll.poll_options ||
                            []
                        )
                            .sort(
                                (
                                    a,
                                    b
                                ) =>
                                    a.label
                                        .localeCompare(
                                            b.label
                                        )
                            )
                            .map(
                                option => ({

                                    ...option,

                                    votes:
                                        counts.get(
                                            `${
                                                poll.id
                                            }:${
                                                option.id
                                            }`
                                        ) ||
                                        0

                                })
                            )

                })
            );

}


// ============================================================
// 37. MOSTRAR ENQUETES
// ============================================================

function renderPolls() {

    const container =
        document.getElementById(
            'polls-container'
        );


    if (!container) {
        return;
    }


    if (!polls.length) {

        container.innerHTML = `
            <div
                class="
                    bg-slate-100
                    p-6
                    rounded-xl
                    text-center
                "
            >
                Nenhuma enquete ativa.
            </div>
        `;

        return;

    }


    container.innerHTML =
        '';


    polls.forEach(
        poll => {

            const total =
                poll.poll_options
                    .reduce(
                        (
                            sum,
                            option
                        ) =>
                            sum +
                            option.votes,
                        0
                    );


            const voted =
                userVotes.has(
                    poll.id
                );


            const options =
                poll.poll_options
                    .map(
                        option => {

                            const percent =
                                total
                                    ? Math.round(
                                        (
                                            option.votes /
                                            total
                                        ) *
                                        100
                                    )
                                    : 0;


                            return `

                                <div class="space-y-1">

                                    <button
                                        type="button"
                                        onclick="handleVote(${poll.id}, ${option.id})"
                                        ${voted ? 'disabled' : ''}
                                        class="
                                            w-full
                                            text-left
                                            border
                                            p-3
                                            rounded-xl
                                            bg-slate-50
                                        "
                                    >

                                        <b>
                                            ${escapeHtml(option.label)}:
                                        </b>

                                        ${escapeHtml(option.option_text)}

                                        <span
                                            class="
                                                float-right
                                                text-xs
                                            "
                                        >
                                            ${option.votes} voto(s)
                                        </span>

                                    </button>


                                    <div
                                        class="
                                            h-2
                                            bg-slate-100
                                            rounded-full
                                            overflow-hidden
                                        "
                                    >

                                        <div
                                            class="
                                                h-full
                                                bg-indigo-600
                                            "
                                            style="width:${percent}%"
                                        ></div>

                                    </div>

                                </div>
                            `;

                        }
                    )
                    .join('');


            const card =
                document.createElement(
                    'div'
                );


            card.className =
                'bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4';


            card.innerHTML = `

                <div
                    class="
                        flex
                        justify-between
                        gap-4
                    "
                >

                    <h3
                        class="
                            font-bold
                            text-lg
                        "
                    >
                        ${escapeHtml(poll.question)}
                    </h3>


                    ${
                        isAdmin()
                            ? `
                                <button
                                    type="button"
                                    onclick="deletePoll(${poll.id})"
                                    class="text-red-500"
                                >
                                    <i
                                        data-lucide="trash-2"
                                        class="w-5 h-5"
                                    ></i>
                                </button>
                            `
                            : ''
                    }

                </div>


                ${options}

            `;


            container
                .appendChild(
                    card
                );

        }
    );


    renderIcons();

}


// ============================================================
// 38. VOTAR
// ============================================================

async function handleVote(
    pollId,
    optionId
) {

    if (!currentUser) {

        alert(
            'Faça login para votar.'
        );

        switchTab(
            'login'
        );

        return;

    }


    const {
        error
    } =
        await db
            .rpc(
                'vote_poll',
                {
                    p_poll_id:
                        pollId,

                    p_option_id:
                        optionId
                }
            );


    if (error) {

        return showError(
            'Não foi possível registrar o voto',
            error
        );

    }


    await Promise.all([
        loadPolls(),
        loadUserVotes()
    ]);


    renderPolls();

}


// ============================================================
// 39. EXCLUIR ENQUETE
// ============================================================

async function deletePoll(
    pollId
) {

    if (!isAdmin()) {

        alert(
            'Ação não autorizada.'
        );

        return;

    }


    if (
        !confirm(
            'Excluir esta enquete permanentemente?'
        )
    ) {

        return;

    }


    const {
        error
    } =
        await db
            .from('polls')
            .delete()
            .eq(
                'id',
                pollId
            );


    if (error) {

        return showError(
            'Não foi possível excluir a enquete',
            error
        );

    }


    await loadPolls();

    renderPolls();

}


// ============================================================
// 40. PAINEL ADMINISTRATIVO
// ============================================================

async function renderAdminDashboard() {

    if (
        !isAdmin() ||
        !db
    ) {

        return;

    }


    const [
        articleResult,
        loanResult,
        helpResult
    ] =
        await Promise.all([

            db
                .from('articles')
                .select(`
                    id,
                    title,
                    content,
                    image_url,
                    status,
                    created_at
                `)
                .order(
                    'created_at',
                    {
                        ascending:
                            false
                    }
                ),


            db
                .from('loans')
                .select(`
                    id,
                    code,
                    status,
                    requested_at,
                    due_date,
                    profiles (
                        full_name,
                        email
                    ),
                    books (
                        title
                    )
                `)
                .order(
                    'requested_at',
                    {
                        ascending:
                            false
                    }
                ),


            db
                .from('help_questions')
                .select(`
                    id,
                    name,
                    email,
                    message,
                    status,
                    admin_response,
                    responded_at,
                    responded_by,
                    created_at
                `)
                .order(
                    'created_at',
                    {
                        ascending:
                            false
                    }
                )

        ]);


    // ========================================================
    // NOTÍCIAS
    // ========================================================

    const articleList =
        document.getElementById(
            'admin-articles-list'
        );


    if (articleList) {

        if (
            articleResult.error
        ) {

            console.error(
                articleResult.error
            );


            articleList.innerHTML =
                '<p class="text-rose-500">Erro ao carregar notícias.</p>';

        } else {

            adminArticles =
                articleResult.data ||
                [];


            articleList.innerHTML =
                adminArticles.length
                    ? adminArticles
                        .map(
                            article => `

                                <div
                                    class="
                                        flex
                                        justify-between
                                        gap-3
                                        py-3
                                    "
                                >

                                    <div>

                                        <p
                                            class="
                                                font-medium
                                                text-slate-700
                                            "
                                        >
                                            ${escapeHtml(article.title)}
                                        </p>


                                        <span
                                            class="
                                                text-xs
                                                ${
                                                    article.status === 'published'
                                                        ? 'text-emerald-600'
                                                        : 'text-amber-600'
                                                }
                                            "
                                        >
                                            ${
                                                article.status === 'published'
                                                    ? 'Publicado'
                                                    : 'Rascunho'
                                            }
                                        </span>

                                    </div>


                                    <div
                                        class="
                                            flex
                                            gap-3
                                        "
                                    >

                                        <button
                                            onclick="loadArticleToEdit(${article.id})"
                                            class="text-indigo-600 text-xs font-semibold"
                                        >
                                            Editar
                                        </button>


                                        <button
                                            onclick="deleteArticle(${article.id})"
                                            class="text-rose-600 text-xs font-semibold"
                                        >
                                            Excluir
                                        </button>

                                    </div>

                                </div>
                            `
                        )
                        .join('')
                    : `
                        <p
                            class="
                                text-slate-400
                                py-4
                            "
                        >
                            Nenhuma notícia cadastrada.
                        </p>
                    `;

        }

    }


    // ========================================================
    // EMPRÉSTIMOS
    // ========================================================

    const loanList =
        document.getElementById(
            'admin-loans-list'
        );


    if (loanList) {

        if (
            loanResult.error
        ) {

            console.error(
                loanResult.error
            );


            loanList.innerHTML =
                '<p class="text-rose-500">Erro ao carregar empréstimos.</p>';

        } else {

            const rows =
                loanResult.data ||
                [];


            loanList.innerHTML =
                rows.length
                    ? rows
                        .map(
                            loan => `

                                <div
                                    class="
                                        py-4
                                        flex
                                        flex-col
                                        sm:flex-row
                                        justify-between
                                        gap-3
                                    "
                                >

                                    <div>

                                        <p
                                            class="
                                                font-semibold
                                            "
                                        >
                                            ${escapeHtml(
                                                loan.profiles?.full_name ||
                                                loan.profiles?.email ||
                                                'Aluno'
                                            )}
                                        </p>


                                        <p
                                            class="
                                                text-sm
                                                text-slate-600
                                            "
                                        >
                                            ${escapeHtml(
                                                loan.books?.title ||
                                                'Livro'
                                            )}
                                        </p>


                                        <p
                                            class="
                                                text-xs
                                                text-slate-400
                                            "
                                        >
                                            ${escapeHtml(loan.code)}
                                            •
                                            ${loanStatusLabel(loan.status)}
                                            •
                                            ${formatDate(loan.due_date)}
                                        </p>

                                    </div>


                                    ${
                                        [
                                            'requested',
                                            'borrowed'
                                        ]
                                            .includes(
                                                loan.status
                                            )
                                            ? `
                                                <button
                                                    onclick="markLoanReturned(${loan.id})"
                                                    class="
                                                        text-emerald-700
                                                        font-bold
                                                        text-sm
                                                    "
                                                >
                                                    Marcar devolvido
                                                </button>
                                            `
                                            : ''
                                    }

                                </div>
                            `
                        )
                        .join('')
                    : `
                        <p
                            class="
                                text-slate-400
                                py-4
                            "
                        >
                            Nenhum empréstimo registrado.
                        </p>
                    `;

        }

    }


    // ========================================================
    // SUPORTE
    // ========================================================

    const helpList =
        document.getElementById(
            'admin-help-list'
        );


    if (helpList) {

        if (
            helpResult.error
        ) {

            console.error(
                'Erro ao carregar suporte:',
                helpResult.error
            );


            helpList.innerHTML = `
                <div
                    class="
                        bg-rose-50
                        text-rose-700
                        p-4
                        rounded-xl
                    "
                >
                    Não foi possível carregar as perguntas.
                </div>
            `;

        } else {

            const questions =
                helpResult.data ||
                [];


            if (!questions.length) {

                helpList.innerHTML = `
                    <div
                        class="
                            text-center
                            py-10
                            text-slate-400
                        "
                    >
                        Nenhuma pergunta de suporte recebida.
                    </div>
                `;

            } else {

                helpList.innerHTML =
                    questions
                        .map(
                            item => `

                                <div
                                    class="
                                        py-6
                                        space-y-4
                                    "
                                >

                                    <div
                                        class="
                                            flex
                                            flex-wrap
                                            items-center
                                            gap-2
                                        "
                                    >

                                        <p
                                            class="
                                                font-bold
                                                text-slate-800
                                            "
                                        >
                                            ${escapeHtml(item.name)}
                                        </p>


                                        <span
                                            class="
                                                text-[10px]
                                                font-bold
                                                uppercase
                                                px-2
                                                py-1
                                                rounded-full
                                                ${
                                                    item.status === 'resolved'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                }
                                            "
                                        >
                                            ${
                                                item.status === 'resolved'
                                                    ? 'Resolvido'
                                                    : 'Aberto'
                                            }
                                        </span>

                                    </div>


                                    <p
                                        class="
                                            text-xs
                                            text-slate-400
                                        "
                                    >
                                        ${escapeHtml(item.email)}
                                    </p>


                                    <p
                                        class="
                                            text-xs
                                            text-slate-400
                                        "
                                    >
                                        Enviado em:
                                        ${formatDate(item.created_at)}
                                    </p>


                                    <div
                                        class="
                                            bg-slate-50
                                            border
                                            rounded-xl
                                            p-4
                                        "
                                    >

                                        <p
                                            class="
                                                text-xs
                                                uppercase
                                                font-bold
                                                text-slate-400
                                                mb-2
                                            "
                                        >
                                            Pergunta
                                        </p>


                                        <p
                                            class="
                                                text-sm
                                                text-slate-700
                                                whitespace-pre-wrap
                                            "
                                        >
                                            ${escapeHtml(item.message)}
                                        </p>

                                    </div>


                                    ${
                                        item.admin_response
                                            ? `

                                                <div
                                                    class="
                                                        bg-indigo-50
                                                        border
                                                        border-indigo-100
                                                        rounded-xl
                                                        p-4
                                                    "
                                                >

                                                    <p
                                                        class="
                                                            text-xs
                                                            font-bold
                                                            text-indigo-500
                                                            mb-2
                                                        "
                                                    >
                                                        Resposta atual
                                                    </p>


                                                    <p
                                                        class="
                                                            text-sm
                                                            text-slate-700
                                                            whitespace-pre-wrap
                                                        "
                                                    >
                                                        ${escapeHtml(item.admin_response)}
                                                    </p>


                                                    ${
                                                        item.responded_at
                                                            ? `
                                                                <p
                                                                    class="
                                                                        text-xs
                                                                        text-slate-400
                                                                        mt-2
                                                                    "
                                                                >
                                                                    Respondido em
                                                                    ${formatDate(item.responded_at)}
                                                                </p>
                                                            `
                                                            : ''
                                                    }

                                                </div>

                                            `
                                            : ''
                                    }


                                    <div>

                                        <label
                                            class="
                                                block
                                                text-xs
                                                font-bold
                                                uppercase
                                                text-slate-500
                                                mb-2
                                            "
                                        >
                                            ${
                                                item.admin_response
                                                    ? 'Editar resposta'
                                                    : 'Responder'
                                            }
                                        </label>


                                        <textarea
                                            id="support-response-${item.id}"
                                            rows="4"
                                            placeholder="Digite a resposta..."
                                            class="
                                                w-full
                                                px-4
                                                py-3
                                                border
                                                rounded-xl
                                                focus:ring-2
                                                focus:ring-violet-500
                                                focus:outline-none
                                            "
                                        >${escapeHtml(item.admin_response || '')}</textarea>

                                    </div>


                                    <div
                                        class="
                                            flex
                                            flex-col
                                            sm:flex-row
                                            gap-3
                                        "
                                    >

                                        <button
                                            type="button"
                                            onclick="respondHelpQuestion(${item.id})"
                                            class="
                                                bg-violet-600
                                                hover:bg-violet-700
                                                text-white
                                                font-semibold
                                                px-5
                                                py-2.5
                                                rounded-lg
                                            "
                                        >
                                            ${
                                                item.admin_response
                                                    ? 'Atualizar Resposta'
                                                    : 'Enviar Resposta'
                                            }
                                        </button>


                                        ${
                                            item.status !== 'resolved'
                                                ? `

                                                    <button
                                                        type="button"
                                                        onclick="markHelpResolved(${item.id})"
                                                        class="
                                                            bg-emerald-100
                                                            text-emerald-700
                                                            font-semibold
                                                            px-5
                                                            py-2.5
                                                            rounded-lg
                                                        "
                                                    >
                                                        Marcar como resolvida
                                                    </button>

                                                `
                                                : ''
                                        }

                                    </div>

                                </div>
                            `
                        )
                        .join('');

            }

        }

    }


    renderIcons();

}


// ============================================================
// 41. NAVEGAÇÃO DO PAINEL ADMIN
// ============================================================

async function openAdminSection(
    section
) {

    if (!isAdmin()) {

        alert(
            'Área exclusiva para gestores autorizados.'
        );

        return;

    }


    const views = {

        overview:
            'admin-view-overview',

        articles:
            'admin-view-articles',

        library:
            'admin-view-library',

        polls:
            'admin-view-polls',

        support:
            'admin-view-support'

    };


    document
        .querySelectorAll(
            '.admin-view'
        )
        .forEach(
            view => {

                view
                    .classList
                    .add('hidden');

            }
        );


    const target =
        document.getElementById(
            views[section] ||
            views.overview
        );


    if (target) {

        target
            .classList
            .remove('hidden');

    }


    if (
        section === 'articles' ||
        section === 'library' ||
        section === 'support'
    ) {

        await renderAdminDashboard();

    }


    if (
        section === 'library'
    ) {

        renderAdminGenreSelect();

    }


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });


    renderIcons();

}


// ============================================================
// 42. SALVAR ARTIGO
// ============================================================

async function saveArticle(
    status
) {

    if (!isAdmin()) {

        alert(
            'Ação não autorizada.'
        );

        return;

    }


    const idInput =
        document
            .getElementById(
                'admin-article-id'
            )
            ?.value ||
        '';


    const title =
        document
            .getElementById(
                'admin-art-title'
            )
            ?.value
            .trim() ||
        '';


    const imageUrl =
        document
            .getElementById(
                'admin-art-image'
            )
            ?.value
            .trim() ||
        null;


    const content =
        document
            .getElementById(
                'admin-art-content'
            )
            ?.value
            .trim() ||
        '';


    if (
        !title ||
        !content
    ) {

        alert(
            'Informe título e conteúdo.'
        );

        return;

    }


    const payload = {

        title,

        content,

        image_url:
            imageUrl,

        status

    };


    let result;


    if (idInput) {

        result =
            await db
                .from('articles')
                .update(
                    payload
                )
                .eq(
                    'id',
                    Number(idInput)
                );

    } else {

        result =
            await db
                .from('articles')
                .insert({

                    ...payload,

                    author_id:
                        currentUser.id

                });

    }


    if (
        result.error
    ) {

        return showError(
            'Não foi possível salvar o artigo',
            result.error
        );

    }


    clearArticleForm();


    await loadArticles();

    await renderAdminDashboard();


    renderArticles();


    alert(
        status === 'published'
            ? 'Artigo publicado com sucesso!'
            : 'Rascunho salvo com sucesso!'
    );

}


async function handleCreateArticle(e) {

    e.preventDefault();


    await saveArticle(
        'published'
    );

}


async function handleSaveDraft() {

    await saveArticle(
        'draft'
    );

}


// ============================================================
// 43. EDITAR ARTIGO
// ============================================================

function loadArticleToEdit(id) {

    if (!isAdmin()) {
        return;
    }


    const article =
        adminArticles.find(
            item =>
                Number(item.id) ===
                Number(id)
        );


    if (!article) {
        return;
    }


    openAdminSection(
        'articles'
    );


    document
        .getElementById(
            'admin-article-id'
        )
        .value =
        article.id;


    document
        .getElementById(
            'admin-art-title'
        )
        .value =
        article.title;


    document
        .getElementById(
            'admin-art-image'
        )
        .value =
        article.image_url ||
        '';


    document
        .getElementById(
            'admin-art-content'
        )
        .value =
        article.content;


    document
        .getElementById(
            'admin-art-title'
        )
        .focus();

}


// ============================================================
// 44. EXCLUIR ARTIGO
// ============================================================

async function deleteArticle(id) {

    if (!isAdmin()) {

        alert(
            'Ação não autorizada.'
        );

        return;

    }


    if (
        !confirm(
            'Excluir esta notícia permanentemente?'
        )
    ) {

        return;

    }


    const {
        error
    } =
        await db
            .from('articles')
            .delete()
            .eq(
                'id',
                id
            );


    if (error) {

        return showError(
            'Não foi possível excluir o artigo',
            error
        );

    }


    await loadArticles();

    await renderAdminDashboard();


    renderArticles();

}


function clearArticleForm() {

    const ids = [
        'admin-article-id',
        'admin-art-title',
        'admin-art-image',
        'admin-art-content'
    ];


    ids.forEach(
        id => {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                element.value =
                    '';

            }

        }
    );

}


// ============================================================
// 45. CADASTRAR LIVRO
// ============================================================

async function handleCreateBook(e) {

    e.preventDefault();


    if (!isAdmin()) {

        alert(
            'Ação não autorizada.'
        );

        return;

    }


    const title =
        document
            .getElementById(
                'admin-book-title'
            )
            .value
            .trim();


    const author =
        document
            .getElementById(
                'admin-book-author'
            )
            .value
            .trim();


    const description =
        document
            .getElementById(
                'admin-book-desc'
            )
            .value
            .trim();


    const genreValue =
        document
            .getElementById(
                'admin-book-genre'
            )
            .value;


    const subgenreValue =
        document
            .getElementById(
                'admin-book-subgenre'
            )
            .value;


    const copies =
        Number(
            document
                .getElementById(
                    'admin-book-copies'
                )
                .value
        );


    if (
        !title ||
        !author
    ) {

        alert(
            'Informe título e autor.'
        );

        return;

    }


    if (!genreValue) {

        alert(
            'Selecione um gênero.'
        );

        return;

    }


    if (
        !Number.isInteger(copies) ||
        copies < 1
    ) {

        alert(
            'Informe uma quantidade válida.'
        );

        return;

    }


    const {
        error
    } =
        await db
            .from('books')
            .insert({

                title,

                author,

                description:
                    description ||
                    null,

                genre_id:
                    Number(
                        genreValue
                    ),

                subgenre_id:
                    subgenreValue
                        ? Number(
                            subgenreValue
                        )
                        : null,

                total_copies:
                    copies,

                available_copies:
                    copies,

                active:
                    true

            });


    if (error) {

        return showError(
            'Não foi possível cadastrar o livro',
            error
        );

    }


    e.target.reset();


    updateAdminSubgenres();


    await loadBooks();


    renderLibrary();


    alert(
        'Livro cadastrado com sucesso!'
    );

}


// ============================================================
// 46. DEVOLVER LIVRO
// ============================================================

async function markLoanReturned(
    loanId
) {

    if (!isAdmin()) {

        alert(
            'Ação não autorizada.'
        );

        return;

    }


    const {
        error
    } =
        await db
            .rpc(
                'return_book_loan',
                {
                    p_loan_id:
                        loanId
                }
            );


    if (error) {

        return showError(
            'Não foi possível registrar a devolução',
            error
        );

    }


    await Promise.all([
        loadBooks(),
        loadMyLoans()
    ]);


    await renderAdminDashboard();


    renderLibrary();

    renderMyLoans();

}


// ============================================================
// 47. CRIAR ENQUETE
// ============================================================

async function handleCreatePoll(e) {

    e.preventDefault();


    if (!isAdmin()) {

        alert(
            'Ação não autorizada.'
        );

        return;

    }


    const question =
        document
            .getElementById(
                'admin-poll-question'
            )
            .value
            .trim();


    const values =
        [
            'A',
            'B',
            'C',
            'D',
            'E'
        ]
            .map(
                label => {

                    const input =
                        document.getElementById(
                            `admin-poll-op${label}`
                        );


                    return {

                        label,

                        option_text:
                            input
                                ? input.value.trim()
                                : ''

                    };

                }
            )
            .filter(
                item =>
                    item.option_text
            );


    if (!question) {

        alert(
            'Informe a pergunta da enquete.'
        );

        return;

    }


    if (
        values.length < 2
    ) {

        alert(
            'A enquete precisa ter pelo menos duas opções.'
        );

        return;

    }


    const {
        data: poll,
        error
    } =
        await db
            .from('polls')
            .insert({

                question,

                active:
                    true,

                created_by:
                    currentUser.id

            })
            .select(
                'id'
            )
            .single();


    if (error) {

        return showError(
            'Não foi possível criar a enquete',
            error
        );

    }


    const {
        error: optionsError
    } =
        await db
            .from(
                'poll_options'
            )
            .insert(
                values.map(
                    item => ({

                        ...item,

                        poll_id:
                            poll.id

                    })
                )
            );


    if (optionsError) {

        await db
            .from('polls')
            .delete()
            .eq(
                'id',
                poll.id
            );


        return showError(
            'Não foi possível salvar as opções',
            optionsError
        );

    }


    e.target.reset();


    await loadPolls();


    renderPolls();


    alert(
        'Enquete criada com sucesso!'
    );


    switchTab(
        'enquetes'
    );

}


// ============================================================
// 48. PERGUNTAS DO USUÁRIO
// ============================================================

async function loadMyHelpQuestions() {

    myHelpQuestions =
        [];


    if (
        !db ||
        !currentUser
    ) {

        return;

    }


    const {
        data,
        error
    } =
        await db
            .from(
                'help_questions'
            )
            .select(`
                id,
                name,
                email,
                message,
                status,
                admin_response,
                responded_at,
                created_at
            `)
            .eq(
                'user_id',
                currentUser.id
            )
            .order(
                'created_at',
                {
                    ascending:
                        false
                }
            );


    if (error) {

        console.error(
            'Erro ao carregar perguntas:',
            error
        );

        return;

    }


    myHelpQuestions =
        data ||
        [];

}


// ============================================================
// 49. MOSTRAR PERGUNTAS E RESPOSTAS
// ============================================================

function renderMyHelpQuestions() {

    const container =
        document.getElementById(
            'my-help-questions-container'
        );


    if (!container) {
        return;
    }


    if (!currentUser) {

        container.innerHTML = `
            <div
                class="
                    bg-slate-50
                    border
                    rounded-xl
                    p-5
                    text-sm
                    text-slate-500
                "
            >
                Faça login para acompanhar suas perguntas e respostas.
            </div>
        `;

        return;

    }


    if (!myHelpQuestions.length) {

        container.innerHTML = `
            <div
                class="
                    bg-slate-50
                    border
                    rounded-xl
                    p-5
                    text-sm
                    text-slate-500
                "
            >
                Você ainda não enviou nenhuma pergunta.
            </div>
        `;

        return;

    }


    container.innerHTML =
        myHelpQuestions
            .map(
                item => `

                    <div
                        class="
                            bg-white
                            border
                            rounded-xl
                            p-5
                            space-y-4
                        "
                    >

                        <div
                            class="
                                flex
                                justify-between
                                gap-3
                            "
                        >

                            <div>

                                <p
                                    class="
                                        font-semibold
                                        text-slate-900
                                    "
                                >
                                    Sua pergunta
                                </p>


                                <p
                                    class="
                                        text-xs
                                        text-slate-400
                                    "
                                >
                                    ${formatDate(item.created_at)}
                                </p>

                            </div>


                            <span
                                class="
                                    text-xs
                                    font-bold
                                    px-2
                                    py-1
                                    rounded-full
                                    ${
                                        item.status === 'resolved'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-amber-100 text-amber-700'
                                    }
                                "
                            >
                                ${
                                    item.status === 'resolved'
                                        ? 'Resolvido'
                                        : 'Em análise'
                                }
                            </span>

                        </div>


                        <div
                            class="
                                bg-slate-50
                                rounded-lg
                                p-4
                            "
                        >

                            <p
                                class="
                                    text-sm
                                    text-slate-700
                                    whitespace-pre-wrap
                                "
                            >
                                ${escapeHtml(item.message)}
                            </p>

                        </div>


                        ${
                            item.admin_response
                                ? `

                                    <div
                                        class="
                                            bg-indigo-50
                                            border-l-4
                                            border-indigo-500
                                            p-4
                                            rounded-r-xl
                                        "
                                    >

                                        <p
                                            class="
                                                text-sm
                                                font-bold
                                                text-indigo-800
                                                mb-2
                                            "
                                        >
                                            Resposta da equipe
                                        </p>


                                        <p
                                            class="
                                                text-sm
                                                text-slate-700
                                                whitespace-pre-wrap
                                            "
                                        >
                                            ${escapeHtml(item.admin_response)}
                                        </p>


                                        ${
                                            item.responded_at
                                                ? `
                                                    <p
                                                        class="
                                                            text-xs
                                                            text-slate-400
                                                            mt-3
                                                        "
                                                    >
                                                        Respondido em
                                                        ${formatDate(item.responded_at)}
                                                    </p>
                                                `
                                                : ''
                                        }

                                    </div>

                                `
                                : `

                                    <p
                                        class="
                                            text-sm
                                            text-slate-400
                                        "
                                    >
                                        Aguardando resposta da equipe.
                                    </p>

                                `
                        }

                    </div>
                `
            )
            .join('');


    renderIcons();

}


// ============================================================
// 50. FORMULÁRIO DE AJUDA
// ============================================================

function setupHelpForm() {

    const name =
        document.getElementById(
            'help-nome'
        );


    const email =
        document.getElementById(
            'help-email'
        );


    if (
        !name ||
        !email
    ) {

        return;

    }


    if (currentUser) {

        name.value =
            currentProfile?.full_name ||
            '';


        email.value =
            currentUser.email ||
            '';

    }


    loadMyHelpQuestions()
        .then(
            () =>
                renderMyHelpQuestions()
        );

}


// ============================================================
// 51. ENVIAR PERGUNTA
// ============================================================

async function handleSendHelpQuestion(e) {

    e.preventDefault();


    if (!ensureConfigured()) {
        return;
    }


    const name =
        document
            .getElementById(
                'help-nome'
            )
            .value
            .trim();


    const email =
        document
            .getElementById(
                'help-email'
            )
            .value
            .trim()
            .toLowerCase();


    const message =
        document
            .getElementById(
                'help-mensagem'
            )
            .value
            .trim();


    if (
        !name ||
        !email ||
        !message
    ) {

        alert(
            'Preencha todos os campos.'
        );

        return;

    }


    const {
        error
    } =
        await db
            .from(
                'help_questions'
            )
            .insert({

                user_id:
                    currentUser?.id ||
                    null,

                name,

                email,

                message,

                status:
                    'open'

            });


    if (error) {

        console.error(
            'Erro ao enviar pergunta:',
            error
        );


        return showError(
            'Não foi possível enviar sua pergunta',
            error
        );

    }


    document
        .getElementById(
            'help-mensagem'
        )
        .value =
        '';


    if (currentUser) {

        await loadMyHelpQuestions();

        renderMyHelpQuestions();

    }


    alert(
        'Pergunta enviada com sucesso para a equipe de suporte!'
    );

}


// ============================================================
// 52. GESTOR RESPONDER PERGUNTA
// ============================================================

async function respondHelpQuestion(
    id
) {

    if (!isAdmin()) {

        alert(
            'Ação não autorizada.'
        );

        return;

    }


    const textarea =
        document.getElementById(
            `support-response-${id}`
        );


    if (!textarea) {
        return;
    }


    const response =
        textarea
            .value
            .trim();


    if (!response) {

        alert(
            'Digite uma resposta antes de enviar.'
        );

        return;

    }


    const {
        error
    } =
        await db
            .from(
                'help_questions'
            )
            .update({

                admin_response:
                    response,

                responded_at:
                    new Date()
                        .toISOString(),

                responded_by:
                    currentUser.id

            })
            .eq(
                'id',
                id
            );


    if (error) {

        return showError(
            'Não foi possível responder a pergunta',
            error
        );

    }


    alert(
        'Resposta salva com sucesso!'
    );


    await renderAdminDashboard();

}


// ============================================================
// 53. MARCAR PERGUNTA COMO RESOLVIDA
// ============================================================

async function markHelpResolved(
    id
) {

    if (!isAdmin()) {

        alert(
            'Ação não autorizada.'
        );

        return;

    }


    const {
        error
    } =
        await db
            .from(
                'help_questions'
            )
            .update({
                status:
                    'resolved'
            })
            .eq(
                'id',
                id
            );


    if (error) {

        return showError(
            'Não foi possível atualizar a pergunta',
            error
        );

    }


    await renderAdminDashboard();

}


// ============================================================
// 54. INICIALIZAÇÃO
// ============================================================

async function initializeApp() {

    // Carrega o tema antes do restante
    initializeTheme();


    updateAuthUI();


    if (!CONFIGURED) {

        console.warn(
            'HenriNews: configure as credenciais públicas do Supabase.'
        );


        const articlesContainer =
            document.getElementById(
                'articles-container'
            );


        if (articlesContainer) {

            articlesContainer.innerHTML = `
                <div
                    class="
                        col-span-full
                        bg-amber-50
                        border
                        border-amber-200
                        text-amber-900
                        p-5
                        rounded-xl
                    "
                >
                    <b>
                        Configuração pendente:
                    </b>

                    configure o Supabase.
                </div>
            `;

        }


        return;

    }


    const urlParams =
        new URLSearchParams(
            window.location.search
        );


    const isRecovery =
        urlParams.get(
            'recovery'
        ) === '1';


    // Listener antes de getSession
    db
        .auth
        .onAuthStateChange(
            (
                event,
                sessionState
            ) => {

                setTimeout(
                    async () => {

                        if (
                            event ===
                            'PASSWORD_RECOVERY'
                        ) {

                            currentUser =
                                sessionState?.user ||
                                null;


                            currentProfile =
                                currentUser
                                    ? await loadProfile(
                                        currentUser.id
                                    )
                                    : null;


                            updateAuthUI();


                            switchTab(
                                'nova-senha'
                            );


                            return;

                        }


                        if (
                            [
                                'SIGNED_IN',
                                'SIGNED_OUT',
                                'USER_UPDATED'
                            ]
                                .includes(
                                    event
                                )
                        ) {

                            await syncCurrentUser(
                                sessionState?.user ||
                                null
                            );

                        }

                    },
                    0
                );

            }
        );


    const {
        data: {
            session
        }
    } =
        await db
            .auth
            .getSession();


    await syncCurrentUser(
        session?.user ||
        null
    );


    await Promise.all([
        loadArticles(),
        loadGenres(),
        loadSubgenres(),
        loadBooks(),
        loadPolls()
    ]);


    if (currentUser) {

        await Promise.all([
            loadSavedArticles(),
            loadMyLoans(),
            loadUserVotes(),
            loadMyHelpQuestions()
        ]);

    }


    renderArticles();

    renderLibrary();

    renderMyLoans();

    renderPolls();

    renderMyHelpQuestions();

    renderAdminGenreSelect();

    updateAuthUI();

    updateThemeButton();

    renderIcons();


    if (
        isRecovery &&
        session
    ) {

        switchTab(
            'nova-senha'
        );

    }

}


// ============================================================
// 55. INICIAR O HENRINEWS
// ============================================================

document.addEventListener(
    'DOMContentLoaded',
    initializeApp
);



// Cole no script.js antes de initializeApp()
let henriNewsAiBusy = false;

function addHenriNewsAIMessage(type, text) {
    const container = document.getElementById('ai-chat-messages');
    if (!container) return;

    const message = document.createElement('div');
    message.className = type === 'user' ? 'ai-message ai-message-user' : 'ai-message ai-message-assistant';

    const strong = document.createElement('strong');
    strong.textContent = type === 'user' ? 'Você: ' : 'Assistente HenriNews: ';

    const content = document.createElement('span');
    content.textContent = text;

    message.appendChild(strong);
    message.appendChild(content);
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
}

function setHenriNewsAILoading(loading) {
    henriNewsAiBusy = loading;
    const button = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-chat-input');

    if (button) {
        button.disabled = loading;
        button.innerHTML = loading
            ? '<span class="ai-loading-dot"></span> Pensando...'
            : '<i data-lucide="sparkles" class="w-4 h-4"></i> Perguntar à IA';
    }

    if (input) input.disabled = loading;
    renderIcons();
}

async function handleHenriNewsAI(e) {
    e.preventDefault();
    if (henriNewsAiBusy) return;

    if (!currentUser) {
        alert('Faça login para utilizar o Assistente HenriNews IA.');
        switchTab('login');
        return;
    }

    if (!db) {
        alert('Não foi possível conectar ao sistema.');
        return;
    }

    const input = document.getElementById('ai-chat-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return alert('Digite uma pergunta para a IA.');
    if (message.length > 700) return alert('A pergunta deve ter no máximo 700 caracteres.');

    addHenriNewsAIMessage('user', message);
    input.value = '';
    setHenriNewsAILoading(true);

    try {
        const { data, error } = await db.functions.invoke('henrinews-ai', {
            body: { message }
        });

        if (error) {
            console.error('Erro ao chamar a IA:', error);
            addHenriNewsAIMessage('assistant', 'Não consegui responder agora. Tente novamente ou envie sua dúvida para a equipe de suporte.');
            return;
        }

        if (!data?.answer) {
            addHenriNewsAIMessage('assistant', 'Não consegui gerar uma resposta. Você pode enviar a dúvida para a equipe de suporte.');
            return;
        }

        addHenriNewsAIMessage('assistant', data.answer);
    } catch (error) {
        console.error('Erro no Assistente HenriNews:', error);
        addHenriNewsAIMessage('assistant', 'O Assistente HenriNews está indisponível no momento. Tente novamente mais tarde.');
    } finally {
        setHenriNewsAILoading(false);
        input.focus();
    }
}
