// fileIO.js
// Handles export and import of waveform data or app state

import { CONFIG } from './config.js';
import { AudioEngine } from './audioEngine.js';

export class FileIO {
  // Export waveform data to JSON and trigger browser download
  static exportToJSON(points) {
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

  // Load waveform data from a JSON file
  static loadFromJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const points = JSON.parse(e.target.result);
          resolve(points);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  static async loadAudio(file) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const maxDuration = Math.min(audioBuffer.duration, CONFIG.MAX_AUDIO_IMPORT_DURATION);
    const sampleRate = audioBuffer.sampleRate;
    const points = [];

    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = Math.min(Math.floor(maxDuration * sampleRate), channelData.length);
    for (let i = 0; i < totalSamples; i++) {
      const sample = channelData[i];
      const time = i / sampleRate;
      points.push({ time, amplitude: sample });
    }

    return points.sort((a, b) => a.time - b.time);
  }

  static audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const samples = buffer.length;
    const dataSize = samples * blockAlign;
    const bufferLen = 44 + dataSize;
    const view = new DataView(new ArrayBuffer(bufferLen));

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    let pos = 44;
    for (let i = 0; i < samples; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = buffer.getChannelData(ch)[i];
        sample = Math.max(-1, Math.min(1, sample));
        const s = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(pos, Math.floor(s), true);
        pos += 2;
      }
    }

    return view.buffer;
  }

  static async exportToWav(audioBuffer) {
    const wavBuffer = this.audioBufferToWav(audioBuffer);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wavesmith_export.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  static async exportToMp3(audioBuffer) {
    if (typeof lamejs === 'undefined') {
      throw new Error('lamejs library not loaded. Include lame.min.js in your HTML.');
    }

    const mp3Encoder = new lamejs.Mp3Encoder(1, audioBuffer.sampleRate, CONFIG.AUDIO_EXPORT_BITRATE);
    const samples = audioBuffer.getChannelData(0);
    const mp3Data = [];

    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      int16Samples[i] = samples[i] < 0 ? samples[i] * 0x8000 : samples[i] * 0x7fff;
    }

    const blockSize = 1152;
    for (let i = 0; i < int16Samples.length; i += blockSize) {
      const chunk = int16Samples.subarray(i, i + blockSize);
      const mp3buf = mp3Encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }

    const end = mp3Encoder.flush();
    if (end.length > 0) mp3Data.push(end);

    const blob = new Blob(mp3Data, { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wavesmith_export.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
