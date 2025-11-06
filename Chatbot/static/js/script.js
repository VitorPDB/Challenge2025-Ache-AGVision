document.addEventListener("DOMContentLoaded", () => {
  // ====== CONFIG ======
  const CHATBOT_BASE = location.pathname.startsWith('/chatbot') ? '/chatbot' : '';

  // URL alvo da página de supervisão (pode vir de <meta name="supervisor-url">)
  const SUPERVISOR_URL =  (document.querySelector('meta[name="supervisor-url"]')?.content) || '/supervisor';

  // ====== ELEMENTOS DO DOM ======
  const messagesDiv = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const emptyState = document.getElementById('empty-state');
  const statusBadge = document.getElementById('status-badge');
  const statusText = document.getElementById('status-text');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const btnBack = document.getElementById('btnBack');

  // Contexto de projeto vindo da URL (ex.: /chatbot?projeto=Projeto X)
  const urlParams = new URLSearchParams(location.search);
  const PROJETO = urlParams.get('projeto') || '';

  // ====== INICIALIZAÇÃO ======
  updateStatus();
  userInput.focus();
  setupEventListeners();
  renderTrace();

  function sameOrigin(u){
    try { return new URL(u, location.href).origin === location.origin; }
    catch { return false; }
  }

  // ====== CONFIGURAÇÃO DE EVENTOS ======
  // 1) Localiza o melhor container para inserir o trace
  function __getTraceMountPoint() {
    // 1. tenta anexar DEPOIS da última mensagem do bot
    const botSelectors = [
      '.message.bot',
      '.msg.bot',
      '.bubble.from-bot',
      '.chat-bubble.from-bot',
      '.assistant', 
      '[data-role="assistant"]'
    ];
    for (const sel of botSelectors) {
      const nodes = document.querySelectorAll(sel);
      if (nodes && nodes.length) {
        return { el: nodes[nodes.length - 1], mode: 'after' };
      }
    }

    // 2. se não houver, tenta o feed da conversa
    const listSelectors = [
      '#chat-list',
      '#messages',
      '.chat-messages',
      '.messages',
      '[data-chat-list]',
      '[role="log"]'
    ];
    for (const sel of listSelectors) {
      const el = document.querySelector(sel);
      if (el) return { el, mode: 'append' };
    }

    // 3. fallback: body
    return { el: document.body, mode: 'append' };
  }

  // 2) Renderiza o trace (raciocínio explicável) no ponto certo
  //
  // 2.1) Estilos
  function injectTraceDockStyles() {
    if (document.getElementById('trace-dock-styles')) return;

    const style = document.createElement('style');
    style.id = 'trace-dock-styles';
    style.textContent = `
      /* posicionamento do dock */
      #trace-dock{
        position:fixed;
        left:16px;
        top:84px;
        bottom:16px;
        width:380px;
        max-width:42vw;
        background:#0f172a;
        color:#e2e8f0;
        border-radius:14px;
        box-shadow:0 10px 30px rgba(0,0,0,.18);
        border:1px solid rgba(255,255,255,.08);
        overflow:hidden;
        z-index:99999;
      }
      #trace-dock .trace-box{
        border:1px solid rgba(255,255,255,.08);
        border-radius:10px;
        background:#0b1220;
        margin:10px 0;
        box-shadow:0 6px 24px rgba(0,0,0,.06);
      }
      #trace-dock details summary{
        cursor:pointer;
        font-weight:600;
        padding:10px 12px;
        list-style:none;
      }
      #trace-dock details summary::-webkit-details-marker{ display:none; }
      #trace-dock details[open] summary{ background:rgba(255,255,255,.04); border-radius:10px 10px 0 0; }
      #trace-dock section{ padding:6px 12px 12px; }
      #trace-dock section > div:first-child{ font-weight:600; margin:6px 0; }
      #trace-dock pre, #trace-dock .pre-like{
        white-space:pre-wrap; overflow:auto; padding:8px; border-radius:6px;
        background:#101826; border:1px solid rgba(255,255,255,.06);
      }
    `;
    document.head.appendChild(style);
  }

  // 2.2) Garante a caixa lateral
  function ensureTraceDock() {
    injectTraceDockStyles();

    let dock = document.getElementById('trace-dock');
    if (!dock) {
      dock = document.createElement('aside');
      dock.id = 'trace-dock';
      dock.innerHTML = `
        <header style="font-weight:700;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:8px;">
          <span class="dot" style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;"></span>
          <span>Raciocínio do Modelo</span>
        </header>
        <div class="trace-scroll" style="height:calc(100% - 48px);overflow:auto;padding:10px 10px 14px;"></div>
      `;
      document.body.appendChild(dock);
    }
    return dock;
  }

  // 2.3) Renderiza um bloco de trace
  function renderTrace(trace) {
    if (!trace) return;

    const dock = (typeof ensureTraceDock === 'function') ? ensureTraceDock() : (function(){
      let d = document.getElementById('trace-dock');
      if (!d) {
        d = document.createElement('aside');
        d.id = 'trace-dock';
        d.style.cssText = 'position:fixed;left:16px;top:84px;bottom:16px;width:380px;max-width:42vw;background:#0f172a;color:#e2e8f0;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.08);overflow:hidden;z-index:99999;';
        d.innerHTML = `
          <header style="font-weight:700;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:8px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;"></span>
            <span>Raciocínio do Modelo</span>
          </header>
          <div class="trace-scroll" style="height:calc(100% - 48px);overflow:auto;padding:10px 10px 14px;"></div>
        `;
        document.body.appendChild(d);
      }
      return d;
    })();

    const scrollArea = dock.querySelector('.trace-scroll') || dock;

    const box = document.createElement('div');
    box.className = 'trace-box';
    box.style.border = '1px solid rgba(255,255,255,.08)';
    box.style.borderRadius = '10px';
    box.style.background = '#0b1220';
    box.style.margin = '10px 0';
    box.style.boxShadow = '0 6px 24px rgba(0,0,0,.06)';

    const details = document.createElement('details');
    details.open = true;

    const summary = document.createElement('summary');
    summary.textContent = '👁️ Ver raciocínio';
    summary.style.cursor = 'pointer';
    summary.style.padding = '10px 12px';
    summary.style.fontWeight = '600';
    details.appendChild(summary);

    // helpers
    const mk = (titulo, corpo, code=false) => {
      const sec = document.createElement('section');
      sec.style.padding = '6px 12px 12px';
      const h = document.createElement('div');
      h.textContent = titulo;
      h.style.fontWeight = '600';
      h.style.margin = '6px 0';
      const pre = document.createElement(code ? 'pre' : 'div');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.overflow = 'auto';
      pre.style.padding = '8px';
      pre.style.borderRadius = '6px';
      pre.style.background = code ? '#101826' : 'transparent';
      pre.style.border = code ? '1px solid rgba(255,255,255,.06)' : 'none';
      pre.textContent = (corpo || '').toString().trim() || '(vazio)';
      sec.appendChild(h); sec.appendChild(pre);
      return sec;
    };

    // 👉 SOMENTE os 3 itens pedidos
    details.appendChild(mk('Código Gerado', trace.codigo_gerado || '', true));
    details.appendChild(mk('Saída do Código (print)', trace.resultado_codigo || '', true));
    details.appendChild(mk('Resposta Final', trace.resposta_final || ''));

    box.appendChild(details);
    // coloca o item mais novo no topo
    scrollArea.insertBefore(box, scrollArea.firstChild);
    // garante que o dock esteja visível
    dock.style.display = 'block';
  }

  // (opcional) cartão “ao vivo” de trace
  function getOrCreateLiveTraceCard() {
    const dock = (typeof ensureTraceDock === 'function') ? ensureTraceDock() : (function(){
      let d = document.getElementById('trace-dock');
      if (!d) {
        d = document.createElement('aside');
        d.id = 'trace-dock';
        d.style.cssText = 'position:fixed;left:16px;top:84px;bottom:16px;width:380px;max-width:42vw;background:#0f172a;color:#e2e8f0;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.08);overflow:hidden;z-index:99999;';
        d.innerHTML = `
          <header style="font-weight:700;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:8px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;"></span>
            <span>Raciocínio do Modelo</span>
          </header>
          <div class="trace-scroll" style="height:calc(100% - 48px);overflow:auto;padding:10px 10px 14px;"></div>
        `;
        document.body.appendChild(d);
      }
      return d;
    })();

    const scroll = dock.querySelector('.trace-scroll') || dock;

    let card = scroll.querySelector('.trace-live');
    if (!card) {
      card = document.createElement('div');
      card.className = 'trace-live';
      card.style.border = '1px solid rgba(255,255,255,.08)';
      card.style.borderRadius = '10px';
      card.style.background = '#0b1220';
      card.style.margin = '10px 0';
      card.style.boxShadow = '0 6px 24px rgba(0,0,0,.06)';
      card.innerHTML = `
        <details open>
          <summary style="cursor:pointer;padding:10px 12px;font-weight:600">👁️ Raciocínio (ao vivo)</summary>
          <section style="padding:6px 12px 12px">
            <div style="font-weight:600;margin:6px 0">Código Gerado</div>
            <pre data-slot="code" style="white-space:pre-wrap;overflow:auto;padding:8px;border-radius:6px;background:#101826;border:1px solid rgba(255,255,255,.06)"></pre>
            <div style="font-weight:600;margin:12px 0 6px">Saída do Código (print)</div>
            <pre data-slot="result" style="white-space:pre-wrap;overflow:auto;padding:8px;border-radius:6px;background:#101826;border:1px solid rgba(255,255,255,.06)"></pre>
            <div style="font-weight:600;margin:12px 0 6px">Resposta Final</div>
            <div data-slot="final" style="white-space:pre-wrap;overflow:auto;padding:8px;border-radius:6px;background:transparent"></div>
          </section>
        </details>
      `;
      scroll.insertBefore(card, scroll.firstChild);
      dock.style.display = 'block';
    }
    return {
      dock,
      codeEl: card.querySelector('[data-slot="code"]'),
      resultEl: card.querySelector('[data-slot="result"]'),
      finalEl: card.querySelector('[data-slot="final"]')
    };
  }

  // ====== FUNÇÕES DE STATUS ======
  function updateStatus() {
    const status = statusText.textContent;
    if (status === 'ONLINE') {
      statusBadge.classList.add('online');
    } else {
      statusBadge.classList.remove('online');
    }
  }

  // ====== FUNÇÕES DE MENSAGEM ======
  function addMessage(role, content) {
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = role === 'user' 
      ? '<i class="fas fa-user"></i>' 
      : '<i class="fas fa-robot"></i>';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';

    // Markdown básico
    let formattedContent = String(content || '')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, '<br>');

    bubbleDiv.innerHTML = formattedContent;

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    contentDiv.appendChild(bubbleDiv);
    contentDiv.appendChild(timeDiv);

    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
  }

  // ====== INDICADOR DE DIGITAÇÃO ======
  function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant typing-indicator';
    typingDiv.id = 'typing-indicator';

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = '<i class="fas fa-robot"></i>';

    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'typing-dots';
    dotsDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

    typingDiv.appendChild(avatarDiv);
    typingDiv.appendChild(dotsDiv);
    messagesDiv.appendChild(typingDiv);
    scrollToBottom();
  }

  function hideTyping() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  // ====== ENVIO DE MENSAGEM ======
  async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || sendBtn.disabled) return;

    addMessage('user', message);
    userInput.value = '';
    userInput.style.height = 'auto';

    sendBtn.disabled = true;
    sendBtn.classList.add('loading');
    sendBtn.innerHTML = '<span style="opacity:0">Enviando...</span>';
    showTyping();

    try {
      // usa ?debug=1 se estiver na URL (?debug=1, ?debug=true, ?debug=on)
      const dbg = (new URLSearchParams(location.search).get('debug') || '')
                    .toLowerCase();
      const wantDebug = ['1', 'true', 'on', 'yes'].includes(dbg);
      const url = `${CHATBOT_BASE}/chat${wantDebug ? '?debug=1' : ''}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(PROJETO ? { 'X-Projeto': PROJETO } : {})
        },
        body: JSON.stringify({ message, ...(wantDebug ? { debug: true } : {}) })
      });

      const ctype = res.headers.get('content-type') || '';
      if (!res.ok || !ctype.toLowerCase().includes('application/json')) {
        const txt = await res.text().catch(() => '');
        hideTyping();
        addMessage('assistant', `⚠️ Erro ${res.status}: não foi possível processar a resposta do servidor.`);
        console.error('Resposta não-JSON/erro:', res.status, txt);
      } else {
        const data = await res.json();
        hideTyping();
        if (data?.error) {
          addMessage('assistant', `⚠️ Erro: ${data.error}`);
        } else {
          addMessage('assistant', data?.reply ?? '(sem resposta)');
          if (data && data.trace) {
            // 👉 mostra o raciocínio logo abaixo da resposta do bot
            renderTrace(data.trace);
          }
        }
      }
    } catch (err) {
      hideTyping();
      addMessage('assistant', '⚠️ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
      console.error('Erro:', err);
    } finally {
      sendBtn.disabled = false;
      sendBtn.classList.remove('loading');
      sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar';
      userInput.focus();
    }
  }

  // ====== LIMPAR CHAT ======
  function clearChat() {
    if (!confirm('Tem certeza que deseja limpar toda a conversa?')) return;
    
    messagesDiv.innerHTML = '';
    const emptyStateClone = document.createElement('div');
    emptyStateClone.className = 'empty-state';
    emptyStateClone.id = 'empty-state';
    emptyStateClone.innerHTML = `
      <i class="fas fa-robot"></i>
      <h3>Olá! Como posso ajudar?</h3>
      <p>Faça perguntas sobre suas tarefas, projetos e documentos. Posso analisar dados, buscar informações e ajudar você a entender melhor seus processos.</p>
      <div class="suggestions">
        <button class="suggestion-chip" data-suggestion="Quantas tarefas críticas estão abertas?">
          <i class="fas fa-exclamation-triangle"></i> Tarefas críticas
        </button>
        <button class="suggestion-chip" data-suggestion="Liste todos os projetos">
          <i class="fas fa-project-diagram"></i> Ver projeto
        </button>
        <button class="suggestion-chip" data-suggestion="Quais tarefas estão próximas de vencer?">
          <i class="fas fa-calendar-alt"></i> Prazos próximos
        </button>
      </div>`;
    messagesDiv.appendChild(emptyStateClone);
    
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', function() {
        const suggestion = this.getAttribute('data-suggestion');
        if (suggestion) {
          userInput.value = suggestion;
          sendMessage();
        }
      });
    });
  }

  // ====== UTILITÁRIOS ======
  function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  // ====== BIND DE EVENTOS GERAIS ======
  function setupEventListeners() {
    // Botão de enviar
    sendBtn.addEventListener('click', sendMessage);

    // Enter para enviar (sem Shift)
    userInput.addEventListener('keypress', handleKeyPress);

    // Auto-resize do textarea
    userInput.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });

    // Botão de limpar chat
    clearChatBtn.addEventListener('click', clearChat);

    // Sugestões
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', function() {
        const suggestion = this.getAttribute('data-suggestion');
        if (suggestion) {
          userInput.value = suggestion;
          sendMessage();
        }
      });
    });

    // Botão Voltar → Supervisor
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        window.location.href = SUPERVISOR_URL;
      });
    }
  }
});
