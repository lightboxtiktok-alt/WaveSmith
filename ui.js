import { InteractionHandler } from './interaction.js';
import { FileIO } from './fileIO.js';
import { AudioEngine } from './audioEngine.js';

export class UI {
  constructor(dataModel, audioEngine, onRender) {
    this.dataModel = dataModel;
    this.audioEngine = audioEngine;
    this.onRender = onRender;
    this.setupButtons();
    this.setupModals();
  }

  setupButtons() {
    // Play button
    const playBtn = document.getElementById('playBtn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.audioEngine.play(this.dataModel.points, this.dataModel.duration);
      });
    }

    // Export button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        FileIO.exportToJSON(this.dataModel.points);
      });
    }

    // Load button
    const loadBtn = document.getElementById('loadBtn');
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', async e => {
          const file = e.target.files[0];
          if (file) {
            try {
              const points = await FileIO.loadFromJSON(file);
              this.dataModel.loadPoints(points);
              this.onRender();
            } catch (error) {
              console.error('Error loading JSON:', error);
            }
          }
        });
        input.click();
      });
    }

    // Import button
    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.wav, .mp3';
        input.addEventListener('change', async e => {
          const file = e.target.files[0];
          if (file) {
            this.showLoadingBar();
            try {
              const points = await FileIO.loadAudio(file);
              this.dataModel.loadPoints(points);
              this.onRender();
            } catch (error) {
              console.error('Error loading audio:', error);
            } finally {
              this.hideLoadingBar();
            }
          }
        });
        input.click();
      });
    }

    // Export audio button
    const exportAudioBtn = document.getElementById('exportAudioBtn');
    if (exportAudioBtn) {
      exportAudioBtn.addEventListener('click', () => {
        this.exportModal.style.display = 'flex';
      });
    }
  }

  setupModals() {
    // Export modal
    this.exportModal = document.createElement('div');
    this.exportModal.className = 'export-modal';
    this.exportModal.innerHTML = `
      <div class="export-modal-content">
        <h3>Export Audio</h3>
        <button class="export-option" data-format="wav">WAV</button>
        <button class="export-option" data-format="mp3">MP3 (320kbps)</button>
        <button class="export-cancel">Cancel</button>
      </div>
    `;
    document.body.appendChild(this.exportModal);

    this.exportModal.querySelector('.export-cancel').addEventListener('click', () => {
      this.exportModal.style.display = 'none';
    });

    this.exportModal.querySelectorAll('.export-option').forEach(button => {
      button.addEventListener('click', async () => {
        const format = button.dataset.format;
        this.exportModal.style.display = 'none';

        try {
          const buffer = this.audioEngine.generateBuffer(this.dataModel.points, this.dataModel.duration);

          if (format === 'wav') {
            await FileIO.exportToWav(buffer);
          } else if (format === 'mp3') {
            await FileIO.exportToMp3(buffer);
          }
        } catch (error) {
          console.error('Export failed:', error);
          alert('Export failed. See console for details.');
        }
      });
    });
  }

  showLoadingBar() {
    const bar = document.getElementById('loadingBar');
    if (bar) bar.style.display = 'block';
  }

  hideLoadingBar() {
    const bar = document.getElementById('loadingBar');
    if (bar) bar.style.display = 'none';
  }
}