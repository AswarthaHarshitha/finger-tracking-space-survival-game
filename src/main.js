// Main Application Entrypoint and Bootstrapper
import { HandTracker } from './hand-tracker.js';
import { GameEngine, GAME_STATES } from './game-engine.js';
import { audio } from './audio.js';

document.addEventListener('DOMContentLoaded', () => {
    // DOM Selectors
    const video = document.getElementById('webcam-video');
    const canvas = document.getElementById('game-canvas');
    
    // Screens/Overlays
    const loadingOverlay = document.getElementById('loading-overlay');
    const progressFill = document.getElementById('loading-progress');
    const loadingStatus = document.getElementById('loading-status');
    const errorOverlay = document.getElementById('error-overlay');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-camera-btn');
    const startScreen = document.getElementById('start-screen');
    
    // Previewers
    const startVideo = document.getElementById('start-preview-video');
    const startCanvas = document.getElementById('start-preview-canvas');
    const startStatus = document.getElementById('start-preview-status');
    
    const hudVideo = document.getElementById('hud-pip-video');
    const hudCanvas = document.getElementById('hud-pip-canvas');
    
    // Control Buttons
    const startGameBtn = document.getElementById('start-game-btn');
    const restartGameBtn = document.getElementById('restart-game-btn');
    const resumeGameBtn = document.getElementById('resume-game-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const muteBtn = document.getElementById('mute-btn');
    
    const soundOnIcon = document.getElementById('sound-on-icon');
    const soundOffIcon = document.getElementById('sound-off-icon');

    // Make sure preview canvases match display dimensions
    startCanvas.width = 180;
    startCanvas.height = 135;
    hudCanvas.width = 120;
    hudCanvas.height = 90;

    // Instantiate engine and hand tracker
    const engine = new GameEngine(canvas);
    const tracker = new HandTracker();
    engine.registerTracker(tracker);

    /**
     * Update loading bar progress
     */
    function updateLoadingProgress(percent, text) {
        progressFill.style.width = `${percent}%`;
        loadingStatus.innerText = text;
    }

    /**
     * Start hand-tracking configuration
     */
    async function startSensorSuite() {
        loadingOverlay.classList.remove('hidden');
        errorOverlay.classList.add('hidden');
        startScreen.classList.add('hidden');
        startGameBtn.disabled = true;

        try {
            // Point the start video preview element to our shared webcam feed
            // MediaPipe Hands will capture from it. We mirror startVideo and hudVideo in CSS.
            tracker.onLoaded = () => {
                loadingOverlay.classList.add('hidden');
                startScreen.classList.remove('hidden');
                
                // Set stream sources for preview displays
                if (video.srcObject) {
                    startVideo.srcObject = video.srcObject;
                    hudVideo.srcObject = video.srcObject;
                }
            };

            // Register tracker events
            tracker.onTrackingActive = () => {
                startGameBtn.disabled = false;
                startGameBtn.innerText = "LAUNCH MISSION";
                startStatus.innerText = "Target tracking locked.";
                startStatus.style.color = '#39ff14'; // neon green
            };

            tracker.onTrackingLost = () => {
                if (engine.state === GAME_STATES.START) {
                    startGameBtn.disabled = true;
                    startGameBtn.innerText = "WAITING FOR TRACKING...";
                    startStatus.innerText = "Searching for hand target...";
                    startStatus.style.color = '#ff007f'; // neon magenta
                }
            };

            // Initialize tracker (uses shared webcam video element)
            await tracker.init(video, updateLoadingProgress);
            
        } catch (error) {
            console.error("Sensor suite activation failed: ", error);
            
            // Render user-friendly error details
            loadingOverlay.classList.add('hidden');
            errorOverlay.classList.remove('hidden');
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage.innerText = "Webcam permissions denied. This game strictly requires webcam tracking to parse hand gesture positions. Please reload and allow camera access.";
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage.innerText = "No webcam device detected. Please connect a webcam and try again.";
            } else {
                errorMessage.innerText = `Interstellar Interface Error: ${error.message || 'Webcam initialization failed.'}`;
            }
        }
    }

    // Secondary preview loop to draw tracked coordinates skeleton
    function runPreviewLoop() {
        if (tracker.isTracking || !tracker.landmarks) {
            if (engine.state === GAME_STATES.START) {
                tracker.drawDebugOverlay(startCanvas);
            } else if (engine.state === GAME_STATES.PLAYING || engine.state === GAME_STATES.PAUSED) {
                tracker.drawDebugOverlay(hudCanvas);
            }
        }
        requestAnimationFrame(runPreviewLoop);
    }

    // Trigger preview skeleton loops
    requestAnimationFrame(runPreviewLoop);

    // Boot the sensor suite
    startSensorSuite();

    // Event listeners
    retryBtn.addEventListener('click', () => {
        audio.playClick();
        startSensorSuite();
    });

    startGameBtn.addEventListener('click', () => {
        // Must resume AudioContext within click handler to satisfy browser autoplay
        audio.init();
        audio.playClick();
        engine.startGame();
    });

    restartGameBtn.addEventListener('click', () => {
        audio.playClick();
        engine.restartGame();
    });

    pauseBtn.addEventListener('click', () => {
        engine.pauseGame();
    });

    resumeGameBtn.addEventListener('click', () => {
        engine.resumeGame();
    });

    // Mute control
    muteBtn.addEventListener('click', () => {
        audio.init();
        const isMuted = audio.toggleMute();
        
        if (isMuted) {
            soundOnIcon.classList.add('hidden');
            soundOffIcon.classList.remove('hidden');
            muteBtn.title = "Unmute Sound";
        } else {
            soundOnIcon.classList.remove('hidden');
            soundOffIcon.classList.add('hidden');
            muteBtn.title = "Mute Sound";
        }
    });

    // Handle game pausing on window focus loss automatically
    window.addEventListener('blur', () => {
        if (engine.state === GAME_STATES.PLAYING) {
            engine.pauseGame();
        }
    });
});
