// Cosmic visual effects (particles, starfield, screen shake, trail effects)

class Particle {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.size = 0;
        this.color = '';
        this.alpha = 1.0;
        this.decay = 0.02;
        this.life = 0; // Remaining frame updates
        this.active = false;
        this.glow = false;
    }

    init(x, y, vx, vy, size, color, life, decay, glow = false) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.size = size;
        this.color = color;
        this.alpha = 1.0;
        this.decay = decay;
        this.life = life;
        this.active = true;
        this.glow = glow;
    }

    update(dt, gameSpeedCoeff) {
        if (!this.active) return;

        // Apply movement (scaled by time step and engine speed)
        this.x += this.vx * dt * gameSpeedCoeff;
        this.y += this.vy * dt * gameSpeedCoeff;
        
        // Decay alpha and life
        this.alpha -= this.decay * dt;
        this.life -= dt;

        if (this.alpha <= 0 || this.life <= 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        if (this.glow) {
            ctx.shadowBlur = this.size * 2;
            ctx.shadowColor = this.color;
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class EffectsManager {
    constructor() {
        this.particles = [];
        this.maxParticles = 800; // Large pre-allocated pool
        
        // Screen shake state
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        
        // Parallax Starfield layers (three layers scrolling at different speeds)
        this.stars = [];
        this.starCount = 120;
        
        this.initPools();
    }

    initPools() {
        // Pre-allocate particles to prevent garbage collection hiccups
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(new Particle());
        }
    }

    /**
     * Create starfield background stars
     */
    initStarfield(width, height) {
        this.stars = [];
        for (let i = 0; i < this.starCount; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                // Speed layers: 0.1 (background, tiny), 0.3 (medium), 0.7 (foreground, bright)
                layer: Math.random() < 0.6 ? 0.1 : (Math.random() < 0.85 ? 0.35 : 0.8),
                size: Math.random() * 1.5 + 0.5,
                color: Math.random() < 0.2 ? '#00f0ff' : (Math.random() < 0.1 ? '#ff007f' : '#ffffff')
            });
        }
    }

    /**
     * Update stars parallax positions
     */
    updateStarfield(width, height, dt, gameSpeedCoeff, isSlowMoActive) {
        // Under slow-motion power-up, star speed drops
        const slowMoCoeff = isSlowMoActive ? 0.3 : 1.0;
        const baseSpeed = 80; // pixels per second

        this.stars.forEach(star => {
            star.y += baseSpeed * star.layer * dt * gameSpeedCoeff * slowMoCoeff;
            
            // Wrap around top if star goes off bottom of screen
            if (star.y > height) {
                star.y = 0;
                star.x = Math.random() * width;
            }
        });
    }

    drawStarfield(ctx) {
        ctx.save();
        this.stars.forEach(star => {
            ctx.fillStyle = star.color;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    /**
     * Trigger a camera screen shake
     */
    triggerScreenShake(intensity, duration) {
        // Add intensity if a shake is already active
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
        this.shakeDuration = Math.max(this.shakeDuration, duration);
    }

    /**
     * Update screen shake logic and decay
     */
    updateScreenShake(dt) {
        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
            
            // Apply randomized translation offsets based on current intensity
            this.shakeX = (Math.random() * 2 - 1) * this.shakeIntensity;
            this.shakeY = (Math.random() * 2 - 1) * this.shakeIntensity;
            
            // Decay intensity over time
            this.shakeIntensity *= Math.max(0, 1 - 2 * dt); // decay coefficient
            
            if (this.shakeDuration <= 0) {
                this.shakeX = 0;
                this.shakeY = 0;
                this.shakeIntensity = 0;
            }
        }
    }

    /**
     * Apply shake offsets to render context
     */
    applyShake(ctx) {
        if (this.shakeX !== 0 || this.shakeY !== 0) {
            ctx.save();
            ctx.translate(this.shakeX, this.shakeY);
        }
    }

    /**
     * Restore render context after shaking
     */
    restoreShake(ctx) {
        if (this.shakeX !== 0 || this.shakeY !== 0) {
            ctx.restore();
        }
    }

    /**
     * Spawn burst particles (e.g. on object destruction)
     */
    spawnExplosion(x, y, color, count = 25, force = 200) {
        let spawned = 0;
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (!p.active) {
                // Random angle and speed
                const angle = Math.random() * Math.PI * 2;
                const speed = (0.2 + Math.random() * 0.8) * force;
                
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed;
                
                const size = Math.random() * 3 + 1.5;
                const life = Math.random() * 0.6 + 0.4; // 0.4 to 1.0 second life
                const decay = 1.0 / life; // full decay within life span

                p.init(x, y, vx, vy, size, color, life, decay, true);
                
                spawned++;
                if (spawned >= count) break;
            }
        }
    }

    /**
     * Spawn thrust spark particles behind player ship
     */
    spawnThrusterSpark(x, y, isShielded) {
        // Look for 2 inactive particles
        let spawned = 0;
        const color = isShielded ? '#00f0ff' : '#ff007f';
        
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (!p.active) {
                // Shoot spark downwards with slight horizontal spread
                const vx = (Math.random() * 2 - 1) * 30;
                const vy = 150 + Math.random() * 100;
                
                const size = Math.random() * 2 + 1;
                const life = Math.random() * 0.2 + 0.15;
                const decay = 1.0 / life;

                p.init(x, y, vx, vy, size, color, life, decay, false);

                spawned++;
                if (spawned >= 2) break;
            }
        }
    }

    /**
     * Update active particles
     */
    updateParticles(dt, gameSpeedCoeff) {
        for (let i = 0; i < this.maxParticles; i++) {
            if (this.particles[i].active) {
                this.particles[i].update(dt, gameSpeedCoeff);
            }
        }
    }

    /**
     * Draw particles
     */
    drawParticles(ctx) {
        for (let i = 0; i < this.maxParticles; i++) {
            if (this.particles[i].active) {
                this.particles[i].draw(ctx);
            }
        }
    }

    /**
     * Clear all particles (e.g. on game restart)
     */
    clearAll() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles[i].active = false;
        }
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeX = 0;
        this.shakeY = 0;
    }
}

// Export singleton instance
export const effects = new EffectsManager();
export default effects;
