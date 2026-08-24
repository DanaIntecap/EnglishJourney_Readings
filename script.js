// =====================================================
// English Journey - Reading module
// =====================================================

let readings = [];
let currentReading = null;

// ---- RSVP state ----
let rsvpWords = [];
let rsvpIndex = 0;
let rsvpTimer = null;
let rsvpStartTime = null;
let rsvpElapsedBeforePause = 0;
let rsvpIsPlaying = false;

// ---- DOM refs ----
const selectNivel = document.getElementById('selectNivel');
const selectUnidad = document.getElementById('selectUnidad');
const selectLectura = document.getElementById('selectLectura');

const readingCard = document.getElementById('readingCard');
const badgeNivel = document.getElementById('badgeNivel');
const badgeUnidad = document.getElementById('badgeUnidad');
const badgeDificultad = document.getElementById('badgeDificultad');
const readingTitle = document.getElementById('readingTitle');
const readingImage = document.getElementById('readingImage');
const readingText = document.getElementById('readingText');
const btnListen = document.getElementById('btnListen');
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
// INIT
// =====================================================
init();

async function init() {
    try {
        const res = await fetch('readings.json');
        readings = await res.json();
        populateNiveles();
    } catch (err) {
        console.error('No se pudo cargar readings.json', err);
        alert('No se pudo cargar el archivo readings.json. Verifica que exista en el repositorio.');
    }
}

// =====================================================
// FILTROS EN CASCADA
// =====================================================
function populateNiveles() {
    const niveles = [...new Set(readings.map(r => r.nivel))].sort();
    fillSelect(selectNivel, niveles, 'Selecciona Nivel');
}

selectNivel.addEventListener('change', () => {
    resetCard();
    const nivel = selectNivel.value;

    selectUnidad.disabled = !nivel;
    selectLectura.disabled = true;
    fillSelect(selectLectura, [], 'Selecciona Lectura');

    if (!nivel) {
        fillSelect(selectUnidad, [], 'Selecciona Unidad');
        return;
    }

    // Unidades numéricas primero (ordenadas como número), luego texto (ej. "Midterm Review")
    const unidadesDelNivel = [...new Set(
        readings.filter(r => r.nivel === nivel).map(r => r.unidad)
    )];

    const numericas = unidadesDelNivel
        .filter(u => !isNaN(u))
        .sort((a, b) => Number(a) - Number(b));

    const textuales = unidadesDelNivel
        .filter(u => isNaN(u))
        .sort();

    fillSelect(selectUnidad, [...numericas, ...textuales], 'Selecciona Unidad', (u) => {
        return isNaN(u) ? u : `Unidad ${u}`;
    });
});

selectUnidad.addEventListener('change', () => {
    resetCard();
    const nivel = selectNivel.value;
    const unidad = selectUnidad.value;

    selectLectura.disabled = !unidad;

    if (!unidad) {
        fillSelect(selectLectura, [], 'Selecciona Lectura');
        return;
    }

    const lecturas = readings.filter(r => r.nivel === nivel && r.unidad === unidad);
    fillSelectByObject(selectLectura, lecturas, 'Selecciona Lectura');
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
        opt.textContent = item.titulo;
        selectEl.appendChild(opt);
    });
}

// =====================================================
// RENDER DE LA LECTURA
// =====================================================
function renderReading(data) {
    readingCard.classList.remove('hidden');

    badgeNivel.textContent = data.nivel;
    badgeUnidad.textContent = isNaN(data.unidad) ? data.unidad : `Unidad ${data.unidad}`;
    badgeDificultad.textContent = data.dificultad;

    readingTitle.textContent = data.titulo;

    readingImage.src = data.imagen;
    readingImage.alt = data.titulo;
    readingImage.onerror = () => { readingImage.style.display = 'none'; };
    readingImage.onload = () => { readingImage.style.display = 'block'; };

    readingText.innerHTML = data.texto;

    btnPdf.href = data.pdf;
    
// --- NUEVO: Ajustar velocidad automática según el nivel ---
    if (data.nivel === "A1.1" || data.dificultad === "Principiante") {
        rsvpSpeed.value = "60"; // O la velocidad lenta por defecto que prefieras
    } else {
        rsvpSpeed.value = "100"; // Valor estándar para otros niveles
    }
    // ---------------------------------------------------------
    stopRsvp();
    prepareRsvp(data.texto);

    renderQuiz(data);

    readingCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCard() {
    readingCard.classList.add('hidden');
    stopRsvp();
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

    const plainText = stripHtml(currentReading.texto);
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;

    window.speechSynthesis.speak(utterance);
});

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
    if (currentReading) prepareRsvp(currentReading.texto);
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
// =====================================================
function renderQuiz(data) {
    quizContainer.innerHTML = '';
    quizResult.classList.add('hidden');
    quizResult.textContent = '';

    let qIndex = 0;

    (data.preguntas_opcion_multiple || []).forEach(q => {
        qIndex++;
        quizContainer.appendChild(buildQuestionBlock(
            `mc-${qIndex}`,
            `${qIndex}. ${q.pregunta}`,
            q.opciones,
            q.correcta
        ));
    });

    (data.preguntas_vf || []).forEach(q => {
        qIndex++;
        quizContainer.appendChild(buildQuestionBlock(
            `vf-${qIndex}`,
            `${qIndex}. ${q.pregunta}`,
            ['True', 'False'],
            q.correcta ? 'True' : 'False'
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

    options.forEach((opt, i) => {
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
   Agregar este bloque a tu script.js existente.
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
  recognition.lang = "en-US";        // inglés, para practicar pronunciación
  recognition.continuous = true;    // no se detiene solo al terminar de hablar
  recognition.interimResults = true; // muestra texto mientras se habla

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
    // Recorremos todos los resultados acumulados en la sesión
    for (let i = 0; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript + " ";
    }
    speechResult.textContent = transcript.trim();

    // Nota: Como ahora es continuo, la validación final se hará 
    // cuando el usuario presione el botón de Stop para detenerlo manualmente.
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
  function compararConTexto(transcript) {
    // ⚠️ AJUSTAR: reemplaza "readingText.textContent" por la variable
    // o elemento donde tu script.js guarda el texto de la lectura actual.
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
