document.addEventListener('alpine:init', () => {
    Alpine.data('dashboardApp', () => ({
        sidebarHtml: '', headerHtml: '',
        isPinned: true, isHovered: false,
        currentTheme: 'datacense',
        userData: { username: '', role: '', permissions: [] },

        modais: { themeOpen: false, notifOpen: false, patchNotes: false, avatar: false, calendar: false, lightbox: false, cropper: false },
        salvandoAvatar: false,

        lightboxUrl: '',

        // --- FUNÇÕES DE NOTIFICAÇÃO ---
        notificacoes: [],
        notificacoesCache: { unread: [], all: [] },
        isCarregandoAba: false,
        notificacoesNaoLidas: 0,
        notificacoesTotal: 0,
        mostrarNotificacoes: false,
        notifTab: 'unread',
        notifModoVerTodas: false,
        notifPaginaAtual: 1,
        toastsAtivos: [],

        // --- FUNÇÕES DE UPDATES (PATCH NOTES) ---
        updates: [],
        updatesAgrupados: [],
        updateSelecionado: null,

        // --- FUNÇÕES DE AVATAR (OTIMIZADAS) ---
        avatarTabs: [],
        avatarAbaAtiva: '',
        avatarCarregando: false,
        avatarCacheBuster: Date.now(),
        customAvatarPath: null,

        // --- FEED DE NOTÍCIAS & API ---
        posts: [],
        carregandoPosts: false,
        paginaAtual: 1,
        limitePorPagina: 3,
        temMaisPosts: false,

        async init() {
            const token = localStorage.getItem('wiki_token');
            if (!token) { window.location.href = '/'; return; }

            try {
                // Decodifica os dados do usuário
                this.userData = JSON.parse(atob(token.split('.')[1]));
                this.userData.formattedName = this.formatName(this.userData.username);

                // Aplica o Tema e o Pino do banco de dados
                this.currentTheme = this.userData.theme || 'datacense';
                this.isPinned = this.userData.sideFixed === undefined ? true : this.userData.sideFixed;
                if (!this.isPinned) this.isHovered = false;

                // Injeta a Sidebar e o Header HTML
                const [sidebarRes, headerRes] = await Promise.all([
                    fetch('/pages/sidebar.html'),
                    fetch('/pages/header.html')
                ]);
                this.sidebarHtml = await sidebarRes.text();
                this.headerHtml = await headerRes.text();

                this.carregarNotificacoes();
                this.carregarUpdates();

                // Busca os posts SOMENTE se estiver no menu
                if (window.location.pathname.includes('menu.html')) {
                    this.fetchPosts(false);
                }
            } catch (e) {
                console.error("Erro fatal no Init. Expulsando usuário por segurança:", e);
                this.fazerLogoff();
            }
        },

        // --- FUNÇÕES DE NOTIFICAÇÃO ---
        // Retorna apenas as notificações da aba selecionada
        get notificacoesFiltradas() {
            if (this.notifTab === 'unread') {
                return this.notificacoes.filter(n => !n.visualizado);
            }
            return this.notificacoes;
        },

        async carregarNotificacoes(isPolling = false) {
            if (isPolling && (this.notifPaginaAtual > 1 || this.notifModoVerTodas)) return;

            try {
                const token = localStorage.getItem('wiki_token');
                const limit = this.notifModoVerTodas ? 25 : 5;

                if (!isPolling && this.notificacoes.length === 0) {
                    this.isCarregandoAba = true;
                }

                const response = await fetch(`/api/notifications?page=${this.notifPaginaAtual}&limit=${limit}&filter=${this.notifTab}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) return;

                const data = await response.json();
                if (data.success) {
                    if (isPolling && this.notificacoes.length > 0) {
                        const idsAntigos = new Set(this.notificacoes.map(n => n.id));
                        const chegaramAgora = (data.notifications || []).filter(n => !idsAntigos.has(n.id) && !n.visualizado);
                        chegaramAgora.forEach(n => this.mostrarToast(n));
                    }

                    this.notificacoes = data.notifications || [];
                    this.notificacoesNaoLidas = data.totalUnread;
                    this.notificacoesTotal = data.totalAll;

                    if (this.notifPaginaAtual === 1 && !this.notifModoVerTodas) {
                        this.notificacoesCache[this.notifTab] = [...this.notificacoes];
                    }
                }
            } catch (e) {
                console.error("Erro ao carregar notificações", e);
            } finally {
                this.isCarregandoAba = false;
            }
        },

        mudarAbaNotificacao(aba) {
            if (this.notifTab === aba && !this.notifModoVerTodas) return;

            this.notifTab = aba;
            this.notifPaginaAtual = 1;
            this.notifModoVerTodas = false;

            if (this.notificacoesCache[aba] && this.notificacoesCache[aba].length > 0) {
                this.notificacoes = [...this.notificacoesCache[aba]];
                this.carregarNotificacoes(true);
            } else {
                this.notificacoes = [];
                this.carregarNotificacoes(false);
            }
        },

        ativarVerTodas() {
            this.notifModoVerTodas = true;
            this.notifPaginaAtual = 1;
            this.carregarNotificacoes();
        },

        mudarPaginaNotificacao(direcao) {
            if (direcao === 'prox') this.notifPaginaAtual++;
            if (direcao === 'ant' && this.notifPaginaAtual > 1) this.notifPaginaAtual--;
            this.carregarNotificacoes();
        },

        mostrarToast(notificacao) {
            // Cria um ID único pro Toast e coloca na fila
            const toastId = Date.now() + Math.random();
            this.toastsAtivos.push({ ...notificacao, toastId });

            // Remove sozinho depois de 8 segundos
            setTimeout(() => {
                this.toastsAtivos = this.toastsAtivos.filter(t => t.toastId !== toastId);
            }, 8000);
        },

        removerToast(toastId) {
            this.toastsAtivos = this.toastsAtivos.filter(t => t.toastId !== toastId);
        },

        iniciarMonitoramentoNotificacoes() {
            // Busca novas notificações a cada 60 segundos
            setInterval(() => this.carregarNotificacoes(true), 60000);
        },

        async marcarNotificacaoLida(notificacao) {
            if (notificacao.visualizado) return;
            notificacao.visualizado = true;
            this.notificacoesNaoLidas = Math.max(0, this.notificacoesNaoLidas - 1);

            try {
                const token = localStorage.getItem('wiki_token');
                await fetch('/api/notifications/read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id: notificacao.id })
                });
            } catch (e) { }
        },

        async marcarTodasComoLidas() {
            this.notificacoes.forEach(n => n.visualizado = true);
            this.notificacoesNaoLidas = 0;

            try {
                const token = localStorage.getItem('wiki_token');
                await fetch('/api/notifications/read-all', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
                });
            } catch (e) { }
        },

        async deletarNotificacao(id, event) {
            if (event) event.stopPropagation();
            this.notificacoes = this.notificacoes.filter(n => n.id !== id);
            this.notificacoesNaoLidas = this.notificacoes.filter(n => !n.visualizado).length;

            try {
                const token = localStorage.getItem('wiki_token');
                await fetch('/api/notifications/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id: id })
                });
            } catch (e) { }
        },

        async limparHistoricoNotificacoes() {
            const diasStr = prompt("Apagar notificações com mais de quantos dias? (Digite 0 para apagar TODAS)");
            if (diasStr === null) return;

            const dias = parseInt(diasStr);
            if (isNaN(dias)) return alert("Por favor, insira um número válido.");

            try {
                const token = localStorage.getItem('wiki_token');
                const response = await fetch('/api/notifications/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id: 'all', dias: dias })
                });
                const data = await response.json();
                if (data.success) {
                    alert(data.message);
                    this.carregarNotificacoes();
                }
            } catch (e) { }
        },

        // --- FUNÇÕES DE UPDATES (PATCH NOTES) ---
        async carregarUpdates() {
            try {
                const token = localStorage.getItem('wiki_token');
                const response = await fetch('/api/updates', { headers: { 'Authorization': `Bearer ${token}` } });
                if (!response.ok) return;

                const data = await response.json();
                if (data.success) {
                    this.updates = data.updates || [];

                    const groups = {};
                    this.updates.forEach(u => {
                        const major = 'V' + u.version.split('.')[0];
                        if (!groups[major]) groups[major] = [];
                        groups[major].push(u);
                    });

                    // AGRUPAMENTO E SANFONA: A primeira versão já nasce aberta (isOpen: index === 0)
                    this.updatesAgrupados = Object.keys(groups)
                        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
                        .map((key, index) => ({
                            major: key,
                            isOpen: index === 0, // A mágica da sanfona começa aqui
                            items: groups[key].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))
                        }));

                    if (this.updates.length > 0) {
                        this.updateSelecionado = this.updatesAgrupados[0].items[0];
                    }
                }
            } catch (e) { console.error("Erro ao carregar updates", e); }
        },

        selecionarUpdate(update) {
            this.updateSelecionado = update;
        },

        // --- FUNÇÕES DE AVATAR (OTIMIZADAS) ---
        getAvatarUrl() {
            if (this.customAvatarPath) return `${this.customAvatarPath}?t=${this.avatarCacheBuster}`;
            return `/assets/img/avatar/${this.userData.username}.png?t=${this.avatarCacheBuster}`;
        },

        async abrirModalAvatar() {
            this.modais.avatar = true;
            // Só busca no banco de dados se o Cache estiver vazio (Performance Extrema)
            if (this.avatarTabs.length === 0) {
                this.avatarCarregando = true;
                try {
                    const token = localStorage.getItem('wiki_token');
                    const res = await fetch('/api/avatar/tabs', { headers: { 'Authorization': `Bearer ${token}` } });
                    const data = await res.json();

                    if (data.success && data.tabs) {
                        this.avatarTabs = data.tabs;
                        if (this.avatarTabs.length > 0) {
                            // Assume que a API devolve { categoria: 'Nome', avatares: [...] }
                            this.avatarAbaAtiva = this.avatarTabs[0].categoria || this.avatarTabs[0].category;
                        }
                    }
                } catch (e) { console.error(e); }
                this.avatarCarregando = false;
            }
        },

        async selecionarAvatar(avatar) {
            // 1. OTIMIZAÇÃO: Altera a foto na tela IMEDIATAMENTE (Zero Delay)
            this.customAvatarPath = avatar.arquivo || avatar.avatar_file;
            this.avatarCacheBuster = Date.now();
            this.modais.avatar = false; // Fecha o modal instantaneamente

            // 2. Avisa o banco de dados em segundo plano
            try {
                const token = localStorage.getItem('wiki_token');
                const res = await fetch('/api/avatar/select', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id_avatar: avatar.id, avatar: avatar.title })
                });
                const data = await res.json();

                // Se o servidor devolver o caminho final correto, a gente atualiza
                if (data.success && data.avatarPath) {
                    this.customAvatarPath = data.avatarPath;
                    this.avatarCacheBuster = Date.now();
                }
            } catch (e) { console.error("Erro ao salvar avatar no banco", e); }
        },

        // =====================================
        // FUNÇÕES DO CROPPER (RECORTAR AVATAR)
        // =====================================
        iniciarCropper(event) {
            const file = event.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                alert('Apenas arquivos de imagem são permitidos!');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                // Esconde a galeria temporariamente e mostra o Cropper
                this.modais.avatar = false;
                this.modais.cropper = true;

                // Aguarda o HTML renderizar o modal
                setTimeout(() => {
                    const image = document.getElementById('cropper-image');
                    image.src = e.target.result;

                    if (window.cropperInstance) {
                        window.cropperInstance.destroy();
                    }

                    // Inicia a ferramenta em modo Quadrado (1:1) para Avatar
                    window.cropperInstance = new Cropper(image, {
                        aspectRatio: 1,
                        viewMode: 1,
                        background: false,
                        autoCropArea: 0.9,
                        responsive: true
                    });
                }, 100);
            };
            reader.readAsDataURL(file);
            event.target.value = ''; // Limpa o input
        },

        fecharCropper() {
            this.modais.cropper = false;
            if (window.cropperInstance) {
                window.cropperInstance.destroy();
                window.cropperInstance = null;
            }
            this.modais.avatar = true; // Retorna para a galeria
        },

        salvarAvatarCropped() {
            if (!window.cropperInstance) return;
            this.salvandoAvatar = true;

            // Recorta a imagem processando para 256x256 pixels
            window.cropperInstance.getCroppedCanvas({
                width: 256,
                height: 256
            }).toBlob((blob) => {
                const formData = new FormData();
                formData.append('avatar', blob, 'avatar.png');

                fetch('/api/avatar/upload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('wiki_token')}` },
                    body: formData
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            this.fecharCropper();
                            this.modais.avatar = false;

                            // Atualiza a foto do perfil na hora com um Math.random para evitar cache!
                            const imgs = document.querySelectorAll('.AVTP-avatar');
                            imgs.forEach(img => img.src = data.avatarPath.split('?')[0] + '?t=' + Date.now());

                            alert(data.message);
                        } else {
                            alert(data.message);
                        }
                    })
                    .catch(err => {
                        console.error('Erro:', err);
                        alert('Erro ao enviar a imagem.');
                    })
                    .finally(() => {
                        this.salvandoAvatar = false;
                    });
            }, 'image/png');
        },

        // --- FEED DE NOTÍCIAS & API ---
        async fetchPosts(isAppend = false) {
            this.carregandoPosts = true;
            try {
                const token = localStorage.getItem('wiki_token');
                const response = await fetch(`/api/posts?page=${this.paginaAtual}&limit=${this.limitePorPagina}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const data = await response.json();
                if (data.success) {
                    const novosPosts = data.posts.map(p => ({
                        ...p,
                        lidoDefinitivo: p.isRead === 1 || p.isRead === true
                    }));

                    if (isAppend) {
                        this.posts = [...this.posts, ...novosPosts];
                    } else {
                        this.posts = novosPosts;
                    }

                    this.temMaisPosts = data.posts.length === this.limitePorPagina;
                }
            } catch (e) {
                console.error("Falha ao puxar posts:", e);
            } finally {
                this.carregandoPosts = false;
            }
        },

        loadMorePosts() {
            this.paginaAtual++;
            this.fetchPosts(true);
        },

        async marcarComoLido(postId) {
            const post = this.posts.find(p => p.id === postId);
            if (!post) return;

            post.lidoDefinitivo = true;
            post.PostIsRead++;

            try {
                const token = localStorage.getItem('wiki_token');
                await fetch('/api/posts/mark-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ post_id: Number(postId) })
                });
            } catch (e) { console.error("Erro ao marcar lido:", e); }
        },

        async reagir(postId, emojiNumber) {
            const post = this.posts.find(p => p.id === postId);
            if (!post) return;

            try {
                const token = localStorage.getItem('wiki_token');
                const response = await fetch('/api/posts/add-reaction', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ post_id: Number(postId), emoji_type: Number(emojiNumber) })
                });

                const data = await response.json();
                if (data.success) {
                    post[`Emoji${emojiNumber}`] = data.newCount;
                } else {
                    alert(data.message);
                }
            } catch (e) { console.error("Erro na reação:", e); }
        },

        editarPost(postId) { alert(`Redirecionar para a edição do Post ID: ${postId}`); },

        deletarPost(postId) {
            if (confirm("Excluir definitivamente esta publicação?")) {
                this.posts = this.posts.filter(p => p.id !== postId);
            }
        },

        abrirLightbox(url) {
            this.lightboxUrl = url;
            this.modais.lightbox = true;
        },

        // --- PREFERÊNCIAS E LAYOUT ---
        getInitials(name) {
            if (!name) return 'US';
            const parts = name.split(' ');
            if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        },

        getShortDate() {
            const d = new Date();
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        },

        setTheme(theme) {
            this.currentTheme = theme;
            localStorage.setItem('wiki_theme', theme);
            this.savePreferences();
        },

        togglePin() {
            this.isPinned = !this.isPinned;
            if (!this.isPinned) this.isHovered = true;
            this.savePreferences();
        },

        async savePreferences() {
            try {
                const token = localStorage.getItem('wiki_token');
                const response = await fetch('/api/auth/preferences', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ theme: this.currentTheme, side_fixed: this.isPinned ? 1 : 0 })
                });
                const data = await response.json();

                // Sobrescreve o Token no navegador para aplicar as alterações nos F5
                if (data.success && data.token) {
                    localStorage.setItem('wiki_token', data.token);
                }
            } catch (e) { console.error("Erro ao salvar preferências:", e); }
        },

        // --- UTILITÁRIOS ---
        formatName(username) {
            if (!username) return 'Usuário';
            return username.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
        },

        formatDate(dateString) {
            if (!dateString) return '';
            const cleanDate = typeof dateString === 'string' && dateString.endsWith('Z') ? dateString.slice(0, -1) : dateString;
            const d = new Date(cleanDate);
            return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        },

        formatDateOnly(dateString) {
            if (!dateString) return '';
            const cleanDate = typeof dateString === 'string' && dateString.endsWith('Z') ? dateString.slice(0, -1) : dateString;
            const d = new Date(cleanDate);
            return d.toLocaleDateString('pt-BR');
        },

        getAvatarUrl() { return `/assets/img/avatar/${this.userData.username}.png`; },

        hasPermission(pageId) {
            if (!this.userData.permissions) return false;
            if (this.userData.role === 'Apolo' || this.userData.permissions.includes('*')) return true;
            return this.userData.permissions.includes(pageId);
        },

        hasAnyPermission(pageIds) {
            if (!this.userData.permissions) return false;
            if (this.userData.role === 'Apolo' || this.userData.permissions.includes('*')) return true;
            return pageIds.some(id => this.userData.permissions.includes(id));
        },

        confirmLogoff() {
            if (confirm('Tem certeza que deseja sair da nave WikiTRC?')) { this.fazerLogoff(); }
        },

        fazerLogoff() {
            localStorage.removeItem('wiki_token');
            window.location.href = '/';
        }
    }));
});