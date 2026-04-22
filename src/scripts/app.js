const cameraElement = document.getElementById('input_video');
const outputElement = document.getElementById('output_canvas');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusElement = document.getElementById('current-action');
const volumeControl = document.getElementById('volume');
const sensitivityControl = document.getElementById('sensitivity');
const effectsControl = document.getElementById('effects');
const recordBtn = document.getElementById('record-btn');
const clearBtn = document.getElementById('clear-btn');
const cameraStatus = document.getElementById('camera-status');

let soundInstrument = null;
const ctx = outputElement ? outputElement.getContext('2d') : null;
let camera = null;
let hands = null;
let cameraActive = false;
let isRecording = false;
let gestureCooldown = 500;
const lastGestures = {};

function initializeHands() {
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });
    hands.onResults(onHandResults);
}

function onHandResults(results) {
    if (!ctx || !outputElement) return;
    ctx.save();
    ctx.clearRect(0, 0, outputElement.width, outputElement.height);
    ctx.drawImage(results.image, 0, 0, outputElement.width, outputElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            const colors = ['#00FF00', '#FF66C4'];
            const color = colors[handIndex % colors.length];

            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color, lineWidth: 2 });
            drawLandmarks(ctx, landmarks, { color, lineWidth: 1, radius: 3 });
            detectGesture(landmarks, handIndex);
        });
    }

    ctx.restore();
}

function detectGesture(landmarks, handIndex) {
    const now = Date.now();
    const handKey = `hand_${handIndex}`;
    if (!lastGestures[handKey]) {
        lastGestures[handKey] = { gesture: null, time: 0 };
    }
    if (now - lastGestures[handKey].time < gestureCooldown) return;

    let gesture = null;
    if (isFist(landmarks)) gesture = 'fist';
    else if (isOpenHand(landmarks)) gesture = 'open_hand';
    else if (isPeaceSign(landmarks)) gesture = 'peace';
    else if (isThumbsUp(landmarks)) gesture = 'thumbs_up';
    else if (isPointing(landmarks)) gesture = 'pointing';

    if (gesture && gesture !== lastGestures[handKey].gesture && soundInstrument) {
        soundInstrument.playNote(gesture, Number(volumeControl.value) / 100);
        lastGestures[handKey] = { gesture, time: now };
        updateStatus(`Gesto detectado (Mano ${handIndex + 1}): ${getGestureName(gesture)}`);
    }
}

function isFist(landmarks) {
    const fingerTips = [8, 12, 16, 20];
    const wrist = landmarks[0];
    return fingerTips.every((tipIndex) => distance(landmarks[tipIndex], wrist) <= 0.2);
}

function isOpenHand(landmarks) {
    const fingerTips = [8, 12, 16, 20];
    const wrist = landmarks[0];
    return fingerTips.every((tipIndex) => distance(landmarks[tipIndex], wrist) >= 0.3);
}

function isPeaceSign(landmarks) {
    const wrist = landmarks[0];
    return (
        distance(landmarks[8], wrist) > 0.3 &&
        distance(landmarks[12], wrist) > 0.3 &&
        distance(landmarks[16], wrist) < 0.2 &&
        distance(landmarks[20], wrist) < 0.2
    );
}

function isThumbsUp(landmarks) {
    const wrist = landmarks[0];
    return (
        distance(landmarks[4], wrist) > 0.3 &&
        distance(landmarks[8], wrist) < 0.2 &&
        distance(landmarks[12], wrist) < 0.2 &&
        distance(landmarks[16], wrist) < 0.2 &&
        distance(landmarks[20], wrist) < 0.2
    );
}

function isPointing(landmarks) {
    const wrist = landmarks[0];
    return (
        distance(landmarks[8], wrist) > 0.3 &&
        distance(landmarks[12], wrist) < 0.2 &&
        distance(landmarks[16], wrist) < 0.2 &&
        distance(landmarks[20], wrist) < 0.2
    );
}

function distance(point1, point2) {
    return Math.sqrt(
        Math.pow(point1.x - point2.x, 2) +
            Math.pow(point1.y - point2.y, 2) +
            Math.pow(point1.z - point2.z, 2)
    );
}

function getGestureName(gesture) {
    const names = {
        fist: 'Puño cerrado',
        open_hand: 'Mano abierta',
        peace: 'Paz y amor',
        thumbs_up: 'Pulgar arriba',
        pointing: 'Señalar'
    };
    return names[gesture] || 'Desconocido';
}

async function startCamera() {
    if (!cameraElement || !hands) return;
    try {
        updateStatus('Iniciando cámara...');
        cameraActive = true;

        camera = new Camera(cameraElement, {
            onFrame: async () => {
                if (cameraActive) {
                    await hands.send({ image: cameraElement });
                }
            },
            width: 640,
            height: 480
        });

        await camera.start();
        startBtn.disabled = true;
        stopBtn.disabled = false;
        setCameraIndicator(true);
        updateStatus('Cámara activa - Realiza gestos con ambas manos');
    } catch (error) {
        console.error('Error al iniciar cámara:', error);
        setCameraIndicator(false);
        updateStatus('Error: No se pudo acceder a la cámara.');
    }
}

function stopCamera() {
    try {
        cameraActive = false;
        if (camera && typeof camera.stop === 'function') {
            camera.stop();
        }
        if (soundInstrument) {
            soundInstrument.stop();
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
        setCameraIndicator(false);
        updateStatus('Cámara detenida.');
    } catch (error) {
        console.error('stopCamera error:', error);
    }
}

function updateStatus(message) {
    if (!statusElement) return;
    const actionText = statusElement.querySelector('.action-text');
    if (actionText) {
        actionText.textContent = message;
    } else {
        statusElement.textContent = message;
    }
}

function setCameraIndicator(isActive) {
    if (!cameraStatus) return;
    cameraStatus.style.background = isActive ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 107, 139, 0.25)';
    const label = cameraStatus.querySelector('span');
    if (label) {
        label.textContent = isActive ? 'Cámara Activada' : 'Cámara Detenida';
    }
}

function selectInstrument(instrument, card) {
    document.querySelectorAll('.instrument-card').forEach((c) => c.classList.remove('active'));
    card.classList.add('active');
    soundInstrument.setInstrument(instrument);
    updateStatus(`Instrumento seleccionado: ${card.querySelector('.instrument-name').textContent}`);
}

function toggleRecording() {
    isRecording = !isRecording;
    if (!recordBtn) return;

    if (isRecording) {
        recordBtn.innerHTML = '<span class="btn-emoji">⏹️</span> Parar Grabación';
        recordBtn.style.background = 'linear-gradient(135deg, #FF6B8B, #FF8E53)';
        updateStatus('Grabando tu canción mágica...');
    } else {
        recordBtn.innerHTML = '<span class="btn-emoji">⏺️</span> Grabar Canción';
        recordBtn.style.background = 'linear-gradient(135deg, var(--success), #04A57D)';
        updateStatus('Grabación detenida.');
    }
}

function clearAll() {
    if (soundInstrument) {
        soundInstrument.stopAllSounds();
    }
    updateStatus('Todo limpiado. Listo para nueva magia.');
}

function setupUIEvents() {
    document.querySelectorAll('.instrument-card').forEach((card, index) => {
        card.addEventListener('click', () => selectInstrument(card.dataset.instrument, card));
        if (index === 0) card.classList.add('active');
    });

    volumeControl.addEventListener('input', (e) => {
        const value = Number(e.target.value);
        soundInstrument.setVolume(value);
        document.getElementById('volume-value').textContent = `${value}%`;
    });

    sensitivityControl.addEventListener('input', (e) => {
        const value = Number(e.target.value);
        gestureCooldown = 1100 - value * 100;
        document.getElementById('sensitivity-value').textContent = `${value}`;
    });

    effectsControl.addEventListener('change', (e) => {
        updateStatus(`Efecto seleccionado: ${e.target.options[e.target.selectedIndex].text}`);
    });

    startBtn.addEventListener('click', startCamera);
    stopBtn.addEventListener('click', stopCamera);
    recordBtn.addEventListener('click', toggleRecording);
    clearBtn.addEventListener('click', clearAll);
}

if (typeof HAND_CONNECTIONS === 'undefined') {
    window.HAND_CONNECTIONS = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8],
        [0, 9],
        [9, 10],
        [10, 11],
        [11, 12],
        [0, 13],
        [13, 14],
        [14, 15],
        [15, 16],
        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20]
    ];
}

document.addEventListener('DOMContentLoaded', () => {
    if (!cameraElement || !outputElement || !startBtn || !stopBtn) return;

    soundInstrument = new SoundInstrument();
    soundInstrument.setVolume(Number(volumeControl.value));
    initializeHands();
    setupUIEvents();
    setCameraIndicator(false);
    updateStatus("Listo para comenzar. Haz clic en 'Iniciar Cámara'.");
});
