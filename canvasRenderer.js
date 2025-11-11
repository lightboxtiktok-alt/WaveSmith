// canvasRenderer.js
// Responsible for drawing the waveform, axes, highlights, points, selection, and labels

import { CONFIG } from './config.js';

export class CanvasRenderer {
  constructor(canvas, amplitudeLabelsEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.amplitudeLabelsEl = amplitudeLabelsEl;
    this.setupResize();
  }

  setupResize() {
    window.addEventListener('resize', () => this.onResize());
    this.onResize();
  }

  onResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  // Coordinate conversion
  visibleRange(dataModel) {
    return dataModel.duration / dataModel.zoom;
  }

  timeToX(dataModel, t) {
    const visible = this.visibleRange(dataModel);
    return ((t - dataModel.pan) / visible) * this.canvas.width;
  }

  xToTime(dataModel, x) {
    const visible = this.visibleRange(dataModel);
    return dataModel.pan + (x / this.canvas.width) * visible;
  }

  amplitudeToY(a) {
    return this.canvas.height / 2 - a * (this.canvas.height / 2);
  }

  yToAmplitude(y) {
    return (this.canvas.height / 2 - y) / (this.canvas.height / 2);
  }

  chooseStep(visible) {
    if (visible > 8) return 2;
    if (visible > 4) return 1;
    if (visible > 2) return 0.5;
    if (visible > 1) return 0.1;
    if (visible > 0.5) return 0.05;
    if (visible > 0.1) return 0.01;
    if (visible > 0.05) return 0.005;
    if (visible > 0.01) return 0.001;
    return 0.0005;
  }

  pickPointAt(dataModel, x, y, tolerancePx = CONFIG.POINT_HIT_RADIUS) {
    return dataModel.points.find(
      p =>
        Math.abs(this.timeToX(dataModel, p.time) - x) < tolerancePx &&
        Math.abs(this.amplitudeToY(p.amplitude) - y) < tolerancePx
    );
  }

  clear() {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    const grad = this.ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, CONFIG.COLORS.BG_TOP);
    grad.addColorStop(1, CONFIG.COLORS.BG_BOTTOM);
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawGrid(dataModel) {
    const { width, height } = this.canvas;
    const visible = this.visibleRange(dataModel);
    const majorStep = this.chooseStep(visible);
    const minorStep = majorStep / 5;

    // Minor grid
    this.ctx.strokeStyle = CONFIG.COLORS.GRID_MINOR;
    this.ctx.lineWidth = 1;
    for (let t = Math.floor(dataModel.pan / minorStep) * minorStep; t < dataModel.pan + visible; t += minorStep) {
      const x = this.timeToX(dataModel, t);
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    // Major grid + labels
    this.ctx.strokeStyle = CONFIG.COLORS.GRID_MAJOR;
    this.ctx.fillStyle = CONFIG.COLORS.GRID_LABELS;
    this.ctx.font = '10px monospace';
    for (let t = Math.floor(dataModel.pan / majorStep) * majorStep; t < dataModel.pan + visible; t += majorStep) {
      const x = this.timeToX(dataModel, t);
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
      const label = t >= 1 ? `${t.toFixed(3)}s` : `${(t * 1000).toFixed(1)}ms`;
      this.ctx.fillText(label, x + 2, 12);
    }

    // Horizontal amplitude lines
    this.ctx.strokeStyle = CONFIG.COLORS.GRID_AMPLITUDE;
    this.ctx.beginPath();
    for (let a = -1; a <= 1; a += 0.5) {
      const y = this.amplitudeToY(a);
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
    }
    this.ctx.stroke();
  }

  drawWaveform(dataModel) {
    if (dataModel.points.length === 0) return;

    this.ctx.strokeStyle = CONFIG.COLORS.WAVEFORM;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    dataModel.points.forEach((p, i) => {
      const x = this.timeToX(dataModel, p.time);
      const y = this.amplitudeToY(p.amplitude);
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    this.ctx.stroke();

    // Point markers
    this.ctx.fillStyle = CONFIG.COLORS.POINT;
    dataModel.points.forEach(p => {
      const x = this.timeToX(dataModel, p.time);
      const y = this.amplitudeToY(p.amplitude);
      this.ctx.beginPath();
      this.ctx.arc(x, y, 4, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawSelection(dataModel) {
    if (dataModel.selectedPoint) {
      const x = this.timeToX(dataModel, dataModel.selectedPoint.time);
      const y = this.amplitudeToY(dataModel.selectedPoint.amplitude);
      this.ctx.fillStyle = CONFIG.COLORS.SELECTION;
      this.ctx.beginPath();
      this.ctx.arc(x, y, CONFIG.SELECTION_HIGHLIGHT_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
    }

    dataModel.selectedPoints.forEach(p => {
      const x = this.timeToX(dataModel, p.time);
      const y = this.amplitudeToY(p.amplitude);
      this.ctx.fillStyle = CONFIG.COLORS.SELECTION;
      this.ctx.beginPath();
      this.ctx.arc(x, y, CONFIG.SELECTION_HIGHLIGHT_RADIUS, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  drawSelectionBox(selectionBox, selectionStart, isCommandKey) {
    if (selectionBox && isCommandKey) {
      this.ctx.strokeStyle = CONFIG.COLORS.SELECTION;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(selectionStart.x, selectionStart.y, selectionBox.width, selectionBox.height);
      this.ctx.fillStyle = CONFIG.COLORS.SELECTION_BOX;
      this.ctx.fillRect(selectionStart.x, selectionStart.y, selectionBox.width, selectionBox.height);
    }
  }

  drawAmplitudeLabels() {
    if (!this.amplitudeLabelsEl) return;
    const amps = [1, 0.75, 0.5, 0.25, 0, -0.25, -0.5, -0.75, -1];
    this.amplitudeLabelsEl.innerHTML = amps.map(a => `<div class="amp-label">${a.toFixed(2)}</div>`).join('');
  }

  draw(dataModel, selectionBox, selectionStart, isCommandKey) {
    this.clear();
    this.drawGrid(dataModel);
    this.drawWaveform(dataModel);
    this.drawSelection(dataModel);
    this.drawSelectionBox(selectionBox, selectionStart, isCommandKey);
    this.drawAmplitudeLabels();
  }
}
