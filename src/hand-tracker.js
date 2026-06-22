// Hand Tracker using MediaPipe Hands

export class HandTracker {
    constructor() {
        this.videoElement = null;
        this.hands = null;
        this.camera = null;
        
        // Raw and smoothed coordinates (in normalized 0 to 1 space)
        this.rawX = 0.5;
        this.rawY = 0.5;
        this.smoothedX = 0.5;
        this.smoothedY = 0.5;
        
        // Tracking states
        this.isTracking = false;
        this.cameraActive = false;
        this.consecutiveLostFrames = 0;
        this.maxFramesToFreeze = 18; // Freeze for approx 300ms at 60fps
        
        // Smoothing parameters
        this.minAlpha = 0.08;   // Heavy filtering for stationary hand
        this.maxAlpha = 0.60;   // High responsiveness for fast hand movement
        this.speedScale = 8.0;  // Sensitivity factor mapping speed to alpha
        
        // Callbacks
        this.onTrackingActive = null;
        this.onTrackingLost = null;
        this.onLoaded = null;
        
        // Hand coordinates calibration boundaries (useful to map tracking area to full screen)
        // Crop the central 80% area to make it easier for player to reach screen corners
        this.cropXMin = 0.15;
        this.cropXMax = 0.85;
        this.cropYMin = 0.20;
        this.cropYMax = 0.80;

        // Landmark indices
        this.INDEX_FINGER_TIP = 8;
        
        // Store landmarks for preview render
        this.landmarks = null;
    }

    /**
     * Set up the webcam stream and MediaPipe Hands instance
     */
    async init(videoElement, progressCallback) {
        this.videoElement = videoElement;
        
        if (progressCallback) progressCallback(30, "Initializing MediaPipe Hands...");

        // Create MediaPipe Hands instance
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        // Configure MediaPipe Hands parameters
        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.6,
            minTrackingConfidence: 0.6
        });

        this.hands.onResults((results) => this.handleTrackingResults(results));

        if (progressCallback) progressCallback(60, "Requesting webcam permissions...");

        try {
            // Setup Camera Utility from MediaPipe
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (this.hands) {
                        await this.hands.send({ image: this.videoElement });
                    }
                },
                width: 640,
                height: 480
            });

            this.cameraActive = true;
            if (progressCallback) progressCallback(85, "Starting camera feed...");
            
            await this.camera.start();
            
            if (progressCallback) progressCallback(100, "Camera ready!");
            if (this.onLoaded) this.onLoaded();
        } catch (error) {
            console.error("Camera initialisation failed: ", error);
            this.cameraActive = false;
            throw error;
        }
    }

    /**
     * Process frame results from MediaPipe
     */
    handleTrackingResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            this.consecutiveLostFrames = 0;
            this.landmarks = results.multiHandLandmarks[0];
            
            // Get index fingertip landmark coordinate
            const tip = this.landmarks[this.INDEX_FINGER_TIP];
            
            // Mirror coordinate horizontally since index.html mirrors the camera visually
            // MediaPipe 0,0 is top-left of mirrored camera, so coordinates align
            this.rawX = tip.x;
            this.rawY = tip.y;

            // Apply dynamic exponential smoothing filter
            this.applyDynamicSmoothing();

            if (!this.isTracking) {
                this.isTracking = true;
                if (this.onTrackingActive) this.onTrackingActive();
            }
        } else {
            // Lost tracking
            this.consecutiveLostFrames++;
            
            // If we exceed our buffer freeze limit, declare tracking lost
            if (this.consecutiveLostFrames > this.maxFramesToFreeze) {
                this.landmarks = null;
                if (this.isTracking) {
                    this.isTracking = false;
                    if (this.onTrackingLost) this.onTrackingLost();
                }
            }
            // If we are within freeze buffer, we simply retain our last smoothed coordinates
        }
    }

    /**
     * Velocity-adaptive exponential smoothing filter
     */
    applyDynamicSmoothing() {
        // Calculate distance (speed) between raw and previous smoothed coordinates
        const dx = this.rawX - this.smoothedX;
        const dy = this.rawY - this.smoothedY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Map speed to smoothing alpha coefficient. 
        // More speed = higher alpha (less smoothing, low latency)
        // Less speed = lower alpha (heavy smoothing, filters tremors)
        let alpha = this.minAlpha + dist * this.speedScale;
        alpha = Math.max(this.minAlpha, Math.min(this.maxAlpha, alpha));

        // Smooth coordinates
        this.smoothedX = this.smoothedX + (this.rawX - this.smoothedX) * alpha;
        this.smoothedY = this.smoothedY + (this.rawY - this.smoothedY) * alpha;
    }

    /**
     * Get smoothed coordinates scaled to screen size (usually game canvas width/height)
     */
    getGameCoordinates(canvasWidth, canvasHeight) {
        // Map normalized coordinates from a cropped sensor window to full canvas
        // This ensures the player can reach all canvas corners without hand going off camera
        let scaledX = (this.smoothedX - this.cropXMin) / (this.cropXMax - this.cropXMin);
        let scaledY = (this.smoothedY - this.cropYMin) / (this.cropYMax - this.cropYMin);

        // Clamp to 0..1 boundary
        scaledX = Math.max(0, Math.min(1, scaledX));
        scaledY = Math.max(0, Math.min(1, scaledY));

        // Note: For gaming feeling, x coordinates are mirrored to match horizontal hand movements.
        // If hand moves right, ship should move right. Standard MediaPipe x ranges 0 (left) to 1 (right)
        // from camera perspective, which corresponds to mirrored x.
        // Let's ensure standard screen coordinates mapping.
        return {
            x: scaledX * canvasWidth,
            y: scaledY * canvasHeight
        };
    }

    /**
     * Render debug hand overlay on a given preview canvas
     */
    drawDebugOverlay(canvasElement) {
        if (!canvasElement) return;
        const ctx = canvasElement.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (!this.landmarks) {
            // Draw a dashed scanning indicator line if searching for hand
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            
            const scanY = (Date.now() % 2000) / 2000 * canvasElement.height;
            ctx.beginPath();
            ctx.moveTo(0, scanY);
            ctx.lineTo(canvasElement.width, scanY);
            ctx.stroke();
            ctx.setLineDash([]);
            return;
        }

        const width = canvasElement.width;
        const height = canvasElement.height;

        // Draw connections
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
        ctx.lineWidth = 2;

        // Define joint connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],       // Index
            [9, 10], [10, 11], [11, 12],          // Middle
            [13, 14], [14, 15], [15, 16],         // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17]             // Palm joint line
        ];

        connections.forEach(([i1, i2]) => {
            const pt1 = this.landmarks[i1];
            const pt2 = this.landmarks[i2];
            ctx.beginPath();
            ctx.moveTo(pt1.x * width, pt1.y * height);
            ctx.lineTo(pt2.x * width, pt2.y * height);
            ctx.stroke();
        });

        // Draw joints
        this.landmarks.forEach((lm, index) => {
            ctx.beginPath();
            ctx.arc(lm.x * width, lm.y * height, 3, 0, 2 * Math.PI);
            
            if (index === this.INDEX_FINGER_TIP) {
                // Glow effect for index fingertip
                ctx.fillStyle = '#ff007f';
                ctx.arc(lm.x * width, lm.y * height, 6, 0, 2 * Math.PI);
            } else {
                ctx.fillStyle = '#00f0ff';
            }
            ctx.fill();
        });
    }
}

// Export a singleton or class
export default HandTracker;
