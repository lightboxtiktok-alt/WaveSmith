import { CONFIG } from './config.js';

export class InteractionHandler {
  constructor(canvas, dataModel, renderer, onStateChange) {
    this.canvas = canvas;
    this.dataModel = dataModel;
    this.renderer = renderer;
    this.onStateChange = onStateChange;

    this.isDragging = false;
    this.draggingPoint = null;
    this.lastX = 0;
    this.lastY = 0;
    this.mouseDownTime = 0;
    this.isCommandKey = false;
    this.selectionBox = null;
    this.selectionStart = { x: 0, y: 0 };

    this.setupMouseEvents();
    this.setupKeyboardEvents();
  }

  setupMouseEvents() {
    this.canvas.addEventListener('mousedown', e => this.onMouseDown(e));
    window.addEventListener('mouseup', e => this.onMouseUp(e));
    window.addEventListener('mousemove', e => this.onMouseMove(e));
    this.canvas.addEventListener('wheel', e => this.onWheel(e));
  }

  setupKeyboardEvents() {
    window.addEventListener('keydown', e => this.onKeyDown(e));
    window.addEventListener('keyup', e => this.onKeyUp(e));
  }

  onMouseDown(e) {
    this.mouseDownTime = performance.now();

    if (!this.isCommandKey) {
      const clickedPoint = this.renderer.pickPointAt(this.dataModel, e.offsetX, e.offsetY, CONFIG.POINT_HIT_RADIUS);
      if (!clickedPoint) {
        this.dataModel.clearSelection();
      } else if (!this.dataModel.selectedPoints.has(clickedPoint)) {
        this.dataModel.selectPoint(clickedPoint);
      }
    }

    if (this.isCommandKey) {
      this.selectionStart = { x: e.offsetX, y: e.offsetY };
      this.selectionBox = { x: e.offsetX, y: e.offsetY, width: 0, height: 0 };
    } else {
      this.draggingPoint = this.renderer.pickPointAt(this.dataModel, e.offsetX, e.offsetY, CONFIG.POINT_HIT_RADIUS);
      if (this.draggingPoint) {
        this.dataModel.saveState();
      }
    }

    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.offsetY;
    this.onStateChange();
  }

  onMouseUp(e) {
    const clickDuration = performance.now() - this.mouseDownTime;

    if (clickDuration < 200 && !this.draggingPoint && !this.isCommandKey) {
      const t = this.renderer.xToTime(this.dataModel, e.offsetX);
      const a = this.renderer.yToAmplitude(e.offsetY);
      this.dataModel.addPoint(t, a);
    }

    this.selectionBox = null;
    this.isDragging = false;
    this.draggingPoint = null;
    this.onStateChange();
  }

  onMouseMove(e) {
    if (!this.isDragging) return;

    if (this.selectionBox && this.isCommandKey) {
      this.selectionBox.width = e.offsetX - this.selectionStart.x;
      this.selectionBox.height = e.offsetY - this.selectionStart.y;

      const left = Math.min(this.selectionStart.x, e.offsetX);
      const right = Math.max(this.selectionStart.x, e.offsetX);
      const top = Math.min(this.selectionStart.y, e.offsetY);
      const bottom = Math.max(this.selectionStart.y, e.offsetY);

      this.dataModel.points.forEach(p => {
        const x = this.renderer.timeToX(this.dataModel, p.time);
        const y = this.renderer.amplitudeToY(p.amplitude);
        if (x >= left && x <= right && y >= top && y <= bottom) {
          this.dataModel.selectedPoints.add(p);
        }
      });
    } else if (this.draggingPoint) {
      this.dragPoints(e);
    } else {
      this.panCanvas(e);
    }

    this.lastX = e.offsetX;
    this.lastY = e.offsetY;
    this.onStateChange();
  }

  dragPoints(e) {
    const currentTime = this.renderer.xToTime(this.dataModel, e.offsetX);
    const previousTime = this.renderer.xToTime(this.dataModel, this.lastX);
    const dx = currentTime - previousTime;

    const currentAmp = this.renderer.yToAmplitude(e.offsetY);
    const previousAmp = this.renderer.yToAmplitude(this.lastY);
    const dy = currentAmp - previousAmp;

    if (this.dataModel.selectedPoints.has(this.draggingPoint)) {
      let canMove = true;
      const selectedArray = Array.from(this.dataModel.selectedPoints);

      for (const p of selectedArray) {
        const newTime = p.time + dx;
        const newAmp = p.amplitude + dy;

        if (newTime < 0 || newTime > this.dataModel.duration || newAmp < -1 || newAmp > 1) {
          canMove = false;
          break;
        }
      }

      if (canMove) {
        selectedArray.forEach(p => {
          p.time += dx;
          p.amplitude += dy;
        });
      }
    } else {
      const newTime = this.draggingPoint.time + dx;
      const newAmp = this.draggingPoint.amplitude + dy;

      if (newTime >= 0 && newTime <= this.dataModel.duration && newAmp >= -1 && newAmp <= 1) {
        this.draggingPoint.time = newTime;
        this.draggingPoint.amplitude = newAmp;
      }
    }

    this.dataModel.points.sort((a, b) => a.time - b.time);
  }

  panCanvas(e) {
    const dx = e.clientX - this.lastX;
    const visible = this.renderer.visibleRange(this.dataModel);
    this.dataModel.pan = Math.max(
      0,
      Math.min(
        this.dataModel.duration - visible,
        this.dataModel.pan - (dx / this.canvas.width) * visible * CONFIG.PAN_MOUSE_SENSITIVITY
      )
    );
  }

  onWheel(e) {
    e.preventDefault();

    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // Horizontal pan
      const visible = this.renderer.visibleRange(this.dataModel);
      this.dataModel.pan = Math.max(
        0,
        Math.min(
          this.dataModel.duration - visible,
          this.dataModel.pan + (e.deltaX / CONFIG.PAN_WHEEL_SENSITIVITY) * visible
        )
      );
    } else {
      // Vertical zoom
      const mxTime = this.renderer.xToTime(this.dataModel, e.offsetX);
      const factor = Math.exp(-e.deltaY * CONFIG.ZOOM_SENSITIVITY);
      this.dataModel.zoom = Math.max(CONFIG.ZOOM_MIN, Math.min(CONFIG.ZOOM_MAX, this.dataModel.zoom * factor));
      const visible = this.renderer.visibleRange(this.dataModel);
      this.dataModel.pan = Math.max(
        0,
        Math.min(
          this.dataModel.duration - visible,
          mxTime - (e.offsetX / this.canvas.width) * visible
        )
      );
    }

    this.onStateChange();
  }

  onKeyDown(e) {
    if (e.metaKey || e.ctrlKey) {
      this.isCommandKey = true;

      if (e.key === 'a') {
        e.preventDefault();
        this.dataModel.selectAllPoints();
        this.onStateChange();
        return;
      }

      if (e.key === 'c') {
        this.dataModel.copySelected();
        return;
      }

      if (e.key === 'v') {
        e.preventDefault();
        this.dataModel.pastePoints();
        this.onStateChange();
        return;
      }

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.dataModel.undo();
        this.onStateChange();
        return;
      }

      if (e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        this.dataModel.redo();
        this.onStateChange();
        return;
      }
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (this.dataModel.selectedPoints.size > 0 || this.dataModel.selectedPoint) {
        this.dataModel.removePoints(
          this.dataModel.selectedPoints.size > 0 ? this.dataModel.selectedPoints : new Set([this.dataModel.selectedPoint])
        );
        this.dataModel.clearSelection();
        this.onStateChange();
      }
    }
  }

  onKeyUp(e) {
    if (e.key === 'Meta' || e.key === 'Control') {
      this.isCommandKey = false;
    }
  }

  getSelectionBoxState() {
    return { box: this.selectionBox, start: this.selectionStart };
  }

  getIsCommandKey() {
    return this.isCommandKey;
  }
}