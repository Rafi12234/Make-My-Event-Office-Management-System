import { Dimensions, useWindowDimensions } from 'react-native';

// Design reference size (standard phone) that all fixed pt values in the
// app's StyleSheets were originally tuned against.
const GUIDELINE_BASE_WIDTH = 375;
const GUIDELINE_BASE_HEIGHT = 812;

// Shortest device side at/above this is treated as a tablet (matches the
// common iPad mini / 7" Android tablet breakpoint).
export const TABLET_MIN_WIDTH = 700;

// Content is capped at this width on large screens/tablets so text lines,
// inputs, and buttons stay a comfortable size instead of stretching
// edge-to-edge across the whole display.
export const MAX_CONTENT_WIDTH = 640;

const { width: INITIAL_WIDTH, height: INITIAL_HEIGHT } = Dimensions.get('window');

// Static snapshot of the screen size, for one-off layout math (e.g. capping
// a modal's inner list height) where a live hook isn't practical.
export const SCREEN_WIDTH = INITIAL_WIDTH;
export const SCREEN_HEIGHT = INITIAL_HEIGHT;

// ── Custom width-based scaling is DISABLED (2026-08-28) ──
// Confirmed via device testing (Android Display Size 350/449/550 +
// a diagnostic overlay) that the width-based moderateScale/scale formula
// itself was the cause of text/cards getting clipped at non-default
// display densities — NOT ScreenContainer, NOT Expo Go, NOT individual
// component flexbox styles. Flexbox (flex/percent/gap) already makes this
// app adapt correctly across phone sizes on its own; scaling font/spacing
// by width on top of that pushed row layouts (badges, header buttons,
// summary cards) past the available width at certain densities. Kept as a
// no-op passthrough rather than deleted so call sites don't need touching.
function scaleFor(width, size) {
  return size;
}

function moderateScaleFor(width, size, factor = 0.5) {
  return size;
}

/** Static helpers for use outside components (e.g. StyleSheet.create at module scope). */
export const scale = (size) => scaleFor(INITIAL_WIDTH, size);
export const verticalScale = (size) => (INITIAL_HEIGHT / GUIDELINE_BASE_HEIGHT) * size;
export const moderateScale = (size, factor = 0.5) => moderateScaleFor(INITIAL_WIDTH, size, factor);
export const isTablet = Math.min(INITIAL_WIDTH, INITIAL_HEIGHT) >= TABLET_MIN_WIDTH;

/**
 * Live screen-size info so components can react as the window changes
 * (rotation, split-screen, or simply running on a phone vs a tablet).
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);

  return {
    width,
    height,
    isTablet: shortestSide >= TABLET_MIN_WIDTH,
    isLandscape: width > height,
    scale: (size) => scaleFor(width, size),
    moderateScale: (size, factor = 0.5) => moderateScaleFor(width, size, factor),
  };
}
