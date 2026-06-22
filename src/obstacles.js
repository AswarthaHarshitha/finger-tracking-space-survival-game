// Obstacle classes and pooling manager
import { effects } from './effects.js';
import { audio } from './audio.js';

class Obstacle {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        
        this.radius = 20;
        this.active = false;
        this.type = 'asteroid'; // 'asteroid', 'meteor', 'drone'
        
        this.health = 1;
        this.maxHealth = 1;
        
        this.damageValue = 20;
        this.scoreValue = 100;
        
        // Visual Rotation (mainly for asteroids)
        this.rotation = 0;
        this.rotationSpeed = 0;
        
        this.color = '#888899';
        
        // Drone horizontal tracking parameters
        this.droneSteerSpeed = 60; // pixels/sec horizontal adjustment
    }

    spawn(x, y, vy, vx, type, sizeScale = 1.0) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;
        this.active = true;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() * 2 - 1) * 1.5;

        // Customize according to obstacle type
        if (type === 'asteroid') {
            this.radius = (15 + Math.random() * 15) * sizeScale;
            this.maxHealth = Math.ceil(this.radius / 10);
            this.health = this.maxHealth;
            this.damageValue = Math.round(this.radius * 0.8);
            this.scoreValue = Math.round(this.radius * 6);
            this.color = '#a0a0b0';
        } 
        else if (type === 'meteor') {
            this.radius = (20 + Math.random() * 10) * sizeScale;
            this.maxHealth = 1; // fragile but fast
            this.health = 1;
            this.vy = vy * 1.6; // 60% faster than standard asteroids
            this.vx = vx * 1.3;
            this.damageValue = 35;
            this.scoreValue = 250;
            this.color = '#ff4500'; // fiery red-orange
        } 
        else if (type === 'drone') {
            this.radius = 18 * sizeScale;
            this.maxHealth = 2;
            this.health = this.maxHealth;
            this.vy = vy * 1.1; // slightly faster
            this.damageValue = 20;
            this.scoreValue = 400;
            this.color = '#39ff14'; // cyber neon green
        }
    }

    /**
     * Inflict damage on obstacle. Returns true if destroyed.
     */
    takeDamage(amount) {
        this.health -= amount;
        
        // Visual flash or dust sparks on hit
        effects.spawnExplosion(this.x, this.y, '#ffffff', 4, 80);

        if (this.health <= 0) {
            this.explode();
            return true;
        }
        return false;
    }

    /**
     * Trigger destruction with score rewards
     */
    explode() {
        this.active = false;
        
        // Spawn rich color-coded particles
        effects.spawnExplosion(this.x, this.y, this.color, 18, 160);
        
        // Screen shake intensity matches obstacle size
        effects.triggerScreenShake(this.radius * 0.35, 0.2);
        
        // Audio blast
        audio.playExplosion();
    }

    /**
     * Destroy silently (player hit or shield deflect, no points)
     */
    destroySilently() {
        this.active = false;
        effects.spawnExplosion(this.x, this.y, this.color, 12, 100);
        audio.playExplosion();
    }

    /**
     * Update obstacle dynamics
     */
    update(dt, playerX, gameSpeedCoeff, isSlowMoActive) {
        if (!this.active) return;

        // Apply slow-mo effect
        const speedMultiplier = (isSlowMoActive ? 0.35 : 1.0) * gameSpeedCoeff;

        // 1. Move drone towards player horizontally
        if (this.type === 'drone') {
            const dx = playerX - this.x;
            const steer = Math.sign(dx) * this.droneSteerSpeed * speedMultiplier * dt;
            
            // Apply steering but clamp it to avoid teleporting
            if (Math.abs(dx) > 10) {
                this.x += steer;
            }
        }

        // 2. Spawn fire particles behind meteors
        if (this.type === 'meteor' && Math.random() < 0.35) {
            // Spawn flame particles slightly offset behind it
            effects.spawnThrusterSpark(this.x, this.y - this.radius, false);
        }

        // Move downward/diagonally
        this.x += this.vx * speedMultiplier * dt;
        this.y += this.vy * speedMultiplier * dt;

        // Spin
        this.rotation += this.rotationSpeed * speedMultiplier * dt;
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.shadowBlur = this.type === 'asteroid' ? 5 : 15;
        ctx.shadowColor = this.color;

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        if (this.type === 'asteroid') {
            // Draw a craggy, irregular polygon for the asteroid
            ctx.beginPath();
            const points = 8;
            const seed = this.radius * 0.15;
            for (let i = 0; i < points; i++) {
                const angle = (i / points) * Math.PI * 2;
                // Add minor jaggedness based on a sin wave to keep it deterministic
                const r = this.radius + Math.sin(i * 1.7) * seed;
                const px = Math.cos(angle) * r;
                const py = Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Craggy surface detail lines
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.beginPath();
            ctx.moveTo(-this.radius * 0.4, -this.radius * 0.2);
            ctx.lineTo(-this.radius * 0.1, -this.radius * 0.3);
            ctx.lineTo(this.radius * 0.2, -this.radius * 0.1);
            ctx.stroke();
        } 
        else if (this.type === 'meteor') {
            // Draw a teardrop flaming comet shape pointing upward
            ctx.fillStyle = '#ff3300';
            ctx.beginPath();
            ctx.moveTo(0, this.radius);
            ctx.bezierCurveTo(this.radius, 0, this.radius * 0.7, -this.radius, 0, -this.radius * 1.8);
            ctx.bezierCurveTo(-this.radius * 0.7, -this.radius, -this.radius, 0, 0, this.radius);
            ctx.closePath();
            ctx.fill();

            // Draw glowing inner core
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(0, -this.radius * 0.2, this.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (this.type === 'drone') {
            // Draw a triangular neon-green robotic drone
            ctx.fillStyle = '#0a1d0f';
            ctx.strokeStyle = '#39ff14';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.moveTo(0, this.radius);          // Drone Front (pointing down)
            ctx.lineTo(this.radius * 0.8, -this.radius * 0.6); // Rear right wing
            ctx.lineTo(0, -this.radius * 0.2);   // Rear center thruster notch
            ctx.lineTo(-this.radius * 0.8, -this.radius * 0.6); // Rear left wing
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Neon glowing thruster engine core
            ctx.fillStyle = '#ff007f';
            ctx.beginPath();
            ctx.arc(0, -this.radius * 0.4, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

export class ObstaclesManager {
    constructor() {
        this.pool = [];
        this.maxObstacles = 60; // Max active in screen
        
        // Spawn timer settings
        this.spawnTimer = 0;
        this.spawnInterval = 1.6; // Spawn every 1.6 seconds at Level 1
        
        this.initPool();
    }

    initPool() {
        for (let i = 0; i < this.maxObstacles; i++) {
            this.pool.push(new Obstacle());
        }
    }

    /**
     * Update obstacles spawning and coordinate movements
     */
    update(dt, canvasWidth, canvasHeight, playerX, playerY, gameSpeedCoeff, isSlowMoActive, currentLevel) {
        // Dynamic difficulty: Scale spawn interval down based on level
        // Level 1 = 1.6s, Level 5 = 0.8s
        const currentInterval = Math.max(0.65, this.spawnInterval - (currentLevel - 1) * 0.15);
        
        this.spawnTimer += dt;
        if (this.spawnTimer >= currentInterval) {
            this.spawnTimer = 0;
            this.spawn(canvasWidth, canvasHeight, currentLevel);
        }

        // Update active entities and recycle if they pass off-screen
        this.pool.forEach(obs => {
            if (obs.active) {
                obs.update(dt, playerX, gameSpeedCoeff, isSlowMoActive);
                
                // Check if off-screen (bottom margin of 50px)
                if (obs.y > canvasHeight + 50) {
                    obs.active = false;
                }
            }
        });
    }

    /**
     * Spawn an obstacle off-screen
     */
    spawn(canvasWidth, canvasHeight, currentLevel) {
        // Find an inactive slot
        const obstacleSlot = this.pool.find(o => !o.active);
        if (!obstacleSlot) return; // Pool fully saturated

        // Spawn position: random X, above the screen
        const padding = 30;
        const x = padding + Math.random() * (canvasWidth - padding * 2);
        const y = -60;

        // Base speeds: scale slightly with level progression
        const speedScale = 1.0 + (currentLevel - 1) * 0.12;
        const vy = (120 + Math.random() * 120) * speedScale;
        const vx = (Math.random() * 2 - 1) * 35 * speedScale;

        // Decide type: 60% Asteroids, 25% Meteors, 15% Drones
        const roll = Math.random();
        let type = 'asteroid';
        if (roll > 0.85) {
            type = 'drone';
        } else if (roll > 0.60) {
            type = 'meteor';
        }

        // Sizes get slightly larger or smaller
        const sizeScale = 0.85 + Math.random() * 0.3;

        obstacleSlot.spawn(x, y, vy, vx, type, sizeScale);
    }

    draw(ctx) {
        this.pool.forEach(obs => {
            if (obs.active) obs.draw(ctx);
        });
    }

    clearAll() {
        this.pool.forEach(obs => obs.active = false);
        this.spawnTimer = 0;
    }
}
export default ObstaclesManager;
