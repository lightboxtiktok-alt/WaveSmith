// dataModel.js
// -----------------------------------------------------------
// Handles waveform point data, history (undo/redo), and import/export.
// This module is purely logical — no rendering or DOM manipulation.
// -----------------------------------------------------------

import { CONFIG } from './config.js';

// === Core Data Structures ===
export let points = [];        // waveform points [{ time, amplitude }]
let undoStack = [];            // stack of previous states
let redoStack = [];            // stack for redo
let copiedPoints = [];         // buffer for copy/paste

// === State Management ===
export function saveState() {
  undoStack.push(JSON.stringify(points));
  // Prevent unlimited memory growth
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0; // clear redo history on new change
}

export function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.stringify(points));
  points = JSON.parse(undoStack.pop());
}

export function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(points));
  points = JSON.parse(redoStack.pop());
}

// === Point Operations ===
export function setPoints(newPoints) {
  points = newPoints.map(p => ({ time: p.time, amplitude: p.amplitude }));
  saveState();
}

export function addPoint(time, amplitude) {
  points.push({ time, amplitude });
  points.sort((a, b) => a.time - b.time);
  saveState();
}

export function removePoints(toRemove) {
  const set = new Set(toRemove);
  points = points.filter(p => !set.has(p));
  saveState();
}

export function updatePoint(target, newValues) {
  const index = points.indexOf(target);
  if (index !== -1) {
    points[index] = { ...points[index], ...newValues };
    saveState();
  }
}

// === Copy / Paste ===
export function copyPoints(selectedPoints) {
  copiedPoints = selectedPoints.map(p => ({ ...p }));
}

export function pastePoints(offset = 0.1) {
  if (copiedPoints.length === 0) return [];
  const newPoints = copiedPoints.map(p => ({
    time: p.time + offset,
    amplitude: p.amplitude
  }));
  points.push(...newPoints);
  points.sort((a, b) => a.time - b.time);
  saveState();
  return newPoints;
}

// === Selection Utilities ===
export function selectAllPoints() {
  return points.slice();
}

// === Export / Import ===
export function exportToJSON() {
  return JSON.stringify(points, null, 2);
}

export function importFromJSON(jsonText) {
  try {
    const data = JSON.parse(jsonText);
    if (!Array.isArray(data)) throw new Error("Invalid JSON format");
    points = data.map(p => ({ time: +p.time, amplitude: +p.amplitude }));
    saveState();
  } catch (err) {
    console.error("Import failed:", err);
  }
}

// === Reset ===
export function clearAllPoints() {
  points = [];
  saveState();
}

// === Utilities ===
export function getPoints() {
  return points.map(p => ({ ...p })); // safe copy
}

// -----------------------------------------------------------
// DataModel class (alternative implementation)
// -----------------------------------------------------------
export class DataModel {
  constructor() {
    this.points = [];
    this.selectedPoints = new Set();
    this.selectedPoint = null;
    this.copiedPoints = [];
    this.undoStack = [];
    this.redoStack = [];
    this.duration = CONFIG.DEFAULT_DURATION || 10.0;
    this.zoom = CONFIG.DEFAULT_ZOOM || 10.0;
    this.pan = 0;
  }

  // Point management
  addPoint(time, amplitude) {
    this.saveState();
    this.points.push({ time, amplitude });
    this.points.sort((a, b) => a.time - b.time);
  }

  removePoints(pointsToRemove) {
    this.saveState();
    this.points = this.points.filter(p => !pointsToRemove.has(p));
  }

  updatePoint(point, newTime, newAmplitude) {
    point.time = newTime;
    point.amplitude = newAmplitude;
    this.points.sort((a, b) => a.time - b.time);
  }

  // Selection management
  selectPoint(point) {
    this.selectedPoints.clear();
    this.selectedPoint = point;
  }

  selectAllPoints() {
    this.selectedPoints = new Set(this.points);
    this.selectedPoint = null;
  }

  clearSelection() {
    this.selectedPoints.clear();
    this.selectedPoint = null;
  }

  // Clipboard operations
  copySelected() {
    this.copiedPoints = Array.from(this.selectedPoints).map(p => ({
      time: p.time,
      amplitude: p.amplitude,
    }));
  }

  pastePoints() {
    if (this.copiedPoints.length === 0) return;
    this.saveState();

    const lastPoint = this.points[this.points.length - 1];
    const startTime = lastPoint ? lastPoint.time : 0;
    const firstCopiedTime = this.copiedPoints[0].time;

    const newPoints = this.copiedPoints.map(p => ({
      time: startTime + (p.time - firstCopiedTime),
      amplitude: p.amplitude,
    }));

    this.points.push(...newPoints);
    this.selectedPoints = new Set(newPoints);
    this.points.sort((a, b) => a.time - b.time);
    return newPoints;
  }

  // Undo/Redo
  saveState() {
    this.undoStack.push(JSON.stringify(this.points));
    const maxUndo = CONFIG.MAX_UNDO || 20;
    if (this.undoStack.length > maxUndo) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(JSON.stringify(this.points));
    this.points = JSON.parse(this.undoStack.pop());
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(JSON.stringify(this.points));
    this.points = JSON.parse(this.redoStack.pop());
    return true;
  }

  // Data loading
  loadPoints(newPoints) {
    this.points = newPoints;
    this.clearSelection();
    this.undoStack = [];
    this.redoStack = [];
  }

  // Hash for change detection
  hash() {
    return JSON.stringify(this.points);
  }
}
