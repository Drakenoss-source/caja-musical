const cameraElement = document.getElementById('input_video');
const outputElement = document.getElementById('output_canvas');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusElement = document.getElementById('current-action');
const volumeControl = document.getElementById('volume');
const sensitivityControl = document.getElementById('sensitivity');
const cameraStatus = document.getElementById('camera-status');

let soundInstrument = null;
const ctx = outputElement ? outputElement.getContext('2d') : null;
let camera = null;
let hands = null;
let cameraActive = false;
let gestureCooldown = 500;
const lastGestures = {};
const reportedErrors = new Set();

function reportError(context, error, userMessage) {
    console.error(`[${context}]`, error);
    if (userMessage) {
        updateStatus(userMessage);
    }
}

function reportErrorOnce(context, error, userMessage) {
    if (reportedErrors.has(context)) return;
    reportedErrors.add(context);
    reportError(context, error, userMessage);
}

function initializeHands() {
    if (typeof Hands !== 'function') {
        throw new Error('MediaPipe Hands no se cargo (revisa la conexion o el bloqueo del CDN).');
    }

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
    try {
        renderHandResults(results);
    } catch (error) {
        reportErrorOnce(
            'onHandResults',
            error,
            'Error al dibujar la deteccion de manos. Revisa la consola.'
        );
    }
}

function renderHandResults(results) {
    ctx.save();
    ctx.clearRect(0, 0, outputElement.width, outputElement.height);
    ctx.drawImage(results.image, 0, 0, outputElement.width, outputElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach((landmarks, handIndex) => {
            const colors = ['#00FF00', '#FF66C4'];
            const color = colors[handIndex % colors.length];

            if (typeof drawConnectors === 'function' && typeof drawLandmarks === 'function') {
                drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color, lineWidth: 2 });
                drawLandmarks(ctx, landmarks, { color, lineWidth: 1, radius: 3 });
            } else {
                reportErrorOnce(
                    'drawing_utils',
                    new Error('MediaPipe drawing_utils no se cargo.'),
                    'No se pudo cargar el dibujo de manos, pero el sonido sigue activo.'
                );
            }
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
        const volume = volumeControl ? Number(volumeControl.value) / 100 : undefined;
        try {
            soundInstrument.playNote(gesture, volume);
        } catch (error) {
            reportErrorOnce(
                'playNote',
                error,
                'No se pudo reproducir el sonido. Haz clic en la pagina para activar el audio.'
            );
            return;
        }
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
    if (!cameraElement) return;
    if (!hands) {
        updateStatus('Error: la deteccion de manos no esta disponible.');
        return;
    }
    if (typeof Camera !== 'function') {
        reportError(
            'startCamera',
            new Error('MediaPipe camera_utils no se cargo.'),
            'Error: no se pudo cargar la libreria de camara.'
        );
        return;
    }

    try {
        updateStatus('Iniciando cámara...');
        cameraActive = true;

        camera = new Camera(cameraElement, {
            onFrame: async () => {
                if (!cameraActive) return;
                try {
                    await hands.send({ image: cameraElement });
                } catch (error) {
                    reportErrorOnce(
                        'hands.send',
                        error,
                        'Error al procesar el video de la camara. Revisa la consola.'
                    );
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
        cameraActive = false;
        camera = null;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        setCameraIndicator(false);
        reportError('startCamera', error, `Error: No se pudo acceder a la cámara (${error.message}).`);
    }
}

function stopCamera() {
    cameraActive = false;
    let failure = null;

    try {
        if (camera && typeof camera.stop === 'function') {
            camera.stop();
        }
    } catch (error) {
        failure = error;
    }
    camera = null;

    startBtn.disabled = false;
    stopBtn.disabled = true;
    setCameraIndicator(false);

    if (failure) {
        reportError('stopCamera', failure, 'Cámara detenida con errores. Revisa la consola.');
        return;
    }
    updateStatus('Cámara detenida.');
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
    if (!soundInstrument) {
        updateStatus('Error: el motor de audio no esta disponible.');
        return;
    }

    try {
        soundInstrument.setInstrument(instrument);
    } catch (error) {
        reportError('selectInstrument', error, `Error: instrumento no disponible (${instrument}).`);
        return;
    }

    document.querySelectorAll('.instrument-card').forEach((c) => c.classList.remove('active'));
    card.classList.add('active');
    const name = card.querySelector('.instrument-name');
    updateStatus(`Instrumento seleccionado: ${name ? name.textContent : instrument}`);
}

function setupUIEvents() {
    document.querySelectorAll('.instrument-card').forEach((card, index) => {
        card.addEventListener('click', () => selectInstrument(card.dataset.instrument, card));
        if (index === 0) card.classList.add('active');
    });

    if (volumeControl) {
        volumeControl.addEventListener('input', (e) => {
            const value = Number(e.target.value);
            if (soundInstrument) {
                try {
                    soundInstrument.setVolume(value);
                } catch (error) {
                    reportError('setVolume', error, 'Error: volumen invalido.');
                    return;
                }
            }
            const display = document.getElementById('volume-value');
            if (display) display.textContent = `${value}%`;
        });
    }

    if (sensitivityControl) {
        sensitivityControl.addEventListener('input', (e) => {
            const value = Number(e.target.value);
            gestureCooldown = 1100 - value * 100;
            const display = document.getElementById('sensitivity-value');
            if (display) display.textContent = `${value}`;
        });
    }

    startBtn.addEventListener('click', () => {
        startCamera().catch((error) => {
            reportError('startCamera', error, 'Error inesperado al iniciar la cámara.');
        });
    });
    stopBtn.addEventListener('click', stopCamera);
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
    if (!cameraElement || !outputElement || !startBtn || !stopBtn) {
        reportError(
            'init',
            new Error('Faltan elementos requeridos en el DOM (video, canvas o botones).'),
            'Error: la pagina no se cargo correctamente.'
        );
        return;
    }

    try {
        soundInstrument = new SoundInstrument();
        if (volumeControl) {
            soundInstrument.setVolume(Number(volumeControl.value));
        }
    } catch (error) {
        reportError('init:audio', error, 'Error: no se pudo iniciar el motor de audio.');
    }

    try {
        initializeHands();
    } catch (error) {
        startBtn.disabled = true;
        reportError('init:hands', error, `Error: no se pudo iniciar la deteccion de manos (${error.message}).`);
    }

    setupUIEvents();
    setCameraIndicator(false);
    if (hands && soundInstrument) {
        updateStatus("Listo para comenzar. Haz clic en 'Iniciar Cámara'.");
    }
});
