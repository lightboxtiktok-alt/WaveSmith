// Default config (fallback)
const DEFAULT_CONFIG = {
  PAN_WHEEL_SENSITIVITY: 600,
  PAN_MOUSE_SENSITIVITY: 1,
  ZOOM_SENSITIVITY: 0.001,
  ZOOM_MIN: 1,
  ZOOM_MAX: 10000,
  DEFAULT_DURATION: 10.0,
  DEFAULT_ZOOM: 10.0,
  MAX_UNDO: 50,
  POINT_HIT_RADIUS: 8,
  SELECTION_HIGHLIGHT_RADIUS: 6,
  MAX_AUDIO_IMPORT_DURATION: 5,
  AUDIO_EXPORT_BITRATE: 320,
  COLORS: {
    BG_TOP: '#141414',
    BG_BOTTOM: '#0a0a0a',
    GRID_MINOR: '#252525',
    GRID_MAJOR: '#404040',
    GRID_LABELS: '#808080',
    GRID_AMPLITUDE: '#333',
    WAVEFORM: '#00ffc8',
    POINT: '#ff0070',
    SELECTION: '#ff00ff80',
    SELECTION_BOX: '#ff00ff20'
  }
};

let CONFIG = { ...DEFAULT_CONFIG };

// Try to load from JSON
async function loadConfigFromJSON() {
  try {
    const response = await fetch('./config.json');
    if (response.ok) {
      const jsonConfig = await response.json();
      CONFIG = { ...DEFAULT_CONFIG, ...jsonConfig };
      console.log('✅ Config loaded from config.json');
    } else {
      console.warn('⚠️ config.json not found, using defaults');
    }
  } catch (error) {
    console.warn('⚠️ Could not load config.json, using defaults:', error.message);
  }
}

// Load config immediately
await loadConfigFromJSON();

export { CONFIG };