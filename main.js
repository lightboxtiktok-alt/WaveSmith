const canvas = document.getElementById('waveCanvas');
const ctx = canvas.getContext('2d');
const amplitudeLabels = document.querySelector('.amplitude-labels');
const exportBtn = document.getElementById('exportBtn');
const loadBtn = document.createElement('button');
loadBtn.innerText = 'Load';
loadBtn.className = 'icon-button';
document.querySelector('.bar-content').appendChild(loadBtn);
const importBtn = document.getElementById('importBtn');

// Sensitivity tuning (tweak these)
const PAN_WHEEL_SENSITIVITY = 600;     // larger = less sensitive horizontal wheel pan (default 200 before)
const PAN_MOUSE_SENSITIVITY = 1;    // multiply mouse-drag pan (1.0 = original, <1 = less pan)
const ZOOM_SENSITIVITY = 0.0010;       // controls zoom speed per wheel delta (smaller = slower)
const ZOOM_MIN = 1;
const ZOOM_MAX = 10000;

let duration = 10.0;        // total 10 s timeline
let zoom = 10.0;            // 10x → 1 s view by default
let pan = 0;
let points = [];
let draggingPoint = null;
let isDragging = false;
let lastX = 0;
let mouseDownTime = 0;
let dockHeight = 70;
let selectionBox = null;
let selectedPoints = new Set();
let selectionStart = { x: 0, y: 0 };
let isCommandKey = false;
let copiedPoints = [];
let lastY = 0;
let undoStack = [];
let redoStack = [];
let selectedPoint = null; // For single point selection
const MAX_UNDO = 20;



// Add new function to save state for undo
function saveState() {
  undoStack.push(JSON.stringify(points));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = []; // Clear redo stack on new action
}

// Add undo/redo functions
function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.stringify(points));
  points = JSON.parse(undoStack.pop());
  draw();
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(points));
  points = JSON.parse(redoStack.pop());
  draw();
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  draw();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Coordinate conversion ---
function visibleRange() { return duration / zoom; }
function timeToX(t) { return ((t - pan) / visibleRange()) * canvas.width; }
function xToTime(x) { return pan + (x / canvas.width) * visibleRange(); }
function amplitudeToY(a) { return canvas.height / 2 - a * (canvas.height / 2); }
function yToAmplitude(y) { return (canvas.height / 2 - y) / (canvas.height / 2); }

// --- Mouse ---
canvas.addEventListener('mousedown', e => {
  mouseDownTime = performance.now();

  if (!isCommandKey) {
    // Clear selection only if clicking empty space
    const clickedPoint = points.find(p =>
      Math.abs(timeToX(p.time) - e.offsetX) < 8 &&
      Math.abs(amplitudeToY(p.amplitude) - e.offsetY) < 8
    );
    
    if (!clickedPoint) {
      selectedPoints.clear();
      selectedPoint = null;
    } else if (!selectedPoints.has(clickedPoint)) {
      selectedPoints.clear();
      selectedPoint = clickedPoint;
    }
  }

  if (isCommandKey) {
    selectionStart = { x: e.offsetX, y: e.offsetY };
    selectionBox = { x: e.offsetX, y: e.offsetY, width: 0, height: 0 };
  } else {
    draggingPoint = points.find(p =>
      Math.abs(timeToX(p.time) - e.offsetX) < 8 &&
      Math.abs(amplitudeToY(p.amplitude) - e.offsetY) < 8
    );
    if (draggingPoint) saveState(); // Save state before moving points
  }

  isDragging = true;
  lastX = e.clientX;
  lastY = e.offsetY;
  draw();
});

window.addEventListener('mouseup', e => {
  const clickDuration = performance.now() - mouseDownTime;
  
  if (clickDuration < 200 && !draggingPoint && !isCommandKey) {
    saveState();
    const t = xToTime(e.offsetX);
    const a = yToAmplitude(e.offsetY);
    points.push({ time: t, amplitude: a });
    points.sort((a, b) => a.time - b.time);
  }
  
  // Clear selection box but keep points selected
  selectionBox = null;
  isDragging = false;
  draggingPoint = null;
  draw();
});

window.addEventListener('mousemove', e => {
  if (!isDragging) return;

  if (selectionBox && isCommandKey) {
    selectionBox.width = e.offsetX - selectionStart.x;
    selectionBox.height = e.offsetY - selectionStart.y;
    
    const left = Math.min(selectionStart.x, e.offsetX);
    const right = Math.max(selectionStart.x, e.offsetX);
    const top = Math.min(selectionStart.y, e.offsetY);
    const bottom = Math.max(selectionStart.y, e.offsetY);
    
    points.forEach(p => {
      const x = timeToX(p.time);
      const y = amplitudeToY(p.amplitude);
      if (x >= left && x <= right && y >= top && y <= bottom) {
        selectedPoints.add(p);
      }
    });
  } else if (draggingPoint) {
    const currentTime = xToTime(e.offsetX);
    const previousTime = xToTime(lastX);
    const dx = currentTime - previousTime;
    
    const currentAmp = yToAmplitude(e.offsetY);
    const previousAmp = yToAmplitude(lastY);
    const dy = currentAmp - previousAmp;
    
    if (selectedPoints.has(draggingPoint)) {
      // Check if any selected point would exceed bounds
      let canMove = true;
      const selectedArray = Array.from(selectedPoints);
      
      // Test move before applying
      for (const p of selectedArray) {
        const newTime = p.time + dx;
        const newAmp = p.amplitude + dy;
        
        if (newTime < 0 || newTime > duration || 
            newAmp < -1 || newAmp > 1) {
          canMove = false;
          break;
        }
      }
      
      // Only move if all points stay within bounds
      if (canMove) {
        selectedArray.forEach(p => {
          p.time += dx;
          p.amplitude += dy;
        });
      }
    } else {
      // Single point drag with bounds check
      const newTime = draggingPoint.time + dx;
      const newAmp = draggingPoint.amplitude + dy;
      
      if (newTime >= 0 && newTime <= duration &&
          newAmp >= -1 && newAmp <= 1) {
        draggingPoint.time = newTime;
        draggingPoint.amplitude = newAmp;
      }
    }
    
    points.sort((a, b) => a.time - b.time);
  } else {
    const dx = e.clientX - lastX;
    const visible = visibleRange();
    pan = Math.max(0, Math.min(duration - visible, 
      pan - dx / canvas.width * visible * PAN_MOUSE_SENSITIVITY));
  }
  
  lastX = e.offsetX; // Update to use offsetX instead of clientX
  lastY = e.offsetY;
  draw();
});

// --- Scroll / Zoom / Pan ---
canvas.addEventListener('wheel', e => {
  e.preventDefault();

  // Two-finger horizontal swipe on trackpad → pan
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    const visible = visibleRange();
    // use PAN_WHEEL_SENSITIVITY to adjust how far deltaX moves the timeline
    pan = Math.max(0, Math.min(duration - visible, pan + e.deltaX / PAN_WHEEL_SENSITIVITY * visible));
    draw();
    return;
  }

  // Otherwise vertical scroll → zoom
  // Use exponential mapping for smooth, continuous zoom and ZOOM_SENSITIVITY to tweak speed.
  const mxTime = xToTime(e.offsetX);
  const factor = Math.exp(-e.deltaY * ZOOM_SENSITIVITY); // scroll up (deltaY<0) -> factor>1 -> zoom in
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
  const visible = visibleRange();
  pan = Math.max(0, Math.min(duration - visible, mxTime - (e.offsetX / canvas.width) * visible));
  draw();
});

// --- Draw ---
function draw() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#141414');
  grad.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const visible = visibleRange();
  const majorStep = chooseStep(visible);
  const minorStep = majorStep / 5;

  // minor grid
  ctx.strokeStyle = '#252525';
  ctx.lineWidth = 1;
  for (let t = Math.floor(pan / minorStep) * minorStep; t < pan + visible; t += minorStep) {
    const x = timeToX(t);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }

  // major grid + labels
  ctx.strokeStyle = '#404040';
  ctx.fillStyle = '#808080';
  ctx.font = '10px monospace';
  for (let t = Math.floor(pan / majorStep) * majorStep; t < pan + visible; t += majorStep) {
    const x = timeToX(t);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    const label = (t >= 1) ? `${t.toFixed(3)}s` : `${(t * 1000).toFixed(1)} ms`;
    ctx.fillText(label, x + 2, 12);
  }

  // horizontal lines
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  for (let a = -1; a <= 1; a += 0.5) {
    const y = amplitudeToY(a);
    ctx.moveTo(0, y); ctx.lineTo(w, y);
  }
  ctx.stroke();

  const amps = [1, 0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75, -1];
  amplitudeLabels.innerHTML = amps
  .map(a => `<div class="amp-label">${a.toFixed(2)}</div>`)
  .join('');


  // waveform
  if (points.length > 0) {
    ctx.strokeStyle = '#00ffc8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = timeToX(p.time);
      const y = amplitudeToY(p.amplitude);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    points.forEach(p => {
      const x = timeToX(p.time);
      const y = amplitudeToY(p.amplitude);
      ctx.fillStyle = '#ff0070';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Draw selected point or points
  if (selectedPoint) {
    const x = timeToX(selectedPoint.time);
    const y = amplitudeToY(selectedPoint.amplitude);
    ctx.fillStyle = '#ff00ff80';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  
  selectedPoints.forEach(p => {
    const x = timeToX(p.time);
    const y = amplitudeToY(p.amplitude);
    ctx.fillStyle = '#ff00ff80';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Draw selection box only while actively selecting
  if (selectionBox && isCommandKey) {
    ctx.strokeStyle = '#ff00ff80';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      selectionStart.x,
      selectionStart.y,
      selectionBox.width,
      selectionBox.height
    );
    ctx.fillStyle = '#ff00ff20';
    ctx.fillRect(
      selectionStart.x,
      selectionStart.y,
      selectionBox.width,
      selectionBox.height
    );
  }
}

// choose step dynamically
function chooseStep(visible) {
  if (visible > 8) return 2;
  if (visible > 4) return 1;
  if (visible > 2) return 0.5;
  if (visible > 1) return 0.1;
  if (visible > 0.5) return 0.05;
  if (visible > 0.1) return 0.01;
  if (visible > 0.05) return 0.005;
  if (visible > 0.01) return 0.001;
  return 0.0005; // 0.5 ms
}

// Function to export points to JSON
function exportToJSON() {
  const json = JSON.stringify(points);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wave_points.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Function to load points from JSON
function loadFromJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const loadedPoints = JSON.parse(e.target.result);
      points = loadedPoints;
      draw();
    } catch (error) {
      console.error('Error loading JSON:', error);
    }
  };
  reader.readAsText(file);
}

// Function to load audio and convert to points
async function loadAudio(event) {
  const file = event.target.files[0];
  if (!file) return;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const reader = new FileReader();

  // Show loading bar
  document.getElementById('loadingBar').style.display = 'block';
  const loadingProgress = document.querySelector('.loading-progress');
  loadingProgress.style.width = '0%'; // Reset progress

  reader.onloadstart = function() {
    loadingProgress.style.width = '10%'; // Start loading
  };

  reader.onload = async function(e) {
    const arrayBuffer = e.target.result;
    loadingProgress.style.width = '50%'; // Halfway through loading

    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    loadingProgress.style.width = '100%'; // Finished loading

    // Process audio buffer to extract points
    const duration = Math.min(audioBuffer.duration, 5); // Limit to 5 seconds
    const sampleRate = audioBuffer.sampleRate;
    points = []; // Reset points array

    for (let i = 0; i < duration * sampleRate; i++) {
      const sample = audioBuffer.getChannelData(0)[i];
      const time = i / sampleRate;
      points.push({ time: time, amplitude: sample });
    }

    // Update points and redraw
    points = points.sort((a, b) => a.time - b.time);
    draw();

    // Hide loading bar after processing
    document.getElementById('loadingBar').style.display = 'none';
  };

  reader.onerror = function() {
    console.error('Error reading file');
    document.getElementById('loadingBar').style.display = 'none'; // Hide loading bar on error
  };

  reader.readAsArrayBuffer(file);
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);

const playBtn = document.createElement('button');
playBtn.innerText = '▶️';
playBtn.className = 'icon-button';
document.querySelector('.bar-content').appendChild(playBtn);

// Volume slider
const volumeSlider = document.createElement('input');
volumeSlider.type = 'range';
volumeSlider.min = 0;
volumeSlider.max = 1;
volumeSlider.step = 0.01;
volumeSlider.value = 1; // Default volume
volumeSlider.className = 'volume-slider';
document.querySelector('.bar-content').appendChild(volumeSlider);
gainNode.gain.value = volumeSlider.value;

volumeSlider.addEventListener('input', () => {
  gainNode.gain.value = volumeSlider.value;
});

// Function to play simulated audio
let isPlaying = false;
let currentSource = null;
let cachedBuffer = null;
let lastPointsHash = '';

// Add utility function to hash points array
function hashPoints(points) {
  return JSON.stringify(points);
}

// Update playAudio function with caching
function playAudio() {
  if (isPlaying && currentSource) {
    currentSource.stop();
  }

  const currentHash = hashPoints(points);

  if (currentHash !== lastPointsHash || !cachedBuffer) {
    // get actual waveform length from last point
    const totalTime = points[points.length - 1]?.time || 1;
    const bufferLength = Math.ceil(audioContext.sampleRate * totalTime);
    cachedBuffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = cachedBuffer.getChannelData(0);

    // generate interpolated waveform
    for (let i = 0; i < bufferLength; i++) {
      const time = i / audioContext.sampleRate; // actual seconds
      let nextIndex = points.findIndex(p => p.time > time);
      if (nextIndex === -1) nextIndex = points.length - 1;
      const prevIndex = Math.max(0, nextIndex - 1);

      const p1 = points[prevIndex];
      const p2 = points[nextIndex];

      let amplitude = 0;
      if (p1 && p2 && p2.time !== p1.time) {
        const t = (time - p1.time) / (p2.time - p1.time);
        amplitude = p1.amplitude + (p2.amplitude - p1.amplitude) * t;
      } else if (p1) {
        amplitude = p1.amplitude;
      }

      data[i] = amplitude;
    }

    lastPointsHash = currentHash;
  }

  isPlaying = true;
  currentSource = audioContext.createBufferSource();
  currentSource.buffer = cachedBuffer;
  currentSource.connect(gainNode);
  currentSource.onended = () => {
    isPlaying = false;
  };
  currentSource.start(0);
}


// Add export functionality
const exportAudioBtn = document.createElement('button');
exportAudioBtn.innerText = 'Export';
exportAudioBtn.className = 'icon-button';
document.querySelector('.bar-content').appendChild(exportAudioBtn);

// Add export modal HTML
const exportModal = document.createElement('div');
exportModal.className = 'export-modal';
exportModal.innerHTML = `
  <div class="export-modal-content">
    <h3>Export Audio</h3>
    <button class="export-option" data-format="wav">WAV</button>
    <button class="export-option" data-format="mp3">MP3 (320kbps)</button>
    <button class="export-cancel">Cancel</button>
  </div>
`;
document.body.appendChild(exportModal);

// Add export functions
async function exportToWav(audioBuffer) {
  const wav = await audioBufferToWav(audioBuffer);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wavesmith_export.wav';
  a.click();
  URL.revokeObjectURL(url);
}

async function exportToMp3(audioBuffer) {
  const mp3encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, 320);
  const samples = audioBuffer.getChannelData(0);
  const mp3Data = [];

  // Convert float32 to int16
  const int16Samples = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    int16Samples[i] = samples[i] * 32767;
  }

  const mp3buf = mp3encoder.encodeBuffer(int16Samples);
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }

  const end = mp3encoder.flush();
  if (end.length > 0) {
    mp3Data.push(end);
  }

  const blob = new Blob(mp3Data, { type: 'audio/mp3' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wavesmith_export.mp3';
  a.click();
  URL.revokeObjectURL(url);
}

// Add modal event listeners
exportAudioBtn.addEventListener('click', () => {
  exportModal.style.display = 'flex';
});

exportModal.querySelector('.export-cancel').addEventListener('click', () => {
  exportModal.style.display = 'none';
});

exportModal.querySelectorAll('.export-option').forEach(button => {
  button.addEventListener('click', async () => {
    const format = button.dataset.format;
    
    // Ensure we have the latest audio buffer
    if (!cachedBuffer) {
      const bufferLength = audioContext.sampleRate * duration;
      cachedBuffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
      const data = cachedBuffer.getChannelData(0);
      
      for (let i = 0; i < bufferLength; i++) {
        const time = (i / audioContext.sampleRate) * duration;
        const pointIndex = points.findIndex(p => p.time >= time);
        const amplitude = pointIndex === -1 ? 0 : points[pointIndex].amplitude;
        data[i] = amplitude;
      }
    }

    try {
      if (format === 'wav') {
        await exportToWav(cachedBuffer);
      } else if (format === 'mp3') {
        await exportToMp3(cachedBuffer);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }

    exportModal.style.display = 'none';
  });
});

// Event listener for play button
playBtn.addEventListener('click', playAudio);

// Event listeners
exportBtn.addEventListener('click', exportToJSON);
loadBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', loadFromJSON);
  input.click();
});
importBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.wav, .mp3';
  input.addEventListener('change', loadAudio);
  input.click();
});

// Add command key detection
window.addEventListener('keydown', e => {
  if (e.metaKey) isCommandKey = true;
  
  // Command+A: Select all points
  if (isCommandKey && e.key === 'a') {
    e.preventDefault(); // Prevent default browser select-all
    selectAllPoints();
    return;
  }
  
  // Command+C: Copy
  if (isCommandKey && e.key === 'c') {
    copiedPoints = Array.from(selectedPoints).map(p => ({
      time: p.time,
      amplitude: p.amplitude
    }));
  }
  
  // Command+V: Paste
  if (isCommandKey && e.key === 'v' && copiedPoints.length > 0) {
    saveState();
    const lastPoint = points[points.length - 1];
    const firstCopiedPoint = copiedPoints[0];
    const offset = lastPoint ? (lastPoint.time - firstCopiedPoint.time) : 0;
    
    const newPoints = copiedPoints.map(p => ({
      time: p.time + offset,
      amplitude: p.amplitude
    }));
    points.push(...newPoints);
    selectedPoints = new Set(newPoints);
    points.sort((a, b) => a.time - b.time);
    draw();
  }
  
  // Command+Z: Undo
  if (isCommandKey && !e.shiftKey && e.key === 'z') {
    undo();
  }
  
  // Command+Shift+Z: Redo
  if (isCommandKey && e.shiftKey && e.key === 'z') {
    redo();
  }
  
  // Delete: Remove selected points
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (selectedPoints.size > 0 || selectedPoint) {
      saveState();
      const pointsToRemove = selectedPoints.size > 0 ? selectedPoints : new Set([selectedPoint]);
      points = points.filter(p => !pointsToRemove.has(p));
      selectedPoints.clear();
      selectedPoint = null;
      draw();
    }
  }
});

window.addEventListener('keyup', e => {
  if (e.key === 'Meta') isCommandKey = false;
});

// Add after other variable declarations
function selectAllPoints() {
  selectedPoints = new Set(points);
  selectedPoint = null;
  draw();
}

// Update keydown event listener to add Command+A
window.addEventListener('keydown', e => {
  if (e.metaKey) isCommandKey = true;
  
  // Command+A: Select all points
  if (isCommandKey && e.key === 'a') {
    e.preventDefault(); // Prevent default browser select-all
    selectAllPoints();
    return;
  }
  
  // Command+C: Copy
  if (isCommandKey && e.key === 'c') {
    copiedPoints = Array.from(selectedPoints).map(p => ({
      time: p.time,
      amplitude: p.amplitude
    }));
  }
  
  // Command+V: Paste
  if (isCommandKey && e.key === 'v' && copiedPoints.length > 0) {
    saveState();
    const lastPoint = points[points.length - 1];
    const firstCopiedPoint = copiedPoints[0];
    const offset = lastPoint ? (lastPoint.time - firstCopiedPoint.time) : 0;
    
    const newPoints = copiedPoints.map(p => ({
      time: p.time + offset,
      amplitude: p.amplitude
    }));
    points.push(...newPoints);
    selectedPoints = new Set(newPoints);
    points.sort((a, b) => a.time - b.time);
    draw();
  }
  
  // Command+Z: Undo
  if (isCommandKey && !e.shiftKey && e.key === 'z') {
    undo();
  }
  
  // Command+Shift+Z: Redo
  if (isCommandKey && e.shiftKey && e.key === 'z') {
    redo();
  }
  
  // Delete: Remove selected points
  if (e.key === 'Backspace' || e.key === 'Delete') {
    if (selectedPoints.size > 0 || selectedPoint) {
      saveState();
      const pointsToRemove = selectedPoints.size > 0 ? selectedPoints : new Set([selectedPoint]);
      points = points.filter(p => !pointsToRemove.has(p));
      selectedPoints.clear();
      selectedPoint = null;
      draw();
    }
  }
});

window.addEventListener('keyup', e => {
  if (e.key === 'Meta') isCommandKey = false;
});
