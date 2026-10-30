/**
 * F1 Draft - Live Track Simulator & Telemetry Engine
 * Features: Vector Track Circuit Canvas, Driver Physics Dots, Commentary Feed,
 * Safety Car / Incidents, Weather Variances, Real-time Leaderboards & Points Scoring.
 */

const F1Simulator = {
  canvas: null,
  ctx: null,
  animationFrameId: null,

  // Sim State
  isPlaying: false,
  simSpeed: 1, // 1x, 2x, 5x
  currentLap: 1,
  totalLaps: 20,
  weather: 'dry', // 'dry' or 'wet'
  trackKey: 'monza',
  safetyCarActive: false,
  safetyCarLapsRemaining: 0,

  // Cars Array (Strictly for player-drafted drivers)
  cars: [],

  // Commentary Log
  commentaryLogs: [],

  // F1 Championship Points Scale
  pointsScale: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],

  // Track Circuit Vector Geometry Definitions & Realistic DRS Zones
  tracks: {
    monaco: {
      name: 'Monaco - Circuit de Monaco',
      lengthKm: 3.337,
      baseLapTime: 72.0,
      drsZones: [{ start: 0.88, end: 0.08, label: 'DRS ZONE 1' }],
      path: [
        { x: 0.35, y: 0.28, type: 'straight' },
        { x: 0.28, y: 0.18, type: 'corner', speedFactor: 0.4 },
        { x: 0.42, y: 0.22, type: 'straight' },
        { x: 0.60, y: 0.25, type: 'corner', speedFactor: 0.55 },
        { x: 0.82, y: 0.32, type: 'corner', speedFactor: 0.45 },
        { x: 0.88, y: 0.45, type: 'corner', speedFactor: 0.25 },
        { x: 0.78, y: 0.40, type: 'corner', speedFactor: 0.4 },
        { x: 0.70, y: 0.48, type: 'straight' },
        { x: 0.52, y: 0.58, type: 'straight' },
        { x: 0.45, y: 0.68, type: 'corner', speedFactor: 0.45 },
        { x: 0.38, y: 0.78, type: 'corner', speedFactor: 0.55 },
        { x: 0.32, y: 0.85, type: 'corner', speedFactor: 0.5 },
        { x: 0.24, y: 0.88, type: 'corner', speedFactor: 0.3 },
        { x: 0.28, y: 0.75, type: 'corner', speedFactor: 0.45 },
        { x: 0.35, y: 0.28, type: 'straight' }
      ]
    },
    monza: {
      name: 'Monza - Temple of Speed',
      lengthKm: 5.793,
      baseLapTime: 81.0,
      drsZones: [
        { start: 0.85, end: 0.12, label: 'DRS ZONE 1' },
        { start: 0.35, end: 0.55, label: 'DRS ZONE 2' }
      ],
      path: [
        { x: 0.10, y: 0.75, type: 'straight' },
        { x: 0.80, y: 0.75, type: 'corner', speedFactor: 0.45 },
        { x: 0.85, y: 0.50, type: 'straight' },
        { x: 0.80, y: 0.25, type: 'corner', speedFactor: 0.5 },
        { x: 0.50, y: 0.20, type: 'straight' },
        { x: 0.20, y: 0.25, type: 'corner', speedFactor: 0.55 },
        { x: 0.10, y: 0.50, type: 'corner', speedFactor: 0.65 }
      ]
    },
    spa: {
      name: 'Spa - Francorchamps',
      lengthKm: 7.004,
      baseLapTime: 104.0,
      drsZones: [
        { start: 0.25, end: 0.48, label: 'KEMMEL DRS' },
        { start: 0.82, end: 0.08, label: 'PIT DRS' }
      ],
      path: [
        { x: 0.15, y: 0.80, type: 'straight' },
        { x: 0.30, y: 0.85, type: 'corner', speedFactor: 0.4 },
        { x: 0.55, y: 0.70, type: 'straight' },
        { x: 0.85, y: 0.50, type: 'straight' },
        { x: 0.80, y: 0.20, type: 'corner', speedFactor: 0.5 },
        { x: 0.50, y: 0.15, type: 'corner', speedFactor: 0.6 },
        { x: 0.20, y: 0.30, type: 'straight' },
        { x: 0.10, y: 0.60, type: 'corner', speedFactor: 0.35 }
      ]
    },
    silverstone: {
      name: 'Silverstone - GP Circuit',
      lengthKm: 5.891,
      baseLapTime: 87.0,
      drsZones: [
        { start: 0.25, end: 0.40, label: 'WELLINGTON DRS' },
        { start: 0.65, end: 0.80, label: 'HANGAR DRS' }
      ],
      path: [
        { x: 0.15, y: 0.70, type: 'straight' },
        { x: 0.35, y: 0.80, type: 'corner', speedFactor: 0.6 },
        { x: 0.60, y: 0.75, type: 'straight' },
        { x: 0.85, y: 0.60, type: 'corner', speedFactor: 0.5 },
        { x: 0.80, y: 0.30, type: 'corner', speedFactor: 0.7 },
        { x: 0.50, y: 0.20, type: 'straight' },
        { x: 0.20, y: 0.30, type: 'corner', speedFactor: 0.55 },
        { x: 0.10, y: 0.50, type: 'corner', speedFactor: 0.45 }
      ]
    },
    suzuka: {
      name: 'Suzuka - International Racing Course',
      lengthKm: 5.807,
      baseLapTime: 89.0,
      drsZones: [{ start: 0.85, end: 0.12, label: 'DRS ZONE 1' }],
      path: [
        { x: 0.15, y: 0.75, type: 'straight' },
        { x: 0.35, y: 0.85, type: 'corner', speedFactor: 0.6 },
        { x: 0.60, y: 0.70, type: 'corner', speedFactor: 0.5 },
        { x: 0.80, y: 0.50, type: 'straight' },
        { x: 0.75, y: 0.25, type: 'corner', speedFactor: 0.4 },
        { x: 0.45, y: 0.20, type: 'straight' },
        { x: 0.25, y: 0.35, type: 'corner', speedFactor: 0.65 },
        { x: 0.40, y: 0.55, type: 'straight' },
        { x: 0.10, y: 0.60, type: 'corner', speedFactor: 0.35 }
      ]
    },
    interlagos: {
      name: 'Interlagos - Autódromo José Carlos Pace',
      lengthKm: 4.309,
      baseLapTime: 70.5,
      drsZones: [
        { start: 0.85, end: 0.15, label: 'MAIN DRS' },
        { start: 0.20, end: 0.40, label: 'RETA OPOSTA DRS' }
      ],
      path: [
        { x: 0.20, y: 0.75, type: 'straight' },
        { x: 0.40, y: 0.85, type: 'corner', speedFactor: 0.45 },
        { x: 0.75, y: 0.70, type: 'straight' },
        { x: 0.85, y: 0.45, type: 'corner', speedFactor: 0.5 },
        { x: 0.65, y: 0.20, type: 'corner', speedFactor: 0.4 },
        { x: 0.35, y: 0.25, type: 'corner', speedFactor: 0.5 },
        { x: 0.15, y: 0.45, type: 'straight' }
      ]
    }
  },

  initSimulator() {
    this.canvas = document.getElementById('sim-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Reset Sim State
    this.isPlaying = false;
    this.simSpeed = 1;
    this.currentLap = 1;
    this.safetyCarActive = false;
    this.safetyCarLapsRemaining = 0;
    this.commentaryLogs = [];

    this.trackKey = document.getElementById('sim-track-select').value || 'monza';
    this.weather = document.getElementById('sim-weather-select').value || 'dry';

    // 1. Build Drivers Array strictly from human drafted players
    this.buildDraftedCarsList();

    // 2. Event Listeners for Controls
    document.getElementById('sim-track-select').addEventListener('change', (e) => {
      this.trackKey = e.target.value;
      this.resetSimulation();
    });

    document.getElementById('sim-weather-select').addEventListener('change', (e) => {
      this.weather = e.target.value;
      this.logCommentary(`Weather updated to ${this.weather === 'wet' ? 'Heavy Rain / Wet Track' : 'Dry Conditions'}.`, 'system');
      document.getElementById('telemetry-weather-indicator').textContent = this.weather === 'wet' ? '🌧️ WET' : '☀️ DRY';
    });

    document.getElementById('btn-sim-play').onclick = () => this.play();
    document.getElementById('btn-sim-pause').onclick = () => this.pause();

    // Speed buttons
    document.querySelectorAll('.btn-speed').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
        if (e.target.id === 'btn-sim-instant') {
          e.target.classList.add('active');
          this.runInstantFinish();
        } else {
          e.target.classList.add('active');
          this.simSpeed = parseFloat(e.target.dataset.speed) || 1;
        }
      };
    });

    this.logCommentary(`Grid formed with ${this.cars.length} drafted drivers. Click PLAY to start!`, 'system');
    this.renderFrame();
  },

  buildDraftedCarsList() {
    this.cars = [];
    let carId = 1;

    // Collect all drafted drivers across all players using custom normalized driver skill ratings
    F1App.state.players.forEach(player => {
      player.roster.forEach(item => {
        // Look up skill from global driverMap or item object fallback
        const driverData = F1App.state.driverMap[item.name];
        const driverSkill = item.skill || (driverData ? driverData.skill : 82);

        // Qualifying time formula strictly reflects driver skill rating + slight random variance
        const qualyTime = (100 - driverSkill) + (Math.random() * 1.5 - 0.75);

        this.cars.push({
          id: carId++,
          driverName: item.name,
          playerName: player.name,
          color: player.color,
          skill: driverSkill,
          qualyTime: qualyTime,
          // Telemetry
          progress: 0, // 0 to 1 along circuit
          lap: 1,
          isDNF: false,
          dnfReason: null,
          lapTimes: [],
          bestLap: null,
          currentSpeed: 0
        });
      });
    });

    // Sort grid by qualifying lap times
    this.cars.sort((a, b) => a.qualyTime - b.qualyTime);

    // Give slight staggered start progress based on grid position
    this.cars.forEach((car, index) => {
      car.gridPos = index + 1;
      car.progress = Math.max(0, 0.05 - index * 0.008);
    });
  },

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    document.getElementById('btn-sim-play').classList.add('btn-active');
    document.getElementById('btn-sim-pause').classList.remove('btn-active');
    document.getElementById('sim-status-badge').textContent = 'RACE IN PROGRESS';
    document.getElementById('sim-status-badge').style.background = '#00A859';
    this.loop();
  },

  pause() {
    this.isPlaying = false;
    document.getElementById('btn-sim-play').classList.remove('btn-active');
    document.getElementById('btn-sim-pause').classList.add('btn-active');
    document.getElementById('sim-status-badge').textContent = 'PAUSED';
    document.getElementById('sim-status-badge').style.background = '#E10600';
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  },

  resetSimulation() {
    this.pause();
    this.currentLap = 1;
    this.safetyCarActive = false;
    this.safetyCarLapsRemaining = 0;
    this.buildDraftedCarsList();
    this.commentaryLogs = [];
    document.getElementById('commentary-feed').innerHTML = '';
    this.logCommentary(`Track changed to ${this.tracks[this.trackKey].name}. Sim reset.`, 'system');
    this.renderFrame();
  },

  loop() {
    if (!this.isPlaying) return;

    this.updatePhysics();
    this.renderFrame();

    if (this.currentLap > this.totalLaps) {
      this.finishRace();
      return;
    }

    this.animationFrameId = requestAnimationFrame(() => this.loop());
  },

  updatePhysics() {
    const track = this.tracks[this.trackKey];
    // Base speed increment per frame
    const baseSpeed = (1 / (track.baseLapTime * 60)) * this.simSpeed;

    // Process each car
    this.cars.forEach((car) => {
      if (car.isDNF) return;

      // Calculate current position segment speed multiplier
      const waypoint = this.getSegmentWaypoint(car.progress, track);
      let speedMult = waypoint.speedFactor || 1.0;

      // Track-Specific Physics Modifiers
      if (this.trackKey === 'monaco') {
        speedMult *= 0.80; // Monaco: -20% speed
      } else if (this.trackKey === 'monza') {
        if (waypoint.type === 'straight') {
          speedMult *= 1.25; // Monza: +25% top speed on straights
        }
      } else if (this.trackKey === 'silverstone') {
        // Silverstone: High tire wear modifier (progressively slows speed over race duration)
        const tireWearFactor = Math.max(0.85, 1.0 - (car.lap / this.totalLaps) * 0.15);
        speedMult *= tireWearFactor;
      } else if (this.trackKey === 'suzuka') {
        // Suzuka: +15% performance boost in Sector 1 (S-Curves) for higher skill drivers (>= 80)
        if (car.progress <= 0.35 && car.skill >= 80) {
          speedMult *= 1.15;
        }
      }

      // Weather penalty
      if (this.weather === 'wet') {
        speedMult *= 0.85;
      }

      // Safety car restriction
      if (this.safetyCarActive) {
        speedMult = Math.min(speedMult, 0.4);
      }

      // Skill influence (+/- 15%)
      const skillMult = 0.85 + (car.skill / 100) * 0.3;

      // Advance car progress
      const frameProgress = baseSpeed * speedMult * skillMult;
      car.progress += frameProgress;

      // Check Lap Completion
      if (car.progress >= 1.0) {
        car.progress -= 1.0;
        car.lap += 1;

        // Calculate lap time
        const lapTimeSec = track.baseLapTime * (1 / skillMult) + (Math.random() * 2 - 1);
        car.lapTimes.push(lapTimeSec);
        if (!car.bestLap || lapTimeSec < car.bestLap) {
          car.bestLap = lapTimeSec;
        }

        // Random DNF Incident Chance
        let dnfThreshold = this.weather === 'wet' ? 0.035 : 0.015;
        if (this.trackKey === 'monaco') {
          dnfThreshold *= 1.30; // Monaco: +30% crash/SC chance
        } else if (this.trackKey === 'interlagos' && this.weather === 'wet') {
          dnfThreshold *= 1.25; // Interlagos: +25% crash chance under wet conditions
        }

        if (Math.random() < dnfThreshold && car.lap > 1 && !this.safetyCarActive) {
          car.isDNF = true;
          car.dnfReason = this.weather === 'wet' ? 'Aquaplaned / Crash' : 'Engine Breakdown';
          this.logCommentary(`💥 CRASH! ${car.driverName} (${car.playerName}) suffers ${car.dnfReason}!`, 'incident');
          this.triggerSafetyCar();
        }
      }
    });

    // Update global current lap counter (based on leader)
    const leader = [...this.cars].sort((a, b) => (b.lap + b.progress) - (a.lap + a.progress))[0];
    if (leader) {
      this.currentLap = Math.min(leader.lap, this.totalLaps + 1);
    }

    // Process Safety Car Laps
    if (this.safetyCarActive) {
      this.safetyCarLapsRemaining -= 0.005 * this.simSpeed;
      if (this.safetyCarLapsRemaining <= 0) {
        this.safetyCarActive = false;
        this.logCommentary('🟢 SAFETY CAR IN THIS LAP! Green flag racing resumes!', 'system');
      }
    }

    // Process Overtaking logic & Commentary
    this.processOvertakes();
  },

  getSegmentWaypoint(progress, track) {
    const numPoints = track.path.length;
    const index = Math.floor(progress * numPoints) % numPoints;
    return track.path[index];
  },

  getCanvasCoords(progress, track) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const path = track.path;
    const numPoints = path.length;

    const exactIndex = (progress % 1) * numPoints;
    const idx1 = Math.floor(exactIndex) % numPoints;
    const idx0 = (idx1 - 1 + numPoints) % numPoints;
    const idx2 = (idx1 + 1) % numPoints;
    const t = exactIndex - Math.floor(exactIndex);

    const p0 = path[idx0];
    const p1 = path[idx1];
    const p2 = path[idx2];

    // Smooth quadratic spline point calculation matching curve rendering
    const mid1X = (p0.x + p1.x) / 2;
    const mid1Y = (p0.y + p1.y) / 2;
    const mid2X = (p1.x + p2.x) / 2;
    const mid2Y = (p1.y + p2.y) / 2;

    const x = ((1 - t) * (1 - t) * mid1X + 2 * (1 - t) * t * p1.x + t * t * mid2X) * width;
    const y = ((1 - t) * (1 - t) * mid1Y + 2 * (1 - t) * t * p1.y + t * t * mid2Y) * height;

    return { x, y };
  },

  processOvertakes() {
    // Sort cars by current distance completed
    const activeCars = this.cars.filter(c => !c.isDNF);
    activeCars.sort((a, b) => (b.lap + b.progress) - (a.lap + a.progress));

    for (let i = 0; i < activeCars.length - 1; i++) {
      const ahead = activeCars[i];
      const behind = activeCars[i + 1];

      const gap = (ahead.lap + ahead.progress) - (behind.lap + behind.progress);

      // Skill-weighted overtake probability: higher-skilled driver behind has much higher chance to pass
      const skillDiff = behind.skill - ahead.skill;
      const baseOvertakeChance = 0.05 + (skillDiff / 100) * 0.12;

      // Proximity threshold for overtake
      if (gap < 0.006 && !this.safetyCarActive && Math.random() < Math.max(0.01, baseOvertakeChance)) {
        // Perform swap
        const tempProg = ahead.progress;
        ahead.progress = behind.progress;
        behind.progress = tempProg;

        this.logCommentary(`⚔️ OVERTAKE! ${behind.driverName} (Skill: ${behind.skill}) passes ${ahead.driverName}!`, 'overtake');
        break;
      }
    }
  },

  triggerSafetyCar() {
    this.safetyCarActive = true;
    this.safetyCarLapsRemaining = 2; // 2 laps of SC
    this.logCommentary('⚠️ SAFETY CAR DEPLOYED! Field compressed - No overtaking allowed.', 'incident');
  },

  renderFrame() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const track = this.tracks[this.trackKey];

    ctx.clearRect(0, 0, width, height);

    // Helper to draw smooth organic curves via quadratic spline interpolation
    const drawSmoothPath = () => {
      ctx.beginPath();
      const points = track.path.map(pt => ({ x: pt.x * width, y: pt.y * height }));
      const len = points.length;

      const pLast = points[len - 1];
      const pFirst = points[0];
      const startMidX = (pLast.x + pFirst.x) / 2;
      const startMidY = (pLast.y + pFirst.y) / 2;

      ctx.moveTo(startMidX, startMidY);
      for (let i = 0; i < len; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % len];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
      }
      ctx.closePath();
    };

    // 1. Draw Organic Circuit Path Vector Map
    // Outer Border Accent: Clean, uniform red stroke (#E10600) along track edges
    drawSmoothPath();
    ctx.lineWidth = 28;
    ctx.strokeStyle = '#E10600';
    ctx.stroke();

    // Track Surface: Solid black fill (#000000)
    drawSmoothPath();
    ctx.lineWidth = 22;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Track Centerline: Thin, dashed yellow line (#FFFF00) running down middle
    drawSmoothPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFF00';
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash pattern

    // Safety Car Indicator Line overlay (Yellow warning outline when SC is active)
    if (this.safetyCarActive) {
      drawSmoothPath();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#FFCC00';
      ctx.stroke();
    }

    // Start/Finish Line Ribbon
    const startPt = track.path[0];
    ctx.beginPath();
    ctx.arc(startPt.x * width, startPt.y * height, 16, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();

    // 2. Draw Driver Physics Dots
    this.cars.forEach((car) => {
      if (car.isDNF) return;

      const coords = this.getCanvasCoords(car.progress, track);

      // Halo Outer Glow
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 11, 0, 2 * Math.PI);
      ctx.fillStyle = car.color;
      ctx.globalAlpha = 0.35;
      ctx.fill();

      // Main Solid Car Dot
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = car.color;
      ctx.globalAlpha = 1.0;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Driver Initial Badge Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const initials = car.driverName.substring(0, 2).toUpperCase();
      ctx.fillText(initials, coords.x, coords.y);
    });

    // 3. Update UI Telemetry Banner
    document.getElementById('telemetry-current-lap').textContent = Math.min(this.currentLap, this.totalLaps);
    document.getElementById('telemetry-total-laps').textContent = this.totalLaps;

    // 4. Update Live Broadcast Leaderboard
    this.updateLeaderboardUI();
  },

  updateLeaderboardUI() {
    const tbody = document.getElementById('sim-leaderboard-tbody');
    tbody.innerHTML = '';

    const sortedCars = [...this.cars].sort((a, b) => {
      if (a.isDNF && !b.isDNF) return 1;
      if (!a.isDNF && b.isDNF) return -1;
      return (b.lap + b.progress) - (a.lap + a.progress);
    });

    const leader = sortedCars[0];

    sortedCars.forEach((car, index) => {
      const tr = document.createElement('tr');

      const posTd = document.createElement('td');
      posTd.innerHTML = `<strong>P${index + 1}</strong>`;

      const driverTd = document.createElement('td');
      driverTd.innerHTML = `<span class="badge-tag" style="background-color: ${car.color}; color:#FFF;">•</span>${car.driverName}`;

      const teamTd = document.createElement('td');
      teamTd.textContent = car.playerName;

      const gapTd = document.createElement('td');
      if (car.isDNF) {
        gapTd.textContent = 'OUT';
        gapTd.style.color = '#FF3333';
      } else if (index === 0) {
        gapTd.textContent = 'LEADER';
        gapTd.style.color = '#00E676';
      } else {
        const gapDist = (leader.lap + leader.progress) - (car.lap + car.progress);
        const gapSec = (gapDist * this.tracks[this.trackKey].baseLapTime).toFixed(1);
        gapTd.textContent = `+${gapSec}s`;
      }

      const statusTd = document.createElement('td');
      if (car.isDNF) {
        statusTd.innerHTML = `<span style="color:#FF3333; font-weight:bold;">DNF</span>`;
      } else if (this.safetyCarActive) {
        statusTd.innerHTML = `<span style="color:#FFCC00;">SC</span>`;
      } else {
        statusTd.innerHTML = `<span style="color:#00E676;">RACING</span>`;
      }

      tr.appendChild(posTd);
      tr.appendChild(driverTd);
      tr.appendChild(teamTd);
      tr.appendChild(gapTd);
      tr.appendChild(statusTd);

      tbody.appendChild(tr);
    });
  },

  logCommentary(text, type = 'normal') {
    const feed = document.getElementById('commentary-feed');
    const div = document.createElement('div');
    div.className = `feed-item ${type}`;
    div.textContent = text;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  },

  runInstantFinish() {
    this.pause();
    this.currentLap = this.totalLaps + 1;

    // Fast-forward simulation results
    this.cars.forEach(car => {
      if (!car.isDNF) {
        car.lap = this.totalLaps;
        car.progress = 0.99 - (car.gridPos * 0.02) + (Math.random() * 0.15);
      }
    });

    this.finishRace();
  },

  finishRace() {
    this.pause();
    document.getElementById('sim-status-badge').textContent = 'CHECKERED FLAG';
    document.getElementById('sim-status-badge').style.background = '#FFD700';
    document.getElementById('sim-status-badge').style.color = '#000';

    this.logCommentary('🏁 CHECKERED FLAG! The Grand Prix has concluded!', 'system');

    // 1. Calculate Final Classification
    const finalClassification = [...this.cars].sort((a, b) => {
      if (a.isDNF && !b.isDNF) return 1;
      if (!a.isDNF && b.isDNF) return -1;
      return (b.lap + b.progress) - (a.lap + a.progress);
    });

    // 2. Award Points & Fastest Lap Bonus
    let overallBestLap = null;
    let fastestLapDriver = null;

    finalClassification.forEach(car => {
      if (car.bestLap && (!overallBestLap || car.bestLap < overallBestLap)) {
        overallBestLap = car.bestLap;
        fastestLapDriver = car;
      }
    });

    finalClassification.forEach((car, index) => {
      let points = index < this.pointsScale.length ? this.pointsScale[index] : 0;
      // Fastest lap bonus (+1 pt if in top 10)
      if (car === fastestLapDriver && index < 10) {
        points += 1;
        car.hasFastestLap = true;
      } else {
        car.hasFastestLap = false;
      }
      car.pointsAwarded = points;
    });

    // 3. Aggregate Team Points & Evaluate Tie-Breakers
    const teamScores = F1App.state.players.map(player => {
      const playerDrivers = finalClassification.filter(c => c.playerName === player.name);
      const totalPoints = playerDrivers.reduce((sum, d) => sum + d.pointsAwarded, 0);

      // Best individual driver position among player's roster
      const driverPositions = playerDrivers.map(d => finalClassification.indexOf(d) + 1);
      const bestFinish = driverPositions.length > 0 ? Math.min(...driverPositions) : 999;

      return {
        id: player.id,
        playerName: player.name,
        color: player.color,
        remainingBudget: player.remainingBudget,
        rosterNames: player.roster.map(r => r.name).join(', '),
        totalPoints: totalPoints,
        bestFinish: bestFinish
      };
    });

    // Sort Team Champions strictly with Tie-Breaker Rules:
    // 1) Total Points (descending)
    // 2) Highest single-driver finish (best position ascending)
    // 3) Remaining budget (descending)
    teamScores.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      if (a.bestFinish !== b.bestFinish) {
        return a.bestFinish - b.bestFinish;
      }
      return b.remainingBudget - a.remainingBudget;
    });

    const winningPlayer = teamScores[0];

    // 4. Populate Results Overlay & Physical Podium Slots
    document.getElementById('champion-announcement').textContent = `${winningPlayer.playerName.toUpperCase()} WINS THE F1 DRAFT! 🏆`;

    // Populate Podium P1, P2, P3 Slot text
    const p1Team = teamScores[0] || { playerName: '--', totalPoints: 0 };
    const p2Team = teamScores[1] || { playerName: '--', totalPoints: 0 };
    const p3Team = teamScores[2] || { playerName: '--', totalPoints: 0 };

    document.getElementById('podium-p1-name').textContent = p1Team.playerName.toUpperCase();
    document.getElementById('podium-p1-pts').textContent = `${p1Team.totalPoints} PTS`;

    document.getElementById('podium-p2-name').textContent = p2Team.playerName.toUpperCase();
    document.getElementById('podium-p2-pts').textContent = `${p2Team.totalPoints} PTS`;

    document.getElementById('podium-p3-name').textContent = p3Team.playerName.toUpperCase();
    document.getElementById('podium-p3-pts').textContent = `${p3Team.totalPoints} PTS`;

    // Render Final Team Table
    const teamTbody = document.getElementById('final-team-tbody');
    teamTbody.innerHTML = '';
    teamScores.forEach((team, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>P${index + 1}</strong></td>
        <td><span class="badge-tag" style="background-color: ${team.color}; color:#FFF;">•</span><strong>${team.playerName}</strong></td>
        <td>${team.rosterNames}</td>
        <td><strong style="color:#FFD700; font-size:1.1rem;">${team.totalPoints} PTS</strong></td>
      `;
      teamTbody.appendChild(tr);
    });

    // Render Driver Classification Table
    const driverTbody = document.getElementById('final-driver-tbody');
    driverTbody.innerHTML = '';
    finalClassification.forEach((car, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>P${index + 1}</strong></td>
        <td>${car.driverName}</td>
        <td>${car.playerName}</td>
        <td>${car.hasFastestLap ? '🟣 FASTEST LAP (+1)' : (car.bestLap ? `${car.bestLap.toFixed(2)}s` : 'N/A')}</td>
        <td><strong>${car.pointsAwarded} PTS</strong></td>
      `;
      driverTbody.appendChild(tr);
    });

    // Show Victory Modal & Trigger Kahoot-Style Sequential Rising Podium (No Spotlight)
    document.getElementById('results-modal').classList.remove('hidden');

    // Reset initial hidden state for all podium blocks & info cards
    document.querySelectorAll('.podium-block').forEach(b => b.classList.remove('raised'));
    document.querySelectorAll('.podium-driver-info').forEach(i => i.classList.remove('revealed'));

    // PHASE 1 (3rd Place Reveal): P3 rises and locks into position
    setTimeout(() => {
      const p3Block = document.querySelector('.p3-block');
      const p3Info = document.querySelector('#podium-slot-p3 .podium-driver-info');
      if (p3Block) p3Block.classList.add('raised');
      if (p3Info) p3Info.classList.add('revealed');
    }, 300);

    // PHASE 2 (2nd Place Reveal): P2 rises and locks into position
    setTimeout(() => {
      const p2Block = document.querySelector('.p2-block');
      const p2Info = document.querySelector('#podium-slot-p2 .podium-driver-info');
      if (p2Block) p2Block.classList.add('raised');
      if (p2Info) p2Info.classList.add('revealed');
    }, 1200);

    // PHASE 3 (1st Place Champion Reveal): Tall central P1 champion pillar rises, reveals champion name, trophy & confetti
    setTimeout(() => {
      const p1Block = document.querySelector('.p1-block');
      const p1Info = document.querySelector('#podium-slot-p1 .podium-driver-info');
      if (p1Block) p1Block.classList.add('raised');
      if (p1Info) p1Info.classList.add('revealed');

      // Particle Confetti Burst
      this.launchConfetti();
    }, 2200);
  },

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const particles = [];
    const colors = ['#E10600', '#FFD700', '#FFFFFF', '#00D2BE', '#FF8000', '#3671C6'];

    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        vx: Math.random() * 4 - 2,
        vy: Math.random() * 5 + 3,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: Math.random() * 6 - 3
      });
    }

    let duration = 180; // 3 seconds at 60fps
    const renderConfetti = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.5);
        ctx.restore();
      });

      duration--;
      if (duration > 0) {
        requestAnimationFrame(renderConfetti);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    requestAnimationFrame(renderConfetti);
  }
};
