/**
 * F1 Draft - Spinning Wheel Canvas Engine
 */

class WheelEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.drivers = [];
    this.currentAngle = 0; // In radians
    this.isSpinning = false;
    this.idleAnimId = null;

    // Visual Palette for Wheel Slices
    this.colors = [
      '#E10600', // Official Red
      '#1A1A24', // Deep Charcoal
      '#FF3333', // Bright Red
      '#282838', // Metallic Gray
      '#B30000', // Dark F1 Red
      '#12121A'  // Chassis Black
    ];

    this.startIdleAnimation();
  }

  setDrivers(driverList) {
    this.drivers = [...driverList];
    this.draw();
  }

  startIdleAnimation() {
    if (this.idleAnimId) cancelAnimationFrame(this.idleAnimId);

    const idleLoop = () => {
      if (!this.isSpinning && this.drivers.length > 0) {
        // Continuous slow rotation drift (~0.0035 rad/frame or ~0.2 deg)
        this.currentAngle += 0.0035;
        this.draw();
      }
      this.idleAnimId = requestAnimationFrame(idleLoop);
    };

    this.idleAnimId = requestAnimationFrame(idleLoop);
  }

  stopIdleAnimation() {
    if (this.idleAnimId) {
      cancelAnimationFrame(this.idleAnimId);
      this.idleAnimId = null;
    }
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = width / 2 - 15;
    const innerRadius = 50;

    ctx.clearRect(0, 0, width, height);

    if (this.drivers.length === 0) {
      // Draw empty wheel state
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
      ctx.fillStyle = '#1A1A24';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#E10600';
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WHEEL CLEARED', centerX, centerY);
      return;
    }

    const numSlices = this.drivers.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Clean flat top-down rotation without 3D skewing
    ctx.save();
    ctx.rotate(this.currentAngle);

    for (let i = 0; i < numSlices; i++) {
      const angleStart = i * sliceAngle;
      const angleEnd = angleStart + sliceAngle;

      // Draw Slice Segment
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, angleStart, angleEnd);
      ctx.arc(0, 0, innerRadius, angleEnd, angleStart, true);
      ctx.closePath();

      ctx.fillStyle = this.colors[i % this.colors.length];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.stroke();

      // Draw Driver Name Text
      ctx.save();
      const textAngle = angleStart + sliceAngle / 2;
      ctx.rotate(textAngle);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';

      const fontSize = Math.max(12, Math.min(18, 300 / numSlices));
      ctx.font = `bold ${fontSize}px 'Chakra Petch', 'Titillium Web', sans-serif`;

      const driverName = this.drivers[i];
      const displayName = driverName.length > 16 ? driverName.substring(0, 14) + '..' : driverName;
      ctx.fillText(displayName.toUpperCase(), outerRadius - 20, 0);
      ctx.restore();
    }

    // Outer Red & Chrome Metallic Chassis Rim
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, 2 * Math.PI);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#E10600';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, outerRadius + 5, 0, 2 * Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();

    // Metallic Gear / Wheel Central Hub Structure
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius + 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#1A1A26';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#383850';
    ctx.stroke();

    // Gear Teeth Accents on Central Hub
    const numTeeth = 8;
    for (let t = 0; t < numTeeth; t++) {
      const toothAngle = (t * 2 * Math.PI) / numTeeth;
      const tx = Math.cos(toothAngle) * (innerRadius + 4);
      const ty = Math.sin(toothAngle) * (innerRadius + 4);
      ctx.beginPath();
      ctx.arc(tx, ty, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#E10600';
      ctx.fill();
    }

    // Inner Hub Cap
    ctx.beginPath();
    ctx.arc(0, 0, innerRadius - 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#0B0B10';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#E10600';
    ctx.stroke();

    // Engraved F1 Center Hub Typography
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'italic 900 18px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('F1', 0, 0);

    ctx.restore(); // Restore wheel rotation
    ctx.restore(); // Restore translate

    // Draw Telemetry Laser Pointer Line down to center hub
    const pulseGlow = Math.sin(performance.now() / 200) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - outerRadius);
    ctx.lineTo(centerX, centerY - innerRadius);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255, 51, 51, ${pulseGlow})`;
    ctx.shadowColor = '#FF3333';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  spin(onComplete) {
    if (this.isSpinning || this.drivers.length === 0) return;

    this.isSpinning = true;
    const spinDuration = 4000; // 4 seconds spin
    const startTime = performance.now();

    // Calculate random total rotation (between 5 and 10 full spins) plus target angle
    const extraSpins = 5 + Math.random() * 5;
    const targetRotation = extraSpins * 2 * Math.PI;
    const startAngle = this.currentAngle;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);

      // Ease Out Cubic easing formula
      const easeOut = 1 - Math.pow(1 - progress, 3);
      this.currentAngle = startAngle + easeOut * targetRotation;

      this.draw();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isSpinning = false;
        // Normalize angle within 0 to 2PI
        this.currentAngle = this.currentAngle % (2 * Math.PI);

        // Determine winning slice under top pointer (Pointer is at 12 o'clock, which is -Math.PI / 2)
        const winningIndex = this.getWinningSliceIndex();
        const selectedDriver = this.drivers[winningIndex];

        if (typeof onComplete === 'function') {
          onComplete(selectedDriver, winningIndex);
        }
      }
    };

    requestAnimationFrame(animate);
  }

  getWinningSliceIndex() {
    if (this.drivers.length === 0) return -1;

    const numSlices = this.drivers.length;
    const sliceAngle = (2 * Math.PI) / numSlices;

    // Pointer is positioned at top center (12 o'clock / -90 deg / 1.5 * PI)
    // In canvas rotation space, wheel angle rotates clockwise.
    let pointerAngle = (1.5 * Math.PI - this.currentAngle) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    const index = Math.floor(pointerAngle / sliceAngle) % numSlices;
    return index;
  }

  removeDriver(driverName) {
    this.drivers = this.drivers.filter(d => d !== driverName);
    this.draw();
  }
}

// Global Wheel Instance
let globalWheelEngine = null;
