/**
 * F1 Draft - Live Track Simulator & Telemetry Engine
 * Features: GeoJSON SVG Circuit Map Visualizer, Car Physics & Curvature Dynamics,
 * Path Interpolation with Rotation & 3-Letter Driver Labels,
 * Weather Controls, Live Leaderboard, Safety Cars, and Championship Podium.
 */

const F1Simulator = {
  canvas: null,
  ctx: null,
  animationFrameId: null,

  // Path Cache for SVG elements
  pathCache: {},

  // Sim State
  isPlaying: false,
  simSpeed: 1, // 1x, 5x, 20x, 50x
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

  // Base lap times for simulation physics (seconds per lap)
  trackBaseLapTimes: {
    monaco: 72.0,
    monza: 81.0,
    spa: 104.0,
    silverstone: 87.0,
    suzuka: 89.0,
    interlagos: 70.5
  },

  getTrackPathObj(trackKey) {
    if (!this.pathCache[trackKey]) {
      const data = typeof TRACK_DATA !== 'undefined' ? TRACK_DATA[trackKey] : null;
      if (!data) return null;

      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', data.path);

      this.pathCache[trackKey] = {
        el: pathEl,
        length: pathEl.getTotalLength(),
        path2d: new Path2D(data.path),
        name: data.name,
        location: data.location,
        lengthMeters: data.lengthMeters
      };
    }
    return this.pathCache[trackKey];
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

    const trackObj = this.getTrackPathObj(this.trackKey);
    const trackName = trackObj ? trackObj.name : 'Circuit';
    this.logCommentary(`Grid formed with ${this.cars.length} drafted drivers at ${trackName}. Click PLAY to start!`, 'system');
    this.renderFrame();
  },

  buildDraftedCarsList() {
    this.cars = [];
    let carId = 1;

    // Collect all drafted drivers across all players using custom normalized driver skill ratings
    if (typeof F1App !== 'undefined' && F1App.state && F1App.state.players) {
      F1App.state.players.forEach(player => {
        player.roster.forEach(item => {
          const driverData = F1App.state.driverMap ? F1App.state.driverMap[item.name] : null;
          const driverSkill = item.skill || (driverData ? driverData.skill : 82);

          // Qualifying time formula reflects driver skill rating + random variance
          const qualyTime = (100 - driverSkill) + (Math.random() * 1.5 - 0.75);

          // Generate 3-letter driver code (e.g., VER, HAM, LEC, NOR)
          const nameParts = item.name.trim().split(/\s+/);
          let label = '';
          if (nameParts.length >= 2) {
            label = nameParts[nameParts.length - 1].substring(0, 3).toUpperCase();
          } else {
            label = item.name.substring(0, 3).toUpperCase();
          }

          this.cars.push({
            id: carId++,
            driverName: item.name,
            driverCode: label,
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
    }

    // Sort grid by qualifying lap times
    this.cars.sort((a, b) => a.qualyTime - b.qualyTime);

    // Stagger start progress slightly based on grid position
    this.cars.forEach((car, index) => {
      car.gridPos = index + 1;
      car.progress = Math.max(0, 0.04 - index * 0.006);
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

    const trackObj = this.getTrackPathObj(this.trackKey);
    const name = trackObj ? trackObj.name : this.trackKey;
    this.logCommentary(`Track changed to ${name}. Sim reset.`, 'system');
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
    const trackObj = this.getTrackPathObj(this.trackKey);
    if (!trackObj) return;

    const baseLapTime = this.trackBaseLapTimes[this.trackKey] || 80.0;
    // Base speed increment per frame
    const baseSpeed = (1 / (baseLapTime * 60)) * this.simSpeed;

    // Process each car
    this.cars.forEach((car) => {
      if (car.isDNF) return;

      // 1. Curvature / Speed factor from path geometry
      const dist = (car.progress % 1) * trackObj.length;
      let speedMult = this.getCurvatureSpeedFactor(trackObj, dist);

      // Track-Specific Physics Modifiers
      if (this.trackKey === 'monaco') {
        speedMult *= 0.85; // Monaco: tighter street circuit
      } else if (this.trackKey === 'monza') {
        speedMult *= 1.15; // Monza: high-speed temple
      } else if (this.trackKey === 'silverstone') {
        // Silverstone: tire wear over race distance
        const tireWearFactor = Math.max(0.85, 1.0 - (car.lap / this.totalLaps) * 0.15);
        speedMult *= tireWearFactor;
      } else if (this.trackKey === 'suzuka') {
        if (car.progress <= 0.35 && car.skill >= 80) {
          speedMult *= 1.15; // S-Curves skill bonus
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
        const lapTimeSec = baseLapTime * (1 / skillMult) + (Math.random() * 2 - 1);
        car.lapTimes.push(lapTimeSec);
        if (!car.bestLap || lapTimeSec < car.bestLap) {
          car.bestLap = lapTimeSec;
        }

        // Random DNF Incident Chance
        let dnfThreshold = this.weather === 'wet' ? 0.035 : 0.015;
        if (this.trackKey === 'monaco') {
          dnfThreshold *= 1.30;
        } else if (this.trackKey === 'interlagos' && this.weather === 'wet') {
          dnfThreshold *= 1.25;
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

  getCurvatureSpeedFactor(trackObj, dist) {
    const totalLength = trackObj.length;
    const delta = 8;
    const p0 = trackObj.el.getPointAtLength(dist % totalLength);
    const p1 = trackObj.el.getPointAtLength((dist + delta) % totalLength);
    const p2 = trackObj.el.getPointAtLength((dist + delta * 2) % totalLength);

    const a1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const a2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);

    let diff = Math.abs(a2 - a1);
    while (diff > Math.PI) diff -= Math.PI * 2;
    diff = Math.abs(diff);

    // Tight corners (large diff) slow car down, straights allow higher top speed
    const factor = Math.max(0.45, 1.25 - diff * 2.0);
    return factor;
  },

  processOvertakes() {
    const activeCars = this.cars.filter(c => !c.isDNF);
    activeCars.sort((a, b) => (b.lap + b.progress) - (a.lap + a.progress));

    for (let i = 0; i < activeCars.length - 1; i++) {
      const ahead = activeCars[i];
      const behind = activeCars[i + 1];

      const gap = (ahead.lap + ahead.progress) - (behind.lap + behind.progress);

      const skillDiff = behind.skill - ahead.skill;
      const baseOvertakeChance = 0.05 + (skillDiff / 100) * 0.12;

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
    this.safetyCarLapsRemaining = 2;
    this.logCommentary('⚠️ SAFETY CAR DEPLOYED! Field compressed - No overtaking allowed.', 'incident');
  },

  renderFrame() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    const trackObj = this.getTrackPathObj(this.trackKey);
    if (!trackObj) return;

    // 1. Draw SVG Track Circuit Path
    // Outer Asphalt Border (Thick Dark Stroke)
    ctx.strokeStyle = '#0B0B10';
    ctx.lineWidth = 26;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(trackObj.path2d);

    ctx.strokeStyle = '#1F1F2C';
    ctx.lineWidth = 20;
    ctx.stroke(trackObj.path2d);

    // Racing Line Surface (Thinner Lighter Stroke)
    ctx.strokeStyle = '#323246';
    ctx.lineWidth = 12;
    ctx.stroke(trackObj.path2d);

    // Center Red Apex Guide Line
    ctx.strokeStyle = 'rgba(225, 6, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.stroke(trackObj.path2d);
    ctx.setLineDash([]); // Reset line dash

    // Safety Car Yellow Outline overlay
    if (this.safetyCarActive) {
      ctx.strokeStyle = '#FFCC00';
      ctx.lineWidth = 4;
      ctx.stroke(trackObj.path2d);
    }

    // 2. Start / Finish Line
    const startPt = trackObj.el.getPointAtLength(0);
    const startPtAhead = trackObj.el.getPointAtLength(4);
    const startAngle = Math.atan2(startPtAhead.y - startPt.y, startPtAhead.x - startPt.x);

    ctx.save();
    ctx.translate(startPt.x, startPt.y);
    ctx.rotate(startAngle + Math.PI / 2);
    // Draw Checkered Start / Finish Bar
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-12, -3, 24, 6);
    ctx.fillStyle = '#E10600';
    ctx.fillRect(-12, -1, 24, 2);
    ctx.restore();

    // 3. Move Cars Along Path using path.getPointAtLength() & Rotate to Travel Direction
    this.cars.forEach((car) => {
      if (car.isDNF) return;

      const dist = (car.progress % 1) * trackObj.length;
      const p = trackObj.el.getPointAtLength(dist);
      const delta = 2;
      const pAhead = trackObj.el.getPointAtLength((dist + delta) % trackObj.length);
      const angle = Math.atan2(pAhead.y - p.y, pAhead.x - p.x);

      // Render Sleek Car Body
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);

      // Outer Glow
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, 2 * Math.PI);
      ctx.fillStyle = car.color;
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Car Main Body
      ctx.fillStyle = car.color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-7, -4, 14, 8, 2);
      } else {
        ctx.rect(-7, -4, 14, 8);
      }
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Front Wing Tip
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(5, -3, 3, 6);

      ctx.restore();

      // Show 3-letter Driver Label next to car
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(car.driverCode, p.x, p.y - 8);
      ctx.shadowBlur = 0; // Reset shadow
    });

    // 4. Update UI Telemetry Banner
    document.getElementById('telemetry-current-lap').textContent = Math.min(this.currentLap, this.totalLaps);
    document.getElementById('telemetry-total-laps').textContent = this.totalLaps;

    // 5. Update Live Broadcast Leaderboard
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
    const baseLapTime = this.trackBaseLapTimes[this.trackKey] || 80.0;

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
        const gapSec = (gapDist * baseLapTime).toFixed(1);
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
    if (!feed) return;
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

    // Sort Team Champions with Tie-Breaker Rules:
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

    // Show Victory Modal & Trigger Kahoot-Style Sequential Rising Podium
    document.getElementById('results-modal').classList.remove('hidden');

    document.querySelectorAll('.podium-block').forEach(b => b.classList.remove('raised'));
    document.querySelectorAll('.podium-driver-info').forEach(i => i.classList.remove('revealed'));

    setTimeout(() => {
      const p3Block = document.querySelector('.p3-block');
      const p3Info = document.querySelector('#podium-slot-p3 .podium-driver-info');
      if (p3Block) p3Block.classList.add('raised');
      if (p3Info) p3Info.classList.add('revealed');
    }, 300);

    setTimeout(() => {
      const p2Block = document.querySelector('.p2-block');
      const p2Info = document.querySelector('#podium-slot-p2 .podium-driver-info');
      if (p2Block) p2Block.classList.add('raised');
      if (p2Info) p2Info.classList.add('revealed');
    }, 1200);

    setTimeout(() => {
      const p1Block = document.querySelector('.p1-block');
      const p1Info = document.querySelector('#podium-slot-p1 .podium-driver-info');
      if (p1Block) p1Block.classList.add('raised');
      if (p1Info) p1Info.classList.add('revealed');

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

    let duration = 180;
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
