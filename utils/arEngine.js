// Self-contained, High-Performance 3D AR Engine with Spatial Distance Tracking & AI Furniture Occlusion
import { Sound } from './sound.js';
import { objectDetector } from './objectDetector.js';

class AREngine {
  constructor() {
    this.container = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    this.animationFrameId = null;

    // Camera Stream
    this.cameraStream = null;
    this.isCameraActive = false;

    // Orientation & Gyroscope
    this.gyroAvailable = false;
    this.hasGyroPermission = false;
    this.orientation = { alpha: 0, beta: 0, gamma: 0 };
    this.panOffset = { yaw: 0, pitch: 0 }; // in radians

    // Touch Drag
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };

    // Target in 3D Space (Spherical coordinates + Metric Distance)
    this.target = {
      azimuth: Math.random() * Math.PI * 2, // 0 to 360 deg
      altitude: (Math.random() - 0.5) * 0.4, // -11 to +11 deg
      distance: 8.2, // Initial spawn distance in meters
      spawnDistance: 8.2,
      effectiveRange: 3.5, // Effective engagement threshold in meters
      image: null,
      isLoaded: false,
      isCovered: false,
      coverName: null,
      occlusionPercent: 0,
      health: 100,
      currentHits: 0,
      maxHits: 5,
      hitFlashUntil: 0,
      sparks: []
    };

    // Step Detection / Pedometer Dead-Reckoning
    this.lastStepTime = 0;
    this.stepDebounceMs = 380;
    this.lastAccelMagnitude = 9.8;
    this.stepsTaken = 0;
    this.stepListenersBound = false;

    // Telemetry & Lock-on
    this.isSpawned = false;
    this.isInViewfinder = false;
    this.isLocked = false;
    this.onTelemetryUpdate = null;

    // Obstacles
    this.obstacles = [];
  }

  // Request Mobile Permissions (Camera, Gyro, Accelerometer)
  async requestPermissions() {
    let gyroGranted = false;
    let cameraGranted = false;

    // 1. Gyroscope & Motion Permission FIRST (iOS Safari gesture requirement)
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res === 'granted') {
          this.hasGyroPermission = true;
          this.gyroAvailable = true;
          gyroGranted = true;
        }
      } else if ('DeviceOrientationEvent' in window) {
        this.hasGyroPermission = true;
        this.gyroAvailable = true;
        gyroGranted = true;
      }

      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        await DeviceMotionEvent.requestPermission().catch(() => {});
      }
    } catch (e) {
      console.warn('[AR] Gyro/Motion permission request:', e);
      this.hasGyroPermission = true;
    }

    this.bindSensors();
    this.bindStepDetection();

    // Initialize AI Object Detector in background
    objectDetector.init().catch(e => console.warn('[AR] Object detector init:', e));

    // 2. Camera Permission
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        this.cameraStream = stream;
        if (this.videoElement) {
          this.videoElement.srcObject = stream;
          this.videoElement.setAttribute('playsinline', 'true');
          this.videoElement.setAttribute('autoplay', 'true');
          await this.videoElement.play().catch(() => {});
        }
        this.isCameraActive = true;
        cameraGranted = true;
      }
    } catch (e) {
      console.warn('[AR] Camera access:', e);
    }

    return { camera: cameraGranted, gyro: gyroGranted };
  }

  start(container, videoElement, onTelemetryUpdate) {
    if (container) this.container = container;
    if (videoElement) this.videoElement = videoElement;
    if (onTelemetryUpdate) this.onTelemetryUpdate = onTelemetryUpdate;

    if (!this.canvas && this.container) {
      this.init(this.container, this.videoElement, this.onTelemetryUpdate);
    }

    // Reset Target & State
    this.isSpawned = false;
    this.isInViewfinder = false;
    this.isLocked = false;
    this.stepsTaken = 0;
    this.target = {
      azimuth: 0,
      altitude: 0,
      distance: 8.2,
      spawnDistance: 8.2,
      effectiveRange: 3.5,
      isLoaded: false,
      image: null,
      isCovered: false,
      coverName: null,
      occlusionPercent: 0,
      health: 100,
      currentHits: 0,
      maxHits: 5,
      hitFlashUntil: 0,
      sparks: []
    };

    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (!this.animationFrameId) {
      this.startLoop();
    }
  }

  init(container, videoElement, onTelemetryUpdate) {
    this.container = container;
    this.videoElement = videoElement;
    this.onTelemetryUpdate = onTelemetryUpdate;

    let existingCanvas = container.querySelector('.ar-three-canvas');
    if (!existingCanvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'ar-three-canvas';
      container.appendChild(this.canvas);
    } else {
      this.canvas = existingCanvas;
    }

    this.ctx = this.canvas.getContext('2d');
    this.resize();

    window.addEventListener('resize', this.resize.bind(this));
    this.bindTouchControls();
    this.bindSensors();
    this.bindStepDetection();

    if (!this.animationFrameId) {
      this.startLoop();
    }
  }

  resize() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round((rect.width || window.innerWidth) * dpr);
    this.canvas.height = Math.round((rect.height || window.innerHeight) * dpr);
  }

  bindSensors() {
    const handleOrientation = (e) => {
      let alpha = 0;
      let beta = 70;
      let gamma = 0;
      let receivedData = false;

      if (e.webkitCompassHeading !== undefined && e.webkitCompassHeading !== null) {
        alpha = e.webkitCompassHeading;
        receivedData = true;
      } else if (e.alpha !== null && e.alpha !== undefined) {
        alpha = 360 - e.alpha;
        receivedData = true;
      }

      if (e.beta !== null && e.beta !== undefined) {
        beta = e.beta;
        receivedData = true;
      }
      if (e.gamma !== null && e.gamma !== undefined) {
        gamma = e.gamma;
      }

      if (receivedData) {
        this.gyroAvailable = true;
        this.orientation.alpha = (alpha * Math.PI) / 180;
        this.orientation.beta = (beta * Math.PI) / 180;
        this.orientation.gamma = (gamma * Math.PI) / 180;
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    window.addEventListener('deviceorientationabsolute', handleOrientation, true);
  }

  // Real-world Step & Pedometer Detection via devicemotion
  bindStepDetection() {
    if (this.stepListenersBound) return;
    this.stepListenersBound = true;

    const handleMotion = (e) => {
      if (!this.isSpawned) return;
      const acc = e.accelerationIncludingGravity || e.acceleration;
      if (!acc) return;

      const ax = acc.x || 0;
      const ay = acc.y || 0;
      const az = acc.z || 0;
      const magnitude = Math.sqrt(ax * ax + ay * ay + az * az);

      const delta = Math.abs(magnitude - this.lastAccelMagnitude);
      this.lastAccelMagnitude = magnitude;

      const now = performance.now();
      // Peak threshold for a physical forward footstep gait
      if (delta > 2.4 && now - this.lastStepTime > this.stepDebounceMs) {
        this.lastStepTime = now;
        this.advanceStep(0.75); // ~0.75m per physical step
      }
    };

    window.addEventListener('devicemotion', handleMotion, true);

    // Keyboard controls for desktop testing (W / Up to advance, S / Down to step back)
    window.addEventListener('keydown', (e) => {
      if (!this.isSpawned) return;
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.advanceStep(0.75);
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        this.retreatStep(0.75);
      }
    });
  }

  // Advance player closer to target in 3D space
  advanceStep(strideMeters = 0.75) {
    if (!this.isSpawned) return;
    const oldDist = this.target.distance;
    this.target.distance = Math.max(1.6, Math.round((this.target.distance - strideMeters) * 10) / 10);
    this.stepsTaken++;

    // Play tactile boot step
    Sound.footstep();

    // When entering effective breach range (< 3.5m)
    if (oldDist > this.target.effectiveRange && this.target.distance <= this.target.effectiveRange) {
      Sound.rangeAcquired();
    }
  }

  // Step back / retreat
  retreatStep(strideMeters = 0.75) {
    if (!this.isSpawned) return;
    this.target.distance = Math.min(10.0, Math.round((this.target.distance + strideMeters) * 10) / 10);
    Sound.footstep();
  }

  bindTouchControls() {
    const onDown = (e) => {
      this.isDragging = true;
      this.dragStart = {
        x: e.clientX || (e.touches && e.touches[0].clientX),
        y: e.clientY || (e.touches && e.touches[0].clientY)
      };
    };

    const onMove = (e) => {
      if (!this.isDragging) return;
      const x = e.clientX || (e.touches && e.touches[0].clientX);
      const y = e.clientY || (e.touches && e.touches[0].clientY);

      const dx = x - this.dragStart.x;
      const dy = y - this.dragStart.y;

      this.panOffset.yaw -= dx * 0.006;
      this.panOffset.pitch = Math.max(-0.4, Math.min(0.4, this.panOffset.pitch - dy * 0.006));

      this.dragStart = { x, y };
    };

    const onUp = () => {
      this.isDragging = false;
    };

    if (this.canvas) {
      this.canvas.addEventListener('mousedown', onDown);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);

      this.canvas.addEventListener('touchstart', onDown, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onUp);
    }
  }

  getCurrentViewOrientation() {
    let heading = this.panOffset.yaw;
    let pitch = this.panOffset.pitch;

    if (this.gyroAvailable) {
      heading = (this.orientation.alpha + this.panOffset.yaw) % (Math.PI * 2);
      const naturalHoldAngle = (70 * Math.PI) / 180;
      const rawPitch = this.orientation.beta - naturalHoldAngle;
      pitch = Math.max(-0.4, Math.min(0.4, rawPitch)) + this.panOffset.pitch;
    }

    return { heading, pitch };
  }

  // Spawn Target Sprite at distance in 3D Space
  spawnTarget(imageUrl, initialDistance = 8.2) {
    const current = this.getCurrentViewOrientation();
    
    // Spawn offset 65° to 115° away to require turning and searching
    const sign = Math.random() > 0.5 ? 1 : -1;
    const randomAngleOffset = sign * (Math.PI / 2.8 + Math.random() * (Math.PI / 3.5));
    
    this.target.azimuth = (current.heading + randomAngleOffset + Math.PI * 2) % (Math.PI * 2);
    this.target.altitude = current.pitch;
    this.target.distance = initialDistance;
    this.target.spawnDistance = initialDistance;
    this.target.effectiveRange = 3.5;
    this.target.isLoaded = false;
    this.target.isCovered = false;
    this.target.coverName = null;
    this.target.occlusionPercent = 0;
    this.target.health = 100;
    this.target.currentHits = 0;
    this.target.maxHits = 5;
    this.target.hitFlashUntil = 0;
    this.target.sparks = [];
    this.stepsTaken = 0;
    this.isSpawned = true;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      this.target.image = img;
      this.target.isLoaded = true;
    };
    img.onerror = () => {
      console.warn('[AR] Target image fallback');
      this.target.isLoaded = true;
    };
  }

  // Register Gunshot on Target with Distance & Cover Occlusion checks
  shoot() {
    if (!this.isSpawned) return { hit: false, reason: 'NO_TARGET' };
    if (this.target.health !== undefined && this.target.health <= 0) {
      return { hit: true, isEliminated: true, remainingHp: 0, hits: 5, maxHits: 5 };
    }

    // 1. Check Distance Requirement (Must breach into effective combat range)
    if (this.target.distance > this.target.effectiveRange) {
      return {
        hit: false,
        reason: 'OUT_OF_RANGE',
        distance: this.target.distance,
        effectiveRange: this.target.effectiveRange
      };
    }

    // 2. Check Line of Sight vs. Obstacle Cover
    if (this.target.isCovered && this.target.occlusionPercent > 0.35) {
      Sound.coverBlocked();
      return {
        hit: false,
        reason: 'BLOCKED_BY_COVER',
        coverName: this.target.coverName || 'FURNITURE',
        occlusionPercent: Math.round(this.target.occlusionPercent * 100)
      };
    }

    // 3. Check Crosshair Lock-on
    const isHit = this.isLocked || this.isInViewfinder;

    if (isHit) {
      this.target.currentHits = Math.min(this.target.maxHits, (this.target.currentHits || 0) + 1);
      this.target.health = Math.max(0, 100 - (this.target.currentHits * 20));
      this.target.hitFlashUntil = Date.now() + 180;

      // Spark particles for impact
      for (let i = 0; i < 15; i++) {
        this.target.sparks.push({
          x: (Math.random() - 0.5) * 40,
          y: (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12,
          life: 1.0,
          color: Math.random() > 0.4 ? '#ff9933' : '#ff334b'
        });
      }

      const isEliminated = this.target.health <= 0;
      if (isEliminated) {
        this.target.isDying = true;
        this.target.deathStartTime = Date.now();
        for (let i = 0; i < 35; i++) {
          this.target.sparks.push({
            x: (Math.random() - 0.5) * 50,
            y: (Math.random() - 0.5) * 70,
            vx: (Math.random() - 0.5) * 18,
            vy: (Math.random() - 0.5) * 18,
            life: 1.0,
            color: Math.random() > 0.3 ? '#ff334b' : '#ff9933'
          });
        }
      }

      return {
        hit: true,
        isEliminated,
        remainingHp: this.target.health,
        hits: this.target.currentHits,
        maxHits: this.target.maxHits
      };
    }

    return { hit: false, reason: 'OFF_TARGET' };
  }

  startLoop() {
    const render = () => {
      this.render();
      this.animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  render() {
    if (!this.ctx || !this.canvas || !this.container) return;

    // Auto-resize canvas
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round((rect.width || window.innerWidth) * dpr);
    const targetH = Math.round((rect.height || window.innerHeight) * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Run AI Object Detection on camera feed (throttled inside detector)
    if (this.videoElement && this.isCameraActive) {
      objectDetector.detect(this.videoElement, w, h);
    }
    const detectedObstacles = objectDetector.getObstacles();
    this.obstacles = detectedObstacles;

    // Draw Detected Tactical Obstacles in camera feed
    this.renderObstacleOverlays(ctx, detectedObstacles, dpr);

    // If target has not spawned yet, only emit sweep telemetry
    if (!this.isSpawned) {
      this.isInViewfinder = false;
      this.isLocked = false;
      if (this.onTelemetryUpdate) {
        this.onTelemetryUpdate({
          isSpawned: false,
          isInViewfinder: false,
          isLocked: false,
          distance: 0,
          isBreached: false,
          isCovered: false,
          coverName: null,
          azimuth: 0,
          health: 0,
          hits: 5,
          directionHint: '📡 SWEEPING SECTOR...'
        });
      }
      return;
    }

    const { heading, pitch } = this.getCurrentViewOrientation();

    // Angular delta between player heading and target azimuth
    let deltaAzimuth = this.target.azimuth - heading;
    while (deltaAzimuth > Math.PI) deltaAzimuth -= Math.PI * 2;
    while (deltaAzimuth < -Math.PI) deltaAzimuth += Math.PI * 2;

    let deltaAltitude = this.target.altitude - pitch;
    deltaAltitude = Math.max(-0.4, Math.min(0.4, deltaAltitude));

    const fovX = (65 * Math.PI) / 180;
    const focalLength = (w / 2) / Math.tan(fovX / 2);

    const relativeDeg = Math.round((deltaAzimuth * 180) / Math.PI);
    let directionHint = 'TARGET AHEAD';
    if (relativeDeg > 12) directionHint = `TURN RIGHT ❯❯ (${relativeDeg}°)`;
    else if (relativeDeg < -12) directionHint = `❮❮ TURN LEFT (${Math.abs(relativeDeg)}°)`;
    else directionHint = `⚡ IN FRONT (${relativeDeg}°)`;

    const isFront = Math.abs(deltaAzimuth) < (Math.PI / 1.8);
    let isInViewfinder = false;
    let isLocked = false;
    let targetScreenBounds = null;

    if (isFront) {
      const screenX = (w / 2) + Math.tan(deltaAzimuth) * focalLength;
      const screenY = (h / 2) - Math.tan(deltaAltitude) * focalLength;

      if (screenX > -300 * dpr && screenX < w + 300 * dpr) {
        if (screenX > 20 * dpr && screenX < w - 20 * dpr && screenY > 20 * dpr && screenY < h - 20 * dpr) {
          isInViewfinder = true;
        }

        // Perspective scaling inversely proportional to metric distance
        // e.g. 8.2m -> scale ~0.43 (small in distance); 2.2m -> scale ~1.6 (close & clear)
        const dist = Math.max(1.5, this.target.distance);
        const scale = (3.5 / dist) * dpr;
        const spriteW = 150 * scale;
        const spriteH = 280 * scale;

        targetScreenBounds = {
          x: screenX - spriteW / 2,
          y: screenY - spriteH / 2,
          w: spriteW,
          h: spriteH,
          centerX: screenX,
          centerY: screenY
        };

        // --- CHECK OBSTACLE COVER OCCLUSION ---
        let maxOcclusion = 0;
        let coveringObstacle = null;

        for (const obs of detectedObstacles) {
          const overlap = this.calculateOverlap(targetScreenBounds, obs);
          if (overlap.ratio > maxOcclusion) {
            maxOcclusion = overlap.ratio;
            coveringObstacle = obs;
          }
        }

        this.target.isCovered = maxOcclusion > 0.25;
        this.target.coverName = coveringObstacle ? coveringObstacle.label : null;
        this.target.occlusionPercent = maxOcclusion;

        ctx.save();
        ctx.translate(screenX, screenY);

        // Death collapse animation handling
        if (this.target.isDying) {
          const deathProgress = Math.min(1, (Date.now() - (this.target.deathStartTime || Date.now())) / 600);
          if (deathProgress >= 1) {
            this.isSpawned = false;
            this.target.isDying = false;
            ctx.restore();
            return;
          }
          ctx.translate(0, deathProgress * 50 * dpr);
          ctx.scale(1 - deathProgress * 0.35, 1 - deathProgress * 0.35);
          ctx.globalAlpha = Math.max(0, 1 - deathProgress);

          ctx.strokeStyle = '#ff334b';
          ctx.lineWidth = 3 * (1 - deathProgress) * dpr;
          ctx.beginPath();
          ctx.arc(0, 0, (spriteW / 2 + 10 * dpr) * (1 + deathProgress * 1.8), 0, Math.PI * 2);
          ctx.stroke();
        }

        const isHitFlashing = Date.now() < (this.target.hitFlashUntil || 0);
        const isBreached = this.target.distance <= this.target.effectiveRange;

        // 3D Threat Glow Ring
        if (!this.target.isDying) {
          if (this.target.isCovered) {
            ctx.strokeStyle = '#e5a93c'; // Yellow cover shield
            ctx.lineWidth = 2.5 * dpr;
            ctx.setLineDash([8 * dpr, 4 * dpr]);
          } else {
            ctx.strokeStyle = isHitFlashing ? '#ffffff' : (isBreached ? '#ff334b' : '#00f2fe');
            ctx.lineWidth = (isHitFlashing ? 4.5 : 3) * dpr;
            ctx.setLineDash([]);
          }

          ctx.beginPath();
          ctx.arc(0, 0, (spriteW / 2) + 16 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 3D HEALTH BAR
          const barW = 130 * dpr;
          const barH = 10 * dpr;
          const barY = -spriteH / 2 - 28 * dpr;
          const hpPercent = Math.max(0, (this.target.health || 100) / 100);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
          ctx.fillRect(-barW / 2, barY, barW, barH);
          ctx.strokeStyle = isBreached ? '#e5a93c' : '#00f2fe';
          ctx.lineWidth = 1 * dpr;
          ctx.strokeRect(-barW / 2, barY, barW, barH);

          ctx.fillStyle = hpPercent > 0.4 ? '#00ff88' : '#ff334b';
          ctx.fillRect(-barW / 2 + 1 * dpr, barY + 1 * dpr, (barW - 2 * dpr) * hpPercent, barH - 2 * dpr);

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${8 * dpr}px monospace`;
          ctx.textAlign = 'center';
          const hitPips = '●'.repeat(this.target.currentHits || 0) + '○'.repeat(Math.max(0, 5 - (this.target.currentHits || 0)));
          ctx.fillText(`HP: ${this.target.health}%  [${hitPips}]`, 0, barY - 4 * dpr);

          // Spatial Distance Tag (Above Target)
          const distTagY = barY - 14 * dpr;
          ctx.fillStyle = isBreached ? '#00ff88' : '#00f2fe';
          ctx.font = `bold ${9 * dpr}px monospace`;
          const distText = isBreached 
            ? `📍 ${this.target.distance.toFixed(1)}m [IN BREACH RANGE]` 
            : `📍 ${this.target.distance.toFixed(1)}m [STEP FORWARD]`;
          ctx.fillText(distText, 0, distTagY);
        }

        // Draw 3D Target Sprite
        if (this.target.isLoaded && this.target.image) {
          if (isHitFlashing) {
            ctx.filter = 'brightness(1.8) contrast(1.4) drop-shadow(0 0 15px #ff334b)';
          } else if (this.target.isCovered) {
            // Semi-transparent thermal ghosting when behind furniture cover
            ctx.globalAlpha = 0.55;
            ctx.filter = 'contrast(1.2) drop-shadow(0 0 8px #e5a93c)';
          }

          ctx.drawImage(this.target.image, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
          ctx.filter = 'none';
          ctx.globalAlpha = 1.0;
        } else {
          // Tactical Silhouette Fallback
          ctx.fillStyle = isHitFlashing ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 51, 75, 0.4)';
          ctx.fillRect(-spriteW / 2, -spriteH / 2, spriteW, spriteH);
          ctx.strokeStyle = '#ff334b';
          ctx.strokeRect(-spriteW / 2, -spriteH / 2, spriteW, spriteH);
        }

        // Draw Hit Sparks
        if (this.target.sparks && this.target.sparks.length > 0) {
          for (let i = this.target.sparks.length - 1; i >= 0; i--) {
            const p = this.target.sparks[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.08;
            if (p.life <= 0) {
              this.target.sparks.splice(i, 1);
              continue;
            }
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x * dpr, p.y * dpr, 3 * p.life * dpr, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 3D Hostile Label Tag / Cover Warning Tag
        const tagW = 140 * dpr;
        const tagH = 22 * dpr;
        const tagY = spriteH / 2 + 6 * dpr;

        if (this.target.isCovered) {
          ctx.fillStyle = '#e5a93c';
          ctx.fillRect(-tagW / 2, tagY, tagW, tagH);
          ctx.fillStyle = '#000000';
          ctx.font = `bold ${9 * dpr}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(`🛡️ IN COVER [${this.target.coverName}]`, 0, tagY + 15 * dpr);
        } else if (!isBreached) {
          ctx.fillStyle = 'rgba(0, 242, 254, 0.9)';
          ctx.fillRect(-tagW / 2, tagY, tagW, tagH);
          ctx.fillStyle = '#070a0b';
          ctx.font = `bold ${9 * dpr}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(`⚠️ STEP FORWARD (< 3.5m)`, 0, tagY + 15 * dpr);
        } else {
          ctx.fillStyle = isHitFlashing ? '#ffffff' : '#ff334b';
          ctx.fillRect(-tagW / 2, tagY, tagW, tagH);
          ctx.fillStyle = isHitFlashing ? '#ff0000' : '#ffffff';
          ctx.font = `bold ${10 * dpr}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(isHitFlashing ? '💥 BULLET IMPACT!' : 'HOSTILE TARGET', 0, tagY + 15 * dpr);
        }

        ctx.restore();

        // Check Crosshair Lock-on (only when in breach range and centered)
        const distFromCenter = Math.hypot(screenX - w / 2, screenY - h / 2);
        if (distFromCenter < 85 * dpr && isBreached && !this.target.isCovered) {
          isLocked = true;
        }
      }
    }

    this.isInViewfinder = isInViewfinder;
    this.isLocked = isLocked;

    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate({
        isSpawned: true,
        isInViewfinder,
        isLocked,
        distance: this.target.distance,
        isBreached: this.target.distance <= this.target.effectiveRange,
        isCovered: this.target.isCovered,
        coverName: this.target.coverName,
        occlusionPercent: Math.round(this.target.occlusionPercent * 100),
        stepsTaken: this.stepsTaken,
        azimuth: relativeDeg,
        health: this.target.health || 100,
        hits: this.target.currentHits || 0,
        directionHint
      });
    }
  }

  // Draw cybernetic bounding overlays for detected furniture & obstacles
  renderObstacleOverlays(ctx, obstacles, dpr) {
    if (!obstacles || obstacles.length === 0) return;

    ctx.save();
    for (const obs of obstacles) {
      const { x, y, width, height, label, score } = obs;

      // Obstacle bounding box
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Corner brackets
      const cornerLen = Math.min(16 * dpr, width * 0.2, height * 0.2);
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2.5 * dpr;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + width - cornerLen, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerLen);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerLen, y + height);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + width - cornerLen, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerLen);
      ctx.stroke();

      // Label Tag
      const labelText = `[${label} // ${score}%]`;
      ctx.font = `bold ${8.5 * dpr}px monospace`;
      const textMetrics = ctx.measureText(labelText);
      const tagW = textMetrics.width + 12 * dpr;
      const tagH = 16 * dpr;

      ctx.fillStyle = 'rgba(7, 10, 11, 0.85)';
      ctx.fillRect(x, Math.max(0, y - tagH), tagW, tagH);
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 1 * dpr;
      ctx.strokeRect(x, Math.max(0, y - tagH), tagW, tagH);

      ctx.fillStyle = '#00f2fe';
      ctx.textAlign = 'left';
      ctx.fillText(labelText, x + 6 * dpr, Math.max(0, y - tagH) + 11.5 * dpr);
    }
    ctx.restore();
  }

  // Calculate 2D overlap between target bounding box and obstacle bounding box
  calculateOverlap(targetBox, obstacleBox) {
    if (!targetBox || !obstacleBox) return { area: 0, ratio: 0 };

    const x1 = Math.max(targetBox.x, obstacleBox.x);
    const y1 = Math.max(targetBox.y, obstacleBox.y);
    const x2 = Math.min(targetBox.x + targetBox.w, obstacleBox.x + obstacleBox.width);
    const y2 = Math.min(targetBox.y + targetBox.h, obstacleBox.y + obstacleBox.height);

    if (x2 <= x1 || y2 <= y1) {
      return { area: 0, ratio: 0 };
    }

    const overlapArea = (x2 - x1) * (y2 - y1);
    const targetArea = targetBox.w * targetBox.h;
    const ratio = Math.min(1.0, overlapArea / Math.max(1, targetArea));

    return { area: overlapArea, ratio };
  }

  // Shutter Snapshot Evidence Capturer
  captureEvidencePhoto() {
    try {
      const offCanvas = document.createElement('canvas');
      const w = this.canvas && this.canvas.width ? this.canvas.width : 1280;
      const h = this.canvas && this.canvas.height ? this.canvas.height : 720;
      offCanvas.width = w;
      offCanvas.height = h;

      const ctx = offCanvas.getContext('2d');

      // 1. Draw video background
      if (this.isCameraActive && this.videoElement && this.videoElement.videoWidth) {
        try {
          ctx.drawImage(this.videoElement, 0, 0, w, h);
        } catch (e) {
          ctx.fillStyle = '#070a0b';
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        ctx.fillStyle = '#070a0b';
        ctx.fillRect(0, 0, w, h);
      }

      // 2. Draw 3D Target Layer
      if (this.canvas) {
        try {
          ctx.drawImage(this.canvas, 0, 0, w, h);
        } catch (e) {}
      }

      // 3. Tactical Military Stamp
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, w - 40, h - 40);

      ctx.fillStyle = '#e5a93c';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('TOP SECRET // OPERATION DHURANDAR RECON EVIDENCE', 40, 60);

      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px monospace';
      ctx.fillText(`TIMESTAMP: ${timestamp} | RANGE: ${this.target.distance.toFixed(1)}m`, 40, 85);

      try {
        return offCanvas.toDataURL('image/jpeg', 0.8);
      } catch (e) {
        console.warn('[AR] Canvas toDataURL security restriction:', e);
        return null;
      }
    } catch (err) {
      console.warn('[AR] Evidence capture fallback:', err);
      return null;
    }
  }

  stop() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.cameraStream) {
      try {
        this.cameraStream.getTracks().forEach(track => track.stop());
      } catch (e) {}
      this.cameraStream = null;
    }
    this.isCameraActive = false;
    this.isSpawned = false;
    this.target.isLoaded = false;
    this.target.image = null;
    this.target.health = 100;
    this.target.currentHits = 0;
    this.target.sparks = [];
    this.target.isCovered = false;
  }
}

export const arEngine = new AREngine();
