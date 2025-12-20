/**
 * Player Configuration Constants
 * @module player/config
 */

export const PLAYER_CONFIG = {
  // Audio playback
  SKIP_DURATION: 3000, // 3 seconds in ms
  SPEED_MIN: 0.5,
  SPEED_MAX: 2.0,
  SPEED_STEP: 0.1,
  VOLUME_MIN: 0,
  VOLUME_MAX: 1,
  VOLUME_STEP: 0.01,
  DEFAULT_SPEED: 1.0,
  DEFAULT_VOLUME: 1.0,

  // Media endpoints
  MEDIA_ENDPOINT: "/media",

  // Responsive breakpoints
  MOBILE_SMALL: 400,
  MOBILE_MAX: 600,
  TABLET_MAX: 900,
  DESKTOP_MIN: 901,

  // Touch targets (MD3 minimum)
  MIN_TOUCH_TARGET: 44,

  // Player dimensions
  DESKTOP_PLAYER_MAX_WIDTH: 650,
  MOBILE_PLAYER_HEIGHT: 60,

  // Highlight colors
  HIGHLIGHT_COLOR: "rgba(255, 215, 0, 0.65)",

  // Keyboard shortcuts
  KEYS: {
    SPACE: " ",
    CTRL_SPACE: "Control+ ",
    CTRL_COMMA: "Control+,",
    CTRL_PERIOD: "Control+.",
  },

  // Timeouts
  TOOLTIP_DELAY: 200,
  COPY_FEEDBACK_DURATION: 2000,
  SCROLL_DEBOUNCE: 100,
};

export default PLAYER_CONFIG;
