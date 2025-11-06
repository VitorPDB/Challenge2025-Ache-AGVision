/***** UTIL *************************************************************/
const fmt     = n => n.toLocaleString('pt-BR');
const getColor = prio => ({Sempre:'#e74c3c',A:'#f39c12',B:'#3498db',C:'#2ecc71'}[prio]||'#888');

/***** CONDIÇÕES PADRÃO *************************************************/
const condicoesDefault = {
  '1. Escopo & Briefing':     ['Sempre','A','B','C'],
  '2. Pesquisa e Análise':    ['Sempre','A','B','C'],
  '3. Concepção e Protótipo': ['Sempre','A','B','C'],
  '4. Validação de Conceito': ['Sempre','A','B','C'],
  '5. Viabilidade':           ['Sempre','A','B','C'],
  '6. Implementação':         ['Sempre','A','B','C']
};

// === Auth Helper (Etapa 1) ===
async function apiPost(url, payload){
  const r = await authedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const j = await r.json().catch(()=>({}));
  if (!r.ok || j.success === false) {
    const msg = j.error || j.message || `${r.status} ${r.statusText}`;
    const err = new Error(msg); err.status = r.status; err.data = j; throw err;
  }
  return j;
}


const Auth = {
  currentUser: null,
  async ensure() {
    try {
      const r = await fetch('/me', { credentials: 'include' });
      if (!r.ok) throw new Error('unauth');
      const data = await r.json();
      Auth.currentUser = data.user;
      // Compat: algumas funções do projeto usam operatorName()
      localStorage.setItem('operatorName', data.user.name || data.user.email || '');
      localStorage.setItem('operatorEmail', data.user.email || '');
      window.operatorName = () => localStorage.getItem('operatorName') || (Auth.currentUser?.name || Auth.currentUser?.email || '');
      // UI de usuário (se existir no HTML)
      const userSpot = document.getElementById('auth-user');
      if (userSpot) userSpot.textContent = `Olá, ${Auth.currentUser.name} (${Auth.currentUser.role})`;
      const btnLogout = document.getElementById('btn-logout');
      if (btnLogout) btnLogout.onclick = async () => {
        await fetch('/logout', { method: 'POST', credentials: 'include' });
        location.href = '/login';
      };
    } catch (e) {
      // Redireciona anônimo para login
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
  }
};

// Wrapper de fetch que injeta cookie de sessão e o X-Operator legado
async function authedFetch(url, options = {}) {
  options.credentials = 'include';
  options.headers = Object.assign({}, options.headers, {
    'X-Operator': (Auth.currentUser?.email || localStorage.getItem('operatorEmail') || '')
  });
  return fetch(url, options);
}


/***** FILTRO ***********************************************************/
function aplicarFiltroTabela(){
  const termo=document.getElementById('filtroTabela').value.toLowerCase();
  document.querySelectorAll('#tabela-tarefas tbody tr').forEach(r=>{
    r.style.display=r.textContent.toLowerCase().includes(termo)?'':'none';
  });
}

/***** DASHBOARD ********************************************************/
let chartFase = null;
let chartCategoria = null;


async function carregarDashboard(){
  try {
    const projetoSel = document.getElementById('projeto-supervisor')?.value || '';
    const res = await fetch('/dashboard-metrics',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ projeto: projetoSel, condicoes: condicoesDefault })
    });
    const m = await res.json();
    if(!m || !m.total){ return; }

    document.querySelector('#card-total .valor').textContent      = fmt(m.total);
    document.querySelector('#card-concluidas .valor').textContent = m.percent_concluidas+'%';
    document.querySelector('#card-criticas .valor').textContent   = fmt(m.criticas_abertas);
    document.querySelector('#card-atrasadas .valor').textContent  = fmt(m.atrasadas);

    if (chartFase) chartFase.destroy();
    if (chartCategoria) chartCategoria.destroy();

    chartFase = new Chart(faseChart,{
      type:'bar',
      data:{labels:Object.keys(m.por_fase),datasets:[{data:Object.values(m.por_fase),backgroundColor:'#d7006c'}]},
      options:{plugins:{legend:{display:false}},responsive:true,maintainAspectRatio:false}
    });

    chartCategoria = new Chart(categoriaChart,{
      type:'doughnut',
      data:{labels:Object.keys(m.por_categoria),datasets:[{data:Object.values(m.por_categoria)}]},
      options:{responsive:true,maintainAspectRatio:false}
    });
  } catch(err) {
    console.warn("Erro ao carregar dashboard:", err);
  }
}

// ================== ETAPA 2 — Supervisor: Em Progresso ==================
async function atualizarEmCursoSupervisor() {
  const projetoSel = document.getElementById('projeto-supervisor')?.value || '';
  const url = projetoSel
    ? `/tarefas-em-curso?projeto=${encodeURIComponent(projetoSel)}`
    : `/tarefas-em-curso`;

  let data = [];
  try {
    const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
    data = await r.json();

    // TÓPICO 3 — manter somente tarefas REALMENTE em curso
    const isEmCurso = (t) => Number(t?.em_curso ?? t?.emCurso ?? t?.EM_CURSO ?? 0) === 1;
    if (Array.isArray(data)) {
      data = data.filter(isEmCurso);
    } else {
      data = [];
    }

    // (opcional) se quiser mostrar só as que têm responsável definido, ative:
    // data = data.filter(t => String(t?.em_curso_by ?? '').trim());
  } catch (_) {
    data = [];
  }


  // 1) KPI "Em Progresso" ------------------------------------------------
  const lastCard = document.getElementById('card-atrasadas');
  const grid = lastCard?.parentElement
    || document.querySelector('.metrics-section .cards-grid, .metrics-section .cards')
    || document.querySelector('.metrics-section');

  let card = document.getElementById('card-emcurso');
  if (!card) {
    card = document.createElement('div');
    card.id = 'card-emcurso';
    card.className = 'task-card';
    card.innerHTML = `
      <div class="metric-header">
        <div class="metric-icon" style="background: var(--info-500, #3b82f6);">
          <i class="fas fa-play"></i>
        </div>
        <h3>Em Progresso</h3>
      </div>
      <div class="valor">0</div>
      <div class="metric-change">
        <i class="fas fa-user-clock"></i>
        Em execução agora
      </div>
    `;
    if (lastCard && lastCard.parentElement) {
      lastCard.parentElement.appendChild(card); // adiciona após "A vencer"
    } else if (grid) {
      grid.appendChild(card);
    }
  }
  const kpiValor = card.querySelector('.valor');
  if (kpiValor) kpiValor.textContent = data.length.toLocaleString('pt-BR');

  // 2) Injetar CSS da tabela (uma vez) -----------------------------------
  if (!document.querySelector('style[data-em-curso-style]')) {
    const st = document.createElement('style');
    st.setAttribute('data-em-curso-style', '1');
    st.textContent = `
      #tabela-em-curso{width:100%;border-collapse:collapse}
      #tabela-em-curso thead{background:var(--primary-500);color:#fff}
      #tabela-em-curso th,#tabela-em-curso td{padding:var(--spacing-lg);border-bottom:1px solid var(--border,#e5e7eb);text-align:left;font-size:var(--text-sm)}
      #tabela-em-curso tbody tr:hover{background:var(--primary-50,#fff5f9)}
      #tabela-em-curso td small{opacity:.8}
      #em-curso-section .empty{padding:16px;color:var(--text-muted,#6b7280)}
    `;
    document.head.appendChild(st);
  }

  // 3) Seção/ tabela "Tarefas em Progresso" ------------------------------
  let section = document.getElementById('em-curso-section');
  if (!section) {
    section = document.createElement('section');
    section.id = 'em-curso-section';
    section.className = 'panel-section';
    section.innerHTML = `
      <h2 class="section-title"><i class="fas fa-play"></i> Tarefas em Progresso</h2>
      <div class="panel">
        <table id="tabela-em-curso">
          <thead>
            <tr>
              <th>#</th>
              <th>Fase</th>
              <th>Nome</th>
              <th>%</th>
              <th>Em curso por</th>
              <th>Início</th>
              <th>Colaboradores</th>
              <th>Relatório</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div class="empty" style="display:none">Nenhuma tarefa em progresso.</div>
      </div>
    `;
    // Insere logo abaixo dos cards e antes do drilldown
    const drilldownSection = document.querySelector('.drilldown-section');
    if (drilldownSection && drilldownSection.parentNode) {
      drilldownSection.parentNode.insertBefore(section, drilldownSection);
    } else {
      const metrics = document.querySelector('.metrics-section');
      (metrics?.parentNode || document.body).insertBefore(section, metrics?.nextSibling || null);
    }
  }

  const tbody = section.querySelector('#tabela-em-curso tbody');
  const empty = section.querySelector('.empty');
  if (tbody) tbody.innerHTML = '';

  if (!data.length) {
    if (empty) empty.style.display = 'block';
    return data;
  } else if (empty) {
    empty.style.display = 'none';
  }

  // 4) Render linhas ------------------------------------------------------
  const frag = document.createDocumentFragment();
  data.forEach(t => {
    const tr = document.createElement('tr');
    const num  = t.numero ?? '';
    const fase = t.fase ?? '';
    const nome = t.nome ?? '';
    const pct  = (() => {
      const p = parseInt(String(t.porcentagem ?? 0).toString().replace('%',''), 10);
      return isNaN(p) ? 0 : Math.max(0, Math.min(100, p));
    })();
    const by   = t.em_curso_by || '';
    const ini  = t.inicio_em || '';
    const cols = (t.colaboradores || '').toString();
    const rel  = (t.relatorio_progresso || '').toString();
    const relShort = rel.length > 120 ? rel.slice(0,117) + '…' : rel;

    tr.innerHTML = `
      <td>${num}</td>
      <td>${fase}</td>
      <td>${nome}</td>
      <td>${pct}%</td>
      <td>${by}</td>
      <td>${ini}</td>
      <td>${cols}</td>
      <td title="${rel.replace(/"/g, '&quot;')}">${relShort || '<small>(sem relatório)</small>'}</td>
    `;
    frag.appendChild(tr);
  });
  if (tbody) tbody.appendChild(frag);

  return data;
}
// Exponha se quiser reusar em outros pontos:
window.atualizarEmCursoSupervisor = atualizarEmCursoSupervisor;

/***** AÇÕES IMEDIATAS **************************************************/
async function carregarAcoes(){
  try {
    const projetoSel = document.getElementById('projeto-supervisor')?.value || '';
    const res=await fetch('/gerar-cronograma',{method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({ projeto: projetoSel, condicoes: condicoesDefault })});
    const dados=await res.json();
    if(!dados || !dados.cronograma){ return; }

    const box=document.getElementById('acoes-imediatas');
    if (!box) return;
    box.innerHTML='';
    dados.cronograma
      .filter(t=>{const d=parseInt(t.duracao)||9999;return(!t.concluida&&(t.condicao==='Sempre'||d<7));})
      .slice(0,10)
      .forEach(t=>{
        const div=document.createElement('div');
        div.className='task-card';
        div.style.borderLeft='6px solid '+getColor(t.condicao);
        div.innerHTML=`<strong>${t.nome}</strong><br><small>${t.fase} • ${t.categoria} • ${t.duracao} dias</small>`;
        box.appendChild(div);
      });
  } catch(err) {
    console.warn("Erro ao carregar ações imediatas:", err);
  }
}

/***** TABELA ***********************************************************/
async function montarTabela() {
  try {
    const projetoSel = document.getElementById('projeto-supervisor')?.value || '';
    const res = await fetch('/gerar-cronograma', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projeto: projetoSel, condicoes: condicoesDefault })
    });

    const dados = await res.json();

    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, m =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])
    );
    const attr = (s) => esc(s);
    const normalizeUrl = (u) => {
      if (!u) return '';
      if (/^mailto:/i.test(u)) return u;
      if (/^https?:\/\//i.test(u)) return u;
      if (/^www\./i.test(u)) return 'https://' + u;
      return u;
    };
    const looksLikeUrl = (u) => typeof u === 'string' && /^(https?:\/\/|www\.|mailto:)/i.test(u);
    const parsePct = (v) => {
      const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
      return Number.isFinite(n) ? n : 0;
    };

    const theadRow = document.querySelector('#tabela-tarefas thead tr');
    if (theadRow && !theadRow.querySelector('th[data-col="textos"]')) {
      const th = document.createElement('th');
      th.setAttribute('data-col', 'textos');
      th.textContent = 'Textos';
      const thDur = theadRow.querySelector('th[data-col="duracao"]');
      if (thDur) theadRow.insertBefore(th, thDur);
      else theadRow.appendChild(th);
    }

    const tbody = document.querySelector('#tabela-tarefas tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!dados || !Array.isArray(dados.cronograma)) return;

    dados.cronograma.forEach(t => {
      const concNum = Number(t.concluida ?? t.Concluida ?? t.CONCLUIDA ?? 0) || 0;
      const pctNum  = parsePct(t.porcentagem ?? t.Porcentagem);
      const durStr  = String(t.duracao ?? t.Duração ?? '').toLowerCase();
      const concluida = concNum >= 1 || pctNum >= 100 || /conclu/.test(durStr);

      const texto = String(t.texto_auxiliar ?? t.como_fazer ?? '');
      const doc   = String(t.documento_auxiliar ?? t.documento_referencia ?? '');
      const linkHtml = looksLikeUrl(doc)
        ? `<a href="${attr(normalizeUrl(doc))}" target="_blank" rel="noopener">${esc(texto || 'Abrir')}</a>`
        : (texto ? `<span title="Sem link associado">${esc(texto)}</span>` : '—');

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${esc(t.numero ?? '')}</td>
        <td>${esc(t.nome ?? '')}</td>
        <td>${esc(t.fase ?? '')}</td>
        <td>${esc(t.categoria ?? '')}</td>
        <td>${esc(typeof prioridadeLabel === 'function' ? prioridadeLabel(t.condicao) : (t.condicao ?? ''))}</td>
        <td>${linkHtml}</td>
        <td>${esc(t.duracao ?? '')}</td>
        <td>${ concluida ? "<button class='btn-reabrir' title='Reabrir esta tarefa'>Reabrir</button>" : "" }</td>
      `;

      // >>> NOVO: salvar owner atual no dataset
      tr.dataset.uid     = String(t.uid ?? t.UID ?? '');
      tr.dataset.numero  = String(t.numero ?? '');
      tr.dataset.nome    = String(t.nome ?? '');
      tr.dataset.sheet   = String(t.Sheet ?? t.sheet ?? '');
      tr.dataset.duracao = String(t.duracao ?? '');
      const isEmCurso = Number(t.em_curso ?? 0) === 1;
      const ownerName = isEmCurso ? String(t.em_curso_by ?? '').trim() : '';
      tr.dataset.owner = ownerName;

      if (concluida) {
        const btn = tr.querySelector('.btn-reabrir');
        if (btn) {
          btn.addEventListener('click', () => {
            const prazo = Number(tr.dataset.duracao) || 30;
            if (typeof abrirModalReabrir === 'function') {
              // >>> PASSA owner para o modal
              abrirModalReabrir({
                numero: tr.dataset.numero,
                sheet: tr.dataset.sheet,
                owner: tr.dataset.owner || ''
              });
            } else {
              // fallback: mantém dono (clearOwner=false)
              reabrirTarefa(tr.dataset.numero, tr.dataset.sheet, prazo, false);
            }
          });
        }
      }

      tbody.appendChild(tr);
    });

  } catch (e) {
    console.error('Erro em montarTabela:', e);
    if (typeof showToast === 'function') {
      showToast(`<span class="toast-icon">⛔</span>Falha ao montar a tabela.`, 4000);
    }
  }
}



let ordemAtual = { key: null, asc: true };

function valorCelula(tr, idx, col) {
  const td = tr.children[idx];
  if (!td) return '';

  // Se existir data-order no TD, usamos (permite você controlar o valor de ordenação)
  const raw = (td.dataset.order ?? td.textContent).trim();

  // Regras específicas por coluna
  if (col === 'fase') {
    // extrai número inicial: "3. Concepção..." -> 3
    const m = raw.match(/^(\d+)/);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  }
  if (col === 'numero' || col === 'duracao') {
    const n = parseFloat(raw.replace(/[^\d.-]/g, ''));
    return isNaN(n) ? Number.POSITIVE_INFINITY : n;
  }
  if (col === 'condicao') {
    const map = { 'Crítica':0, 'Sempre':0, 'A':1, 'Alta':1, 'B':2, 'Média':2, 'C':3, 'Baixa':3 };
    return map[raw] ?? 99;
  }
  if (col === 'concluida') {
    // aceita "Sim/Não", "100/0", "100%" etc.
    if (/^sim/i.test(raw) || /100/.test(raw)) return 1;
    if (/^n(ã|a)o/i.test(raw) || /^0$/.test(raw)) return 0;
    const n = parseFloat(raw.replace('%',''));
    return isNaN(n) ? 0 : n;
  }

  return raw.toLowerCase();
}

function ordenarTabela(th) {
  const tabela = document.getElementById('tabela-tarefas');
  if (!tabela) return;
  const corpo = tabela.querySelector('tbody');
  const linhas = Array.from(corpo.querySelectorAll('tr'));
  const col = th.dataset.col;
  const idx = Array.from(th.parentElement.children).indexOf(th); // índice do TH clicado

  // Alterna direção
  if (ordemAtual.key === col) {
    ordemAtual.asc = !ordemAtual.asc;
  } else {
    ordemAtual.key = col;
    ordemAtual.asc = true;
  }

  // Ordenação estável
  const emp = linhas.map((el, i) => ({ el, i }));
  emp.sort((A, B) => {
    const a = valorCelula(A.el, idx, col);
    const b = valorCelula(B.el, idx, col);

    let cmp;
    if (typeof a === 'number' && typeof b === 'number') {
      cmp = a - b;
    } else {
      cmp = String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
    }
    if (!ordemAtual.asc) cmp = -cmp;
    // estabilidade
    return cmp !== 0 ? cmp : (A.i - B.i);
  });

  // Reinsere na nova ordem
  corpo.innerHTML = '';
  emp.forEach(x => corpo.appendChild(x.el));

  // Atualiza setas visuais
  tabela.querySelectorAll('thead th').forEach(h => h.classList.remove('sort-asc','sort-desc'));
  th.classList.add(ordemAtual.asc ? 'sort-asc' : 'sort-desc');
}




let drilldownBase = [];   // lista carregada do backend
let drilldownKind = 'total';   // qual card foi clicado (total, críticas, etc.)
let drilldownProjetoKey = null;

function aplicarFiltros(lista) {
  const nome   = document.getElementById('filtro-nome').value.toLowerCase();
  const prio   = document.getElementById('filtro-prioridade').value;
  const cat    = document.getElementById('filtro-categoria').value;
  const fase   = document.getElementById('filtro-fase').value;

  return lista.filter(t=>{
    if (nome && !t.nome.toLowerCase().includes(nome)) return false;
    if (prio && t.condicao !== prio) return false;
    if (cat  && t.categoria !== cat) return false;
    if (fase && t.fase !== fase) return false;
    return true;
  });
}




/***** DRILLDOWN (lista por clique nos cards) **********************************/
const DR_PANEL  = () => document.getElementById('drilldown');
const DR_TITLE  = () => document.getElementById('drilldown-title');
const DR_COUNT  = () => document.getElementById('drilldown-count');
const DR_LIST   = () => document.getElementById('drilldown-list');

// ——— Substitua a função inteira por esta versão ———
function renderizarDrilldown(kindParam) {
  const kind = kindParam || drilldownKind || 'total';

  // containers (mantém os seletores usados no supervisor.html)
  const root = document.getElementById('drilldown') || document.getElementById('drilldown-panel');
  if (!root) { console.warn('Drilldown: painel não encontrado.'); return; }

  const listEl = document.getElementById('drilldown-list') ||
                 root.querySelector('.drilldown-list');
  if (!listEl) { console.warn('Drilldown: contêiner da lista não encontrado.'); return; }

  const titleEl = document.getElementById('drilldown-title') ||
                  root.querySelector('.drilldown-title') ||
                  root.querySelector('[data-dr-title]');
  const countEl = document.getElementById('drilldown-count') ||
                  root.querySelector('.drilldown-count') ||
                  root.querySelector('[data-dr-count]');

  // base + filtros
  const baseKind = filtrarPor(kind, Array.isArray(drilldownBase) ? drilldownBase : []);
  const filtrada = aplicarFiltros(baseKind);

  // título/contador
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-list"></i> ${tituloPor(kind)}`;
  if (countEl) countEl.textContent = `${filtrada.length} ${filtrada.length === 1 ? 'item' : 'itens'}`;

  // render (usa o SEU cardHTML, que já gera .drill-card + badges compatíveis com o CSS do supervisor.html)
  listEl.innerHTML = filtrada.map(cardHTML).join('') || `<div class="meta">Nada a exibir.</div>`;

  // wire reabrir
  listEl.querySelectorAll('.btn-reabrir').forEach(btn => {
    btn.addEventListener('click', () => {
      abrirModalReabrir({ numero: btn.dataset.numero, sheet: btn.dataset.sheet });
    });
  });
}




function showDrilldownPanel() {
  const panel = getDrilldownPanel();
  if (!panel) {
    console.warn('Painel de drilldown não encontrado.');
    return false;
  }
  // abre SEMPRE
  panel.classList?.add('show');
  panel.style.display = 'block';         // <- força exibir
  panel.setAttribute('aria-hidden', 'false');
  return true;
}

function prioridadeBadge(p){
  const m = { 'Sempre':'s','A':'a','B':'b','C':'c' };
  return `<span class="badge ${m[p]||''}">${prioridadeLabel(p)}</span>`;
}

async function fetchCronogramaBase(proj) {
  const projetoSel = (typeof proj === 'string') ? proj : getProjetoSelecionado();
  try {
    const res = await fetch('/gerar-cronograma', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        projeto: projetoSel,        // <<=== IMPORTANTE: nome do campo deve ser "projeto"
        condicoes: condicoesDefault //     mantenha o protocolo do seu backend
      })
    });

    if (!res.ok) {
      console.warn('Falha ao obter cronograma. HTTP', res.status);
      return [];
    }
    const json = await res.json();
    const lista = Array.isArray(json?.cronograma) ? json.cronograma : [];
    return lista;
  } catch (err) {
    console.error('Erro no fetch de cronograma:', err);
    return [];
  }
}



function duracaoNum(t){
  const n = parseInt(t.duracao,10);
  return Number.isFinite(n) ? n : 9999;
}

/** kind: 'total' | 'concluidas' | 'criticas' | 'atrasadas' */
function filtrarPor(kind, lista){
  switch(kind){
    case 'concluidas': return lista.filter(isConcluida);
    case 'criticas':   return lista.filter(t=>!isConcluida(t) && t.condicao==='Sempre');
    case 'atrasadas':  return lista.filter(t=>!isConcluida(t) && duracaoNum(t)<7);
    case 'total':
    default:           return lista.slice();
  }
}

function tituloPor(kind){
  return {
    total:      'Todas as tarefas',
    concluidas: 'Tarefas concluídas',
    criticas:   'Críticas abertas',
    atrasadas:  'Atrasadas (<7 dias)'
  }[kind] || 'Lista';
}

function corBorda(cond){
  return ({Sempre:'#e74c3c',A:'#f39c12',B:'#3498db',C:'#2ecc71'}[cond]||'#bbbbbb');
}

function cardHTML(t){
  const d = duracaoNum(t);
  const durTxt = (isConcluida(t) ? 'Concluída' : (Number.isFinite(d) && d!==9999 ? `${d} dias` : 'Prazo não definido'));
  const btnReabrir = isConcluida(t)
    ? `<button class="btn-reabrir" data-numero="${t.numero}" data-sheet="${t.Sheet}">Reabrir</button>`
    : '';
  return `
    <div class="drill-card" style="border-left-color:${corBorda(t.condicao)}">
      <div class="linha">
        <span class="nome">${t.nome}</span>
        ${prioridadeBadge(t.condicao)}
      </div>
      <div class="meta"><i class="fas fa-layer-group"></i> ${t.fase} • <i class="fas fa-folder"></i> ${t.categoria}</div>
      <div class="meta"><i class="fas fa-clock"></i> ${durTxt}</div>
      ${btnReabrir ? `<div class="linha">${btnReabrir}</div>` : ``}
    </div>
  `;
}

/***** DRILLDOWN ************************************************************/
function popularFiltros() {
  const fases = [...new Set(drilldownBase.map(t=>t.fase).filter(Boolean))];
  const cats  = [...new Set(drilldownBase.map(t=>t.categoria).filter(Boolean))];

  const faseSel = document.getElementById('filtro-fase');
  faseSel.innerHTML = '<option value="">Todas fases</option>';
  fases.forEach(f=>{
    let opt=document.createElement('option');
    opt.value=f; opt.text=f;
    faseSel.appendChild(opt);
  });

  const catSel = document.getElementById('filtro-categoria');
  catSel.innerHTML = '<option value="">Todas categorias</option>';
  cats.forEach(c=>{
    let opt=document.createElement('option');
    opt.value=c; opt.text=c;
    catSel.appendChild(opt);
  });
}


async function abrirDrilldown(kind) {
  try {
    const projAtual = getProjetoSelecionado();
    const panel = getDrilldownPanel();

    // 👉 se o mesmo tipo estiver aberto, feche (toggle)
    if (drilldownKind === kind && panel && panel.style.display === 'block') {
      hideDrilldownPanel();
      return;
    }

    drilldownKind = kind; // atualiza o tipo aberto

    // mostra o painel
    const ok = showDrilldownPanel();
    if (!ok) return;

    // recarrega base se o projeto mudou ou cache vazio
    if (!Array.isArray(drilldownBase) || !drilldownBase.length || drilldownProjetoKey !== projAtual) {
      drilldownBase = await fetchCronogramaBase(projAtual);
      drilldownProjetoKey = projAtual;
    }

    // chama render
    if (typeof renderizarDrilldown === 'function') {
      renderizarDrilldown(kind);
    } else {
      console.warn('renderizarDrilldown() não encontrada.');
    }
  } catch (e) {
    console.error('Falha ao abrir drilldown:', e);
  }
}

function fecharDrilldown(){
  hideDrilldownPanel()
}

function hideDrilldownPanel() {
  const panel = getDrilldownPanel();
  if (!panel) return;
  panel.classList?.remove('show');
  panel.style.display = 'none';          // <- esconde
  panel.setAttribute('aria-hidden', 'true');
  drilldownKind = null;                  // <- reseta tipo atual
}

/***** REABRIR TAREFA ************************************************************/

function abrirModalReabrir({ numero, sheet, owner }) {
  const modal  = document.getElementById('modal-reabrir');
  const input  = document.getElementById('novoPrazo');
  const btnOk  = document.getElementById('reabrir-confirmar');
  const btnCan = document.getElementById('reabrir-cancelar');

  if (!modal || !input || !btnOk || !btnCan) {
    (window.toastError || window.showToast)(`Componentes do modal de reabrir não encontrados.`, 4200);
    return;
  }

  // >>> Cria (uma única vez) o bloco de opções de responsável
  let ownerBox = modal.querySelector('[data-owner-opts]');
  if (!ownerBox) {
    ownerBox = document.createElement('div');
    ownerBox.setAttribute('data-owner-opts','');
    ownerBox.style.cssText = 'margin:10px 0 0 0; display:block;';

    const label = document.createElement('div');
    label.style.cssText = 'font-weight:600; margin-bottom:6px;';
    label.textContent = 'Responsável ao reabrir:';
    ownerBox.appendChild(label);

    const keepId = 'reabrir-owner-keep';
    const noneId = 'reabrir-owner-none';
    ownerBox.innerHTML += `
      <label style="display:flex;align-items:center;gap:8px;margin:4px 0;">
        <input type="radio" name="reabrir_owner" id="${keepId}" value="keep" checked>
        <span>Manter responsável atual</span>
      </label>
      <label style="display:flex;align-items:center;gap:8px;margin:4px 0;">
        <input type="radio" name="reabrir_owner" id="${noneId}" value="none">
        <span>Ninguém (liberar)</span>
      </label>
      <div id="reabrir-owner-hint" style="font-size:12px;opacity:.8;margin-top:4px;"></div>
    `;
    // insere logo acima dos botões
    btnOk.parentElement.insertBefore(ownerBox, btnOk);
  }

  // >>> Atualiza o hint com o dono atual
  const hint = modal.querySelector('#reabrir-owner-hint');
  hint.textContent = owner ? `Responsável atual: ${owner}` : `Sem responsável atual.`;

  input.value = 30;
  input.min   = 1;
  modal.style.display = 'flex';

  btnOk.onclick = () => {
    const val = parseInt(input.value, 10);
    if (!Number.isFinite(val) || val < 1) {
      (window.toastWarn || window.showToast)(`Informe um prazo válido em dias (≥ 1).`, 3600);
      return;
    }
    const choice = modal.querySelector('input[name="reabrir_owner"]:checked')?.value || 'keep';
    const clearOwner = (choice === 'none');

    modal.style.display = 'none';
    reabrirTarefa(numero, sheet, val, clearOwner);
  };

  btnCan.onclick = () => {
    modal.style.display = 'none';
  };
}



async function reabrirTarefa(numero, sheet, prazoDias, clearOwner=false) {
  try {
    const out = await apiPost('/concluir-tarefa', {
      numero, sheet, acao:'reabrir', duracao: prazoDias, clear_owner: !!clearOwner
    });

    const respTxt = clearOwner ? 'sem responsável (liberada)' : 'com responsável mantido';
    (window.toastSuccess || window.showToast)(`Tarefa <b>${numero}</b> reaberta (${respTxt}). Atualizando painel…`, 3400);

    // >>> REFRESH COMPLETO (E) <
    try {
      await Promise.allSettled([
        typeof carregarDashboard === 'function' ? carregarDashboard() : null,
        typeof montarTabela === 'function' ? montarTabela() : null,
        typeof atualizarEmCursoSupervisor === 'function' ? atualizarEmCursoSupervisor() : null
      ]);
    } catch (uiErr) {
      console.warn('Reaberta, mas falhou refresh da UI:', uiErr);
      (window.toastInfo || window.showToast)(`A tarefa foi reaberta. Se a tela não atualizou, recarregue.`, 4200);
    }
  } catch (err) {
    (window.toastError || window.showToast)(`<b>Erro ao reabrir:</b> ${err.message}`, 4500);
  }
}




/***** CANCELA CONCLUSÃO ************************************************************/
function cancelarConclusao(numero, sheet, prazoDias, clearOwner=false) {
  (async () => {
    try {
      const resp = await fetch('/concluir-tarefa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero, sheet, acao: 'reabrir',
          duracao: prazoDias,
          clear_owner: !!clearOwner   // >>> adiciona suporte
        })
      });

      const ct  = (resp.headers.get('content-type') || '').toLowerCase();
      const raw = await resp.text();
      let data  = null;
      if (ct.includes('application/json') && raw) {
        try { data = JSON.parse(raw); } catch (_) { data = null; }
      }

      if (!resp.ok) {
        const msg = (data && (data.error||data.message)) || `HTTP ${resp.status}`;
        return (window.toastError || window.showToast)(`<b>Erro ao reabrir:</b> ${msg}`, 4500);
      }
      if (data && data.success === false) {
        const msg = data.error || 'Falha desconhecida';
        return (window.toastError || window.showToast)(`<b>Erro ao reabrir:</b> ${msg}`, 4500);
      }

      const respTxt = clearOwner ? 'sem responsável (liberada)' : 'com responsável mantido';
      (window.toastSuccess || window.showToast)(`Tarefa <b>${numero}</b> reaberta (${respTxt}). Atualizando painel…`, 3200);

      try {
        if (typeof carregarDashboard === 'function') await carregarDashboard();
        if (typeof montarTabela === 'function') await montarTabela();
        if (typeof aplicarFiltroTabela === 'function') aplicarFiltroTabela();
        if (typeof carregarAcoes === 'function') await carregarAcoes();
        if (typeof atualizarEmCursoSupervisor === 'function') await atualizarEmCursoSupervisor();
      } catch (uiErr) {
        console.warn('Reaberta, mas falhou refresh UI:', uiErr);
      }
    } catch (err) {
      (window.toastError || window.showToast)(`<b>Erro ao reabrir:</b> ${err.message}`, 4500);
    }
  })();
}



/***** CATEGORIAS *******************************************************/
async function carregarCategorias() {
  try {
    const res = await fetch('/categorias-usadas');
    const categorias = await res.json();
    const select = document.getElementById('select-categoria');
    categorias.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  } catch (err) {
    console.warn("Erro ao carregar categorias:", err);
  }
}

/***** ABAS *************************************************************/
async function carregarAbas() {
  try {
    const proj = document.getElementById('projeto-supervisor')?.value || '';
    const res  = await fetch('/listar-abas' + (proj ? ('?projeto='+encodeURIComponent(proj)) : ''));
    const abas = await res.json();
    const select = document.getElementById('select-sheet');
    select.innerHTML = '<option value="">Selecione a aba de destino</option>';
    (Array.isArray(abas) ? abas : (abas[proj]||[])).forEach(aba=>{
      const opt = document.createElement('option');
      opt.value = aba; opt.textContent = aba;
      select.appendChild(opt);
    });
  } catch (err) { console.warn("Erro ao carregar abas:", err); }
}

async function carregarCategorias() {
  try {
    const proj = document.getElementById('projeto-supervisor')?.value || '';
    const url  = '/categorias-usadas' ;
    const res  = await fetch(url);
    const categorias = await res.json();
    const select = document.getElementById('select-categoria');
    select.innerHTML = '<option value="">Selecione a Categoria</option>';
    categorias.forEach(cat=>{
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      select.appendChild(opt);
    });
  } catch(err){ console.warn("Erro ao carregar categorias:", err); }
}


/***** ADICIONAR TAREFA *************************************************/
function mapPrioridadeLabelParaValor(label) {
  const mapa = { "Crítica": "Sempre", "Alta": "A", "Média": "B", "Baixa": "C" };
  return mapa[label] || label;
}

function valStr(elIdOrVal) {
  const v = typeof elIdOrVal === 'string' && document.getElementById(elIdOrVal)
    ? document.getElementById(elIdOrVal).value
    : elIdOrVal;
  return (v ?? '').toString().trim();
}

function valNum(elId) {
  const n = Number(valStr(elId));
  return Number.isFinite(n) ? n : null;
}

// ===== Modal Tarefa Adicionada =====
function abrirModalTarefaAdicionada(nomeTarefa, nomeProjeto, options = { autoCloseMs: 2200 }) {
  const modal = document.getElementById('modal-tarefa-ok');
  const body  = document.getElementById('mto-body');
  if (!modal || !body) return;

  const nome = (nomeTarefa || '').toString().trim();
  const proj = (nomeProjeto || '').toString().trim();

  body.innerHTML = `
    A tarefa <strong>${nome || '(sem nome)'}</strong> foi adicionada no projeto
    <strong>${proj || '(sem projeto)'}</strong>.
  `;

  // mostrar
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');

  // foco acessível
  const btnOk = modal.querySelector('.mto-btn');
  setTimeout(()=> btnOk?.focus(), 30);

  // fechar por botões/ESC/click fora
  const close = () => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown', onKey);
    modal.removeEventListener('click', onClickOutside);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const onClickOutside = (e) => { if (e.target === modal) close(); };

  modal.querySelectorAll('[data-mto-close]').forEach(b=> b.onclick = close);
  document.addEventListener('keydown', onKey);
  modal.addEventListener('click', onClickOutside);

  // autoclose opcional
  if (options?.autoCloseMs && Number.isFinite(options.autoCloseMs)) {
    setTimeout(() => {
      // só fecha se ainda estiver aberto
      if (modal.classList.contains('show')) {
        close();
      }
    }, options.autoCloseMs);
  }
}

// ===== Modal "Tarefa adicionada" — auto-injetável =========================
function __injectModalTarefaOK() {
  // CSS (injeta uma única vez)
  if (!document.querySelector('style[data-mto-style="1"]')) {
    const css = `
      .mto-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);
        display:none;align-items:center;justify-content:center;z-index:99999}
      .mto-overlay.show{display:flex}
      .mto-dialog{width:min(520px,92vw);background:#fff;color:#222;border-radius:16px;
        box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden;transform:translateY(6px);
        animation:mto-pop .16s ease-out;position:relative}
      @keyframes mto-pop{from{opacity:.8;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      .mto-header{display:flex;align-items:center;gap:10px;padding:16px 18px;
        background:linear-gradient(90deg,#f8d7e6,#ffd6ea 70%);border-bottom:1px solid #ffe3f0}
      .mto-icon{font-size:22px}
      .mto-body{padding:18px;line-height:1.45}
      .mto-footer{padding:12px 18px;display:flex;justify-content:flex-end;gap:8px;background:#fafafa;border-top:1px solid #eee}
      .mto-btn{padding:10px 16px;border-radius:10px;border:0;cursor:pointer;font-weight:700;background:#d63384;color:#fff}
      .mto-close{position:absolute;right:10px;top:8px;border:0;background:transparent;font-size:22px;cursor:pointer;color:#222}
      @media (prefers-color-scheme: dark){
        .mto-dialog{background:#151515;color:#eee}
        .mto-header{background:linear-gradient(90deg,#3a1d2f,#4a1d39 70%);border-bottom-color:#4a1d39}
        .mto-footer{background:#111;border-top-color:#222}
        .mto-close{color:#eee}
      }
    `;
    const style = document.createElement('style');
    style.dataset.mtoStyle = '1';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // HTML (injeta uma única vez)
  if (!document.getElementById('modal-tarefa-ok')) {
    const div = document.createElement('div');
    div.id = 'modal-tarefa-ok';
    div.className = 'mto-overlay';
    div.setAttribute('role','dialog');
    div.setAttribute('aria-modal','true');
    div.setAttribute('aria-hidden','true');
    div.innerHTML = `
      <div class="mto-dialog">
        <button class="mto-close" aria-label="Fechar" data-mto-close>&times;</button>
        <div class="mto-header">
          <span class="mto-icon">✅</span>
          <h3 id="mto-title">Tarefa adicionada</h3>
        </div>
        <div class="mto-body" id="mto-body"></div>
        <div class="mto-footer">
          <button class="mto-btn" data-mto-close>OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }
}

function prioridadeLabel(v){ return ({ 'Sempre':'Crítica','A':'Alta','B':'Média','C':'Baixa' }[v] || v); }


function abrirModalTarefaAdicionada(nomeTarefa, nomeProjeto, options = { autoCloseMs: 2200 }) {
  // garante que exista
  __injectModalTarefaOK();

  const modal = document.getElementById('modal-tarefa-ok');
  const body  = document.getElementById('mto-body');
  if (!modal || !body) return console.warn('Modal Tarefa OK não encontrado/gerado');

  const nome = (nomeTarefa || '').toString().trim();
  const proj = (nomeProjeto || '').toString().trim();

  body.innerHTML = `A tarefa <strong>${nome || '(sem nome)'}</strong> foi adicionada no projeto <strong>${proj || '(sem projeto)'}</strong>.`;

  // abre
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');

  const close = () => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.removeEventListener('keydown', onKey);
    modal.removeEventListener('click', onClickOutside);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const onClickOutside = (e) => { if (e.target === modal) close(); };

  modal.querySelectorAll('[data-mto-close]').forEach(b => b.onclick = close);
  document.addEventListener('keydown', onKey);
  modal.addEventListener('click', onClickOutside);

  // foco
  setTimeout(() => modal.querySelector('.mto-btn')?.focus(), 30);

  // autoclose
  if (options?.autoCloseMs && Number.isFinite(options.autoCloseMs)) {
    setTimeout(() => { if (modal.classList.contains('show')) close(); }, options.autoCloseMs);
  }
}

// ===== TOASTS v2 (global, bottom-left, visual melhorado) =================
(function initToastsV2(){
  if (window.__toasts_v2__) return; window.__toasts_v2__ = true;

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
  window.showToast   = (html, ms)=> renderToast('info','',html,ms);
  window.toastInfo   = (msg, ms)=> renderToast('info','',msg,ms);
  window.toastSuccess= (msg, ms)=> renderToast('success','',msg,ms);
  window.toastError  = (msg, ms)=> renderToast('error','',msg,ms);
  window.toastWarn   = (msg, ms)=> renderToast('warn','',msg,ms);

  // Mensagem pronta para tarefa adicionada
  window.toastTarefaAdicionada = (nome, projeto) => {
    const safeTask = (nome||'').toString().trim() || '(sem nome)';
    const safeProj = (projeto||'').toString().trim() || '(sem projeto)';
    toastSuccess(`Tarefa <b>${safeTask}</b> adicionada ao projeto <b>${safeProj}</b>.`, 3500);
    if (clearOwner) {
      const sel = `#tabela-tarefas tbody tr[data-numero="${numero}"][data-sheet="${sheet}"]`;
      const row = document.querySelector(sel);
      if (row) {
        row.dataset.owner = '';
        row.querySelectorAll('.owner-chip, .badge-em-curso, .resp-indicador').forEach(n => n.remove());
      }
    }
  };

  // ✅ Alias de compatibilidade para código legado:
  window.toasterAdicionarTarefa = function(nome, projeto){
    if (typeof window.toastTarefaAdicionada === 'function') {
      return window.toastTarefaAdicionada(nome, projeto);
    }
    toastSuccess(`Tarefa adicionada.`, 3200);
  };
})();





async function configurarFormularioAdicionar() {
  const form = document.getElementById('form-adicionar-tarefa');
  if (!form) return;

  const parsePct = (v) => {
    const s = (v ?? '').toString().trim().replace('%','');
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);

    const projetoSelecionadoForm = (document.getElementById('projeto-adicionar')?.value || '').trim();
    const projetoSelecionadoTopo = (document.getElementById('projeto-supervisor')?.value || '').trim();

    const classificacaoVal =
      (fd.get('Classificação') ??
       fd.get('Classificacao') ??
       ''
      ).toString().trim();

    const payload = {
      numero: parseInt((fd.get('numero') || ''), 10),
      classificacao: classificacaoVal,
      categoria: (fd.get('categoria') || '').toString().trim(),
      fase: (fd.get('fase') || '').toString().trim(),
      condicao: (fd.get('condicao') || '').toString().trim(),
      nome: (fd.get('nome') || '').toString().trim(),
      duracao: parseInt((fd.get('duracao') || ''), 10) || 0,
      como_fazer: (fd.get('como_fazer') || '').toString().trim(),
      documento_referencia: (fd.get('documento_referencia') || '').toString().trim(),
      porcentagem: parsePct(fd.get('porcentagem')),
      sheet: (fd.get('sheet') || '').toString().trim(),
      projeto: (projetoSelecionadoForm || projetoSelecionadoTopo),
      concluida: 0
    };

    if (!payload.projeto) {
      (window.toastWarn || window.showToast)(`Selecione um projeto para adicionar a tarefa.`, 3600);
      return;
    }

    const btn = form.querySelector('button[type="submit"], .btn-submit');
    if (btn) { btn.disabled = true; btn.dataset.loading = '1'; }

    try {
      // >>> USA apiPost (D) <
      const json = await apiPost('/adicionar-tarefa', payload);
      
      if (!json.success) throw new Error(json.error || 'Erro desconhecido');

      const nomeOK = payload.nome;
      const projetoOK = json.projeto || payload.projeto;

      toastTarefaAdicionada(nomeOK, projetoOK);

      // >>> REFRESH COMPLETO (E) <
      await Promise.allSettled([
        typeof carregarDashboard === 'function' ? carregarDashboard() : null,
        typeof montarTabela === 'function' ? montarTabela() : null,
        typeof aplicarFiltroTabela === 'function' ? aplicarFiltroTabela() : null,
        typeof carregarAcoes === 'function' ? carregarAcoes() : null,
        typeof atualizarEmCursoSupervisor === 'function' ? atualizarEmCursoSupervisor() : null
      ]);
    } catch (err) {
      (window.toastError || window.showToast)(`Falha ao adicionar: ${err.message}`, 4500);
    } finally {
      if (btn) { btn.disabled = false; delete btn.dataset.loading; }
    }
  });
}



/***** PROJETOS *************************************************************/


async function carregarProjetosSupervisor(){
  try{
    const r = await fetch('/listar-projetos');
    const lista = await r.json();
    const sel = document.getElementById('projeto-supervisor');
    if(!sel) return;
    sel.innerHTML = `<option value="">Todos</option>` + 
      (lista||[]).map(p=>`<option value="${p}">${p}</option>`).join('');
    sel.addEventListener('change', async ()=>{
      await carregarDashboard();
      if (typeof carregarAcoes === 'function') await carregarAcoes();
      if (typeof atualizarEmCursoSupervisor === 'function') await atualizarEmCursoSupervisor();
      await montarTabela().then(aplicarFiltroTabela);
      await carregarAbas();
      await carregarCategorias();
    });
  }catch(e){ console.warn('Falha projetos (supervisor)', e); }
}

async function criarProjeto(nome){
  const res = await fetch('/criar-projeto', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ nome })
  });
  const out = await res.json();
  if(!out.success) throw new Error(out.error || 'Falha ao criar');
  // recarrega e seleciona
  await carregarProjetosSupervisor();
  document.getElementById('projeto-supervisor').value = out.projeto;
  await Promise.all([carregarAbas(), carregarCategorias(), carregarDashboard(), montarTabela(), carregarAcoes()]);
  toast('Projeto criado com sucesso');
}

async function uploadProjeto(file){
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/upload-projeto', { method:'POST', body: fd });
  const out = await r.json();
  if(!out.success) throw new Error(out.error || 'Falha no upload');
  await carregarProjetosSupervisor();
  document.getElementById('projeto-supervisor').value = out.projeto;
  await Promise.all([carregarAbas(), carregarCategorias(), carregarDashboard(), montarTabela(), carregarAcoes()]);
  await Promise.all([carregarAbas(), carregarCategorias(), carregarDashboard(), montarTabela(), carregarAcoes()]);
  if (typeof atualizarEmCursoSupervisor === 'function') {
    await atualizarEmCursoSupervisor();
  }

  toast('Projeto importado com sucesso');
}

function toast(msg, type='success'){
  const box = document.getElementById('toast-container') || (()=>{const d=document.createElement('div');d.id='toast-container';document.body.appendChild(d);return d;})();
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas fa-check-circle"></i> ${msg}`;
  box.appendChild(t);
  setTimeout(()=> t.remove(), 3000);
}

// ======================================
//======== ABAS =========================
//=======================================
// ================== ABAS: Adicionar (Tarefa | Projeto) ==================
function initAbasAdicionar() {
  const tabTarefa   = document.getElementById('tab-tarefa');
  const tabProjeto  = document.getElementById('tab-projeto');
  const panelTarefa = document.getElementById('panel-tarefa');
  const panelProj   = document.getElementById('panel-projeto');
  const lbl         = document.getElementById('aba-label');

  // Se a seção não estiver na página, não faz nada
  if (!tabTarefa || !tabProjeto || !panelTarefa || !panelProj || !lbl) return;

  // Helper para alternar
  const setTab = (qual) => {
    const projetoAtivo = (qual === 'projeto');

    // estado visual das abas
    tabTarefa.classList.toggle('active', !projetoAtivo);
    tabProjeto.classList.toggle('active', projetoAtivo);

    // acessibilidade (opcional)
    tabTarefa.setAttribute('aria-selected', String(!projetoAtivo));
    tabProjeto.setAttribute('aria-selected', String(projetoAtivo));
    tabTarefa.setAttribute('tabindex', !projetoAtivo ? '0' : '-1');
    tabProjeto.setAttribute('tabindex', projetoAtivo ? '0' : '-1');

    // painéis
    panelTarefa.style.display = projetoAtivo ? 'none'  : 'block';
    panelProj.style.display   = projetoAtivo ? 'block' : 'none';

    // rótulo do título
    lbl.textContent = projetoAtivo ? 'Projeto' : 'Tarefa';

    // foco amigável
    if (projetoAtivo) {
      document.getElementById('input-proj-nome')?.focus();
    } else {
      // tenta focar no primeiro campo do formulário de tarefa
      panelTarefa.querySelector('input,select,textarea,button')?.focus();
    }
  };

  // Eventos das abas
  tabTarefa.addEventListener('click', () => setTab('tarefa'));
  tabProjeto.addEventListener('click', () => setTab('projeto'));

  // Estado inicial: deixa a aba de tarefa ativa
  setTab('tarefa');

  // ---------- Botão "Criar Projeto" ----------
  const btnCriar = document.getElementById('btn-criar-projeto');
  const inpNome  = document.getElementById('input-proj-nome');
  if (btnCriar && inpNome) {
    btnCriar.addEventListener('click', async (e) => {
      e.preventDefault();
      const nome = (inpNome.value || '').trim();
      if (!nome) { alert('Informe um nome para o projeto (.xlsx).'); inpNome.focus(); return; }
      try {
        await criarProjeto(nome);  // usa sua função já existente
      } catch (err) {
        alert('Erro ao criar projeto: ' + (err.message || err));
      }
    });
  }

  // ---------- Upload (drag & drop) ----------
  const drop   = document.getElementById('dropzone-projeto');
  const inputF = document.getElementById('input-file-projeto');
  const chips  = document.getElementById('chips-projeto');
  const btnUp  = document.getElementById('btn-enviar-projeto');

  // estado local de arquivos selecionados
  const filesProjeto = [];

  function addChip(f) {
    const pill = document.createElement('span');
    pill.style.cssText = `
      display:inline-flex;align-items:center;gap:6px;padding:6px 10px;
      border-radius:999px;border:1px solid var(--border);background:#faf9fb;
    `;
    pill.innerHTML = `<i class="fas fa-file-excel"></i> ${f.name}`;
    chips?.appendChild(pill);
  }

  function handleFiles(list) {
    for (const f of list) {
      if (!/\.xlsx$/i.test(f.name)) { alert('Apenas .xlsx'); continue; }
      filesProjeto.push(f);
      addChip(f);
    }
  }

  if (drop) {
    ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      drop.style.borderColor = 'var(--primary-500)';
      drop.style.background  = '#fff6fb';
    }));
    ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      if (ev === 'dragleave') {
        drop.style.borderColor = 'var(--border)';
        drop.style.background  = '#fff';
      }
    }));
    drop.addEventListener('drop', (e) => {
      drop.style.borderColor = 'var(--border)';
      drop.style.background  = '#fff';
      handleFiles(e.dataTransfer.files);
    });
  }

  if (inputF) {
    inputF.addEventListener('change', () => handleFiles(inputF.files || []));
  }

  if (btnUp) {
    btnUp.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!filesProjeto.length) { alert('Selecione ou arraste um .xlsx'); return; }
      try {
        // Se quiser permitir múltiplos, faça um loop. Aqui enviamos o primeiro.
        await uploadProjeto(filesProjeto[0]);  // usa sua função já existente
      } catch (err) {
        alert('Erro no upload: ' + (err.message || err));
      }
    });
  }
}

function isConcluida(t) {
  const conc = Number(t?.concluida ?? t?.Concluida ?? t?.CONCLUIDA ?? 0) || 0;
  const pct  = Number(t?.porcentagem ?? t?.Porcentagem ?? 0) || 0;
  const durS = String(t?.duracao ?? t?.Duração ?? '').toLowerCase();
  return conc >= 1 || pct >= 100 || /conclu/.test(durS);
}



function operatorName() {
return localStorage.getItem('operatorName') || 'usuario';
}

async function concluirTarefaCompat(item){
try {
const payload = {
sheet: item.sheet,
task_uuid: item.task_uuid, // opcional por enquanto
version: item.version, // opcional por enquanto
numero: item.numero // fallback compatível
};
const out = await apiPost('/concluir-tarefa', payload);
return out.task; // contém nova version
} catch (e){
if (e.status === 409){
// mostre aviso e atualize a linha com e.data.current
console.warn('Conflito de versão', e.data.current);
// TODO: refresh linha específica
} else {
throw e;
}
}
}

const EDITAVEIS = new Set(['nome','duracao','condicao','fase','categoria','classificacao']);

document.addEventListener('dblclick', (e)=>{
  const cell = e.target.closest('[data-field]');
  if(!cell) return;
  const field = cell.dataset.field;
  if(!EDITAVEIS.has(field)) return;

  const row = cell.closest('[data-row]');
  const task = JSON.parse(row.dataset.task); // salve o objeto no data-task do <tr>
  const old = task[field] ?? '';

  const input = document.createElement('input');
  input.value = old;
  input.onkeydown = async (ev)=>{
    if(ev.key === 'Enter'){
      const val = input.value.trim();
      try{
        const payload = {
          sheet: task.Sheet, projeto: task.Projeto,
          task_uuid: task.task_uuid, version: task.version
        };
        payload[field] = val;

        const res = await fetch('/editar-tarefa', {
          method:'POST',
          headers:{'Content-Type':'application/json','X-Operator':operatorName?.()||'usuario'},
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if(!res.ok){
          if(res.status===409){ /* version_conflict -> recarregar linha */ }
          throw new Error(out.error||'Falha ao editar');
        }
        // atualizar linha
        Object.assign(task, out.task);
        row.dataset.task = JSON.stringify(task);
        cell.textContent = out.task[field] ?? '';
      } catch(err){
        console.warn(err);
      } finally {
        cell.removeChild(input);
      }
    }
    if(ev.key === 'Escape'){ cell.removeChild(input); cell.textContent = old; }
  };
  cell.textContent = '';
  cell.appendChild(input);
  input.focus();
});

function getProjetoSelecionado() {
  const sel = document.getElementById('projeto-supervisor');
  return (sel && typeof sel.value === 'string') ? sel.value : '';
}

function getDrilldownPanel() {
  // tenta por ids mais comuns
  return document.getElementById('drilldown-panel')
      || document.getElementById('drilldown')
      || null;
}

async function exportarVisaoAtual(formato='csv'){
  const filtros = coletarFiltrosDaTela(); // reutilize seu coletor atual
  const projeto = getProjetoSelecionado(); // se tiver

  const res = await fetch('/exportar-supervisor', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ projeto, filtros, formato })
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = formato === 'xlsx' ? 'supervisor_export.xlsx' : 'supervisor_export.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}


async function apiPost(url, body) {
const res = await fetch(url, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
'X-Operator': operatorName(),
},
body: JSON.stringify({ operator: operatorName(), ...body })
});
const data = await res.json().catch(()=>({}));
if (!res.ok) throw { status: res.status, data };
return data;
}

// Retorna SEMPRE um array de strings com nomes de projetos
async function carregarProjetos() {
  const res = await fetch('/listar-projetos');
  const data = await res.json();
  // aceita tanto ["P1","P2"] quanto { success:true, projetos:["P1","P2"] }
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.projetos)) return data.projetos;
  throw new Error(data?.error || 'Falha ao listar projetos');
}

async function preencherSelectsDeProjeto(ids = []) {
  try {
    const projetos = await carregarProjetos();
    ids.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      // preserva a primeira opção (vazia) se existir
      const primeira = sel.querySelector('option[value=""]')?.outerHTML || '<option value=""></option>';
      sel.innerHTML = primeira + projetos.map(p => `<option value="${p}">${p}</option>`).join('');
    });
  } catch (e) {
    console.error('Erro ao preencher selects de projeto:', e);
  }
}

(function wireImportBox(){
  const drop = document.getElementById('import-drop');
  const input = document.getElementById('import-file');
  if(!drop || !input) return;

  drop.addEventListener('click', ()=> input.click());
  input.addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) uploadProjeto(f);
  });

  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('drag');
    const f = e.dataTransfer.files?.[0];
    if (f) uploadProjeto(f);
  });
})();



// ================== CHATBOT WIDGET (Supervisor) ==================
(function initChatbotWidget(){
  const btn   = document.getElementById('chatbot-widget-btn');
  const modal = document.getElementById('chatbot-widget');
  const close = document.getElementById('chatbot-close');
  const frame = document.getElementById('chatbot-iframe');

  if (!btn || !modal || !close || !frame) return;

  function currentProjeto(){
    const el = document.getElementById('projeto-supervisor') || document.getElementById('projeto');
    return (el && el.value) ? el.value.trim() : '';
  }

  function openWidget(){
    const projeto = encodeURIComponent(currentProjeto());
    const url = '/chatbot/' + (projeto ? ('?projeto='+projeto) : '');
    if (frame.src !== url) frame.src = url;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
  }
  function closeWidget(){
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
  }

  btn.addEventListener('click', openWidget);
  close.addEventListener('click', closeWidget);

  // Opcional: enviar contexto para o iframe sem recarregar
  document.addEventListener('change', (e)=>{
    if (e.target && (e.target.id === 'projeto' || e.target.id === 'projeto-supervisor')){
      try {
        frame?.contentWindow?.postMessage({ type:'context', projeto: currentProjeto() }, '*');
      } catch(e){}
    }
  });
})();




/***** INIT *************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  // =================== AUTENTICAÇÃO (Etapa 1) ===================
  // Tenta usar o helper Auth.ensure(); se não existir, faz um fallback simples.
  try {
    if (window.Auth && typeof Auth.ensure === 'function') {
      await Auth.ensure(); // redireciona para /login se não autenticado
    } else {
      // Fallback leve: valida sessão e preenche operatorName/operatorEmail
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
        window.operatorName = () => localStorage.getItem('operatorName') || u.name || u.email || '';
      }
    }
  } catch (e) {
    console.warn('Falha ao garantir autenticação:', e);
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    return;
  }

  // === MUDANÇA 3: Logout delegado (funciona mesmo se o botão for criado depois)
  if (!window.__logoutDelegated__) {
    window.__logoutDelegated__ = true;
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('#btn-logout, .btn-logout, [data-logout]');
      if (!btn) return;
      e.preventDefault();
      try {
        await fetch('/logout', { method: 'POST', credentials: 'include', cache: 'no-store' });
      } catch (_) { /* ignora erro de rede */ }
      try {
        localStorage.removeItem('operatorName');
        localStorage.removeItem('operatorEmail');
      } catch (_) {}
      window.location.replace('/login'); // evita voltar logado no histórico
    });
  }
  // ===============================================================

  // Wrapper de fetch autenticado: usa authedFetch se existir; senão, fallback.
  const doFetch = (window.authedFetch) || (async (url, options = {}) => {
    const headers = Object.assign(
      { 'X-Operator': localStorage.getItem('operatorEmail') || '' },
      options.headers || {}
    );
    return fetch(url, Object.assign({}, options, { headers, credentials: 'include' }));
  });
  // ===============================================================

  // helper: (re)liga os cliques dos cards sempre que o dashboard for re-renderizado
  function bindCardClicks() {
    const cardTotal      = document.getElementById('card-total');
    const cardConcluidas = document.getElementById('card-concluidas');
    const cardCriticas   = document.getElementById('card-criticas');
    const cardAtrasadas  = document.getElementById('card-atrasadas');

    if (cardTotal)      cardTotal.onclick      = () => abrirDrilldown('total');
    if (cardConcluidas) cardConcluidas.onclick = () => abrirDrilldown('concluidas');
    if (cardCriticas)   cardCriticas.onclick   = () => abrirDrilldown('criticas');
    if (cardAtrasadas)  cardAtrasadas.onclick  = () => abrirDrilldown('atrasadas');
  }

  // Carregamentos existentes
  carregarProjetosSupervisor();
  carregarCategorias();
  carregarAbas();
  configurarFormularioAdicionar();

  // Render inicial do dashboard e ações
  await carregarDashboard();
  bindCardClicks();            // <<=== liga cliques após render
  await carregarAcoes();
  if (typeof atualizarEmCursoSupervisor === 'function') {
    await atualizarEmCursoSupervisor();
  }


  initAbasAdicionar();

  // >>> Preenche também o seletor de projeto do formulário de "Adicionar"
  await preencherSelectsDeProjeto(['projeto-supervisor', 'projeto-adicionar']);

  // >>> Herdar o filtro global para o formulário (apenas se o form ainda não tiver valor)
  const selFiltro = document.getElementById('projeto-supervisor');
  const selAdd    = document.getElementById('projeto-adicionar');
  if (selFiltro) {
      selFiltro.addEventListener('change', async () => {
        try { if (typeof drilldownBase !== 'undefined') drilldownBase = []; } catch(e){}
        try { if (typeof drilldownProjetoKey !== 'undefined') drilldownProjetoKey = null; } catch(e){}

        try { 
          if (typeof carregarDashboard === 'function') {
            await carregarDashboard();
            bindCardClicks();    // <<=== religar cliques após re-render
          }
        } catch(e){ console.warn('Falha ao carregar dashboard:', e); }

        try { 
          if (typeof carregarAcoes === 'function') await carregarAcoes(); 
          if (typeof atualizarEmCursoSupervisor === 'function') await atualizarEmCursoSupervisor();
        } catch(e){ console.warn('Falha ao carregar ações:', e); }
      });
  }

  // >>> NOVO: menu flutuante de exportação ===============================
  const btnExportar = document.getElementById('btn-exportar-projeto');
  const menuExportar = document.getElementById('menu-exportar');

  if (btnExportar && menuExportar) {
    // alterna visibilidade do menu
    btnExportar.addEventListener('click', (e) => {
      e.stopPropagation();
      menuExportar.classList.toggle('show');
    });

    // fecha ao clicar fora
    document.addEventListener('click', (e) => {
      if (!menuExportar.contains(e.target) && e.target !== btnExportar) {
        menuExportar.classList.remove('show');
      }
    });

    // ações dos botões PDF/XLSX (usa doFetch autenticado)
    menuExportar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        menuExportar.classList.remove('show'); // fecha o menu
        const formato = btn.dataset.format;
        const projetoSel = document.getElementById('projeto-supervisor')?.value || '';
        if (!projetoSel) {
          alert('Selecione um projeto antes de exportar.');
          return;
        }

        try {
          const res = await doFetch(`/exportar-projeto?projeto=${encodeURIComponent(projetoSel)}&formato=${formato}`);
          if (!res.ok) throw new Error(`Erro HTTP ${res.status}`);

          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${projetoSel}.${formato}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Erro ao exportar projeto:', err);
          alert('Falha ao exportar projeto.');
        }
      });
    });
  }
  // =====================================================================

  // >>> Quando o usuário trocar o projeto, invalidar cache e recarregar cards (e religar cliques)
  if (selFiltro) {
    selFiltro.addEventListener('change', async () => {
      try { if (typeof drilldownBase !== 'undefined') drilldownBase = []; } catch(e){}
      try { if (typeof drilldownProjetoKey !== 'undefined') drilldownProjetoKey = null; } catch(e){}

      try { 
        if (typeof carregarDashboard === 'function') {
          await carregarDashboard();
          bindCardClicks();    // <<=== religar cliques após re-render
        }
      } catch(e){ console.warn('Falha ao carregar dashboard:', e); }

      try { 
        if (typeof carregarAcoes === 'function') await carregarAcoes(); 
        if (typeof atualizarEmCursoSupervisor === 'function') await atualizarEmCursoSupervisor();
      } catch(e){ console.warn('Falha ao carregar ações:', e); }

    });
  }

  // Tabela
  await montarTabela().then(aplicarFiltroTabela);

  const filtro = document.getElementById('filtroTabela');
  if (filtro) filtro.addEventListener('input', aplicarFiltroTabela);

  window.addEventListener('click', e => {
    const modal = document.getElementById('modal-reabrir');
    if (e.target === modal) modal.style.display = 'none';
  });

  // Fechar painel
  const drClose = document.getElementById('drilldown-close');
  if (drClose) drClose.addEventListener('click', fecharDrilldown);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') fecharDrilldown(); });

  // Drilldown: listeners dos filtros
  ['filtro-nome','filtro-prioridade','filtro-categoria','filtro-fase'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', renderizarDrilldown);
  });

  // Ordenação da tabela
  document.querySelectorAll('#tabela-tarefas thead th').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => ordenarTabela(th));
  });

});
