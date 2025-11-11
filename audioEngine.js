// audioEngine.js
// Handles waveform-to-audio playback using the Web Audio API

import { points } from './dataModel.js';
import { CONFIG } from './config.js';

export class AudioEngine {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
    this.isPlaying = false;
    this.currentSource = null;
    this.cachedBuffer = null;
    this.lastPointsHash = '';
  }

  setVolume(value) {
    this.gainNode.gain.value = value;
  }

  hashPoints(points) {
    return JSON.stringify(points);
  }

  /**
   * Convert waveform points into an AudioBuffer
   * Each "point" is assumed to represent amplitude (-1..1)
   */
  generateBuffer(points, duration) {
    const totalTime = points[points.length - 1]?.time || duration;
    const bufferLength = Math.ceil(this.audioContext.sampleRate * totalTime);
    const buffer = this.audioContext.createBuffer(1, bufferLength, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferLength; i++) {
      const time = i / this.audioContext.sampleRate;
      // Find surrounding points for linear interpolation
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

    return buffer;
  }

  /**
   * Plays the waveform buffer once
   */
  play(points, duration) {
    if (this.isPlaying && this.currentSource) {
      this.currentSource.stop();
    }

    const currentHash = this.hashPoints(points);

    if (currentHash !== this.lastPointsHash || !this.cachedBuffer) {
      this.cachedBuffer = this.generateBuffer(points, duration);
      this.lastPointsHash = currentHash;
    }

    this.isPlaying = true;
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = this.cachedBuffer;
    this.currentSource.connect(this.gainNode);
    this.currentSource.onended = () => {
      this.isPlaying = false;
    };
    this.currentSource.start(0);
  }

  /**
   * Stops playback
   */
  stop() {
    if (this.currentSource) {
      this.currentSource.stop();
      this.isPlaying = false;
    }
  }
}
