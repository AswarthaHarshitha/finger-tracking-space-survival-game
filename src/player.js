// Player Space Ship and Laser System
import { effects } from './effects.js';
import { audio } from './audio.js';

class Laser {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.speed = 1000; // pixels per second
        this.radius = 4;
        this.active = false;
        this.color = '#00f0ff';
        this.damage = 1;
    }

    spawn(x, y, color = '#00f0ff') {
        this.x = x;
        this.y = y;
        this.active = true;
        this.color = color;
    }

    update(dt) {
        if (!this.active) return;
        
        // Move straight up
        this.y -= this.speed * dt;
        
        // Deactivate if off-screen
        if (this.y < -50) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        
        // Draw pill-shaped laser projectile
        ctx.beginPath();
        ctx.roundRect(this.x - 2, this.y - 12, 4, 24, 2);
        ctx.fill();
        ctx.restore();
    }
}

export class Player {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        
        this.width = 44;
        this.height = 56;
        this.radius = 22; // Bounding radius for collision
        
        this.health = 100;
        this.maxHealth = 100;
        
        // Power-up durations in seconds
        this.shieldTime = 0;
        this.slowMoTime = 0;
        this.doubleScoreTime = 0;
        
        // Damage & invincibility
        this.invulnerableTime = 0;
        this.invulnerableDuration = 1.0; // 1 second of i-frames on hit
        this.blinkTimer = 0;
        
        // Motion Interpolation (lower lambda = smoother/laggy, higher = snappier)
        this.lerpLambda = 14.0;
        
        // Laser Pooling
        this.lasers = [];
        this.maxLasers = 40;
        this.fireInterval = 0.18; // Seconds between automatic shots
        this.fireTimer = 0;
        
        // Motion Trail tracking
        this.trail = [];
        this.maxTrailLength = 10;
        
        this.initPools();
    }

    initPools() {
        for (let i = 0; i < this.maxLasers; i++) {
            this.lasers.push(new Laser());
        }
    }

    /**
     * Set up player at start coordinates
     */
    init(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.health = 100;
        
        // Reset timers
        this.shieldTime = 0;
        this.slowMoTime = 0;
        this.doubleScoreTime = 0;
        this.invulnerableTime = 0;
        this.fireTimer = 0;
        this.trail = [];
        
        // Clear lasers
        this.lasers.forEach(l => l.active = false);
    }

    setTarget(tx, ty) {
        this.targetX = tx;
        this.targetY = ty;
    }

    /**
     * Check if a specific power-up is active
     */
    isShielded() { return this.shieldTime > 0; }
    isSlowMo() { return this.slowMoTime > 0; }
    isDoubleScore() { return this.doubleScoreTime > 0; }
    isInvulnerable() { return this.invulnerableTime > 0; }

    /**
     * Core update loop
     */
    update(dt) {
        // Frame-rate independent exponential interpolation towards target finger coordinate
        const lerpFactor = 1 - Math.exp(-this.lerpLambda * dt);
        this.x += (this.targetX - this.x) * lerpFactor;
        this.y += (this.targetY - this.y) * lerpFactor;

        // Record coordinates for motion trail
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.pop();
        }

        // Decrement power-up timers
        if (this.shieldTime > 0) this.shieldTime = Math.max(0, this.shieldTime - dt);
        if (this.slowMoTime > 0) this.slowMoTime = Math.max(0, this.slowMoTime - dt);
        if (this.doubleScoreTime > 0) this.doubleScoreTime = Math.max(0, this.doubleScoreTime - dt);
        if (this.invulnerableTime > 0) {
            this.invulnerableTime = Math.max(0, this.invulnerableTime - dt);
            this.blinkTimer += dt * 15; // blinking frequency accumulator
        }

        // Spawn engine thruster particles
        effects.spawnThrusterSpark(this.x, this.y + this.height / 2, this.isShielded());

        // Automatic firing
        this.fireTimer += dt;
        if (this.fireTimer >= this.fireInterval) {
            this.fireTimer = 0;
            this.fireLaser();
        }

        // Update active lasers
        this.lasers.forEach(l => {
            if (l.active) l.update(dt);
        });
    }

    /**
     * Fire laser projectile
     */
    fireLaser() {
        // Double-score active: fire dual lasers! Otherwise single central laser.
        const laserColor = this.isDoubleScore() ? '#ff007f' : '#00f0ff';
        
        if (this.isDoubleScore()) {
            this.spawnLaser(this.x - 12, this.y - 10, laserColor);
            this.spawnLaser(this.x + 12, this.y - 10, laserColor);
        } else {
            this.spawnLaser(this.x, this.y - 15, laserColor);
        }
        
        audio.playLaser();
    }

    spawnLaser(x, y, color) {
        for (let i = 0; i < this.maxLasers; i++) {
            if (!this.lasers[i].active) {
                this.lasers[i].spawn(x, y, color);
                break;
            }
        }
    }

    /**
     * Inflict hull damage on player ship
     */
    takeDamage(amount) {
        if (this.isShielded() || this.isInvulnerable()) {
            return false; // Damage deflected
        }

        this.health = Math.max(0, this.health - amount);
        this.invulnerableTime = this.invulnerableDuration;
        this.blinkTimer = 0;

        // Visual and auditory feedback
        audio.playHit();
        effects.triggerScreenShake(12, 0.3); // Heavy shake
        
        // Spawn small explosion centered on ship
        effects.spawnExplosion(this.x, this.y, '#ff3333', 15, 120);

        return this.health <= 0; // Returns true if destroyed
    }

    // Power-up activation methods
    activateShield(duration) {
        this.shieldTime = duration;
        audio.playShieldUp();
    }

    activateSlowMo(duration) {
        this.slowMoTime = duration;
        audio.playPowerUp();
    }

    activateDoubleScore(duration) {
        this.doubleScoreTime = duration;
        audio.playPowerUp();
    }

    restoreHealth(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
        audio.playPowerUp();
    }

    /**
     * Render player spaceship and visual sub-systems
     */
    draw(ctx) {
        // Draw lasers first so they sit underneath ship layers
        this.lasers.forEach(l => {
            if (l.active) l.draw(ctx);
        });

        // Draw motion trail
        if (this.trail.length > 1) {
            ctx.save();
            ctx.lineWidth = 3;
            const trailColor = this.isShielded() ? '0, 240, 255' : (this.isDoubleScore() ? '255, 0, 127' : '0, 240, 255');
            
            for (let i = 1; i < this.trail.length; i++) {
                const prev = this.trail[i - 1];
                const curr = this.trail[i];
                const alpha = (1.0 - (i / this.trail.length)) * 0.25;
                ctx.strokeStyle = `rgba(${trailColor}, ${alpha})`;
                
                ctx.beginPath();
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(curr.x, curr.y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Hit flashing: Skip rendering on alternating blink counts
        if (this.isInvulnerable() && Math.floor(this.blinkTimer) % 2 === 0) {
            return;
        }

        // Draw sleek neon spaceship
        ctx.save();
        ctx.translate(this.x, this.y);

        // Neon Glow
        ctx.shadowBlur = 15;
        const mainColor = this.isDoubleScore() ? '#ff007f' : '#00f0ff';
        ctx.shadowColor = mainColor;
        
        // Ship Wing Thruster trails/glows
        ctx.fillStyle = this.isShielded() ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 0, 127, 0.2)';
        ctx.beginPath();
        ctx.moveTo(-16, 20);
        ctx.lineTo(-24, 28);
        ctx.lineTo(-12, 28);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(16, 20);
        ctx.lineTo(24, 28);
        ctx.lineTo(12, 28);
        ctx.closePath();
        ctx.fill();

        // Ship Outer Hull Outline
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = 2.5;
        ctx.fillStyle = '#0f0f1b'; // Dark metal inner body fill
        
        ctx.beginPath();
        ctx.moveTo(0, -25);          // Nose cone tip
        ctx.lineTo(8, -8);           // Cockpit bridge
        ctx.lineTo(18, 14);          // Right wing tip front
        ctx.lineTo(22, 20);          // Right wing edge
        ctx.lineTo(10, 16);          // Inner right exhaust wing joint
        ctx.lineTo(6, 22);           // Right engine exhaust outer
        ctx.lineTo(0, 18);           // Mid hull exhaust point
        ctx.lineTo(-6, 22);          // Left engine exhaust outer
        ctx.lineTo(-10, 16);         // Inner left exhaust wing joint
        ctx.lineTo(-22, 20);         // Left wing edge
        ctx.lineTo(-18, 14);         // Left wing tip front
        ctx.lineTo(-8, -8);          // Cockpit bridge
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Futuristic Cockpit detail
        ctx.fillStyle = this.isShielded() ? '#00f0ff' : '#ff007f';
        ctx.beginPath();
        ctx.moveTo(0, -12);
        ctx.lineTo(4, -3);
        ctx.lineTo(3, 4);
        ctx.lineTo(-3, 4);
        ctx.lineTo(-4, -3);
        ctx.closePath();
        ctx.fill();

        // Wing highlights
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-12, 10);
        ctx.lineTo(-18, 14);
        ctx.moveTo(12, 10);
        ctx.lineTo(18, 14);
        ctx.stroke();

        ctx.restore(); // Clear translations and shadows

        // Draw Shield Bubble if active
        if (this.isShielded()) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            // Breathe shield size slightly over time
            const breathe = Math.sin(Date.now() / 150) * 2;
            const shieldRadius = this.radius + 16 + breathe;
            
            // Radial gradient for shield bubble
            const gradient = ctx.createRadialGradient(0, 0, shieldRadius - 8, 0, 0, shieldRadius + 2);
            gradient.addColorStop(0, 'rgba(0, 240, 255, 0.05)');
            gradient.addColorStop(0.8, 'rgba(0, 240, 255, 0.25)');
            gradient.addColorStop(1, 'rgba(0, 240, 255, 0.7)');

            ctx.fillStyle = gradient;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#00f0ff';
            
            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
            ctx.fill();

            // Draw clean subtle outer ring
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.restore();
        }
    }
}
