const LANDMARK_COUNT = 21;
const NEAR = 0.1;
const FAR = 0.4;

/**
 * Builds a 21-point landmark list with the wrist at the origin. Any index listed
 * in `extendedTips` sits far from the wrist, every other point sits close to it.
 */
export function makeLandmarks(extendedTips = []) {
    const extended = new Set(extendedTips);
    return Array.from({ length: LANDMARK_COUNT }, (_, index) => {
        if (index === 0) return { x: 0, y: 0, z: 0 };
        return { x: extended.has(index) ? FAR : NEAR, y: 0, z: 0 };
    });
}

export const GESTURE_LANDMARKS = {
    fist: makeLandmarks([]),
    open_hand: makeLandmarks([8, 12, 16, 20]),
    peace: makeLandmarks([8, 12]),
    thumbs_up: makeLandmarks([4]),
    pointing: makeLandmarks([8]),
    // Between the fist and open-hand thresholds, so no rule matches.
    unknown: Array.from({ length: LANDMARK_COUNT }, (_, index) =>
        index === 0 ? { x: 0, y: 0, z: 0 } : { x: 0.25, y: 0, z: 0 }
    )
};
