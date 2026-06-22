// Power-up collectibles and pooling manager

class PowerUp {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vy = 120; // Falling speed (pixels per second)
        
        this.radius = 16;
        this.active = false;
        
        // Type: 'shield', 'slowmo', 'double', 'health'
        this.type = 'shield';
        this.color = '#00f0ff';
        
        // Hover/Rotation animations
        this.rotation = 0;
        this.pulseTime = 0;
    }

    spawn(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.active = true;
        this.rotation = 0;
        this.pulseTime = Math.random() * 10; // offset starting pulse phase
        
        // Configure visual attributes based on type
        switch (type) {
            case 'shield':
                this.color = '#00f0ff'; // Neon Cyan
                break;
            case 'slowmo':
                this.color = '#ffdf00'; // Neon Yellow
                break;
            case 'double':
                this.color = '#ff007f'; // Neon Magenta
                break;
            case 'health':
                this.color = '#39ff14'; // Cyber Green
                break;
        }
    }

    update(dt, gameSpeedCoeff, isSlowMoActive) {
        if (!this.active) return;

        // Account for slow-motion matrix
        const slowMultiplier = isSlowMoActive ? 0.35 : 1.0;
        
        // Move downward
        this.y += this.vy * slowMultiplier * gameSpeedCoeff * dt;
        
        // Slowly spin symbol
        this.rotation += 1.5 * dt;
        this.pulseTime += dt * 5;
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Breathe glow size
        const glowRadius = this.radius + Math.sin(this.pulseTime) * 3;
        
        ctx.shadowBlur = glowRadius * 1.2;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.fillStyle = 'rgba(10, 10, 20, 0.7)';
        ctx.lineWidth = 2.5;

        // Draw outer ring container
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw inner custom icon based on type
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.fillStyle = this.color;

        if (this.type === 'shield') {
            // Draw a compact energy Shield Hexagon
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const px = Math.cos(angle) * (this.radius - 4);
                const py = Math.sin(angle) * (this.radius - 4);
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        } 
        else if (this.type === 'slowmo') {
            // Draw Hourglass / Clock symbol
            const size = this.radius - 6;
            ctx.beginPath();
            ctx.moveTo(-size, -size);
            ctx.lineTo(size, -size);
            ctx.lineTo(-size, size);
            ctx.lineTo(size, size);
            ctx.closePath();
            ctx.stroke();
            
            // Draw clock center dot
            ctx.beginPath();
            ctx.arc(0, 0, 2, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (this.type === 'double') {
            // Draw dual gem / "II" symbol
            const w = 4;
            const h = 8;
            ctx.beginPath();
            // Left bar
            ctx.roundRect(-w - 2, -h, w, h * 2, 1);
            // Right bar
            ctx.roundRect(2, -h, w, h * 2, 1);
            ctx.stroke();
            ctx.fill();
        } 
        else if (this.type === 'health') {
            // Draw First-Aid cross
            const size = this.radius - 5;
            const arm = size / 3;
            
            ctx.beginPath();
            ctx.moveTo(-arm, -size);
            ctx.lineTo(arm, -size);
            ctx.lineTo(arm, -arm);
            ctx.lineTo(size, -arm);
            ctx.lineTo(size, arm);
            ctx.lineTo(arm, arm);
            ctx.lineTo(arm, size);
            ctx.lineTo(-arm, size);
            ctx.lineTo(-arm, arm);
            ctx.lineTo(-size, arm);
            ctx.lineTo(-size, -arm);
            ctx.lineTo(-arm, -arm);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        }

        ctx.restore();
    }
}

export class PowerupsManager {
    constructor() {
        this.pool = [];
        this.maxPowerups = 8;
        
        // Spawn interval: spawn one powerup roughly every 14 seconds
        this.spawnTimer = 0;
        this.spawnInterval = 14.0;
        
        this.types = ['shield', 'slowmo', 'double', 'health'];
        
        this.initPool();
    }

    initPool() {
        for (let i = 0; i < this.maxPowerups; i++) {
            this.pool.push(new PowerUp());
        }
    }

    update(dt, canvasWidth, canvasHeight, gameSpeedCoeff, isSlowMoActive) {
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawn(canvasWidth, canvasHeight);
        }

        // Update active pickups and recycle
        this.pool.forEach(pu => {
            if (pu.active) {
                pu.update(dt, gameSpeedCoeff, isSlowMoActive);
                
                if (pu.y > canvasHeight + 40) {
                    pu.active = false;
                }
            }
        });
    }

    spawn(canvasWidth, canvasHeight) {
        // Find inactive slot
        const slot = this.pool.find(p => !p.active);
        if (!slot) return; // Pool full

        // Random X above canvas
        const padding = 40;
        const x = padding + Math.random() * (canvasWidth - padding * 2);
        const y = -40;

        // Choose powerup type randomly
        const type = this.types[Math.floor(Math.random() * this.types.length)];

        slot.spawn(x, y, type);
    }

    draw(ctx) {
        this.pool.forEach(pu => {
            if (pu.active) pu.draw(ctx);
        });
    }

    clearAll() {
        this.pool.forEach(pu => pu.active = false);
        this.spawnTimer = 0;
    }
}
export default PowerupsManager;
