const fases = [
  "1. Escopo & Briefing",
  "2. Pesquisa e Análise",
  "3. Concepção e Protótipo",
  "4. Validação de Conceito",
  "5. Viabilidade",
  "6. Implementação"
];

const condicoes = [
  { valor: "Sempre", label: "Crítica" },
  { valor: "A", label: "Alta" },
  { valor: "B", label: "Média" },
  { valor: "C", label: "Baixa" }
];

// === Auth Helper (Etapa 1) ===
const Auth = {
  currentUser: null,
  async ensure() {
    try {
      const r = await fetch('/me', { credentials: 'include' });
      if (!r.ok) throw new Error('unauth');
      const data = await r.json();
      Auth.currentUser = data.user;
      localStorage.setItem('operatorName', data.user.name || data.user.email || '');
      localStorage.setItem('operatorEmail', data.user.email || '');
      window.operatorName = () => localStorage.getItem('operatorName') || (Auth.currentUser?.name || Auth.currentUser?.email || '');
      const userSpot = document.getElementById('auth-user');
      if (userSpot) userSpot.textContent = `Olá, ${Auth.currentUser.name} (${Auth.currentUser.role})`;
      const btnLogout = document.getElementById('btn-logout');
      if (btnLogout) btnLogout.onclick = async () => {
        await fetch('/logout', { method: 'POST', credentials: 'include' });
        location.href = '/login';
      };
    } catch (e) {
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
  }
};

async function authedFetch(url, options = {}) {
  options.credentials = 'include';
  options.headers = Object.assign({}, options.headers, {
    'X-Operator': (Auth.currentUser?.email || localStorage.getItem('operatorEmail') || '')
  });
  return fetch(url, options);
}

// ===== TOASTS v2 (global, bottom-left, visual melhorado) =================
(function initToastsV2(){
  // força substituir versões antigas/simples
  window.__toasts_v2__ = true;

  if (!document.getElementById('toasts-v2-style')) {
    const css = `
      /* Host do toast */
      .ux-toast-host {
        position: fixed;
        left: 16px;
        bottom: 16px;
        right: auto;
        top: auto;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      }

      /* Animações refinadas */
      @keyframes ux-toast-in {
        from {
          opacity: 0;
          transform: translateY(12px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes ux-toast-out {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(8px) scale(0.98);
        }
      }

      /* Design do Toast Moderno */
      .ux-toast {
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 14px;
        width: clamp(300px, 48vw, 440px);
        padding: 18px 20px;
        border-radius: 16px;
        
        /* Fundo branco limpo */
        background: #ffffff;
        
        /* Borda sutil com cor rosa */
        border: 1.5px solid var(--light-gray);
        
        /* Sombra sofisticada */
        box-shadow: 
          0 4px 16px rgba(214, 51, 132, 0.08),
          0 8px 32px rgba(214, 51, 132, 0.04),
          0 0 0 1px rgba(214, 51, 132, 0.04);
        
        /* Animação suave */
        opacity: 0;
        transform: translateY(12px) scale(0.95);
        animation: ux-toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        
        /* Backdrop blur para modernidade */
        backdrop-filter: blur(8px);
      }

      .ux-toast.hide {
        animation: ux-toast-out 0.2s cubic-bezier(0.4, 0, 1, 1) forwards;
      }

      /* Ícone com destaque */
      .ux-toast .icon {
        font-size: 22px;
        line-height: 1;
        margin-top: 1px;
        filter: drop-shadow(0 2px 4px rgba(214, 51, 132, 0.15));
      }

      /* Conteúdo */
      .ux-toast .content {
        flex: 1;
        min-width: 0;
      }

      .ux-toast .title {
        font-weight: 600;
        font-size: 15px;
        margin-bottom: 4px;
        color: var(--dark);
        letter-spacing: -0.01em;
      }

      .ux-toast .msg {
        font-size: 14px;
        line-height: 1.45;
        color: var(--primary);
        opacity: 0.95;
      }

      /* Tipos de Toast com cores vibrantes */
      .ux-toast.success {
        border-left: 4px solid var(--primary-light);
        background: #ffffff;
      }
      .ux-toast.success .icon {
        color: var(--primary-light);
      }

      .ux-toast.error {
        border-left: 4px solid var(--danger);
        background: #ffffff;
      }
      .ux-toast.error .icon {
        color: var(--danger);
      }

      .ux-toast.info {
        border-left: 4px solid var(--primary);
        background: #ffffff;
      }
      .ux-toast.info .icon {
        color: var(--primary);
      }

      .ux-toast.warn {
        border-left: 4px solid var(--secondary);
        background: #ffffff;
      }
      .ux-toast.warn .icon {
        color: var(--secondary);
      }

      /* Hover effect sutil */
      .ux-toast:hover {
        transform: translateY(-2px);
        box-shadow: 
          0 6px 20px rgba(214, 51, 132, 0.12),
          0 12px 40px rgba(214, 51, 132, 0.06),
          0 0 0 1px rgba(214, 51, 132, 0.06);
        transition: all 0.2s ease;
      }

      /* Dark Mode Elegante */
      @media (prefers-color-scheme: dark) {
        .ux-toast {
          background: var(--dark);
          border-color: rgba(214, 51, 132, 0.25);
          box-shadow: 
            0 8px 24px rgba(0, 0, 0, 0.4),
            0 16px 48px rgba(0, 0, 0, 0.2),
            0 0 0 1px rgba(214, 51, 132, 0.15);
          backdrop-filter: blur(12px);
        }

        .ux-toast .title {
          color: var(--light);
        }

        .ux-toast .msg {
          color: var(--primary-light);
        }

        .ux-toast.success {
          background: var(--dark);
        }

        .ux-toast.error {
          background: var(--dark);
        }

        .ux-toast.info {
          background: var(--dark);
        }

        .ux-toast.warn {
          background: var(--dark);
        }

        .ux-toast:hover {
          box-shadow: 
            0 12px 32px rgba(0, 0, 0, 0.5),
            0 20px 60px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(214, 51, 132, 0.3);
        }
      }`;
    const style = document.createElement('style');
    style.id = 'toasts-v2-style'; style.textContent = css;
    document.head.appendChild(style);
  }

  let host = null;
  function ensureHost(){
    if (!host) {
      host = document.createElement('div');
      host.className = 'ux-toast-host';
      (document.body || document.documentElement).appendChild(host);
    }
  }

  function renderToast(type, title, message, ms=3200){
    ensureHost();
    const el = document.createElement('div');
    el.className = `ux-toast ${type||'info'}`;
    const icon = (type==='success'?'✅':type==='error'?'⛔':type==='warn'?'⚠️':'ℹ️');
    el.innerHTML = `
      <div class="icon">${icon}</div>
      <div class="content">
        ${title ? `<div class="title">${title}</div>` : ``}
        <div class="msg">${message||''}</div>
      </div>`;
    host.appendChild(el);
    const kill = ()=>{ el.classList.add('hide'); setTimeout(()=> el.remove(), 180); };
    const t = setTimeout(kill, ms);
    el.addEventListener('mouseenter', ()=> clearTimeout(t));
    el.addEventListener('mouseleave', ()=> setTimeout(kill, 1200));
  }

  // API global
  window.showToast    = (html, ms)=> renderToast('info','',html,ms);
  window.toastInfo    = (msg, ms)=> renderToast('info','',msg,ms);
  window.toastSuccess = (msg, ms)=> renderToast('success','',msg,ms);
  window.toastError   = (msg, ms)=> renderToast('error','',msg,ms);
  window.toastWarn    = (msg, ms)=> renderToast('warn','',msg,ms);
})();

// === FIX visual p/ títulos gigantes no card de tarefas (Gestão) ===
(function ensureTaskHeaderLayoutFix(){
  if (document.getElementById('gestor-layout-fixes')) return;
  const css = `
    /* Cabeçalho em 2 colunas: Título (1fr) + Ações (auto) */
    .task-card .task-header{
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
    }

    /* Título: clamp 2 linhas, quebra inteligente e reticências */
    .task-card .task-title{
      min-width: 0;
      font-weight: 700;
      line-height: 1.25;
      overflow: hidden;
      overflow-wrap: anywhere;    /* quebra palavras muito longas */
      word-break: break-word;
    }
    .task-card .task-title.clamp-2{
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    /* Botões: podem quebrar linha à vontade */
    .task-card .task-actions{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-start;
      align-items: center;
      min-width: max-content; /* evita encolher demais e amassar ícones */
    }

    /* Badge já vinha com nowrap inline; reforço global opcional */
    .task-card .badge-em-curso{ white-space: nowrap; }

    /* Em telas pequenas, ações vão para baixo do título */
    @media (max-width: 720px){
      .task-card .task-header{ grid-template-columns: 1fr; }
      .task-card .task-actions{ margin-top: 6px; }
    }
  `;
  const st = document.createElement('style');
  st.id = 'gestor-layout-fixes';
  st.textContent = css;
  document.head.appendChild(st);
})();


async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Operator': operatorEmail() },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const raw = await res.text();

  let data = null;
  if (ct.includes('application/json')) {
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (e) { data = res.ok ? {} : null; }
  } else {
    data = res.ok ? (raw ? { message: raw } : {}) : { message: raw };
  }

  if (!res.ok || (data && data.success === false)) {
    const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data || {};
}


// Toasts mínimos (só se não existir showToast vindo do supervisor)
(function ensureToasts(){
  if (typeof window.showToast === 'function') return;
  const css = `
    .toast-host{position:fixed;top:14px;right:14px;z-index:99999;display:flex;flex-direction:column;gap:8px}
    .toast{display:flex;align-items:center;gap:8px;min-width:200px;max-width:360px;padding:10px 14px;border-radius:10px;
           background:#fff;color:#222;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.12);border:1px solid #f3f3f3;opacity:0;transform:translateY(-6px);
           animation:toast-in .18s ease-out forwards}
    @keyframes toast-in{to{opacity:1;transform:translateY(0)}}
    .toast.hide{animation:toast-out .15s ease-in forwards}
    @keyframes toast-out{to{opacity:0;transform:translateY(-6px)}}
    .toast-icon{flex:0 0 auto}
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host);
  window.showToast = (html, ms=2500) => {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="toast-icon">✔️</div><div class="toast-msg">${html}</div>`;
    host.appendChild(el);
    setTimeout(()=> el.classList.add('hide'), ms);
    setTimeout(()=> el.remove(), ms+180);
  };
})();


function operatorEmail() {
  // Prioridade 1: objeto Auth.currentUser (mais confiável)
  if (window.Auth && Auth.currentUser && Auth.currentUser.email) {
    return Auth.currentUser.email;
  }
  
  // Prioridade 2: localStorage
  const stored = localStorage.getItem('operatorEmail') || localStorage.getItem('operatorName') || '';
  
  // Valida se não está vazio
  if (!stored || stored.trim() === '' || stored === 'system') {
    console.warn('⚠️ Operador não identificado! localStorage:', stored);
    return '';
  }
  
  return stored;
}

function bindBotaoProgresso(root = document) {
  root.querySelectorAll('.btn-progresso, [data-action="progress"]').forEach(btn => {
    btn.onclick = () => {
      const { numero, sheet, projeto, pct, relato, colaboradores } = btn.dataset;
      window.abrirModalProgresso({
        projeto: projeto || '',
        sheet,
        numero,
        pct: parseInt(String(pct || '0').replace('%', ''), 10) || 0,
        relato: relato || '',
        colaboradores: colaboradores || ''
      });
    };
  });
}


async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Operator': (localStorage.getItem('operatorEmail') || localStorage.getItem('operatorName') || '') },
    credentials: 'include',
    body: JSON.stringify(payload)
  });

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const raw = await res.text();

  let data = null;
  if (ct.includes('application/json')) {
    try { data = raw ? JSON.parse(raw) : {}; }
    catch (e) {
      // Se vier JSON inválido mas HTTP OK, considere sucesso “sem corpo”
      if (res.ok) data = {};
      else throw new Error(`${res.status} ${res.statusText}`);
    }
  } else {
    // Sem JSON: se OK e sem corpo, aceite; se veio texto, devolva em message
    data = res.ok ? (raw ? { message: raw } : {}) : { message: raw };
  }

  if (!res.ok || (data && data.success === false)) {
    const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data || {};
}


function sanitizePct(value) {
  const n = Number(String(value).replace('%','').trim());
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

window.__tarefaAtual__ = null;

function toggleFiltro() {
  const filtroBox = document.getElementById("filtrosAvancados");
  filtroBox.classList.toggle("active");
}

function gerarFiltros() {
  const condDiv = document.getElementById("condicoes");
  condDiv.innerHTML = "";

  fases.forEach(fase => {
    const container = document.createElement("div");
    container.className = "fase-container";

    const faseHeader = document.createElement("div");
    faseHeader.className = "fase-header";
    faseHeader.innerHTML = `<i class="fas fa-folder"></i> <strong>${fase}</strong>`;

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "Selecionar tudo";
    toggleBtn.className = "btn-toggle-fase";
    toggleBtn.onclick = () => {
      const checkboxes = container.querySelectorAll("input[type=checkbox]");
      let todosMarcados = true;
      checkboxes.forEach(cb => {
        if (cb.value !== "Sempre" && !cb.checked) todosMarcados = false;
      });
      checkboxes.forEach(cb => {
        if (cb.value !== "Sempre") cb.checked = !todosMarcados;
      });
      carregarTarefas();
    };

    faseHeader.appendChild(toggleBtn);
    container.appendChild(faseHeader);

    const condicoesContainer = document.createElement("div");
    condicoesContainer.className = "condicoes-options";

    condicoes.forEach(c => {
      const label = document.createElement("label");
      label.className = "condicao-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.fase = fase;
      checkbox.value = c.valor;
      checkbox.id = `cond-${fase.replace(/\s+/g, "-")}-${c.valor}`;
      checkbox.checked = c.valor === "Sempre";

      checkbox.onchange = function () {
        if (checkbox.value === "Sempre" && !checkbox.checked) {
          document.getElementById("modal-alerta").style.display = "flex";

          const confirmarBtn = document.getElementById("modal-confirmar");
          const cancelarBtn = document.getElementById("modal-cancelar");

          confirmarBtn.onclick = () => {
            document.getElementById("modal-alerta").style.display = "none";
            checkbox.checked = false;
            carregarTarefas();
          };

          cancelarBtn.onclick = () => {
            checkbox.checked = true;
            document.getElementById("modal-alerta").style.display = "none";
          };

          return;
        }

        carregarTarefas();
      };

      const span = document.createElement("span");
      span.className = `condicao-marker ${c.valor === "Sempre" ? "s-marker" : "default-marker"}`;
      span.textContent = c.label;

      label.appendChild(checkbox);
      label.appendChild(span);
      condicoesContainer.appendChild(label);
    });

    container.appendChild(condicoesContainer);
    condDiv.appendChild(container);
  });
}

async function carregarTarefas() {
  garantirModalClips();

  const esc = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  const categoria = document.getElementById("categoria").value;
  const checkboxes = document.querySelectorAll("input[type=checkbox]:checked");
  const condicoesPorFase = {};

  checkboxes.forEach(cb => {
    const fase = cb.getAttribute("data-fase");
    if (!condicoesPorFase[fase]) condicoesPorFase[fase] = [];
    condicoesPorFase[fase].push(cb.value);
  });

  const projeto = (document.getElementById("projeto")?.value || '').trim();
  // Filtro: Em Curso (todas, somente em curso, minhas em curso)
  const filtroEmCurso = (document.getElementById('filtro-em-curso')?.value || 'todas');

  try {
    const res = await fetch("/gerar-cronograma", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projeto, categoria, condicoes: condicoesPorFase }),
    });

    const dados = await res.json();

    const upcoming = document.getElementById("tarefas-upcoming");
    upcoming.innerHTML = "";

    const blocos = {
      emCurso:   criarSecao("Em Curso", "play-circle", upcoming),
      concluidas: criarSecao("Concluídas", "check-circle", upcoming),
      atrasadas: criarSecao("Atrasadas", "exclamation-circle", upcoming),
      dias10: criarSecao("Até 10 dias", "clock", upcoming),
      dias15: criarSecao("Até 15 dias", "clock", upcoming),
      mais15: criarSecao("Mais de 15 dias", "clock", upcoming),
    };

    if (dados.cronograma && dados.cronograma.length > 0) {
      dados.cronograma.forEach((tarefa) => {
        let duracaoDias = 0;
        let duracaoTexto = tarefa.duracao;

        if (tarefa.duracao === "Concluído") {
          duracaoDias = 0;
        } else if (typeof tarefa.duracao === "number") {
          duracaoDias = tarefa.duracao;
          duracaoTexto = `${tarefa.duracao} dias`;
        } else if (tarefa.duracao === null || tarefa.duracao === 9999) {
          duracaoTexto = "Prazo não definido";
          duracaoDias = 9999;
        } else {
          duracaoDias = parseInt(tarefa.duracao) || 0;
          duracaoTexto = duracaoDias > 0 ? `${duracaoDias} dias` : "Prazo não definido";
        }

        const pct = parseInt(String(tarefa.porcentagem ?? '0').toString().replace('%','')) || 0;

        const concluida = (
          tarefa.concluida === 1 || tarefa.concluida === "1" ||
          pct >= 100 ||
          String(tarefa.duracao).toLowerCase().includes('conclu')
        );

        const emCurso   = Number(tarefa.em_curso || 0) === 1;
        const emCursoBy = String(tarefa.em_curso_by || '').trim();
        const meuEmail  = (localStorage.getItem('operatorEmail') || '').toLowerCase();
        const souDono   = !!emCursoBy && emCursoBy.toLowerCase() === meuEmail;

        const startDisabledAttr = (emCurso && !souDono)
          ? `disabled title="Em curso por ${esc(emCursoBy)}"`
          : '';

        // --- Filtro de "Em curso" ---
        if (filtroEmCurso === 'em_curso_minha' && !(emCurso && souDono)) return;
        if (filtroEmCurso === 'em_curso_todas' && !emCurso) return;

        const progressoDataAttr =
          `data-pct="${pct}" ` +
          `data-relato="${esc(tarefa.relatorio_progresso || '')}" ` +
          `data-colaboradores="${esc(tarefa.colaboradores || '')}"`;

        const badgeEmCurso = (emCurso && !concluida && emCursoBy)
          ? `
            <span class="badge-em-curso" style="margin-right:8px;padding:4px 8px; border-radius:8px; background:#fff8db; border:1px solid #f2c94c; color:#8a6d1d; white-space:nowrap">
              <i class="fas fa-play-circle"></i> Em curso por ${esc(emCursoBy)}
            </span>`
          : "";


        const prioridades = {
          "Sempre": { label: "Crítica", color: "prioridade-s", icon: "⚠️" },
          "A": { label: "Alta",   color: "prioridade-a", icon: "⬆️" },
          "B": { label: "Média",  color: "prioridade-b", icon: "➡️" },
          "C": { label: "Baixa",  color: "prioridade-c", icon: "⬇️" },
        };
        const prioridadeInfo = prioridades[tarefa.condicao] || {};

        const card = document.createElement("div");
        card.className = "task-card";

        const textoRef = (tarefa.como_fazer ?? "");
        const docRef   = (tarefa.documento_auxiliar ?? tarefa.documento_referencia ?? "");

        card.innerHTML = `
          ${prioridadeInfo.label ? `
            <div class="task-priority-tag ${prioridadeInfo.color}">
              ${prioridadeInfo.icon} PRIORIDADE ${prioridadeInfo.label}
            </div>` : ""}

          <div class="task-header">
            <div class="task-title clamp-2" title="${esc(tarefa.nome)}">${esc(tarefa.nome)}</div>

            <div class="task-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
              ${badgeEmCurso}

              ${
                concluida
                  ? `
                    <span class="task-concluida">
                      <i class="fas fa-check-circle"></i> Concluída
                    </span>
                    <button class="btn-auxilio btn-reabrir"
                            data-action="reopen"
                            data-projeto="${esc(tarefa.Projeto || tarefa.projeto || projeto)}"
                            data-sheet="${esc(tarefa.Sheet || tarefa.sheet || '')}"
                            data-numero="${esc(tarefa.numero)}">
                      <i class="fas fa-undo"></i> Reabrir
                    </button>
                  `
                  : (emCurso
                    ? `
                      <button class="btn-secondary btn-progresso"
                              data-action="progress"
                              data-projeto="${esc(tarefa.Projeto || tarefa.projeto || projeto)}"
                              data-sheet="${esc(tarefa.Sheet || tarefa.sheet || '')}"
                              data-numero="${esc(tarefa.numero)}"
                              ${progressoDataAttr}>
                        <i class="fas fa-pen"></i> Progresso
                      </button>
                    `
                    : `
                      <button class="btn-auxilio"
                              data-action="start"
                              data-projeto="${esc(tarefa.Projeto || tarefa.projeto || projeto)}"
                              data-sheet="${esc(tarefa.Sheet || tarefa.sheet || '')}"
                              data-numero="${esc(tarefa.numero)}">
                        <i class="fas fa-play"></i> Iniciar
                      </button>

                      <button class="btn-secondary btn-progresso"
                              data-action="progress"
                              data-projeto="${esc(tarefa.Projeto || tarefa.projeto || projeto)}"
                              data-sheet="${esc(tarefa.Sheet || tarefa.sheet || '')}"
                              data-numero="${esc(tarefa.numero)}"
                              ${progressoDataAttr}>
                        <i class="fas fa-pen"></i> Progresso
                      </button>
                    `)
              }

              <button class="btn-secondary btn-clips"
                      data-numero="${esc(tarefa.numero)}"
                      data-nome="${esc(tarefa.nome || 'Tarefa')}"
                      data-fase="${esc(tarefa.fase || '')}"
                      data-categoria="${esc(tarefa.categoria || '')}"
                      data-sheet="${esc(tarefa.Sheet || tarefa.sheet || '')}">
                <i class="fas fa-paperclip"></i> Anexos
              </button>
            </div>


          <div class="task-details">
            <div class="task-detail">
              <i class="fas fa-diagram-project"></i>
              <span>${esc(tarefa.Projeto || projeto || 'Projeto')}</span>
            </div>
            <div class="task-detail">
              <i class="fas fa-layer-group"></i>
              <span>${esc(tarefa.fase || '')}</span>
            </div>
            <div class="task-detail">
              <i class="fas fa-clock"></i>
              <span>${esc(duracaoTexto)}</span>
            </div>
            <div class="task-detail">
              <i class="fas fa-percent"></i>
              <span>${pct}%</span>
            </div>
          </div>
        `;

        const btnStart = card.querySelector("[data-action='start']");
        if (btnStart) {
          btnStart.addEventListener("click", async () => {
            await iniciarTarefa(tarefa.numero, tarefa.Sheet || tarefa.sheet || "", tarefa.Projeto || projeto || "");
          });
        }

        const btnReopen = card.querySelector(".btn-reabrir");
        if (btnReopen) {
          btnReopen.addEventListener("click", async () => {
            await reabrirTarefa(tarefa.numero, tarefa.Sheet || tarefa.sheet || "", tarefa.Projeto || projeto || "");
          });
        }

        const btnProg = card.querySelector(".btn-progresso");
        if (btnProg) {
          btnProg.addEventListener("click", () => {
            abrirModalProgresso({
              numero: tarefa.numero,
              projeto: tarefa.Projeto || projeto || "",
              sheet: tarefa.Sheet || tarefa.sheet || "",
              pct: pct,
              colaboradores: tarefa.colaboradores || "",
              relato: tarefa.relatorio_progresso || "",
            });
          });
        }

        const btnClips = card.querySelector(".btn-clips");
        if (btnClips) {
          btnClips.addEventListener("click", () => {
            abrirModalClips({
              numero: tarefa.numero,
              nome: tarefa.nome || "Tarefa",
              fase: tarefa.fase || "",
              categoria: tarefa.categoria || "",
              sheet: tarefa.Sheet || tarefa.sheet || "",
              texto: tarefa.como_fazer ?? "",
              doc:   tarefa.documento_auxiliar ?? tarefa.documento_referencia ?? "",
              projeto: tarefa.Projeto || tarefa.projeto || projeto || ""
            });
          });

        }


        const ehNumero = typeof tarefa.duracao === "number" || !isNaN(parseInt(tarefa.duracao));
        if (concluida) {
          blocos.concluidas.appendChild(card);
          blocos.concluidas._contador.textContent = blocos.concluidas.childElementCount;
         } else if (emCurso) {
          blocos.emCurso.appendChild(card);
          blocos.emCurso._contador.textContent = blocos.emCurso.childElementCount;
        } else if (!ehNumero) {
          blocos.mais15.appendChild(card);
          blocos.mais15._contador.textContent = blocos.mais15.childElementCount;
        } else if (duracaoDias < 7) {
          card.classList.add("atrasada");
          blocos.atrasadas.appendChild(card);
          blocos.atrasadas._contador.textContent = blocos.atrasadas.childElementCount;
        } else if (duracaoDias <= 10) {
          blocos.dias10.appendChild(card);
          blocos.dias10._contador.textContent = blocos.dias10.childElementCount;
        } else if (duracaoDias <= 15) {
          blocos.dias15.appendChild(card);
          blocos.dias15._contador.textContent = blocos.dias15.childElementCount;
        } else {
          blocos.mais15.appendChild(card);
          blocos.mais15._contador.textContent = blocos.mais15.childElementCount;
        }
      });
    }

    try {
      window.__cronogramaGestor = (dados && Array.isArray(dados.cronograma)) ? dados.cronograma : [];
      const model = notif_build(window.__cronogramaGestor);
      notif_render(model);
    } catch(e) {
      console.warn('Notif: falha ao atualizar', e);
    }

  } catch (error) {
    console.error("Erro ao carregar tarefas:", error);
  }
}


// ===== Delegação de cliques para Iniciar / Reabrir / Progresso =====
document.addEventListener('click', async (e) => {
  // Iniciar
  const startBtn = e.target.closest('[data-action="start"], .btn-iniciar');
  if (startBtn) {
    e.preventDefault();
    await iniciarTarefa(
      startBtn.dataset.numero,
      startBtn.dataset.sheet,
      startBtn.dataset.projeto
    );
    return;
  }

  // Reabrir
  const reopenBtn = e.target.closest('[data-action="reopen"], .btn-reabrir');
  if (reopenBtn) {
    e.preventDefault();
    await reabrirTarefa(
      reopenBtn.dataset.numero,
      reopenBtn.dataset.sheet,
      reopenBtn.dataset.projeto
    );
    return;
  }

  // Progresso
  const progBtn = e.target.closest('[data-action="progress"]');
  if (progBtn) {
    e.preventDefault();
    const { projeto, sheet, numero, pct, relato, colaboradores } = progBtn.dataset;
    window.abrirModalProgresso({
      projeto,
      sheet,
      numero,
      pct: parseInt(String(pct || '0').replace('%', ''), 10) || 0,
      relato: relato || '',
      colaboradores: colaboradores || ''   // ← agora vem preenchido
    });
    return;
  }

});

function garantirModalClips() {
  if (document.getElementById("modal-clips")) return;

  const modal = document.createElement("div");
  modal.id = "modal-clips";
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-conteudo" style="max-width:640px;">
      <div class="modal-icon"><i class="fas fa-paperclip"></i></div>
      <h2 id="clips-titulo">Anexos</h2>

      <div id="clips-body" style="padding:0 20px; margin-top:10px; text-align:left;"></div>

      <div class="modal-actions" style="display:flex; justify-content:center; gap:12px; padding:16px; background:var(--surface-2)">
        <a id="clips-link-documentos" class="btn-primary">🔎 Abrir Documentos</a>
        <button id="clips-fechar" class="btn-secondary">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  window.addEventListener("click", e => { if (e.target === modal) fecharModalClips(); });
  modal.querySelector("#clips-fechar").addEventListener("click", fecharModalClips);
  document.addEventListener("keydown", e => { if (e.key === "Escape") fecharModalClips(); });
}

function looksLikeUrl(v){ return /^https?:\/\//i.test(String(v || '')); }
function escHtml(s){ return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function extractFirstUrl(raw) {
  const str = String(raw || '').trim();
  if (!str) return '';
  const m = str.match(/https?:\/\/[^\s)]+/i);
  if (!m) return '';
  // limpa fechamentos/terminadores ocasionais
  return m[0].replace(/[),.;]+$/,'');
}

function abrirModalClips(tarefa){
  garantirModalClips();

  const modal    = document.getElementById('modal-clips');
  const tituloEl = document.getElementById('clips-titulo');
  const bodyEl   = document.getElementById('clips-body');
  const linkDocs = document.getElementById('clips-link-documentos');

  if (!modal) return;

  // Título
  if (tituloEl) tituloEl.textContent = tarefa?.nome || tarefa?.titulo || 'Anexos';

  // Conteúdos
  const textoVal = tarefa?.texto ?? tarefa?.como_fazer ?? '';
  const rawDoc   = tarefa?.documento_auxiliar ?? tarefa?.doc ?? tarefa?.documento_referencia ?? '';
  const faseTxt  = escHtml(tarefa?.fase ?? '');
  const catTxt   = escHtml(tarefa?.categoria ?? '');
  const sheetTxt = escHtml(tarefa?.sheet ?? tarefa?.Sheet ?? '');
  const textoAux = (String(textoVal || '').trim()) ? escHtml(String(textoVal)) : '—';

  if (bodyEl){
    bodyEl.innerHTML = `
      <div style="margin-bottom:12px; opacity:.85">
        <div><b>Fase:</b> ${faseTxt || '-'}</div>
        <div><b>Categoria:</b> ${catTxt || '-'}</div>
        <div><b>Sheet:</b> ${sheetTxt || '-'}</div>
      </div>

      <div style="padding:12px; border:1px solid var(--border, #e9ecef); border-radius:10px; background:var(--surface, #fff);">
        <div style="font-weight:700; margin-bottom:6px;">📄 Texto auxiliar</div>
        <div id="clips-text-content" style="white-space:pre-wrap; line-height:1.5;">${textoAux}</div>
      </div>
    `;
  }

  // Link “Abrir Documentos”
  if (linkDocs){
    const firstUrl   = extractFirstUrl(rawDoc);
    const docResolved = firstUrl || String(rawDoc || '').trim();

    if (!docResolved) {
      linkDocs.style.display = 'none';
      linkDocs.removeAttribute('href');
      linkDocs.removeAttribute('target');
      linkDocs.removeAttribute('rel');
    } else if (looksLikeUrl(docResolved)) {
      linkDocs.href   = docResolved;
      linkDocs.target = '_blank';
      linkDocs.rel    = 'noopener noreferrer';
      linkDocs.textContent = '🔎 Abrir Documentos';
      linkDocs.style.display = '';
    } else {
      const qp = new URLSearchParams({
        projeto: String(tarefa?.projeto || tarefa?.Projeto || ''),
        termo:   String(docResolved || '')
      });
      linkDocs.href = `/documentos?${qp}`;
      linkDocs.removeAttribute('target');
      linkDocs.setAttribute('rel', 'nofollow');
      linkDocs.textContent = '🔎 Abrir Documentos';
      linkDocs.style.display = '';
    }
  }

  modal.style.display = 'flex';
}

function fecharModalClips() {
  const modal = document.getElementById("modal-clips");
  if (modal) modal.style.display = "none";
}

function criarSecao(titulo, icone, container) {
  const secao = document.createElement("div");
  secao.className = "task-section";

  const header = document.createElement("div");
  header.className = "task-section-header";
  header.style.cursor = "pointer";

  const titleContent = document.createElement("div");
  titleContent.className = "section-title";
  titleContent.innerHTML = `
    <div class="section-icon">
      <i class="fas fa-${icone}"></i>
    </div>
    <div>
      <h3>${titulo}</h3>
    </div>
  `;

  const toggleIcon = document.createElement("i");
  toggleIcon.className = "fas fa-chevron-down";
  toggleIcon.style.marginLeft = "auto";
  toggleIcon.style.transition = "transform 0.3s ease";

  const contador = document.createElement("div");
  contador.className = "section-count";
  contador.textContent = "0";

  header.appendChild(titleContent);
  header.appendChild(toggleIcon);
  header.appendChild(contador);

  const lista = document.createElement("div");
  lista.className = "task-list show";

  header.addEventListener("click", () => {
    lista.classList.toggle("show");
    toggleIcon.classList.toggle("fa-chevron-down");
    toggleIcon.classList.toggle("fa-chevron-up");
  });

  secao.appendChild(header);
  secao.appendChild(lista);
  container.appendChild(secao);

  lista._contador = contador;
  return lista;
}

function filtrarTarefas() {
  const termo = document.getElementById("pesquisa").value.toLowerCase();
  const secoes = document.querySelectorAll(".task-section");

  secoes.forEach(secao => {
    const lista = secao.querySelector(".task-list");
    const tarefas = Array.from(lista.children);
    let visiveis = 0;

    tarefas.forEach(card => {
      const titulo = card.querySelector(".task-title")?.textContent.toLowerCase() || "";
      const deveMostrar = titulo.includes(termo);
      card.style.display = deveMostrar ? "" : "none";
      if (deveMostrar) visiveis++;
    });

    if (lista._contador) {
      lista._contador.textContent = visiveis;
    }

    if (visiveis > 0 || secao.querySelector("h3").textContent.includes("Concluídas")) {
      secao.style.display = "";
    } else {
      secao.style.display = "none";
    }
  });
}

async function iniciarTarefa(numero, sheet, projeto){
  // 🔒 VALIDAÇÃO: Garante que o operador está identificado
  const op = operatorEmail();
  
  if (!op || op === 'system') {
    toastError(
      '⚠️ Usuário não identificado. Por favor:<br>' +
      '1. Recarregue a página (F5)<br>' +
      '2. Se persistir, faça login novamente', 
      5000
    );
    console.error('❌ Tentativa de iniciar tarefa sem operador válido');
    return;
  }
  
  console.log('✅ Iniciando tarefa - Operador:', op, '| Tarefa:', numero);
  
  try {
    await postJSON('/iniciar-tarefa', { numero, sheet, projeto });
    
    if (typeof carregarTarefas === 'function') await carregarTarefas();
    if (typeof window.atualizarEmCurso === 'function') await window.atualizarEmCurso();
    
    toastSuccess(`Tarefa <b>${numero}</b> iniciada com sucesso!`);
  } catch (err) {
    toastError(`Falha ao iniciar: ${err.message}`, 4500);
  }
}

async function reabrirTarefa(numero, sheet, projeto){
  try {
    await postJSON('/concluir-tarefa', { numero, sheet, projeto, acao:'reabrir' });
    
    // >>> REFRESH COMPLETO (E) <
    if (typeof carregarTarefas === 'function') await carregarTarefas();
    if (typeof window.atualizarEmCurso === 'function') await window.atualizarEmCurso();
    
    toastInfo(`Tarefa <b>${numero}</b> reaberta.`);
  } catch (err) {
    toastError(`Falha ao reabrir: ${err.message}`, 4500);
  }
}

// Desligado por padrão até o backend expor /events
(function initSSE(){
  if (!window.ENABLE_SSE) return;
  if (!('EventSource' in window)) return;
  try {
    const es = new EventSource('/events');
    es.addEventListener('ping', () => {});
    es.addEventListener('task_added',  (e)=>console.log('SSE add', e.data));
    es.addEventListener('task_changed',(e)=>console.log('SSE changed', e.data));
    es.addEventListener('task_batch',  (e)=>console.log('SSE batch', e.data));
  } catch(e){ console.warn('SSE indisponível', e); }
})();

function operatorName() {
  return localStorage.getItem('operatorName') || 'usuario';
}

window.onclick = function (event) {
  const modals = document.querySelectorAll(".modal");
  modals.forEach(modal => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
};

async function carregarProjetos() {
  try {
    const r = await fetch('/listar-projetos');
    const lista = await r.json();
    const sel = document.getElementById('projeto');
    if (!sel) return;

    sel.innerHTML = `<option value="">Todos</option>` +
      (lista||[]).map(p=>`<option value="${p}">${p}</option>`).join('');

    sel.addEventListener('change', carregarTarefas);
  } catch(e) {
    console.warn('Falha listar-projetos', e);
  }
}

function notif_isConcluida(t) {
  const v = String(t.concluida ?? '').trim().toLowerCase();
  if (['1','100','sim','concluida','concluída','true'].includes(v)) return true;
  const n = parseFloat(v.replace('%',''));
  return Number.isFinite(n) && n >= 100;
}

function notif_dias(t) {
  if (t.duracao === 'Concluído') return 0;
  if (typeof t.duracao === 'number') return t.duracao;
  if (t.duracao === null || t.duracao === 9999) return 9999;
  const n = parseInt(String(t.duracao).replace(/[^\d-]/g,''), 10);
  return Number.isFinite(n) ? n : 9999;
}

function notif_build(cronograma) {
  const base = (cronograma || []).filter(x => x && x.nome);

  const criticas = base.filter(t => !notif_isConcluida(t) && (t.condicao === 'Sempre' || /cr[ií]tica/i.test(String(t.condicao))));
  const vencendo2 = base.filter(t => !notif_isConcluida(t) && notif_dias(t) <= 2);
  const atrasadas = base.filter(t => !notif_isConcluida(t) && notif_dias(t) < 7);

  const items = [];
  if (atrasadas.length) items.push({
    id: 'atrasadas',
    title: `${atrasadas.length} tarefa(s) com menos de 7 dias`,
    meta: 'Menos de uma semana para conclusão',
    color: 'red',
    action: () => notif_goSection('Atrasadas')
  });
  if (criticas.length) items.push({
    id: 'criticas',
    title: `${criticas.length} crítica(s) aberta(s)`,
    meta: 'Prioridade Crítica',
    color: 'pink',
    action: () => notif_highlightCriticas()
  });
  if (vencendo2.length) items.push({
    id: 'vencendo2',
    title: `${vencendo2.length} vencendo em até 2 dias`,
    meta: 'Atenção imediata',
    color: 'yellow',
    action: () => notif_goSection('Até 10 dias')
  });

  const total = criticas.length + vencendo2.length + atrasadas.length;
  return { total, items };
}

function notif_render(model) {
  const badge = document.getElementById('notif-badge');
  const list  = document.getElementById('notif-list');
  if (!badge || !list) return;

  if (model.total > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = String(model.total);
  } else {
    badge.style.display = 'none';
  }

  list.innerHTML = model.items.map(it => `
    <div class="notif-item" data-id="${it.id}">
      <div class="notif-line">
        <span class="dot ${it.color}"></span>
        <span class="notif-title">${it.title}</span>
      </div>
      <div class="notif-meta">${it.meta}</div>
    </div>
  `).join('') || `<div class="notif-meta">Sem avisos no momento.</div>`;

  list.querySelectorAll('.notif-item').forEach(el=>{
    el.addEventListener('click', ()=>{
      const id = el.getAttribute('data-id');
      const found = model.items.find(x=>x.id===id);
      if (found && typeof found.action === 'function') found.action();
      document.getElementById('notif-panel')?.classList.remove('show');
    });
  });
}

function notif_hidePanel() {
  const panel = document.getElementById('notif-panel');
  const backdrop = document.querySelector('.notif-backdrop');
  if (panel) {
    panel.style.display = 'none';
    panel.dataset.open = '0';
  }
  if (backdrop) backdrop.remove();
}

function notif_bindBell() {
  const bell  = document.getElementById('notif-bell');
  const panel = document.getElementById('notif-panel');

  if (!bell || !panel) return;

  (function ensureNotifStyles(){
    if (document.querySelector('style[data-notif-style="ix"]')) return;
    const css = `
      .notif-fixed {
        position: fixed !important;
        top: 70px;
        right: 16px;
        max-width: min(380px, 92vw);
        max-height: min(70vh, calc(100vh - 90px));
        overflow: auto;
        z-index: 2147483000;
        background: var(--surface, #fff);
        border: 1px solid var(--border, #e9ecef);
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.18);
      }
      .notif-backdrop {
        position: fixed; inset: 0; background: transparent; z-index: 2147482999;
      }
      @media (max-width: 480px){
        .notif-fixed { left: 8px; right: 8px; top: 64px; }
      }
    `;
    const st = document.createElement('style');
    st.dataset.notifStyle = 'ix';
    st.textContent = css;
    document.head.appendChild(st);
  })();

  function positionPanel(anchor, panelEl) {
    const r  = anchor.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;

    const top = Math.min(Math.max(r.bottom + 8, 60), vh - 60);
    panelEl.style.top = `${top}px`;

    const desiredRight = vw - r.right;
    panelEl.style.right = `${Math.max(desiredRight, 8)}px`;
    panelEl.style.left = 'auto';

    const pw = panelEl.offsetWidth || 360;
    const left = vw - (Math.max(desiredRight, 8)) - pw;
    if (left < 8) {
      panelEl.style.left = '8px';
      panelEl.style.right = 'auto';
    }
  }

  function openPanel() {
    if (panel.parentElement !== document.body) document.body.appendChild(panel);
    panel.classList.add('notif-fixed');
    panel.style.display = 'block';
    panel.dataset.open = '1';

    positionPanel(bell, panel);

    const backdrop = document.createElement('div');
    backdrop.className = 'notif-backdrop';
    document.body.appendChild(backdrop);

    const close = () => notif_hidePanel();

    const onDoc = (e) => {
      if (panel.contains(e.target) || bell.contains(e.target)) return;
      close();
      document.removeEventListener('click', onDoc, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
    const onResize = () => positionPanel(bell, panel);
    const onScroll = () => positionPanel(bell, panel);

    backdrop.addEventListener('click', close);
    document.addEventListener('click', onDoc, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);
  }

  bell.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = panel.dataset.open === '1';
    if (open) {
      notif_hidePanel();
    } else {
      openPanel();
    }
  });
}

function notif_goSection(tituloSection) {
  const alvo = Array.from(document.querySelectorAll('.task-section'))
    .find(s => s.querySelector('.section-title')?.textContent.includes(tituloSection));
  if (alvo) alvo.scrollIntoView({ behavior:'smooth', block:'start' });
}

function notif_highlightCriticas() {
  document.querySelectorAll('.task-card').forEach(c=>{
    const temSempre = /prioridade-s/.test(c.innerHTML);
    c.style.outline = temSempre ? '2px solid #d6336c' : '';
  });
}

function setLogoutHandler(id = 'btn-sair') {
  const el = document.getElementById(id);
  if (!el) return;
  el.onclick = async () => {
    try {
      await fetch('/logout', { method: 'POST', credentials: 'include', cache: 'no-store' });
    } catch(e) {}
    try {
      localStorage.removeItem('operatorName');
      localStorage.removeItem('operatorEmail');
    } catch(e){}
    window.location.replace('/login');
  };
}

async function fecharModalProgresso(){
  const m = document.getElementById('modal-progresso');
  if (m) m.style.display = 'none';
  window.__tarefaAtual__ = null;
}


async function salvarProgresso(){
  try {
    const m   = document.getElementById('modal-progresso');
    const pct = sanitizePct(m.querySelector('#prog-pct').value);
    const rel = (m.querySelector('#prog-relato').value || '').trim();
    const col = m.querySelector('#prog-colabs') ? m.querySelector('#prog-colabs').value.trim() : '';

    const { numero, sheet, projeto } = window.__tarefaAtual__ || {};
    if (!numero || !sheet) throw new Error('Tarefa não definida.');

    await postJSON('/atualizar-progresso', { numero, sheet, projeto, porcentagem: pct, relatorio: rel, colaboradores: col });

    // >>> REFRESH COMPLETO (E) <
    if (typeof carregarTarefas === 'function') await carregarTarefas();
    if (typeof window.atualizarEmCurso === 'function') await window.atualizarEmCurso();
    
    toastSuccess(`Progresso salvo.`);
    fecharModalProgresso && fecharModalProgresso();
  } catch (err) {
    toastError(`Erro ao salvar progresso: ${err.message}`, 4500);
  }
}

async function concluirViaModal(){
  try {
    const { numero, sheet, projeto } = window.__tarefaAtual__ || {};
    if (!numero || !sheet) throw new Error('Tarefa não definida.');

    await postJSON('/concluir-tarefa', { numero, sheet, projeto, acao:'concluir' });

    // >>> REFRESH COMPLETO (E) <
    if (typeof carregarTarefas === 'function') await carregarTarefas();
    if (typeof window.atualizarEmCurso === 'function') await window.atualizarEmCurso();
    
    toastSuccess(`Tarefa concluída com sucesso.`);
    fecharModalProgresso && fecharModalProgresso();
  } catch (err) {
    toastError(`Falha ao concluir tarefa: ${err.message}`, 4500);
  }
}

function bindModalProgresso(){
  const m = document.getElementById('modal-progresso');
  if (!m) return;
  m.querySelector('#btn-prog-cancelar')?.addEventListener('click', fecharModalProgresso);
  m.querySelector('#btn-prog-salvar')?.addEventListener('click', salvarProgresso);
  m.querySelector('#btn-prog-concluir')?.addEventListener('click', concluirViaModal);
  window.addEventListener('click', (e)=>{ if(e.target===m) fecharModalProgresso(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && m.style.display==='flex') fecharModalProgresso(); });
}

// ============== ETAPA 2 – Modal de Progresso + Concluir (Gestor) ==============
(function(){
  function abrirModalProgresso({ projeto, sheet, numero, pct = 0, relato = '', colaboradores = '' }) {
    window.__tarefaAtual__ = { projeto, sheet, numero };

    const m   = document.getElementById('modal-progresso');
    const inp = m?.querySelector('#prog-pct');
    const txt = m?.querySelector('#prog-relato');
    const col = m?.querySelector('#prog-colabs');

    if (!m) { alert('Modal de progresso não encontrado.'); return; }

    if (inp) inp.value = String(pct || 0).replace('%','');
    if (txt) txt.value = relato || '';
    if (col) col.value = colaboradores || '';

    m.style.display = 'flex';
  }
  window.abrirModalProgresso = abrirModalProgresso;
})();


function limparFiltros() {
  document.getElementById('projeto').value = '';
  document.getElementById('categoria').value = '';
  document.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.checked = (cb.value === 'Sempre');
  });
  carregarTarefas();
}

document.addEventListener("DOMContentLoaded", async () => {
  bindModalProgresso();

  try {
    if (window.Auth && typeof Auth.ensure === 'function') {
      await Auth.ensure();
    } else {
      const r = await fetch('/me', { credentials: 'include' });
      if (!r.ok) {
        if (!location.pathname.startsWith('/login')) location.href = '/login';
        return;
      }
      const data = await r.json();
      const u = data.user || {};
      localStorage.setItem('operatorName', u.name || u.email || '');
      localStorage.setItem('operatorEmail', u.email || '');
      if (typeof window.operatorName !== 'function') {
        window.operatorName = () =>
          localStorage.getItem('operatorName') || u.name || u.email || '';
      }
    }
  } catch (e) {
    console.warn('Falha ao garantir autenticação:', e);
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    return;
  }

  if (!window.__logoutDelegated__) {
    window.__logoutDelegated__ = true;
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('#btn-logout, .btn-logout, [data-logout]');
      if (!btn) return;
      e.preventDefault();
      try {
        await fetch('/logout', { method: 'POST', credentials: 'include', cache: 'no-store' });
      } catch (_) {}
      try {
        localStorage.removeItem('operatorName');
        localStorage.removeItem('operatorEmail');
      } catch (_) {}
      window.location.replace('/login');
    });
  }

  const doFetch = (window.authedFetch) || (async (url, options = {}) => {
    const headers = Object.assign(
      { 'X-Operator': localStorage.getItem('operatorEmail') || '' },
      options.headers || {}
    );
    return fetch(url, Object.assign({}, options, { headers, credentials: 'include' }));
  });

  carregarProjetos();
  gerarFiltros();

  await carregarTarefas();   // <-- aguarda render
  bindBotaoProgresso();      // <-- liga cliques nos botões (extra; o delegate já cobre)

  if (typeof notif_bindBell === 'function') notif_bindBell();

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal").forEach(m => (m.style.display = "none"));
    }
  });

  const btnCancelar = document.getElementById("modal-cancelar");
  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      const modal = document.getElementById("modal-alerta");
      if (modal) modal.style.display = "none";
    });
  }

  const btnCancelarConclusao = document.getElementById("cancelar-conclusao");
  if (btnCancelarConclusao) {
    btnCancelarConclusao.addEventListener("click", () => {
      const modal = document.getElementById("modal-concluir");
      if (modal) modal.style.display = "none";
    });
  }

  document.addEventListener("click", e => {
    const filtroBox = document.getElementById("filtrosAvancados");
    const toggleBtn = document.getElementById("toggle-avancado");
    if (
      filtroBox &&
      filtroBox.classList.contains("active") &&
      !filtroBox.contains(e.target) &&
      e.target !== toggleBtn
    ) {
      filtroBox.classList.remove("active");
    }
  });
});