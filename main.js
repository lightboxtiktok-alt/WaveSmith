// main.js
import { DataModel } from './dataModel.js';
import { CanvasRenderer } from './canvasRenderer.js';
import { InteractionHandler } from './interaction.js';
import { AudioEngine } from './audioEngine.js';
import { UI } from './ui.js';

console.log('✅ main.js loaded');

// Get DOM elements
const canvas = document.getElementById('waveCanvas');
const amplitudeLabelsEl = document.querySelector('.amplitude-labels');

console.log('Canvas:', canvas);
console.log('AmplitudeLabels:', amplitudeLabelsEl);

if (!canvas) {
  console.error('❌ Canvas element not found!');
}

// Initialize core modules
try {
  const dataModel = new DataModel();
  console.log('✅ DataModel initialized');

  const renderer = new CanvasRenderer(canvas, amplitudeLabelsEl);
  console.log('✅ CanvasRenderer initialized');

  const audioEngine = new AudioEngine();
  console.log('✅ AudioEngine initialized');

  // Render function
  function render() {
    console.log('Rendering...');
    const { box, start } = interactionHandler.getSelectionBoxState();
    const isCommandKey = interactionHandler.getIsCommandKey();
    renderer.draw(dataModel, box, start, isCommandKey);
  }

  // Initialize interaction handler with render callback
  const interactionHandler = new InteractionHandler(canvas, dataModel, renderer, render);
  console.log('✅ InteractionHandler initialized');

  // Initialize UI controller
  const ui = new UI(dataModel, audioEngine, render);
  console.log('✅ UI initialized');

  // Initial render
  render();
  console.log('✅ Initial render complete');
} catch (error) {
  console.error('❌ Initialization error:', error);
  console.error(error.stack);
}

// Hook up play button


// Hook up volume slider
const volumeSlider = document.createElement('input');
volumeSlider.type = 'range';
volumeSlider.min = 0;
volumeSlider.max = 1;
volumeSlider.step = 0.01;
volumeSlider.value = 1;
volumeSlider.className = 'volume-slider';
document.querySelector('.bar-content').appendChild(volumeSlider);
volumeSlider.addEventListener('input', () => {
  audioEngine.setVolume(volumeSlider.value);
});

// Hook up export/load buttons
const exportBtn = document.getElementById('exportBtn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
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
  });
}

const loadBtn = document.createElement('button');
loadBtn.innerText = 'Load';
loadBtn.className = 'icon-button';
document.querySelector('.bar-content').appendChild(loadBtn);
loadBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedPoints = JSON.parse(event.target.result);
        points.splice(0, points.length, ...loadedPoints);
        renderer.points = points;
        renderer.draw();
      } catch (error) {
        console.error('Error loading JSON:', error);
      }
    };
    reader.readAsText(file);
  });
  input.click();
});

const importBtn = document.getElementById('importBtn');
if (importBtn) {
  importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.wav, .mp3';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      document.getElementById('loadingBar').style.display = 'block';
      const loadingProgress = document.querySelector('.loading-progress');
      loadingProgress.style.width = '0%';

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async (event) => {
        const arrayBuffer = event.target.result;
        loadingProgress.style.width = '50%';

        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          loadingProgress.style.width = '100%';

          const maxDuration = Math.min(audioBuffer.duration, 5);
          const sampleRate = audioBuffer.sampleRate;
          points.splice(0, points.length); // Clear existing points

          for (let i = 0; i < maxDuration * sampleRate; i++) {
            const sample = audioBuffer.getChannelData(0)[i];
            const time = i / sampleRate;
            points.push({ time, amplitude: sample });
          }

          renderer.points = points;
          renderer.draw();
          document.getElementById('loadingBar').style.display = 'none';
        } catch (error) {
          console.error('Error decoding audio:', error);
          document.getElementById('loadingBar').style.display = 'none';
        }
      };

      reader.readAsArrayBuffer(file);
    });
    input.click();
  });
}

// Setup keyboard shortcuts
window.addEventListener('keydown', (e) => {
  const isCmd = e.metaKey || e.ctrlKey;

  if (isCmd && e.key === 'a') {
    e.preventDefault();
    selectedPoints = new Set(points);
    renderer.selectedPoints = selectedPoints;
    renderer.draw();
  }

  if (isCmd && e.key === 'c') {
    interaction.copiedPoints = Array.from(selectedPoints).map(p => ({
      time: p.time,
      amplitude: p.amplitude
    }));
    console.log('Copied:', interaction.copiedPoints);
  }

  if (isCmd && e.key === 'v' && interaction.copiedPoints && interaction.copiedPoints.length > 0) {
    e.preventDefault();
    const lastPoint = points[points.length - 1];
    const startTime = lastPoint ? lastPoint.time : 0;

    const newPoints = interaction.copiedPoints.map(p => ({
      time: startTime + (p.time - interaction.copiedPoints[0].time),
      amplitude: p.amplitude
    }));

    points.push(...newPoints);
    points.sort((a, b) => a.time - b.time);
    selectedPoints = new Set(newPoints);
    renderer.points = points;
    renderer.selectedPoints = selectedPoints;
    renderer.draw();
    console.log('Pasted:', newPoints);
  }

  if (isCmd && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    // Undo logic here
  }

  if (isCmd && e.shiftKey && e.key === 'z') {
    e.preventDefault();
    // Redo logic here
  }
});

// Request animation frame for continuous updates
function animate() {
  renderer.draw();
  requestAnimationFrame(animate);
}
animate();
