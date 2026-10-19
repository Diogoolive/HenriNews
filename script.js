// ============================================================
// HENRINEWS - JORNAL & BIBLIOTECA ESCOLAR
// Versão Supabase: Auth + Postgres + RLS
// ============================================================

// 1) COLE AQUI OS DADOS DO SEU PROJETO SUPABASE
// Supabase Dashboard > Project Settings > API
const SUPABASE_URL = 'https://ffggwhdtefummpzfspvb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3UVcflML5_szZeiW0DvCzw_vOzTOC_W';

const CONFIGURED =
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');

const db = CONFIGURED
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    })
    : null;

let currentUser = null;
let currentProfile = null;
let articles = [];
let books = [];
let polls = [];
let myLoans = [];
let savedArticleIds = new Set();
let userVotes = new Map();
let adminArticles = [];
let currentFilter = 'all';

// ============================================================
// UTILITÁRIOS
// ============================================================
function ensureConfigured() {
    if (CONFIGURED) return true;
    alert('Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no início do arquivo script.js.');
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
    const fallback = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80';
    if (!url) return fallback;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : fallback;
    } catch {
        return fallback;
    }
}

function formatDate(value) {
    if (!value) return '—';
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        const [year, month, day] = String(value).split('-').map(Number);
        date = new Date(year, month - 1, day);
    } else {
        date = new Date(value);
    }
    if (Number.isNaN(date.getTime())) return escapeHtml(value);
    return date.toLocaleDateString('pt-BR');
}

function renderIcons() {
    if (window.lucide?.createIcons) window.lucide.createIcons();
}

function redirectUrl() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
        return `${location.origin}${location.pathname}`;
    }
    return undefined;
}

function showError(context, error) {
    console.error(context, error);
    alert(`${context}: ${error?.message || 'erro inesperado.'}`);
}

// ============================================================
// 2) NAVEGAÇÃO E AUTENTICAÇÃO
// ============================================================
function updateAuthUI() {
    const badge = document.getElementById('user-status-badge');
    const actionBtn = document.getElementById('auth-action-btn');
    const adminBtn = document.getElementById('nav-admin-btn');
    const registerBtn = document.getElementById('auth-register-btn');

    if (!badge || !actionBtn || !adminBtn) return;

    if (currentUser) {
        badge.innerText = isAdmin() ? 'Gestor' : 'Aluno/Responsável';
        badge.className = isAdmin()
            ? 'text-xs bg-amber-500 text-slate-900 px-2 py-1 rounded font-bold'
            : 'text-xs bg-indigo-800 px-2 py-1 rounded text-indigo-200 font-medium';

        actionBtn.innerText = 'Sair';
        actionBtn.onclick = handleLogout;
        registerBtn?.classList.add('hidden');
        adminBtn.classList.toggle('hidden', !isAdmin());
    } else {
        badge.innerText = 'Visitante';
        badge.className = 'text-xs bg-indigo-800 px-2 py-1 rounded text-indigo-200 font-medium';
        actionBtn.innerText = 'Entrar';
        actionBtn.onclick = () => switchTab('login');
        registerBtn?.classList.remove('hidden');
        adminBtn.classList.add('hidden');
    }
    renderIcons();
}


function switchTab(tabId) {

    // ========================================================
    // PROTEÇÃO DO PAINEL GESTOR
    // ========================================================

    if (tabId === 'admin' && !isAdmin()) {

        alert(
            'Área exclusiva para gestores autorizados.'
        );

        tabId = 'feed';
    }



    // ========================================================
    // ESCONDER TODAS AS TELAS
    // ========================================================

    document
        .querySelectorAll('.tab-content')
        .forEach(el => {

            el.classList.remove('active');

        });


    // ========================================================
    // MOSTRAR A TELA ESCOLHIDA
    // ========================================================

    const target =
        document.getElementById(
            `tab-${tabId}`
        );


    if (target) {

        target.classList.add('active');

    }


    // ========================================================
    // FEED
    // ========================================================

    if (tabId === 'feed') {

        renderArticles();

    }


    // ========================================================
    // BIBLIOTECA
    // ========================================================

    if (tabId === 'biblioteca') {

        // Volta a biblioteca para a tela inicial
        // sempre que clicar no menu Biblioteca

        const searchInput =
            document.getElementById(
                'lib-search-input'
            );


        if (searchInput) {

            searchInput.value = '';

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


        currentLibraryGenreId = null;
        currentLibrarySubgenreId = null;


        // Atualiza livros e empréstimos

        renderLibrary();

        renderMyLoans();

    }



    // ========================================================
    // ENQUETES
    // ========================================================

    if (tabId === 'enquetes') {

        renderPolls();

    }


    // ========================================================
    // PAINEL GESTOR
    // ========================================================

    if (tabId === 'admin') {

        renderAdminDashboard();

        renderAdminGenreSelect();

    }


    // ========================================================
    // AJUDA
    // ========================================================

    if (tabId === 'ajuda') {

        setupHelpForm();

    }


    // ========================================================
    // VOLTAR AO TOPO
    // ========================================================

    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });


    // ========================================================
    // ATUALIZAR ÍCONES
    // ========================================================

    renderIcons();

}

async function loadProfile(userId) {
    if (!db || !userId) return null;
    const { data, error } = await db
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', userId)
        .single();

    if (error) {
        console.warn('Não foi possível carregar o perfil:', error.message);
        return null;
    }
    return data;
}

async function syncCurrentUser(user) {
    currentUser = user || null;
    currentProfile = currentUser ? await loadProfile(currentUser.id) : null;

    if (currentUser && !currentProfile) {
        currentProfile = {
            id: currentUser.id,
            full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Aluno',
            email: currentUser.email,
            role: 'student'
        };
    }

    updateAuthUI();
    await Promise.all([loadSavedArticles(), loadMyLoans(), loadUserVotes()]);
    renderArticles();
    renderMyLoans();
    renderPolls();
}

async function handleRegister(e) {
    e.preventDefault();
    if (!ensureConfigured()) return;

    const name = document.getElementById('register-nome').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const password = document.getElementById('register-senha').value;

    if (password.length < 8) {
        alert('A senha precisa ter pelo menos 8 caracteres.');
        return;
    }

    const options = { data: { full_name: name } };
    const callback = redirectUrl();
    if (callback) options.emailRedirectTo = callback;

    const { data, error } = await db.auth.signUp({ email, password, options });
    if (error) return showError('Não foi possível criar a conta', error);

    e.target.reset();

    if (data.session) {
        await syncCurrentUser(data.user);
        alert('Cadastro realizado com sucesso!');
        switchTab('feed');
    } else {
        alert('Cadastro realizado. Confirme o e-mail recebido antes de entrar.');
        switchTab('login');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    if (!ensureConfigured()) return;

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-senha').value;

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) return showError('Não foi possível entrar', error);

    await syncCurrentUser(data.user);
    e.target.reset();
    switchTab('feed');
}

async function handleLogout() {
    if (!ensureConfigured()) return;
    const { error } = await db.auth.signOut();
    if (error) return showError('Não foi possível sair', error);

    currentUser = null;
    currentProfile = null;
    savedArticleIds.clear();
    userVotes.clear();
    myLoans = [];
    updateAuthUI();
    renderArticles();
    renderMyLoans();
    switchTab('feed');
}

async function handleRecoverPassword(e) {
    e.preventDefault();

    if (!ensureConfigured()) return;

    const email = document
        .getElementById('recover-email')
        .value
        .trim()
        .toLowerCase();

    if (!email) {
        alert('Digite seu e-mail.');
        return;
    }

    // Quando clicar no link do e-mail, o usuário volta
    // para o HenriNews com ?recovery=1 na URL
    const recoveryUrl =
        `${window.location.origin}${window.location.pathname}?recovery=1`;

    const { error } =
        await db.auth.resetPasswordForEmail(
            email,
            {
                redirectTo: recoveryUrl
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


    switchTab('login');
}

async function handleUpdatePassword(e) {

    e.preventDefault();

    if (!ensureConfigured()) return;
 

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


    if (password.length < 8) {

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


    const { error } =
        await db.auth.updateUser({
            password:
                password
        });


    if (error) {

        return showError(
            'Não foi possível atualizar a senha',
            error
        );

    }


    e.target.reset();


    // Remove ?recovery=1 da URL
    window.history.replaceState(
        {},
        document.title,
        window.location.pathname
    );


    // Encerra a sessão criada pelo link de recuperação
    await db.auth.signOut();


    currentUser = null;
    currentProfile = null;


    updateAuthUI();


    alert(
        'Senha alterada com sucesso! Agora entre com sua nova senha.'
    );


    switchTab(
        'login'
    );

}

// ============================================================
// 3) ARTIGOS / NOTÍCIAS
// ============================================================
async function loadArticles() {
    if (!db) return;
    const { data, error } = await db
        .from('articles')
        .select('id, title, content, image_url, created_at')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

    if (error) return console.error('Erro ao carregar artigos:', error);
    articles = data || [];
}

async function loadSavedArticles() {
    savedArticleIds = new Set();
    if (!db || !currentUser) return;

    const { data, error } = await db
        .from('article_saves')
        .select('article_id')
        .eq('user_id', currentUser.id);

    if (!error) (data || []).forEach(item => savedArticleIds.add(item.article_id));
}

function renderArticles() {
    const container = document.getElementById('articles-container');
    if (!container) return;
    container.innerHTML = '';

    let filtered = articles;
    if (currentFilter === 'saved') {
        if (!currentUser) {
            container.innerHTML = '<div class="col-span-full bg-amber-50 text-amber-800 p-4 rounded-xl text-sm font-medium">Faça login para visualizar seus artigos salvos.</div>';
            return;
        }
        filtered = articles.filter(a => savedArticleIds.has(a.id));
    }

    if (!filtered.length) {
        container.innerHTML = '<div class="col-span-full text-slate-400 py-12 text-center text-sm">Nenhuma notícia encontrada.</div>';
        return;
    }

    filtered.forEach(art => {
        const desc = art.content.length > 115 ? `${art.content.substring(0, 115)}...` : art.content;
        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition';
        card.innerHTML = `
            <img src="${safeImage(art.image_url)}" class="h-48 w-full object-cover" alt="Capa da notícia">
            <div class="p-5 flex-grow flex flex-col justify-between space-y-4">
                <div class="space-y-2">
                    <h3 class="font-bold text-lg text-slate-900 leading-tight">${escapeHtml(art.title)}</h3>
                    <p class="text-xs text-slate-500 leading-relaxed">${escapeHtml(desc)}</p>
                </div>
                <div class="flex items-center justify-between pt-2 border-t text-sm">
                    <button onclick="viewArticleDetail(${art.id})" class="text-indigo-600 font-semibold hover:text-indigo-700 transition flex items-center gap-1">
                        Ler notícia completa <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </button>
                    <button onclick="toggleSaveArticle(${art.id})" class="${savedArticleIds.has(art.id) ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'} transition" title="Salvar para ler depois">
                        <i data-lucide="bookmark" class="w-5 h-5 ${savedArticleIds.has(art.id) ? 'fill-current' : ''}"></i>
                    </button>
                </div>
            </div>`;
        container.appendChild(card);
    });
    renderIcons();
}

function filterArticles(type) {
    currentFilter = type;
    renderArticles();
}

function viewArticleDetail(id) {
    const art = articles.find(a => a.id === id);
    if (!art) return;

    const container = document.getElementById('article-detail-content');
    container.innerHTML = `
        <div class="space-y-6">
            <h1 class="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">${escapeHtml(art.title)}</h1>
            <img src="${safeImage(art.image_url)}" class="w-full h-96 object-cover rounded-2xl shadow-sm" alt="Capa da notícia">
            <div class="text-slate-700 leading-relaxed text-base whitespace-pre-line">${escapeHtml(art.content)}</div>
        </div>`;
    switchTab('artigo-detalhe');
}

async function toggleSaveArticle(id) {
    if (!currentUser) {
        alert('Faça login para salvar artigos.');
        return switchTab('login');
    }
    if (!ensureConfigured()) return;

    if (savedArticleIds.has(id)) {
        const { error } = await db.from('article_saves').delete().eq('user_id', currentUser.id).eq('article_id', id);
        if (error) return showError('Não foi possível remover o artigo dos salvos', error);
        savedArticleIds.delete(id);
    } else {
        const { error } = await db.from('article_saves').insert({ user_id: currentUser.id, article_id: id });
        if (error) return showError('Não foi possível salvar o artigo', error);
        savedArticleIds.add(id);
    }
    renderArticles();
}

// ============================================================
// 4) BIBLIOTECA - GÊNEROS, SUBGÊNEROS E LIVROS
// ============================================================

let genres = [];
let subgenres = [];

let currentLibraryGenreId = null;
let currentLibrarySubgenreId = null;


// ============================================================
// CARREGAR GÊNEROS
// ============================================================

async function loadGenres() {

    if (!db) return;

    const { data, error } = await db
        .from('genres')
        .select('id, name')
        .order('name', {
            ascending: true
        });


    if (error) {

        console.error(
            'Erro ao carregar gêneros:',
            error
        );

        return;

    }


    genres = data || [];
}


// ============================================================
// CARREGAR SUBGÊNEROS
// ============================================================

async function loadSubgenres() {

    if (!db) return;

    const { data, error } = await db
        .from('subgenres')
        .select(
            'id, genre_id, name'
        )
        .order(
            'name',
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            'Erro ao carregar subgêneros:',
            error
        );

        return;

    }


    subgenres = data || [];
}


// ============================================================
// CARREGAR LIVROS
// ============================================================

async function loadBooks() {

    if (!db) return;


    const { data, error } = await db
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
                ascending: false
            }
        );


    if (error) {

        console.error(
            'Erro ao carregar livros:',
            error
        );

        return;

    }


    books = data || [];

}


// ============================================================
// CRIAR CARD DO LIVRO
// ============================================================

function createBookCard(book, extraClasses = '') {

    const available =
        Number(book.available_copies) > 0;


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
                hover:shadow-md
                transition
                ${extraClasses}
            "
        >

            <div class="space-y-2">

                <div
                    class="
                        flex
                        flex-wrap
                        items-center
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
                            tracking-wider

                            ${
                                available
                                ? 'text-emerald-700 bg-emerald-50'
                                : 'text-rose-700 bg-rose-50'
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
                                    font-semibold
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
                        text-base
                        text-slate-900
                        leading-snug
                    "
                >

                    ${escapeHtml(book.title)}

                </h3>


                <p
                    class="
                        text-xs
                        text-slate-500
                        font-medium
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
                                font-medium
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
                                leading-relaxed
                                pt-1
                            "
                        >

                            ${escapeHtml(book.description)}

                        </p>

                    `
                    : ''
                }

            </div>


            <button

                onclick="requestLoan(${book.id})"

                ${available ? '' : 'disabled'}

                class="
                    w-full
                    bg-slate-900
                    hover:bg-slate-800
                    text-white
                    font-medium
                    py-2
                    rounded-lg
                    text-xs
                    transition
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
// TELA PRINCIPAL
// ============================================================

function renderLibrary() {

    renderNewBooks();
    renderGenres();

}


// ============================================================
// NOVOS LIVROS
// ============================================================

function renderNewBooks() {

    const container =
        document.getElementById(
            'new-books-container'
        );


    if (!container) return;


    const recentBooks =
        [...books]
            .sort(
                (a, b) =>
                    new Date(b.created_at) -
                    new Date(a.created_at)
            )
            .slice(
                0,
                8
            );


    if (!recentBooks.length) {

        container.innerHTML = `

            <div
                class="
                    text-sm
                    text-slate-400
                    py-8
                "
            >

                Nenhum livro cadastrado ainda.

            </div>

        `;

        return;

    }


    container.innerHTML =
        recentBooks
            .map(
                book =>
                    createBookCard(
                        book,
                        'min-w-[260px] max-w-[260px] snap-start'
                    )
            )
            .join('');

}


// ============================================================
// GÊNEROS
// ============================================================

function renderGenres() {

    const container =
        document.getElementById(
            'genres-container'
        );


    if (!container) return;


    if (!genres.length) {

        container.innerHTML = `

            <div
                class="
                    col-span-full
                    text-center
                    text-slate-400
                    py-8
                "
            >

                Nenhum gênero cadastrado.

            </div>

        `;

        return;

    }


    container.innerHTML =
        genres
            .map(
                genre => {

                    const numberOfBooks =
                        books.filter(
                            book =>
                                Number(book.genre_id) ===
                                Number(genre.id)
                        ).length;


                    const numberOfSubgenres =
                        subgenres.filter(
                            sub =>
                                Number(sub.genre_id) ===
                                Number(genre.id)
                        ).length;


                    return `

                        <button
                            type="button"

                            onclick="
                                openGenre(
                                    ${genre.id}
                                )
                            "

                            class="
                                bg-white
                                border
                                border-slate-200
                                rounded-xl
                                p-5
                                text-left
                                shadow-sm
                                hover:shadow-md
                                hover:border-indigo-300
                                transition
                                group
                            "
                        >

                            <div
                                class="
                                    flex
                                    justify-between
                                    items-start
                                    gap-3
                                "
                            >

                                <div>

                                    <div
                                        class="
                                            w-10
                                            h-10
                                            rounded-lg
                                            bg-indigo-100
                                            text-indigo-600
                                            flex
                                            items-center
                                            justify-center
                                            mb-3
                                        "
                                    >

                                        <i
                                            data-lucide="book-open"
                                            class="w-5 h-5"
                                        ></i>

                                    </div>


                                    <h3
                                        class="
                                            font-bold
                                            text-slate-900
                                            group-hover:text-indigo-600
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

                                        ${numberOfBooks}
                                        livro(s)

                                    </p>


                                    <p
                                        class="
                                            text-xs
                                            text-slate-400
                                        "
                                    >

                                        ${numberOfSubgenres}
                                        subgênero(s)

                                    </p>

                                </div>


                                <i
                                    data-lucide="chevron-right"
                                    class="
                                        w-5
                                        h-5
                                        text-slate-300
                                        group-hover:text-indigo-600
                                    "
                                ></i>

                            </div>

                        </button>

                    `;

                }
            )
            .join('');


    renderIcons();

}


// ============================================================
// ABRIR UM GÊNERO
// ============================================================

function openGenre(genreId) {

    const genre =
        genres.find(
            item =>
                Number(item.id) ===
                Number(genreId)
        );


    if (!genre) return;


    currentLibraryGenreId =
        Number(genreId);

    currentLibrarySubgenreId =
        null;


    document
        .getElementById('library-home')
        ?.classList
        .add('hidden');


    document
        .getElementById('library-subgenre-view')
        ?.classList
        .add('hidden');


    document
        .getElementById('library-genre-view')
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
        genre.id
    );


    renderBooksForGenre(
        genre.id
    );


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });


    renderIcons();

}


// ============================================================
// SUBGÊNEROS DO GÊNERO
// ============================================================

function renderSubgenresForGenre(genreId) {

    const container =
        document.getElementById(
            'subgenres-container'
        );


    if (!container) return;


    const filtered =
        subgenres.filter(
            sub =>
                Number(sub.genre_id) ===
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
                subgenre => {

                    const count =
                        books.filter(
                            book =>
                                Number(book.subgenre_id) ===
                                Number(subgenre.id)
                        ).length;


                    return `

                        <button
                            type="button"

                            onclick="
                                openSubgenre(
                                    ${subgenre.id}
                                )
                            "

                            class="
                                bg-white
                                border
                                border-slate-200
                                rounded-xl
                                p-4
                                flex
                                items-center
                                justify-between
                                gap-3
                                text-left
                                hover:border-indigo-300
                                hover:shadow-sm
                                transition
                            "
                        >

                            <div>

                                <h4
                                    class="
                                        font-semibold
                                        text-slate-800
                                    "
                                >

                                    ${escapeHtml(subgenre.name)}

                                </h4>


                                <p
                                    class="
                                        text-xs
                                        text-slate-500
                                    "
                                >

                                    ${count}
                                    livro(s)

                                </p>

                            </div>


                            <i
                                data-lucide="chevron-right"
                                class="
                                    w-5
                                    h-5
                                    text-slate-400
                                "
                            ></i>

                        </button>

                    `;

                }
            )
            .join('');


    renderIcons();

}


// ============================================================
// LIVROS DE UM GÊNERO
// ============================================================

function renderBooksForGenre(genreId) {

    const container =
        document.getElementById(
            'genre-books-container'
        );


    if (!container) return;


    const genreBooks =
        books.filter(
            book =>
                Number(book.genre_id) ===
                Number(genreId)
        );


    if (!genreBooks.length) {

        container.innerHTML = `

            <div
                class="
                    col-span-full
                    text-center
                    text-slate-400
                    py-10
                "
            >

                Nenhum livro cadastrado neste gênero.

            </div>

        `;

        return;

    }


    container.innerHTML =
        genreBooks
            .map(
                book =>
                    createBookCard(book)
            )
            .join('');

}


// ============================================================
// ABRIR SUBGÊNERO
// ============================================================

function openSubgenre(subgenreId) {

    const subgenre =
        subgenres.find(
            item =>
                Number(item.id) ===
                Number(subgenreId)
        );


    if (!subgenre) return;


    const genre =
        genres.find(
            item =>
                Number(item.id) ===
                Number(subgenre.genre_id)
        );


    currentLibraryGenreId =
        Number(subgenre.genre_id);

    currentLibrarySubgenreId =
        Number(subgenre.id);


    document
        .getElementById('library-home')
        ?.classList
        .add('hidden');


    document
        .getElementById('library-genre-view')
        ?.classList
        .add('hidden');


    document
        .getElementById('library-subgenre-view')
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
            subgenre.name;

    }


    if (parent) {

        parent.textContent =
            genre?.name || '';

    }


    renderBooksForSubgenre(
        subgenre.id
    );


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });


    renderIcons();

}


// ============================================================
// LIVROS DO SUBGÊNERO
// ============================================================

function renderBooksForSubgenre(subgenreId) {

    const container =
        document.getElementById(
            'subgenre-books-container'
        );


    if (!container) return;


    const filtered =
        books.filter(
            book =>
                Number(book.subgenre_id) ===
                Number(subgenreId)
        );


    if (!filtered.length) {

        container.innerHTML = `

            <div
                class="
                    col-span-full
                    text-center
                    text-slate-400
                    py-10
                "
            >

                Nenhum livro cadastrado neste subgênero.

            </div>

        `;

        return;

    }


    container.innerHTML =
        filtered
            .map(
                book =>
                    createBookCard(book)
            )
            .join('');

}


// ============================================================
// VOLTAR PARA BIBLIOTECA
// ============================================================

function backToLibraryHome() {

    currentLibraryGenreId =
        null;

    currentLibrarySubgenreId =
        null;


    document
        .getElementById('library-genre-view')
        ?.classList
        .add('hidden');


    document
        .getElementById('library-subgenre-view')
        ?.classList
        .add('hidden');


    document
        .getElementById('library-home')
        ?.classList
        .remove('hidden');


    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });


    renderIcons();

}


// ============================================================
// VOLTAR PARA O GÊNERO ATUAL
// ============================================================

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
// PESQUISA
// ============================================================

function handleLibrarySearch() {

    const input =
        document.getElementById(
            'lib-search-input'
        );


    const section =
        document.getElementById(
            'library-search-section'
        );


    const home =
        document.getElementById(
            'library-home'
        );


    const genreView =
        document.getElementById(
            'library-genre-view'
        );


    const subgenreView =
        document.getElementById(
            'library-subgenre-view'
        );


    const search =
        (input?.value || '')
            .trim()
            .toLowerCase();


    if (!search) {

        section?.classList.add(
            'hidden'
        );


        genreView?.classList.add(
            'hidden'
        );


        subgenreView?.classList.add(
            'hidden'
        );


        home?.classList.remove(
            'hidden'
        );


        return;

    }


    home?.classList.add(
        'hidden'
    );


    genreView?.classList.add(
        'hidden'
    );


    subgenreView?.classList.add(
        'hidden'
    );


    section?.classList.remove(
        'hidden'
    );


    renderLibrarySearchResults();

}


// ============================================================
// RESULTADO DA BUSCA
// ============================================================

function renderLibrarySearchResults() {

    const container =
        document.getElementById(
            'library-search-results'
        );


    const counter =
        document.getElementById(
            'library-search-count'
        );


    if (!container) return;


    const search =
        (
            document
                .getElementById(
                    'lib-search-input'
                )
                ?.value || ''
        )
            .trim()
            .toLowerCase();


    const filterType =
        document
            .getElementById(
                'lib-filter-select'
            )
            ?.value || 'all';


    const filtered =
        books.filter(
            book => {

                const title =
                    (
                        book.title || ''
                    )
                        .toLowerCase()
                        .includes(search);


                const author =
                    (
                        book.author || ''
                    )
                        .toLowerCase()
                        .includes(search);


                const description =
                    (
                        book.description || ''
                    )
                        .toLowerCase()
                        .includes(search);


                if (
                    filterType ===
                    'titulo'
                ) {

                    return title;

                }


                if (
                    filterType ===
                    'autor'
                ) {

                    return author;

                }


                if (
                    filterType ===
                    'descricao'
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


    if (!filtered.length) {

        container.innerHTML = `

            <div
                class="
                    col-span-full
                    text-center
                    text-slate-400
                    py-12
                "
            >

                Nenhum livro corresponde à pesquisa.

            </div>

        `;

        return;

    }


    container.innerHTML =
        filtered
            .map(
                book =>
                    createBookCard(book)
            )
            .join('');

}


// ============================================================
// LIMPAR PESQUISA
// ============================================================

function clearLibrarySearch() {

    const input =
        document.getElementById(
            'lib-search-input'
        );


    if (input) {

        input.value = '';

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
// PAINEL GESTOR - CARREGAR GÊNEROS NO SELECT
// ============================================================

function renderAdminGenreSelect() {

    const genreSelect =
        document.getElementById(
            'admin-book-genre'
        );


    if (!genreSelect) return;


    genreSelect.innerHTML = `

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


    updateAdminSubgenres();

}


// ============================================================
// PAINEL GESTOR - ALTERAR SUBGÊNEROS
// ============================================================

function updateAdminSubgenres() {

    const genreSelect =
        document.getElementById(
            'admin-book-genre'
        );


    const subgenreSelect =
        document.getElementById(
            'admin-book-subgenre'
        );


    if (
        !genreSelect ||
        !subgenreSelect
    ) {

        return;

    }


    const genreId =
        Number(
            genreSelect.value
        );


    subgenreSelect.innerHTML = `

        <option value="">
            Nenhum subgênero
        </option>

    `;


    if (!genreId) {

        subgenreSelect.disabled =
            true;

        return;

    }


    const filtered =
        subgenres.filter(
            sub =>
                Number(sub.genre_id) ===
                genreId
        );


    filtered.forEach(
        subgenre => {

            const option =
                document.createElement(
                    'option'
                );


            option.value =
                subgenre.id;


            option.textContent =
                subgenre.name;


            subgenreSelect.appendChild(
                option
            );

        }
    );


    subgenreSelect.disabled =
        false;

}








async function loadMyLoans() {
    myLoans = [];
    if (!db || !currentUser) return;

    const { data, error } = await db
        .from('loans')
        .select('id, code, status, requested_at, due_date, returned_at, books(title, author)')
        .eq('user_id', currentUser.id)
        .order('requested_at', { ascending: false });

    if (error) return console.error('Erro ao carregar empréstimos:', error);
    myLoans = data || [];
}

function loanStatusLabel(status) {
    return ({
        requested: 'Solicitado',
        borrowed: 'Retirado',
        returned: 'Devolvido',
        cancelled: 'Cancelado'
    })[status] || status;
}

function renderMyLoans() {
    const container = document.getElementById('my-loans-container');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = '<div class="bg-slate-100 text-slate-600 p-4 rounded-xl text-sm">Faça login para acompanhar seus empréstimos.</div>';
        return;
    }

    if (!myLoans.length) {
        container.innerHTML = '<div class="bg-slate-100 text-slate-500 p-4 rounded-xl text-sm">Você ainda não possui empréstimos registrados.</div>';
        return;
    }

    container.innerHTML = myLoans.map(loan => `
        <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
                <p class="font-bold text-slate-900">${escapeHtml(loan.books?.title || 'Livro')}</p>
                <p class="text-xs text-slate-500">Código: <b>${escapeHtml(loan.code)}</b> • Pedido: ${formatDate(loan.requested_at)} • Prazo: ${formatDate(loan.due_date)}</p>
            </div>
            <span class="status-pill ${loan.status === 'returned' ? 'bg-emerald-100 text-emerald-700' : loan.status === 'cancelled' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}">${loanStatusLabel(loan.status)}</span>
        </div>`).join('');
}

async function requestLoan(bookId) {
    if (!currentUser) {
        alert('Faça login para solicitar um livro.');
        return switchTab('login');
    }
    if (!ensureConfigured()) return;

    const { data, error } = await db.rpc('request_book_loan', { p_book_id: bookId });
    if (error) return showError('Não foi possível solicitar o empréstimo', error);

    const loan = Array.isArray(data) ? data[0] : data;
    const book = books.find(b => b.id === bookId);

    document.getElementById('loan-details-box').innerHTML = `
        <p><b>Voucher de Retirada:</b> <span class="text-emerald-600 font-mono font-bold">${escapeHtml(loan?.code || '')}</span></p>
        <p><b>Livro Solicitado:</b> ${escapeHtml(book?.title || '')}</p>
        <p><b>Autor:</b> ${escapeHtml(book?.author || '')}</p>
        <p><b>Solicitante:</b> ${escapeHtml(currentProfile?.full_name || currentUser.email)}</p>
        <p><b>Data do Pedido:</b> ${formatDate(loan?.requested_at)}</p>
        <p><b>Prazo de Devolução:</b> ${formatDate(loan?.due_date)}</p>
        <p class="text-xs text-slate-400 mt-2 border-t pt-2">Apresente o código para o responsável da biblioteca no momento da retirada.</p>`;

    await Promise.all([loadBooks(), loadMyLoans()]);
    renderLibrary();
    renderMyLoans();
    switchTab('emprestimo-confirmacao');
}

// ============================================================
// 5) ENQUETES
// ============================================================
async function loadUserVotes() {
    userVotes = new Map();
    if (!db || !currentUser) return;

    const { data, error } = await db
        .from('poll_votes')
        .select('poll_id, option_id')
        .eq('user_id', currentUser.id);

    if (!error) (data || []).forEach(v => userVotes.set(v.poll_id, v.option_id));
}

async function loadPolls() {
    if (!db) return;

    const { data: pollRows, error } = await db
        .from('polls')
        .select('id, question, active, created_at, poll_options(id, label, option_text)')
        .eq('active', true)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar enquetes:', error);
        return;
    }

    const { data: results, error: resultError } = await db.rpc('get_poll_results');
    if (resultError) console.error('Erro ao carregar resultados:', resultError);

    const counts = new Map();
    (results || []).forEach(row => counts.set(`${row.poll_id}:${row.option_id}`, Number(row.votes)));

    polls = (pollRows || []).map(poll => ({
        ...poll,
        poll_options: (poll.poll_options || [])
            .sort((a, b) => a.label.localeCompare(b.label))
            .map(opt => ({ ...opt, votes: counts.get(`${poll.id}:${opt.id}`) || 0 }))
    }));
}

function renderPolls() {
    const container = document.getElementById('polls-container');
    if (!container) return;
    container.innerHTML = '';

    if (!polls.length) {
        container.innerHTML = '<div class="bg-slate-100 text-slate-600 p-6 rounded-xl text-center font-medium">Nenhuma enquete ativa no momento.</div>';
        return;
    }

    polls.forEach(poll => {
        const totalVotes = poll.poll_options.reduce((sum, option) => sum + option.votes, 0);
        const alreadyVoted = userVotes.has(poll.id);

        const optionsHTML = poll.poll_options.map(option => {
            const percentage = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0;
            const selected = userVotes.get(poll.id) === option.id;
            return `
                <div class="space-y-1">
                    <button onclick="handleVote(${poll.id}, ${option.id})" ${alreadyVoted ? 'disabled' : ''} class="w-full text-left ${selected ? 'bg-indigo-100 border-indigo-300' : 'bg-slate-50 border-slate-200'} hover:bg-indigo-50 border p-3 rounded-xl transition flex justify-between items-center group">
                        <span class="font-medium text-slate-700"><b>${escapeHtml(option.label)}:</b> ${escapeHtml(option.option_text)}</span>
                        <span class="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-bold">${option.votes} voto(s)</span>
                    </button>
                    <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden"><div class="bg-indigo-600 h-full rounded-full" style="width:${percentage}%"></div></div>
                    <p class="text-right text-[10px] font-semibold text-slate-400">${percentage}%</p>
                </div>`;
        }).join('');

        const card = document.createElement('div');
        card.className = 'bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative space-y-4';
        card.innerHTML = `
            <div class="flex justify-between items-start gap-4">
                <div>
                    <h3 class="text-lg font-bold text-slate-900">${escapeHtml(poll.question)}</h3>
                    ${alreadyVoted ? '<p class="text-xs text-emerald-600 mt-1">Seu voto já foi registrado nesta enquete.</p>' : ''}
                </div>
                ${isAdmin() ? `<button onclick="deletePoll(${poll.id})" class="text-red-500 hover:text-red-700 p-2 rounded-xl hover:bg-red-50" title="Excluir enquete"><i data-lucide="trash-2" class="w-5 h-5"></i></button>` : ''}
            </div>
            <div class="space-y-3">${optionsHTML}</div>`;
        container.appendChild(card);
    });
    renderIcons();
}

async function handleVote(pollId, optionId) {
    if (!currentUser) {
        alert('Faça login para votar.');
        return switchTab('login');
    }
    if (!ensureConfigured()) return;

    const { error } = await db.rpc('vote_poll', { p_poll_id: pollId, p_option_id: optionId });
    if (error) return showError('Não foi possível registrar o voto', error);

    await Promise.all([loadPolls(), loadUserVotes()]);
    renderPolls();
}

async function deletePoll(pollId) {
    if (!isAdmin()) return alert('Ação não autorizada.');
    if (!confirm('Excluir esta enquete permanentemente?')) return;

    const { error } = await db.from('polls').delete().eq('id', pollId);
    if (error) return showError('Não foi possível excluir a enquete', error);

    await loadPolls();
    renderPolls();
}

// ============================================================
// 6) PAINEL ADMINISTRATIVO
// ============================================================
async function renderAdminDashboard() {
    if (!isAdmin() || !db) return;

    const [articleResult, loanResult, helpResult] = await Promise.all([
        db.from('articles').select('id, title, content, image_url, status, created_at').order('created_at', { ascending: false }),
        db.from('loans').select('id, code, status, requested_at, due_date, profiles(full_name, email), books(title)').order('requested_at', { ascending: false }),
        db.from('help_questions').select('id, name, email, message, status, created_at').order('created_at', { ascending: false })
    ]);

    if (articleResult.error) return showError('Erro ao carregar o painel', articleResult.error);
    adminArticles = articleResult.data || [];

    const artList = document.getElementById('admin-articles-list');
    if (artList) {
        artList.innerHTML = adminArticles.length ? adminArticles.map(art => `
            <div class="flex justify-between items-center py-2 gap-2">
                <span class="truncate font-medium text-slate-700">${escapeHtml(art.title)} <small class="${art.status === 'published' ? 'text-emerald-600' : 'text-amber-600'}">(${art.status === 'published' ? 'publicado' : 'rascunho'})</small></span>
                <div class="flex gap-2 shrink-0">
                    <button onclick="loadArticleToEdit(${art.id})" class="text-indigo-600 font-medium hover:underline text-xs">Editar</button>
                    <button onclick="deleteArticle(${art.id})" class="text-rose-600 font-medium hover:underline text-xs">Excluir</button>
                </div>
            </div>`).join('') : '<p class="text-slate-400 py-3 text-center">Nenhum artigo cadastrado.</p>';
    }

    const loanList = document.getElementById('admin-loans-list');
    if (loanList) {
        if (loanResult.error) {
            loanList.innerHTML = '<p class="text-rose-500 py-3">Erro ao carregar empréstimos.</p>';
        } else {
            const rows = loanResult.data || [];
            loanList.innerHTML = rows.length ? rows.map(loan => `
                <div class="py-3 flex justify-between gap-3 items-start">
                    <div><b>${escapeHtml(loan.profiles?.full_name || loan.profiles?.email || 'Aluno')}</b> — ${escapeHtml(loan.books?.title || 'Livro')}<br><span class="text-slate-400">${escapeHtml(loan.code)} • ${loanStatusLabel(loan.status)} • prazo ${formatDate(loan.due_date)}</span></div>
                    ${['requested','borrowed'].includes(loan.status) ? `<button onclick="markLoanReturned(${loan.id})" class="text-emerald-700 font-bold hover:underline">Devolvido</button>` : ''}
                </div>`).join('') : '<p class="text-slate-400 py-3 text-center">Nenhum empréstimo registrado.</p>';
        }
    }

    const helpList = document.getElementById('admin-help-list');
    if (helpList) {
        if (helpResult.error) {
            helpList.innerHTML = '<p class="text-rose-500 py-3">Erro ao carregar perguntas.</p>';
        } else {
            const rows = helpResult.data || [];
            helpList.innerHTML = rows.length ? rows.map(item => `
                <div class="py-4 flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div>
                        <p class="font-bold text-slate-800">${escapeHtml(item.name)} <span class="text-xs font-normal text-slate-400">${escapeHtml(item.email)}</span></p>
                        <p class="text-slate-600 mt-1">${escapeHtml(item.message)}</p>
                        <p class="text-xs text-slate-400 mt-1">${formatDate(item.created_at)} • ${item.status === 'resolved' ? 'Resolvido' : 'Aberto'}</p>
                    </div>
                    ${item.status !== 'resolved' ? `<button onclick="markHelpResolved(${item.id})" class="text-violet-700 font-bold hover:underline shrink-0">Marcar resolvido</button>` : ''}
                </div>`).join('') : '<p class="text-slate-400 py-3 text-center">Nenhuma pergunta de suporte.</p>';
        }
    }

    renderIcons();
}

async function saveArticle(status) {
    if (!isAdmin()) return alert('Ação não autorizada.');

    const idInput = document.getElementById('admin-article-id').value;
    const title = document.getElementById('admin-art-title').value.trim();
    const imageUrl = document.getElementById('admin-art-image').value.trim() || null;
    const content = document.getElementById('admin-art-content').value.trim();

    if (!title || !content) return alert('Informe título e conteúdo.');

    const payload = { title, content, image_url: imageUrl, status };
    let result;

    if (idInput) {
        result = await db.from('articles').update(payload).eq('id', Number(idInput));
    } else {
        result = await db.from('articles').insert({ ...payload, author_id: currentUser.id });
    }

    if (result.error) return showError('Não foi possível salvar o artigo', result.error);

    clearArticleForm();
    await loadArticles();
    await renderAdminDashboard();
    renderArticles();
    alert(status === 'published' ? 'Artigo publicado com sucesso!' : 'Rascunho salvo no banco de dados!');
}

async function handleCreateArticle(e) {
    e.preventDefault();
    await saveArticle('published');
}

async function handleSaveDraft() {
    await saveArticle('draft');
}

function loadArticleToEdit(id) {
    if (!isAdmin()) return;
    const art = adminArticles.find(a => a.id === id);
    if (!art) return;

    document.getElementById('admin-article-id').value = art.id;
    document.getElementById('admin-art-title').value = art.title;
    document.getElementById('admin-art-image').value = art.image_url || '';
    document.getElementById('admin-art-content').value = art.content;
    document.getElementById('admin-art-title').focus();
}

async function deleteArticle(id) {
    if (!isAdmin()) return alert('Ação não autorizada.');
    if (!confirm('Excluir esta notícia permanentemente?')) return;

    const { error } = await db.from('articles').delete().eq('id', id);
    if (error) return showError('Não foi possível excluir o artigo', error);

    await Promise.all([loadArticles(), renderAdminDashboard()]);
    renderArticles();
}

function clearArticleForm() {
    document.getElementById('admin-article-id').value = '';
    document.getElementById('admin-art-title').value = '';
    document.getElementById('admin-art-image').value = '';
    document.getElementById('admin-art-content').value = '';
}

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


    // -----------------------------------------
    // VALIDAÇÕES
    // -----------------------------------------

    if (!title) {

        alert(
            'Informe o título do livro.'
        );

        return;

    }


    if (!author) {

        alert(
            'Informe o autor do livro.'
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
            'Informe uma quantidade válida de exemplares.'
        );

        return;

    }


    const genreId =
        Number(genreValue);


    const subgenreId =
        subgenreValue
            ? Number(subgenreValue)
            : null;


    // -----------------------------------------
    // CADASTRAR NO SUPABASE
    // -----------------------------------------

    const {
        error
    } =
        await db
            .from('books')
            .insert({

                title:
                    title,

                author:
                    author,

                description:
                    description || null,

                genre_id:
                    genreId,

                subgenre_id:
                    subgenreId,

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


    // -----------------------------------------
    // LIMPAR FORMULÁRIO
    // -----------------------------------------

    e.target.reset();


    updateAdminSubgenres();


    // -----------------------------------------
    // ATUALIZAR BIBLIOTECA
    // -----------------------------------------

    await loadBooks();


    renderLibrary();


    alert(
        'Livro cadastrado com sucesso!'
    );

}

async function markLoanReturned(loanId) {
    if (!isAdmin()) return alert('Ação não autorizada.');
    const { error } = await db.rpc('return_book_loan', { p_loan_id: loanId });
    if (error) return showError('Não foi possível registrar a devolução', error);

    await Promise.all([loadBooks(), loadMyLoans(), renderAdminDashboard()]);
    renderLibrary();
    renderMyLoans();
}

async function handleCreatePoll(e) {
    e.preventDefault();
    if (!isAdmin()) return alert('Ação não autorizada.');

    const question = document.getElementById('admin-poll-question').value.trim();
    const values = ['A', 'B', 'C', 'D', 'E']
        .map(label => ({ label, option_text: document.getElementById(`admin-poll-op${label}`).value.trim() }))
        .filter(item => item.option_text);

    if (values.length < 2) return alert('A enquete precisa ter pelo menos duas opções.');

    const { data: poll, error } = await db
        .from('polls')
        .insert({ question, active: true, created_by: currentUser.id })
        .select('id')
        .single();

    if (error) return showError('Não foi possível criar a enquete', error);

    const { error: optionsError } = await db
        .from('poll_options')
        .insert(values.map(item => ({ ...item, poll_id: poll.id })));

    if (optionsError) {
        await db.from('polls').delete().eq('id', poll.id);
        return showError('Não foi possível salvar as opções da enquete', optionsError);
    }

    e.target.reset();
    await loadPolls();
    renderPolls();
    switchTab('enquetes');
}

// ============================================================
// 7) SUPORTE
// ============================================================
function setupHelpForm() {
    const name = document.getElementById('help-nome');
    const email = document.getElementById('help-email');
    if (!name || !email) return;

    if (currentUser) {
        name.value = currentProfile?.full_name || '';
        email.value = currentUser.email || '';
    }
}

async function handleSendHelpQuestion(e) {
    e.preventDefault();
    if (!ensureConfigured()) return;

    const name = document.getElementById('help-nome').value.trim();
    const email = document.getElementById('help-email').value.trim().toLowerCase();
    const message = document.getElementById('help-mensagem').value.trim();

    const { error } = await db.from('help_questions').insert({
        user_id: currentUser?.id || null,
        name,
        email,
        message
    });

    if (error) return showError('Não foi possível enviar sua pergunta', error);

    document.getElementById('help-mensagem').value = '';
    alert('Pergunta enviada com sucesso!');
}

async function markHelpResolved(id) {
    if (!isAdmin()) return alert('Ação não autorizada.');
    const { error } = await db.from('help_questions').update({ status: 'resolved' }).eq('id', id);
    if (error) return showError('Não foi possível atualizar a pergunta', error);
    await renderAdminDashboard();
}

// ============================================================
// 8) INICIALIZAÇÃO
// ============================================================
async function initializeApp() {

    updateAuthUI();

    if (!CONFIGURED) {

        console.warn(
            'HenriNews: configure as credenciais públicas do Supabase.'
        );

        const articlesContainer =
            document.getElementById('articles-container');

        if (articlesContainer) {

            articlesContainer.innerHTML = `
                <div class="
                    col-span-full
                    bg-amber-50
                    border
                    border-amber-200
                    text-amber-900
                    p-5
                    rounded-xl
                ">
                    <b>Configuração pendente:</b>
                    configure o Supabase no script.js.
                </div>
            `;

        }

        return;
    }


    // ========================================================
    // VERIFICAR SE VEIO DO LINK DE RECUPERAÇÃO
    // ========================================================

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const isRecovery =
        urlParams.get('recovery') === '1';


    // ========================================================
    // OUVIR EVENTOS DO SUPABASE
    // IMPORTANTE: fica antes do getSession()
    // ========================================================

    db.auth.onAuthStateChange(
        (event, sessionState) => {

            setTimeout(
                async () => {

                    console.log(
                        'Evento de autenticação:',
                        event
                    );


                    // ----------------------------------------
                    // RECUPERAÇÃO DE SENHA
                    // ----------------------------------------

                    if (
                        event ===
                        'PASSWORD_RECOVERY'
                    ) {

                        currentUser =
                            sessionState?.user || null;


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


                    // ----------------------------------------
                    // OUTROS EVENTOS
                    // ----------------------------------------

                    if (
                        [
                            'SIGNED_IN',
                            'SIGNED_OUT',
                            'USER_UPDATED'
                        ].includes(event)
                    ) {

                        await syncCurrentUser(
                            sessionState?.user || null
                        );

                    }

                },
                0
            );

        }
    );


    // ========================================================
    // CARREGAR SESSÃO
    // ========================================================

    const {
        data: {
            session
        }
    } =
        await db.auth.getSession();


    await syncCurrentUser(
        session?.user || null
    );


    // ========================================================
    // CARREGAR DADOS
    // ========================================================

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
            loadUserVotes()
        ]);

    }


    // ========================================================
    // RENDERIZAR SITE
    // ========================================================

    renderArticles();

    renderLibrary();

    renderMyLoans();

    renderPolls();

    renderAdminGenreSelect();

    updateAuthUI();

    renderIcons();


    // ========================================================
    // GARANTIA EXTRA PARA RECUPERAÇÃO
    // ========================================================

    if (
        isRecovery &&
        session
    ) {

        switchTab(
            'nova-senha'
        );

    }


}

document.addEventListener('DOMContentLoaded', initializeApp);
