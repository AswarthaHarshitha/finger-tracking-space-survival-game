# Cosmic Evasion: Finger-Tracking Space Survival Game

A production-quality webcam-based finger-tracking arcade game built using pure HTML5, CSS3, JavaScript (ES Modules), MediaPipe Hands, and the Web Audio API. No external build tools are required, making local development, deployment, and testing simple.

Live Application: https://fingertrackingspacesurvivalgame.netlify.app/
---

## 🚀 Game Concept

Pilot your futuristic spaceship using the **tip of your index finger** in front of your webcam. Move your hand to dodge incoming hazards and collect power-ups. The longer you survive, the higher your score.

---

## 🛠️ Technology Stack & Architecture

- **Frontend Core**: HTML5 Canvas, CSS3 Custom Properties (CSS variables), ES Modules (JavaScript).
- **Computer Vision**: MediaPipe Hands (v0.4.x) via jsDelivr CDN.
- **Synthesizer**: Web Audio API (procedural generation of sound effects, lasers, explosions, and cosmic background tracks, meaning zero download latency and absolute offline reliability).
- **Visuals**: Canvas 2D context with hardware-accelerated animations (`requestAnimationFrame`), dynamic screen shake, scrolling cyber grids, and customizable particle arrays.

### Project Layout
```
space-survival-game/
├── package.json         # Dev server scripts
├── index.html           # Layout & CDNs loadout
├── styles.css           # Styling sheet (Glassmorphic cards, PIP preview, HUD layout)
├── README.md            # Setup and testing instructions (This file)
└── src/
    ├── main.js          # Bootstrapping module and DOM events
    ├── hand-tracker.js  # MediaPipe webcam tracking, coordinate mapping & filter
    ├── game-engine.js   # State machine, frame-rate tracking, parallax starfield, grid
    ├── player.js        # Spaceship rendering, automated firing, trail effects
    ├── obstacles.js     # Pooled Asteroids, Meteors, and steerable enemy Drones
    ├── powerups.js      # Pooled Shield, Slow-Mo, Double Score, Repair bonuses
    ├── physics.js       # Fast 2D circle collision detection and clamping
    ├── audio.js         # Sound manager synthesis & ambient track player
    └── effects.js       # Pre-allocated particle explosion pools & screen shake
```

---

## ⚡ Key Engineering & Performance Optimizations

1. **Pre-allocated Object Pooling (Zero Garbage Collection Spikes)**:
   - High-rate dynamic entities like obstacles, power-ups, lasers, and explosion particles are pre-allocated in pools during initialization.
   - Active entities are toggled on and off instead of instantiated and dereferenced dynamically. This avoids runtime garbage collection halts, guaranteeing a stable **60 FPS** target.
2. **Velocity-Adaptive Double-Smoothing Filter**:
   - The hand tracker computes coordinates smoothing using an exponential filter where the smoothing coefficient $\alpha$ scales dynamically:
     $$\alpha = \text{clamp}(\text{speed} \cdot k, \alpha_{min}, \alpha_{max})$$
   - This provides **rock-solid stillness** (no jitter) when your hand is stationary, and **immediate snap responsiveness** (low latency) when you move your hand rapidly.
3. **Graceful Hand Loss Recovery**:
   - If the camera loses sight of your hand (e.g. hand goes out of frame temporarily), the ship position freezes in place for up to 300ms.
   - If tracking is lost longer, the interface pauses or enters calibration status. Once re-acquired, the ship coordinates interpolate smoothly rather than instantly teleporting, preserving realistic game feel.
4. **Sharp High-DPI Canvas Rendering**:
   - The Canvas element checks the system's `window.devicePixelRatio` and automatically scales the canvas resolution, ensuring vector lines and ship assets look razor-sharp on Retina and high-resolution displays.

---

## 🎮 Game Elements & Power-Ups

- **Asteroid**: Spinning rocks of varying weights.
- **Meteor**: Flaming fireballs descending at high speeds.
- **Drone**: Steerable robot craft that adjust course towards the player ship.
- **Shield (Cyan Hexagon)**: Protects hull and deflects collisions.
- **Slow Motion (Yellow Hourglass)**: Dilates time, slowing obstacles by 65% while the player moves normally.
- **Double Score (Magenta Gem)**: Activates 2.0x score multipliers and fires dual lasers.
- **Health Restore (Green Cross)**: Repairs ship hull integrity by 25 points.

---

## ⚙️ Setup and Launch Instructions

### Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed.

### 1. Launch Dev Server
Inside the game directory, run:
```bash
npm run dev
```
This boots an HTTP server serving the assets locally at `http://localhost:8080`.

### 2. Open Game Interface
Open `http://localhost:8080` in Chrome, Safari, or Firefox.
*Note: Grant webcam access permissions when prompted by your browser.*

---

## 📝 Testing Checklist

Please execute these manual checks to verify features and stability:

- [ ] **Webcam Permission Prompt**: Verify the camera overlay appears and requests camera permission. If denied, confirm the camera failure card renders.
- [ ] **Tracking Stability & Jitter**: Place your index finger in the webcam feed. Verify the green skeleton outline overlays your joints and that your index finger locks without jitter.
- [ ] **Boundary Clamping**: Verify that your spaceship is clamped properly within the bounds of the screen and cannot fly off-canvas.
- [ ] **Collision Checks**: Let an Asteroid hit you. Confirm the screen shakes, a thud sound triggers, and health bar depletes.
- [ ] **Power-up Collection**: Collect a power-up (e.g. Shield). Confirm the shield bubble renders around the ship, deflects asteroids, and the HUD power-up duration timer ticks down.
- [ ] **Audio Toggle**: Click the speaker icon in the bottom right corner. Verify it mutes and unmutes the ambient music and sound effects.
- [ ] **Pause System**: Click the Pause button (or switch browser tabs). Verify the game halts. Click Resume to check frame-independent continuity.
- [ ] **Game Restart**: Let your health reach 0. Confirm the Game Over scoreboard screen appears showing your high score. Click **Launch Again** to confirm states reset correctly.
