(function initializeMagicSoundUtils(globalObject) {
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizePercentage(value) {
        return clamp(Number(value) / 100, 0, 1);
    }

    function distance3d(point1, point2) {
        return Math.sqrt(
            Math.pow(point1.x - point2.x, 2) +
                Math.pow(point1.y - point2.y, 2) +
                Math.pow(point1.z - point2.z, 2)
        );
    }

    function areLandmarksWithinDistance(
        landmarks,
        landmarkIndexes,
        threshold,
        inclusive = true,
        referenceIndex = 0
    ) {
        const reference = landmarks[referenceIndex];
        return landmarkIndexes.every((landmarkIndex) => {
            const measuredDistance = distance3d(landmarks[landmarkIndex], reference);
            return inclusive ? measuredDistance <= threshold : measuredDistance < threshold;
        });
    }

    function areLandmarksBeyondDistance(
        landmarks,
        landmarkIndexes,
        threshold,
        inclusive = true,
        referenceIndex = 0
    ) {
        const reference = landmarks[referenceIndex];
        return landmarkIndexes.every((landmarkIndex) => {
            const measuredDistance = distance3d(landmarks[landmarkIndex], reference);
            return inclusive ? measuredDistance >= threshold : measuredDistance > threshold;
        });
    }

    function bindNumericInput(
        inputElement,
        outputElement,
        { formatValue = String, onChange = () => {} } = {}
    ) {
        if (!inputElement) return;

        inputElement.addEventListener('input', (event) => {
            const value = Number(event.target.value);
            if (onChange(value) === false) return;
            if (outputElement) {
                outputElement.textContent = formatValue(value);
            }
        });
    }

    globalObject.MagicSoundUtils = Object.freeze({
        clamp,
        normalizePercentage,
        distance3d,
        areLandmarksWithinDistance,
        areLandmarksBeyondDistance,
        bindNumericInput
    });
})(typeof window === 'undefined' ? globalThis : window);
