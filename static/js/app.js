/**
 * GPTB2B Chat — голосовой ввод + подключение к чату через вебхук (как ITSTorg)
 */
(function () {
  const WEBHOOK_URL = window.GPTB2B_WEBHOOK_URL || '';
  const STORAGE_KEY = 'gptb2bChatHistory';
  const WELCOME_BOT = 'Привет! Я — ИИ-ассистент, обученный на базе знаний <b>GPTB2B.ru</b>.<br><br>Я знаю всё о том, как обучить ИИ на ваших документах и настроить передачу лидов в Telegram.<br><br><b>Нажмите на микрофон</b> и спросите меня: «В чем преимущество RAG?»';

  const chatState = {
    chatHistory: [],
    isTyping: false,
    isListening: false,
    recognition: null
  };

  const messagesContainer = document.getElementById('chat-messages');
  const form = document.getElementById('ai-form');
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('send-btn');
  const voiceBtn = document.getElementById('voice-btn');
  const newChatBtn = document.getElementById('new-chat-btn') || document.getElementById('reset-chat');

  function getInitialHTML() {
    return `<div class="message-bot p-6 max-w-[85%] leading-relaxed shadow-lg"><p class="text-xs text-purple-400 font-black uppercase mb-2 tracking-widest">System Message</p><div class="message-content">${WELCOME_BOT}</div></div>`;
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const history = JSON.parse(raw);
      if (!Array.isArray(history) || history.length === 0) return false;
      chatState.chatHistory = history;
      return true;
    } catch (e) {
      console.warn('Ошибка загрузки истории чата:', e);
      return false;
    }
  }

  function saveHistory() {
    try {
      if (chatState.chatHistory.length > 20) {
        chatState.chatHistory = chatState.chatHistory.slice(-20);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chatState.chatHistory));
    } catch (e) {
      console.warn('Ошибка сохранения истории чата:', e);
    }
  }

  function renderHistory() {
    if (!messagesContainer) return;
    messagesContainer.innerHTML = '';
    chatState.chatHistory.forEach(function (msg) {
      if (msg.role === 'user') {
        addMessageDOM('user', msg.content, false);
      } else if (msg.role === 'assistant') {
        addMessageDOM('bot', msg.content, true, true);
      }
    });
    scrollToBottom();
  }

  function addMessageDOM(role, content, isHTML, noAnimate) {
    if (!messagesContainer) return null;
    const div = document.createElement('div');
    div.className = 'p-4 md:p-6 max-w-[85%] message-' + role + ' shadow-lg leading-relaxed';
    if (noAnimate) div.style.animation = 'none';
    const inner = document.createElement('div');
    inner.className = 'message-content';
    if (isHTML) inner.innerHTML = content; else inner.textContent = content;
    div.appendChild(inner);
    messagesContainer.appendChild(div);
    scrollToBottom();
    return div;
  }

  function showTypingIndicator() {
    if (chatState.isTyping || !messagesContainer) return;
    chatState.isTyping = true;
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = 'typing-indicator';
    div.innerHTML = '<span>AI печатает</span><div class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
    messagesContainer.appendChild(div);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
    chatState.isTyping = false;
  }

  function scrollToBottom() {
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function setLoading(loading) {
    if (sendBtn) sendBtn.style.opacity = loading ? '0.5' : '1';
    if (sendBtn) sendBtn.disabled = !!loading;
  }

  function initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      if (voiceBtn) voiceBtn.style.display = 'none';
      return;
    }
    chatState.recognition = new SpeechRec();
    chatState.recognition.continuous = false;
    chatState.recognition.interimResults = false;
    chatState.recognition.lang = 'ru-RU';

    chatState.recognition.onstart = function () {
      chatState.isListening = true;
      if (voiceBtn) voiceBtn.classList.add('mic-active');
      if (input) input.placeholder = 'Слушаю вас...';
    };

    chatState.recognition.onresult = function (event) {
      var transcript = event.results[0][0].transcript;
      if (input) {
        input.value = transcript;
        setTimeout(sendUserMessage, 500);
      }
    };

    chatState.recognition.onerror = function (event) {
      console.error('Ошибка распознавания речи:', event.error);
      if (event.error === 'not-allowed') {
        alert('Доступ к микрофону запрещён.\n\nКак включить:\n1. Нажмите на значок замка или камеры слева от адреса сайта\n2. Найдите «Микрофон» и выберите «Разрешить»\n3. Обновите страницу (F5) и нажмите на микрофон снова.');
      } else if (event.error === 'no-speech') {
        // Пользователь не сказал ничего — не показываем ошибку
      } else {
        alert('Не удалось распознать речь. Проверьте микрофон и попробуйте снова.');
      }
      stopListening();
    };

    chatState.recognition.onend = function () {
      stopListening();
    };

    if (voiceBtn) {
      voiceBtn.addEventListener('click', function () {
        if (chatState.isListening) {
          chatState.recognition.stop();
        } else {
          try {
            chatState.recognition.start();
          } catch (e) {
            console.error('Ошибка запуска распознавания:', e);
          }
        }
      });
    }
  }

  function stopListening() {
    chatState.isListening = false;
    if (voiceBtn) voiceBtn.classList.remove('mic-active');
    if (input) input.placeholder = 'Задайте вопрос ассистенту...';
  }

  function sendUserMessage() {
    var text = (input && input.value) ? input.value.trim() : '';
    if (!text) return;

    if (input) input.value = '';

    if (chatState.chatHistory.length === 0) {
      chatState.chatHistory.push({ role: 'assistant', content: WELCOME_BOT });
      addMessageDOM('bot', WELCOME_BOT, false, true);
    }

    chatState.chatHistory.push({ role: 'user', content: text });
    addMessageDOM('user', text, false);
    saveHistory();

    showTypingIndicator();
    setLoading(true);

    if (!WEBHOOK_URL) {
      hideTypingIndicator();
      setLoading(false);
      var errMsg = 'Не настроен вебхук чата. Укажите webhook_url в config.toml.';
      addMessageDOM('bot', errMsg, false);
      chatState.chatHistory.push({ role: 'assistant', content: errMsg });
      saveHistory();
      return;
    }

    fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ message: text, chatHistory: chatState.chatHistory })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        hideTypingIndicator();
        setLoading(false);
        var answer = data.answer || data.message || data.response || 'Нет ответа';
        addMessageDOM('bot', answer, true);
        chatState.chatHistory.push({ role: 'assistant', content: answer });
        saveHistory();
      })
      .catch(function (err) {
        hideTypingIndicator();
        setLoading(false);
        console.error('Ошибка чата:', err);
        var errMsg = 'Не удалось соединиться с сервером. Проверьте интернет или попробуйте позже.';
        if (err.message && err.message.indexOf('Failed to fetch') !== -1) {
          errMsg = 'Не удалось соединиться с сервером. Проверьте подключение к интернету.';
        }
        addMessageDOM('bot', errMsg, false);
        chatState.chatHistory.push({ role: 'assistant', content: errMsg });
        saveHistory();
      });
  }

  function newChat() {
    chatState.chatHistory = [];
    chatState.isTyping = false;
    hideTypingIndicator();
    stopListening();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    if (messagesContainer) messagesContainer.innerHTML = getInitialHTML();
    if (input) input.value = '';
    setLoading(false);
  }

  function init() {
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        sendUserMessage();
      });
    }
    if (newChatBtn) newChatBtn.addEventListener('click', newChat);

    if (loadHistory()) {
      renderHistory();
    } else {
      if (messagesContainer) messagesContainer.innerHTML = getInitialHTML();
    }

    initSpeechRecognition();
    if (input) input.focus();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
