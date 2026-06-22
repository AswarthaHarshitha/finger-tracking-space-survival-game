// Game Engine Coordinator
import { Player } from './player.js';
import { ObstaclesManager } from './obstacles.js';
import { PowerupsManager } from './powerups.js';
import { Physics } from './physics.js';
import { effects } from './effects.js';
import { audio } from './audio.js';

export const GAME_STATES = {
    START: 'START',
    CALIBRATING: 'CALIBRATING',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
};

export class GameEngine {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        
        // Dimensions
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Game States
        this.state = GAME_STATES.START;
        
        // Time Keeping
        this.lastTime = 0;
        this.fps = 60;
        this.fpsFilter = 50; // smoothing filter for FPS indicator
        
        // Game progression & scoring
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('cosmic_high_score') || '0', 10);
        this.survivalTime = 0;
        this.level = 1;
        this.gameSpeedCoeff = 1.0;
        this.scoreInterval = 0.1; // Add survival points every 0.1s
        this.scoreTimer = 0;
        
        // Level progression timer
        this.levelTimer = 0;
        this.levelDuration = 30.0; // Level up every 30 seconds
        
        // Entities
        this.player = new Player();
        this.obstaclesManager = new ObstaclesManager();
        this.powerupsManager = new PowerupsManager();
        
        // Hand Tracker reference
        this.handTracker = null;
        
        // HTML UI selectors
        this.hudScore = document.getElementById('hud-score');
        this.hudLevel = document.getElementById('hud-level');
        this.hudHealthBar = document.getElementById('health-bar');
        this.hudShieldContainer = document.getElementById('hud-shield-container');
        this.hudShieldBar = document.getElementById('shield-bar');
        this.hudPowerupsList = document.getElementById('active-powerups-list');
        this.hudMultiplier = document.getElementById('hud-multiplier');
        this.hudMultiplierContainer = document.getElementById('hud-multiplier-container');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Set references and register hand tracker
     */
    registerTracker(tracker) {
        this.handTracker = tracker;
    }

    /**
     * Scale canvas dimensions to handle sharp high-DPI displays
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        // Set display dimensions
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;
        
        // Set backing store dimensions
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        
        // Scale context
        this.ctx.scale(dpr, dpr);
        
        // Reinitialize starfield locations to match new bounds
        effects.initStarfield(this.width, this.height);
    }

    /**
     * Launch calibration phase
     */
    startCalibration() {
        this.state = GAME_STATES.CALIBRATING;
        audio.init();
        audio.playClick();
        
        // Clear overlays
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('calibration-overlay').classList.remove('hidden');
        
        // Center player initially
        this.player.init(this.width / 2, this.height * 0.75);
    }

    /**
     * Launch main gameplay loop
     */
    startGame() {
        this.state = GAME_STATES.PLAYING;
        this.score = 0;
        this.survivalTime = 0;
        this.level = 1;
        this.gameSpeedCoeff = 1.0;
        this.levelTimer = 0;
        this.scoreTimer = 0;
        
        this.player.init(this.width / 2, this.height * 0.75);
        this.obstaclesManager.clearAll();
        this.powerupsManager.clearAll();
        effects.clearAll();
        
        audio.init();
        audio.playClick();
        audio.startBackgroundMusic();
        
        // Manage overlays
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('calibration-overlay').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('pause-overlay').classList.add('hidden');
        document.getElementById('game-hud').classList.remove('hidden');
        
        // Kick off requestAnimationFrame
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * Pause game flight
     */
    pauseGame() {
        if (this.state !== GAME_STATES.PLAYING) return;
        this.state = GAME_STATES.PAUSED;
        audio.playClick();
        document.getElementById('pause-overlay').classList.remove('hidden');
    }

    /**
     * Resume game flight
     */
    resumeGame() {
        if (this.state !== GAME_STATES.PAUSED) return;
        this.state = GAME_STATES.PLAYING;
        audio.playClick();
        document.getElementById('pause-overlay').classList.add('hidden');
        
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    /**
     * Ship destroyed sequence
     */
    triggerGameOver() {
        this.state = GAME_STATES.GAMEOVER;
        audio.stopBackgroundMusic();
        audio.playGameOver();
        
        // Update high score in local storage
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('cosmic_high_score', this.highScore);
        }
        
        // Synchronize Game Over scoreboard values
        document.getElementById('final-score').innerText = this.formatScore(this.score);
        document.getElementById('high-score').innerText = this.formatScore(this.highScore);
        document.getElementById('final-time').innerText = `${this.survivalTime.toFixed(1)}s`;
        
        // Toggle overlays
        document.getElementById('game-hud').classList.add('hidden');
        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    /**
     * Restart from game over screen
     */
    restartGame() {
        this.startGame();
    }

    /**
     * Add score points
     */
    addScore(points) {
        this.score += points;
    }

    /**
     * Main requestAnimationFrame Loop
     */
    loop(timestamp) {
        if (this.state === GAME_STATES.GAMEOVER) return;

        // Calculate delta time in seconds
        let dt = (timestamp - this.lastTime) / 1000.0;
        this.lastTime = timestamp;

        // Cap dt to prevent extreme jumps (e.g. background tab resuming)
        if (dt > 0.1) dt = 0.1;

        // Calculate rolling average FPS
        const currentFps = 1.0 / dt;
        this.fps += (currentFps - this.fps) / this.fpsFilter;

        if (this.state === GAME_STATES.PLAYING) {
            this.update(dt);
        }

        this.draw();

        // Continue loop if still active
        if (this.state === GAME_STATES.PLAYING || this.state === GAME_STATES.PAUSED) {
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    /**
     * Update all entity dynamics
     */
    update(dt) {
        this.survivalTime += dt;
        
        // Incremental difficulty system
        this.levelTimer += dt;
        if (this.levelTimer >= this.levelDuration) {
            this.levelTimer = 0;
            this.level++;
            this.gameSpeedCoeff += 0.14; // Increase obstacle speed by 14% each level
            effects.triggerScreenShake(15, 0.4); // Visual shake on level up
            audio.playShieldUp(); // positive alert tone
        }

        // Add passive score for survival (15 points per second)
        this.scoreTimer += dt;
        if (this.scoreTimer >= this.scoreInterval) {
            this.scoreTimer = 0;
            const pointsMultiplier = this.player.isDoubleScore() ? 30 : 15;
            this.score += pointsMultiplier * this.scoreInterval * this.level;
        }

        // Update player coordinates target from Hand Tracker
        if (this.handTracker && this.handTracker.isTracking) {
            const coords = this.handTracker.getGameCoordinates(this.width, this.height);
            this.player.setTarget(coords.x, coords.y);
            
            // Auto-hide calibration screen if it was active
            if (this.state === GAME_STATES.PLAYING) {
                document.getElementById('calibration-overlay').classList.add('hidden');
            }
        } else {
            // Hand lost: show calibration overlay reconnect warning
            if (this.state === GAME_STATES.PLAYING) {
                document.getElementById('calibration-overlay').classList.remove('hidden');
            }
        }

        // Update background star parallax
        effects.updateStarfield(this.width, this.height, dt, this.gameSpeedCoeff, this.player.isSlowMo());

        // Update player spaceship positioning
        this.player.update(dt);
        Physics.keepInBounds(this.player, this.width, this.height);

        // Update obstacles
        this.obstaclesManager.update(
            dt, 
            this.width, 
            this.height, 
            this.player.x, 
            this.player.y, 
            this.gameSpeedCoeff, 
            this.player.isSlowMo(), 
            this.level
        );

        // Update powerups
        this.powerupsManager.update(
            dt, 
            this.width, 
            this.height, 
            this.gameSpeedCoeff, 
            this.player.isSlowMo()
        );

        // Resolve collisions
        Physics.resolveCollisions(
            this.player, 
            this.obstaclesManager, 
            this.powerupsManager, 
            (pts) => this.addScore(pts)
        );

        // Update visual effects (particles, screen shake)
        effects.updateParticles(dt, this.gameSpeedCoeff);
        effects.updateScreenShake(dt);

        // Check fail conditions
        if (this.player.health <= 0) {
            this.triggerGameOver();
        }
    }

    /**
     * Render entire Canvas frame
     */
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#05050a'; // Solid cosmic dark space
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Apply screen shake translate offsets
        effects.applyShake(this.ctx);

        // Draw starfield
        effects.drawStarfield(this.ctx);

        // If slow-motion matrix active, draw a custom grid overlay
        if (this.player.isSlowMo()) {
            this.drawSlowMoGrid(this.ctx);
        }

        // Draw powerups
        this.powerupsManager.draw(this.ctx);

        // Draw obstacles
        this.obstaclesManager.draw(this.ctx);

        // Draw particles
        effects.drawParticles(this.ctx);

        // Draw player ship
        this.player.draw(this.ctx);

        // Restore screen shake translation
        effects.restoreShake(this.ctx);

        // Synchronize HUD overlay
        this.syncHUD();
    }

    /**
     * Draw scrolling sci-fi grid overlay for slow-motion matrix
     */
    drawSlowMoGrid(ctx) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 223, 0, 0.08)';
        ctx.lineWidth = 1;
        const gridSize = 65;
        const offset = (Date.now() / 22) % gridSize;
        
        // Vertical lines
        for (let x = 0; x < this.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
            ctx.stroke();
        }
        
        // Scrolling horizontal lines
        for (let y = offset; y < this.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Map scores into comma formatted text
     */
    formatScore(num) {
        return Math.floor(num).toLocaleString('en-US', { minimumIntegerDigits: 6, useGrouping: true });
    }

    /**
     * Synchronize HUD text elements
     */
    syncHUD() {
        if (this.state !== GAME_STATES.PLAYING && this.state !== GAME_STATES.PAUSED) return;

        // 1. Sync Score and level text
        if (this.hudScore) this.hudScore.innerText = this.formatScore(this.score);
        if (this.hudLevel) this.hudLevel.innerText = this.level;

        // 2. Sync Health bar
        if (this.hudHealthBar) {
            const healthPct = Math.max(0, this.player.health);
            this.hudHealthBar.style.width = `${healthPct}%`;
            
            // Add alert visual styling on low integrity
            if (healthPct < 30) {
                this.hudHealthBar.style.background = 'linear-gradient(90deg, #ff0000, #ff5555)';
            } else {
                this.hudHealthBar.style.background = 'linear-gradient(90deg, #ff1a1a, #ff4d4d)';
            }
        }

        // 3. Sync Shield bar
        if (this.hudShieldContainer && this.hudShieldBar) {
            if (this.player.isShielded()) {
                this.hudShieldContainer.classList.remove('hidden');
                const shieldPct = (this.player.shieldTime / 10) * 100; // max shield 10s
                this.hudShieldBar.style.width = `${shieldPct}%`;
            } else {
                this.hudShieldContainer.classList.add('hidden');
            }
        }

        // 4. Double score multiplier tag
        if (this.hudMultiplierContainer && this.hudMultiplier) {
            if (this.player.isDoubleScore()) {
                this.hudMultiplierContainer.classList.remove('hidden');
                this.hudMultiplier.innerText = `x2.0`;
            } else {
                this.hudMultiplierContainer.classList.add('hidden');
            }
        }

        // 5. Active powerup durations text injections
        if (this.hudPowerupsList) {
            this.hudPowerupsList.innerHTML = '';
            
            if (this.player.isShielded()) {
                this.injectPowerupTag('shield-active', 'DEFLECTORS', this.player.shieldTime);
            }
            if (this.player.isSlowMo()) {
                this.injectPowerupTag('slowmo-active', 'TIME EXPANSION', this.player.slowMoTime);
            }
            if (this.player.isDoubleScore()) {
                this.injectPowerupTag('double-active', 'OVERCHARGE', this.player.doubleScoreTime);
            }
        }
    }

    injectPowerupTag(className, label, timeRemaining) {
        const div = document.createElement('div');
        div.className = `powerup-indicator ${className}`;
        div.innerHTML = `<span class="dot"></span> ${label} <span class="duration">${timeRemaining.toFixed(1)}s</span>`;
        this.hudPowerupsList.appendChild(div);
    }
}
export default GameEngine;
