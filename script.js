// =====================================================
// English Journey - Reading module
// =====================================================

// ---- Enfoques pedagógicos (etiquetas válidas) ----
const FOCUS_CONTENT = 'Content & Comprehension';
const FOCUS_ORAL = 'Oral Fluency & Pronunciation';
const FOCUS_LIST = [FOCUS_CONTENT, FOCUS_ORAL];

let readings = [];
let currentReading = null;
let focusFilter = 'all'; // 'all' | FOCUS_CONTENT | FOCUS_ORAL

// ---- RSVP state ----
let rsvpWords = [];
let rsvpIndex = 0;
let rsvpTimer = null;
let rsvpStartTime = null;
let rsvpElapsedBeforePause = 0;
let rsvpIsPlaying = false;

// ---- TTS state ----
let speechChunks = [], speechChunkIndex = 0, speechPaused = false, speechToken = 0;

// ---- DOM refs ----
const selectEnfoque = document.getElementById('selectEnfoque');
const selectNivel = document.getElementById('selectNivel');
const selectUnidad = document.getElementById('selectUnidad');
const selectLectura = document.getElementById('selectLectura');

const readingCard = document.getElementById('readingCard');
const badgeNivel = document.getElementById('badgeNivel');
const badgeUnidad = document.getElementById('badgeUnidad');
const badgeDificultad = document.getElementById('badgeDificultad');
const focusChips = document.getElementById('focusChips');
const readingTitle = document.getElementById('readingTitle');
const readingImage = document.getElementById('readingImage');
const readingText = document.getElementById('readingText');
const btnListen = document.getElementById('btnListen');
const btnPauseSpeech = document.getElementById('btnPauseSpeech');
const btnStopSpeech = document.getElementById('btnStopSpeech');
const speechSeek = document.getElementById('speechSeek');
const speechPosition = document.getElementById('speechPosition');
const speechSpeed = document.getElementById('speechSpeed');
const btnPdf = document.getElementById('btnPdf');

const rsvpSpeed = document.getElementById('rsvpSpeed');
const btnPlay = document.getElementById('btnPlay');
const btnPause = document.getElementById('btnPause');
const btnRestart = document.getElementById('btnRestart');
const rsvpWordEl = document.getElementById('rsvpWord');
const rsvpProgressFill = document.getElementById('rsvpProgressFill');
const rsvpStats = document.getElementById('rsvpStats');

const quizContainer = document.getElementById('quizContainer');
const btnCheckAnswers = document.getElementById('btnCheckAnswers');
const quizResult = document.getElementById('quizResult');

// =====================================================
// PARSEO DE ETIQUETAS (skills_focus / tags)
// Acepta: ["A","B"]  |  "A; B"  |  "A"
// =====================================================
function canonicalFocus(label) {
    const s = String(label || '').trim().toLowerCase();
    if (!s) return null;
    if (s.startsWith('content') || s.includes('comprehension')) return FOCUS_CONTENT;
    if (s.startsWith('oral') || s.includes('fluency') || s.includes('pronunciation')) return FOCUS_ORAL;
    return null; // etiqueta desconocida: se ignora
}

function parseFocus(raw) {
    let list = [];
    if (Array.isArray(raw)) {
        list = raw;
    } else if (typeof raw === 'string') {
        list = raw.split(';');
    }
    const result = [];
    list.forEach(item => {
        const canon = canonicalFocus(item);
        if (canon && !result.includes(canon)) result.push(canon);
    });
    // Orden consistente: Content primero, luego Oral
    return FOCUS_LIST.filter(f => result.includes(f));
}

function normalizeReading(r) {
    return {
        ...r,
        _focus: parseFocus(r.skills_focus !== undefined ? r.skills_focus : r.tags)
    };
}

// =====================================================
// INIT
// =====================================================
async function init() {
    try {
        const res = await fetch('readings.json', { cache: 'no-store' });
        const data = await res.json();
        readings = data
            .filter(r => r.active !== false)
            .map(normalizeReading);
        populateNiveles();
    } catch (err) {
        console.error('No se pudo cargar readings.json', err);
        alert('No se pudo cargar el archivo readings.json. Verifica que exista en el repositorio.');
    }
}

// =====================================================
// FILTROS EN CASCADA (Enfoque + Nivel > Unidad > Lectura)
// =====================================================
function getVisibleReadings() {
    if (focusFilter === 'all') return readings;
    return readings.filter(r => r._focus.includes(focusFilter));
}

function populateNiveles() {
    const niveles = [...new Set(getVisibleReadings().map(r => r.sub_level))].sort();
    fillSelect(selectNivel, niveles, 'Selecciona Nivel');
}

function populateUnidades() {
    const nivel = selectNivel.value;
    selectUnidad.disabled = !nivel;
    selectLectura.disabled = true;
    fillSelect(selectLectura, [], 'Selecciona Lectura');

    if (!nivel) {
        fillSelect(selectUnidad, [], 'Selecciona Unidad');
        return;
    }

    const unidadesDelNivel = [...new Set(
        getVisibleReadings().filter(r => r.sub_level === nivel).map(r => String(r.unit))
    )];

    // Numéricas primero (orden numérico), luego texto (ej. "Midterm Review")
    const numericas = unidadesDelNivel
        .filter(u => !isNaN(u))
        .sort((a, b) => Number(a) - Number(b));
    const textuales = unidadesDelNivel
        .filter(u => isNaN(u))
        .sort();

    fillSelect(selectUnidad, [...numericas, ...textuales], 'Selecciona Unidad', (u) => {
        return isNaN(u) ? u : `Unidad ${u}`;
    });
}

function populateLecturas() {
    const nivel = selectNivel.value;
    const unidad = selectUnidad.value;

    selectLectura.disabled = !unidad;

    if (!unidad) {
        fillSelect(selectLectura, [], 'Selecciona Lectura');
        return;
    }

    const lecturas = getVisibleReadings().filter(
        r => r.sub_level === nivel && String(r.unit) === unidad
    );
    fillSelectByObject(selectLectura, lecturas, 'Selecciona Lectura');
}

function setIfExists(selectEl, value) {
    if (!value) return false;
    const exists = [...selectEl.options].some(o => o.value === value);
    if (exists) selectEl.value = value;
    return exists;
}

// Cambio de enfoque: reconstruye listas y conserva la selección si sigue disponible
selectEnfoque.addEventListener('change', () => {
    focusFilter = selectEnfoque.value || 'all';

    const prevNivel = selectNivel.value;
    const prevUnidad = selectUnidad.value;
    const prevLectura = selectLectura.value;

    populateNiveles();
    const nivelOk = setIfExists(selectNivel, prevNivel);

    populateUnidades();
    const unidadOk = nivelOk && setIfExists(selectUnidad, prevUnidad);

    populateLecturas();
    const lecturaOk = unidadOk && setIfExists(selectLectura, prevLectura);

    // Si la lectura abierta ya no cumple el filtro, se cierra la tarjeta
    if (!lecturaOk) resetCard();
});

selectNivel.addEventListener('change', () => {
    resetCard();
    populateUnidades();
});

selectUnidad.addEventListener('change', () => {
    resetCard();
    populateLecturas();
});

selectLectura.addEventListener('change', () => {
    const id = selectLectura.value;
    if (!id) {
        resetCard();
        return;
    }
    currentReading = readings.find(r => r.id === id);
    renderReading(currentReading);
});

function fillSelect(selectEl, values, placeholder, labelFn) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    values.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = labelFn ? labelFn(v) : v;
        selectEl.appendChild(opt);
    });
}

function fillSelectByObject(selectEl, items, placeholder) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.title;
        selectEl.appendChild(opt);
    });
}

// =====================================================
// RENDER DE LA LECTURA
// =====================================================
function renderFocusChips(focusArray) {
    focusChips.innerHTML = '';
    focusArray.forEach(f => {
        const chip = document.createElement('span');
        chip.className = 'focus-chip ' + (f === FOCUS_CONTENT ? 'focus-content' : 'focus-oral');
        chip.textContent = (f === FOCUS_CONTENT ? '📖 ' : '🎤 ') + f;
        focusChips.appendChild(chip);
    });
}

function renderReading(data) {
    readingCard.classList.remove('hidden');

    badgeNivel.textContent = data.sub_level;
    badgeUnidad.textContent = isNaN(data.unit) ? data.unit : `Unidad ${data.unit}`;
    badgeDificultad.textContent = data.difficulty;

    renderFocusChips(data._focus);

    readingTitle.textContent = data.title;

    readingImage.src = data.image || '';
    readingImage.alt = data.title;
    readingImage.onerror = () => { readingImage.style.display = 'none'; };
    readingImage.onload = () => { readingImage.style.display = 'block'; };

    readingText.innerHTML = data.text;

    // El PDF es opcional: solo se muestra si la lectura tiene el campo "pdf"
    if (data.pdf) {
        btnPdf.href = data.pdf;
        btnPdf.style.display = '';
    } else {
        btnPdf.removeAttribute('href');
        btnPdf.style.display = 'none';
    }

    // Velocidad automática según el nivel
    if (data.sub_level === 'A1.1') {
        rsvpSpeed.value = '60';
    } else {
        rsvpSpeed.value = '100';
    }

    stopRsvp();
    stopSpeech();
    prepareRsvp(data.text);

    renderQuiz(data);

    readingCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCard() {
    readingCard.classList.add('hidden');
    stopRsvp();
    stopSpeech();
    currentReading = null;
}

// =====================================================
// TTS - Text to Speech (temporal, hasta tener audio grabado)
// =====================================================
btnListen.addEventListener('click', () => {
    if (!currentReading) return;

    if (!('speechSynthesis' in window)) {
        alert('Tu navegador no soporta lectura por voz (Text-to-Speech).');
        return;
    }

    window.speechSynthesis.cancel();
    speechChunks = stripHtml(currentReading.text).split(/(?<=[.!?])\s+/).filter(Boolean);
    speechChunkIndex = 0; speechPaused = false;
    speechSeek.max = Math.max(0, speechChunks.length - 1); speechSeek.value = 0; speechSeek.disabled = false;
    btnPauseSpeech.disabled = false; btnStopSpeech.disabled = false; btnPauseSpeech.textContent = '⏸ Pausar';
    speakSpeechChunk();
});

function speakSpeechChunk() {
    if (speechChunkIndex >= speechChunks.length) { stopSpeech(); return; }
    const myToken = ++speechToken; // invalida callbacks de fragmentos cancelados
    speechPosition.textContent = `Fragmento ${speechChunkIndex + 1} de ${speechChunks.length}`;
    speechSeek.value = speechChunkIndex;
    const utterance = new SpeechSynthesisUtterance(speechChunks[speechChunkIndex]);
    utterance.lang = 'en-US';
    // Estimación a partir de una base de 150 WPM; la cadencia real depende de la voz instalada.
    const requestedWpm = Number(speechSpeed.value);
    utterance.rate = ([60, 80, 100, 150].includes(requestedWpm) ? requestedWpm : 100) / 150;
    utterance.onend = () => {
        if (myToken !== speechToken) return;
        if (!speechPaused) { speechChunkIndex++; speakSpeechChunk(); }
    };
    window.speechSynthesis.speak(utterance);
}
btnPauseSpeech.addEventListener('click', () => {
    if (speechPaused) { speechPaused = false; window.speechSynthesis.resume(); btnPauseSpeech.textContent = '⏸ Pausar'; }
    else { speechPaused = true; window.speechSynthesis.pause(); btnPauseSpeech.textContent = '▶ Reanudar'; }
});
btnStopSpeech.addEventListener('click', stopSpeech);
speechSeek.addEventListener('input', () => {
    speechChunkIndex = Number(speechSeek.value); speechPaused = false; window.speechSynthesis.cancel(); speakSpeechChunk();
});
function stopSpeech() {
    speechToken++; // evita que un onend pendiente inicie otro fragmento
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speechPaused = true; speechChunkIndex = 0;
    btnPauseSpeech.disabled = true; btnStopSpeech.disabled = true; speechSeek.disabled = true;
    btnPauseSpeech.textContent = '⏸ Pausar';
    speechPosition.textContent = `Fragmento 0 de ${speechChunks.length}`;
}

function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// =====================================================
// RSVP - Lector rápido palabra por palabra
// =====================================================
function prepareRsvp(html) {
    const plainText = stripHtml(html).replace(/\s+/g, ' ').trim();
    rsvpWords = plainText.split(' ');
    rsvpIndex = 0;
    rsvpElapsedBeforePause = 0;
    rsvpIsPlaying = false;
    rsvpWordEl.textContent = 'Presiona Play';
    rsvpProgressFill.style.width = '0%';
    updateRsvpStats();
}

btnPlay.addEventListener('click', () => {
    if (rsvpWords.length === 0) return;
    if (rsvpIndex >= rsvpWords.length) rsvpIndex = 0;

    rsvpIsPlaying = true;
    rsvpStartTime = Date.now();
    tickRsvp();
});

btnPause.addEventListener('click', () => {
    pauseRsvp();
});

btnRestart.addEventListener('click', () => {
    stopRsvp();
    if (currentReading) prepareRsvp(currentReading.text);
});

function tickRsvp() {
    clearTimeout(rsvpTimer);
    if (!rsvpIsPlaying || rsvpIndex >= rsvpWords.length) {
        if (rsvpIndex >= rsvpWords.length) {
            rsvpWordEl.textContent = '✔ Fin de la lectura';
            rsvpIsPlaying = false;
        }
        return;
    }

    const wpm = Number(rsvpSpeed.value);
    const msPerWord = 60000 / wpm;

    rsvpWordEl.textContent = rsvpWords[rsvpIndex];
    rsvpIndex++;
    updateRsvpStats();

    rsvpTimer = setTimeout(tickRsvp, msPerWord);
}

function pauseRsvp() {
    rsvpIsPlaying = false;
    clearTimeout(rsvpTimer);
    if (rsvpStartTime) {
        rsvpElapsedBeforePause += (Date.now() - rsvpStartTime);
    }
}

function stopRsvp() {
    rsvpIsPlaying = false;
    clearTimeout(rsvpTimer);
    rsvpIndex = 0;
    rsvpElapsedBeforePause = 0;
    rsvpWordEl.textContent = 'Presiona Play';
    rsvpProgressFill.style.width = '0%';
    rsvpStats.textContent = 'Palabra 0 de 0 · 0% completado · 00:00';
}

function updateRsvpStats() {
    const total = rsvpWords.length;
    const pct = total ? Math.round((rsvpIndex / total) * 100) : 0;
    rsvpProgressFill.style.width = pct + '%';

    let elapsedMs = rsvpElapsedBeforePause;
    if (rsvpIsPlaying && rsvpStartTime) {
        elapsedMs += (Date.now() - rsvpStartTime);
    }
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');

    rsvpStats.textContent = `Palabra ${rsvpIndex} de ${total} · ${pct}% completado · ${mm}:${ss}`;
}

// =====================================================
// PREGUNTAS DE COMPRENSIÓN
// multiple_choice: correct_answer = índice base 1
// true_false: correct_answer = "T" / "F"
// =====================================================
function renderQuiz(data) {
    quizContainer.innerHTML = '';
    quizResult.classList.add('hidden');
    quizResult.textContent = '';

    let qIndex = 0;

    (data.multiple_choice || []).forEach(q => {
        qIndex++;
        const options = q.options || [];
        const correctText = options[Number(q.correct_answer) - 1];
        quizContainer.appendChild(buildQuestionBlock(
            `mc-${qIndex}`,
            `${qIndex}. ${q.question}`,
            options,
            correctText
        ));
    });

    (data.true_false || []).forEach(q => {
        qIndex++;
        const ca = q.correct_answer;
        const isTrue = ca === true || String(ca).trim().toUpperCase() === 'T' || String(ca).trim().toLowerCase() === 'true';
        quizContainer.appendChild(buildQuestionBlock(
            `vf-${qIndex}`,
            `${qIndex}. ${q.statement}`,
            ['True', 'False'],
            isTrue ? 'True' : 'False'
        ));
    });
}

function buildQuestionBlock(name, questionText, options, correctValue) {
    const block = document.createElement('div');
    block.className = 'question-block';
    block.dataset.correct = correctValue;

    const qText = document.createElement('div');
    qText.className = 'question-text';
    qText.textContent = questionText;
    block.appendChild(qText);

    options.forEach((opt) => {
        const label = document.createElement('label');
        label.className = 'option-label';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = opt;
        input.style.marginRight = '8px';

        label.appendChild(input);
        label.appendChild(document.createTextNode(opt));
        block.appendChild(label);
    });

    return block;
}

btnCheckAnswers.addEventListener('click', () => {
    const blocks = quizContainer.querySelectorAll('.question-block');
    let correctCount = 0;

    blocks.forEach(block => {
        const correctValue = block.dataset.correct;
        const labels = block.querySelectorAll('.option-label');
        const selected = block.querySelector('input:checked');

        labels.forEach(label => {
            label.classList.remove('correct', 'incorrect');
            const input = label.querySelector('input');
            if (input.value === correctValue) {
                label.classList.add('correct');
            } else if (selected && input.value === selected.value) {
                label.classList.add('incorrect');
            }
        });

        if (selected && selected.value === correctValue) {
            correctCount++;
        }
    });

    const total = blocks.length;
    const pct = total ? Math.round((correctCount / total) * 100) : 0;

    quizResult.classList.remove('hidden');
    quizResult.textContent = `Puntaje: ${correctCount}/${total}  (${pct}%)`;
});

/* ============================================================
   Pronunciation Practice — Speech Recognition
   Requiere que el HTML tenga: #btnMic, #speechResult, #speechFeedback
   ============================================================ */

(function () {
  const btnMic = document.getElementById("btnMic");
  const speechResult = document.getElementById("speechResult");
  const speechFeedback = document.getElementById("speechFeedback");

  // 1) Verificar soporte del navegador
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    btnMic.disabled = true;
    btnMic.textContent = "🎤 No disponible en este navegador";
    return;
  }

  // 2) Configurar el reconocimiento
  const recognition = new SpeechRecognitionAPI();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;

  let isListening = false;

  // 3) Click del botón: iniciar / detener
  btnMic.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
      return;
    }

    speechResult.classList.remove("hidden");
    speechFeedback.classList.add("hidden");
    speechResult.textContent = "Escuchando...";

    recognition.start();
  });

  // 4) Cuando empieza a escuchar
  recognition.onstart = () => {
    isListening = true;
    btnMic.textContent = "⏹ Stop Recording";
  };

  // 5) Resultados en tiempo real (parciales y finales)
  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + " ";
    }
    speechResult.textContent = transcript.trim();
  };

  // 6) Cuando termina de escuchar (por silencio, error, o stop manual)
  recognition.onend = () => {
    isListening = false;
    btnMic.textContent = "🎤 Start Recording";
  };

  recognition.onerror = (event) => {
    isListening = false;
    btnMic.textContent = "🎤 Start Recording";
    speechResult.textContent = "No se detectó audio. Intenta de nuevo.";
    console.warn("Speech recognition error:", event.error);
  };

  // 7) Comparación simple entre lo escuchado y el texto de la lectura
  //    (igual que en tu versión: definida pero aún no se invoca)
  function compararConTexto(transcript) {
    const textoOriginal = document.getElementById("readingText").textContent;

    const limpiar = (str) =>
      str.toLowerCase().replace(/[.,!?"']/g, "").trim().split(/\s+/);

    const palabrasOriginal = limpiar(textoOriginal);
    const palabrasDichas = limpiar(transcript);

    let coincidencias = 0;
    palabrasDichas.forEach((palabra) => {
      if (palabrasOriginal.includes(palabra)) coincidencias++;
    });

    const porcentaje = palabrasOriginal.length
      ? Math.round((coincidencias / palabrasOriginal.length) * 100)
      : 0;

    speechFeedback.classList.remove("hidden");

    if (porcentaje >= 70) {
      speechFeedback.textContent = `✅ ¡Buen trabajo! Coincidencia: ${porcentaje}%`;
      speechFeedback.style.color = "#008D36";
    } else {
      speechFeedback.textContent = `🔁 Sigue practicando. Coincidencia: ${porcentaje}%`;
      speechFeedback.style.color = "#c0392b";
    }
  }
})();

// Se inicia al final para que todas las variables ya estén definidas
init();
