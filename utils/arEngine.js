// Self-contained, High-Performance 3D AR Engine with ZERO external CDN dependencies

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

    // Target in 3D Space (Spherical coordinates)
    this.target = {
      azimuth: Math.random() * Math.PI * 2, // 0 to 360 deg
      altitude: (Math.random() - 0.5) * 0.4, // -11 to +11 deg
      distance: 4.5, // meters
      image: null,
      isLoaded: false
    };

    // Telemetry & Lock-on
    this.isLocked = false;
    this.onTelemetryUpdate = null;
  }

  // Request Mobile Permissions (Camera & iOS Gyro)
  async requestPermissions() {
    let gyroGranted = false;
    let cameraGranted = false;

    // 1. Gyroscope Permission FIRST (MUST be synchronous in user gesture context for iOS Safari!)
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
    } catch (e) {
      console.warn('[AR] Gyro permission request:', e);
      this.hasGyroPermission = true; // Fallback to event listening
    }

    this.bindSensors();

    // 2. Camera Permission SECOND
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

  init(container, videoElement, onTelemetryUpdate) {
    this.container = container;
    this.videoElement = videoElement;
    this.onTelemetryUpdate = onTelemetryUpdate;

    // Create 3D Projection Canvas
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
    this.startLoop();
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

  // Spawn Target Sprite Fixed in 3D Space (Gated by Spawn Trigger)
  spawnTarget(imageUrl) {
    const current = this.getCurrentViewOrientation();
    
    // Spawn target offset 65 to 110 degrees away from current gaze (requires player to turn & hunt!)
    const sign = Math.random() > 0.5 ? 1 : -1;
    const randomAngleOffset = sign * (Math.PI / 2.8 + Math.random() * (Math.PI / 3.5)); // 65° to 115°
    
    this.target.azimuth = (current.heading + randomAngleOffset + Math.PI * 2) % (Math.PI * 2);
    this.target.altitude = current.pitch;
    this.target.distance = 3.8;
    this.target.isLoaded = false;
    this.target.health = 100;
    this.target.currentHits = 0;
    this.target.maxHits = 5;
    this.target.hitFlashUntil = 0;
    this.target.sparks = [];
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

  // Register Gunshot on Target
  shoot() {
    if (!this.isSpawned) return { hit: false, reason: 'NO_TARGET' };
    if (this.target.health !== undefined && this.target.health <= 0) {
      return { hit: true, isEliminated: true, remainingHp: 0, hits: 5, maxHits: 5 };
    }

    // Check if target is locked or in crosshair zone
    const isHit = this.isLocked || this.isInViewfinder;

    if (isHit) {
      this.target.currentHits = Math.min(this.target.maxHits, (this.target.currentHits || 0) + 1);
      this.target.health = Math.max(0, 100 - (this.target.currentHits * 20));
      this.target.hitFlashUntil = Date.now() + 180;

      // Spawn spark particles for bullet impact
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

    // Dynamic auto-resize to handle screen transitions & orientation changes
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
          azimuth: 0,
          health: 100,
          hits: 0,
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

    // Field of View
    const fovX = (65 * Math.PI) / 180;
    const focalLength = (w / 2) / Math.tan(fovX / 2);

    // Relative degrees for radar & arrow guide
    const relativeDeg = Math.round((deltaAzimuth * 180) / Math.PI);
    let directionHint = 'TARGET AHEAD';
    if (relativeDeg > 12) directionHint = `TURN RIGHT ❯❯ (${relativeDeg}°)`;
    else if (relativeDeg < -12) directionHint = `❮❮ TURN LEFT (${Math.abs(relativeDeg)}°)`;
    else directionHint = `⚡ IN FRONT (${relativeDeg}°)`;

    // Is target in front of camera?
    const isFront = Math.abs(deltaAzimuth) < (Math.PI / 1.8);
    let isInViewfinder = false;
    let isLocked = false;

    if (isFront) {
      // Perspective projection onto screen
      const screenX = (w / 2) + Math.tan(deltaAzimuth) * focalLength;
      const screenY = (h / 2) - Math.tan(deltaAltitude) * focalLength;

      // Draw when on or near screen
      if (screenX > -250 * dpr && screenX < w + 250 * dpr) {
        // Target is inside viewfinder
        if (screenX > 20 * dpr && screenX < w - 20 * dpr && screenY > 20 * dpr && screenY < h - 20 * dpr) {
          isInViewfinder = true;
        }

        const scale = (4.0 / this.target.distance) * dpr;
        const spriteW = 150 * scale;
        const spriteH = 280 * scale;

        ctx.save();
        ctx.translate(screenX, screenY);

        const isHitFlashing = Date.now() < (this.target.hitFlashUntil || 0);

        // 3D Threat Glow Ring
        ctx.strokeStyle = isHitFlashing ? '#ffffff' : (isInViewfinder ? '#ff334b' : '#ff9933');
        ctx.lineWidth = (isHitFlashing ? 4.5 : 3) * dpr;
        ctx.beginPath();
        ctx.arc(0, 0, (spriteW / 2) + 16 * dpr, 0, Math.PI * 2);
        ctx.stroke();

        // 3D HEALTH BAR (Top of Hostile)
        const barW = 130 * dpr;
        const barH = 10 * dpr;
        const barY = -spriteH / 2 - 28 * dpr;
        const hpPercent = Math.max(0, (this.target.health || 100) / 100);

        // Bar Container Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(-barW / 2, barY, barW, barH);
        ctx.strokeStyle = '#e5a93c';
        ctx.lineWidth = 1 * dpr;
        ctx.strokeRect(-barW / 2, barY, barW, barH);

        // Bar Fill
        ctx.fillStyle = hpPercent > 0.4 ? '#00ff88' : '#ff334b';
        ctx.fillRect(-barW / 2 + 1 * dpr, barY + 1 * dpr, (barW - 2 * dpr) * hpPercent, barH - 2 * dpr);

        // Health & Hit Pips Text
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${8 * dpr}px monospace`;
        ctx.textAlign = 'center';
        const hitPips = '●'.repeat(this.target.currentHits || 0) + '○'.repeat(Math.max(0, 5 - (this.target.currentHits || 0)));
        ctx.fillText(`HP: ${this.target.health}%  [${hitPips}]`, 0, barY - 4 * dpr);

        // Draw 3D Target Sprite or Silhouette Fallback
        if (this.target.isLoaded && this.target.image) {
          if (isHitFlashing) {
            ctx.filter = 'brightness(1.8) contrast(1.4) drop-shadow(0 0 15px #ff334b)';
          }
          ctx.drawImage(this.target.image, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
          ctx.filter = 'none';
        } else {
          // Tactical Silhouette
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

        // 3D Hostile Label Tag
        ctx.fillStyle = isHitFlashing ? '#ffffff' : '#ff334b';
        ctx.fillRect(-65 * dpr, spriteH / 2 + 6 * dpr, 130 * dpr, 22 * dpr);
        ctx.fillStyle = isHitFlashing ? '#ff0000' : '#ffffff';
        ctx.font = `bold ${10 * dpr}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(isHitFlashing ? '💥 BULLET IMPACT!' : 'HOSTILE TARGET', 0, spriteH / 2 + 21 * dpr);

        ctx.restore();

        // Check Crosshair Lock-on (distance from center of screen)
        const distFromCenter = Math.hypot(screenX - w / 2, screenY - h / 2);
        if (distFromCenter < 85 * dpr) {
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
        azimuth: relativeDeg,
        health: this.target.health || 100,
        hits: this.target.currentHits || 0,
        directionHint
      });
    }
  }

  // Shutter Snapshot Evidence Capturer
  captureEvidencePhoto() {
    const offCanvas = document.createElement('canvas');
    const w = this.canvas ? this.canvas.width : 1280;
    const h = this.canvas ? this.canvas.height : 720;
    offCanvas.width = w;
    offCanvas.height = h;

    const ctx = offCanvas.getContext('2d');

    // 1. Draw video background
    if (this.isCameraActive && this.videoElement && this.videoElement.videoWidth) {
      ctx.drawImage(this.videoElement, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#070a0b';
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Draw 3D Target Layer
    if (this.canvas) {
      ctx.drawImage(this.canvas, 0, 0, w, h);
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
    ctx.fillText(`TIMESTAMP: ${timestamp}`, 40, 85);

    return offCanvas.toDataURL('image/jpeg', 0.85);
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    this.isCameraActive = false;
  }
}

export const arEngine = new AREngine();
