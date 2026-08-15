// Real-Time Computer Vision Object Detection Engine
// Uses TensorFlow.js COCO-SSD for tactical furniture & cover obstacle identification

class ObjectDetector {
  constructor() {
    this.model = null;
    this.isLoading = false;
    this.isLoaded = false;
    this.lastDetectionTime = 0;
    this.detectionInterval = 180; // Run inference every 180ms to keep 60 FPS rendering
    this.isDetecting = false;
    this.obstacles = [];

    // Target furniture and obstacle classes relevant for indoor tactical cover
    this.coverClasses = new Set([
      'couch',
      'sofa',
      'chair',
      'dining table',
      'table',
      'bed',
      'tv',
      'potted plant',
      'refrigerator',
      'bench',
      'desk',
      'suitcase',
      'toilet'
    ]);
  }

  // Load TensorFlow.js and COCO-SSD asynchronously via CDN
  async init() {
    if (this.isLoaded || this.isLoading) return;
    this.isLoading = true;

    try {
      // 1. Ensure TensorFlow.js core is loaded
      if (typeof window.tf === 'undefined') {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      }

      // 2. Ensure COCO-SSD model is loaded
      if (typeof window.cocoSsd === 'undefined') {
        await this.loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      }

      if (window.cocoSsd) {
        console.log('[CV] Loading COCO-SSD model...');
        this.model = await window.cocoSsd.load({
          base: 'lite_mobilenet_v2' // Ultra-fast lightweight model for real-time mobile AR
        });
        this.isLoaded = true;
        this.isLoading = false;
        console.log('[CV] COCO-SSD Model successfully loaded and ready for AR cover detection!');
      }
    } catch (err) {
      console.warn('[CV] Object detection initialization note (running in heuristic mode):', err);
      this.isLoading = false;
    }
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  // Detect obstacles in video stream and project into canvas coordinate system
  async detect(videoElement, canvasWidth, canvasHeight) {
    if (!this.isLoaded || !this.model || !videoElement || this.isDetecting) {
      return this.obstacles;
    }

    const now = performance.now();
    if (now - this.lastDetectionTime < this.detectionInterval) {
      return this.obstacles;
    }

    if (videoElement.readyState < 2 || !videoElement.videoWidth) {
      return this.obstacles;
    }

    this.isDetecting = true;
    this.lastDetectionTime = now;

    try {
      const predictions = await this.model.detect(videoElement);
      const videoW = videoElement.videoWidth;
      const videoH = videoElement.videoHeight;

      // Scaling factors from video feed to AR canvas
      const scaleX = canvasWidth / videoW;
      const scaleY = canvasHeight / videoH;

      const detectedObstacles = [];

      predictions.forEach((pred, idx) => {
        const className = pred.class.toLowerCase();
        // Check if class is a tactical cover object and passes confidence threshold
        if (this.coverClasses.has(className) && pred.score >= 0.45) {
          const [vx, vy, vw, vh] = pred.bbox;

          detectedObstacles.push({
            id: `obs-${idx}`,
            class: className,
            label: className.toUpperCase(),
            score: Math.round(pred.score * 100),
            x: vx * scaleX,
            y: vy * scaleY,
            width: vw * scaleX,
            height: vh * scaleY,
            rawBbox: [vx, vy, vw, vh],
            timestamp: Date.now()
          });
        }
      });

      this.obstacles = detectedObstacles;
    } catch (err) {
      console.warn('[CV] Detection frame error:', err);
    } finally {
      this.isDetecting = false;
    }

    return this.obstacles;
  }

  getObstacles() {
    return this.obstacles;
  }
}

export const objectDetector = new ObjectDetector();
