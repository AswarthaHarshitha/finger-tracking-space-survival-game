// Simple high-performance 2D physics and collision handlers

export class Physics {
    /**
     * Circular bounding box collision check (super fast and efficient)
     */
    static checkCircularCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distanceSq = dx * dx + dy * dy;
        const radiusSum = obj1.radius + obj2.radius;
        return distanceSq < radiusSum * radiusSum;
    }

    /**
     * Clamp an object's position to keep it fully within the screen limits
     */
    static keepInBounds(player, canvasWidth, canvasHeight) {
        const halfW = player.width / 2;
        const halfH = player.height / 2;
        
        if (player.x < halfW) player.x = halfW;
        if (player.x > canvasWidth - halfW) player.x = canvasWidth - halfW;
        
        if (player.y < halfH) player.y = halfH;
        if (player.y > canvasHeight - halfH) player.y = canvasHeight - halfH;
    }

    /**
     * Resolve collisions between lasers, player, obstacles, and powerups
     * @param {Player} player - The player ship
     * @param {ObstaclesManager} obstaclesManager - Manager holding pooled obstacles
     * @param {PowerupsManager} powerupsManager - Manager holding pooled powerups
     * @param {Function} onScoreAdd - Callback when score increases (args: points)
     */
    static resolveCollisions(player, obstaclesManager, powerupsManager, onScoreAdd) {
        const obstacles = obstaclesManager.pool;
        const powerups = powerupsManager.pool;
        const lasers = player.lasers;

        // 1. Lasers vs Obstacles
        for (let l = 0; l < lasers.length; l++) {
            const laser = lasers[l];
            if (!laser.active) continue;

            for (let o = 0; o < obstacles.length; o++) {
                const obs = obstacles[o];
                if (!obs.active) continue;

                if (this.checkCircularCollision(laser, obs)) {
                    // Deactivate laser
                    laser.active = false;
                    
                    // Obstacle takes damage
                    const destroyed = obs.takeDamage(laser.damage);
                    if (destroyed) {
                        // Increase score
                        const doubleMultiplier = player.isDoubleScore() ? 2 : 1;
                        onScoreAdd(obs.scoreValue * doubleMultiplier);
                    }
                    
                    // Break laser loop since this laser hit an obstacle
                    break;
                }
            }
        }

        // 2. Player vs Obstacles
        for (let o = 0; o < obstacles.length; o++) {
            const obs = obstacles[o];
            if (!obs.active) continue;

            if (this.checkCircularCollision(player, obs)) {
                if (player.isShielded()) {
                    // Deflect obstacle: destroy obstacle, don't damage player
                    obs.destroySilently(); // Destroy without scoring, spawn explosion
                    
                    // Slightly reduce shield time as penalty/cost
                    player.shieldTime = Math.max(0, player.shieldTime - 0.75);
                } else {
                    // Player takes damage based on obstacle weight
                    const isDead = player.takeDamage(obs.damageValue);
                    
                    // Destroy the obstacle on impact
                    obs.destroySilently();
                }
            }
        }

        // 3. Player vs Powerups
        for (let p = 0; p < powerups.length; p++) {
            const pu = powerups[p];
            if (!pu.active) continue;

            if (this.checkCircularCollision(player, pu)) {
                // Apply specific power-up effect
                switch (pu.type) {
                    case 'shield':
                        player.activateShield(10); // 10s shield duration
                        break;
                    case 'slowmo':
                        player.activateSlowMo(8);  // 8s slow motion duration
                        break;
                    case 'double':
                        player.activateDoubleScore(12); // 12s double score duration
                        break;
                    case 'health':
                        player.restoreHealth(25); // heal 25 HP
                        break;
                }
                
                // Deactivate collected power-up
                pu.active = false;
            }
        }
    }
}
export default Physics;
