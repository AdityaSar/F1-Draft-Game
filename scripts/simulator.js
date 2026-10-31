/**
 * F1 Draft - Realistic Grand Prix Simulation Engine
 *
 * Models real F1 physics & race dynamics:
 * - Driver Skill (1-100)
 * - Tyre Compounds (Soft, Medium, Hard, Wet) with compound-specific grip & degradation
 * - Fuel load burn-off effect per lap
 * - Track overtaking difficulty & 1.0s gap DRS threshold
 * - Strategic Pit Stops (~20s in-pit loss, fresh tyres)
 * - Random incidents & Safety Car deployments (bunching field, frozen overtakes)
 * - Fastest Lap tracking & FIA points (25-18-15-12-10-8-6-4-2-1, +1 for top-10 FL)
 * - Rich live commentary feed
 * - Smooth continuous path visualizer using GeoJSON SVG track data
 */

// ============================================================================
// SIMULATION CONSTANTS & CONFIGURATION (Easily Tweakable)
// ============================================================================
const SIM_CONFIG = {
  // Pit stop time loss in seconds (entry, box service, exit)
  PIT_STOP_TIME_SECONDS: 20.0,

  // Maximum tyre wear before car must pit (0 = fresh, 1 = destroyed)
  TYRE_PIT_THRESHOLD: 0.65,

  // Fuel load parameters
  STARTING_FUEL_KG: 100.0,
  FUEL_BURN_PER_LAP_KG: 100.0 / 20.0, // Burned completely over race distance
  FUEL_TIME_PENALTY_PER_KG: 0.033,    // ~0.33s per 10kg fuel

  // Base overtaking chance scaling
  OVERTAKE_GAP_THRESHOLD_SECONDS: 1.0,

  // Base incident / DNF probability per lap
  DRY_DNF_CHANCE_PER_LAP: 0.008,
  WET_DNF_CHANCE_PER_LAP: 0.022,

  // Safety Car chance on incident
  SC_TRIGGER_CHANCE_ON_DNF: 0.85,
  SAFETY_CAR_DURATION_LAPS: 2,

  // Points scoring system
  POINTS_SCALE: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],

  // Track metadata: displayName, country, laps (10-20), overtakingDifficulty (0 to 1), baseLapTime
  TRACKS: {
    monaco: {
      displayName: 'Circuit de Monaco',
      country: 'Monaco',
      laps: 18,
      overtakingDifficulty: 0.90, // Extremely hard to pass
      baseLapTime: 72.0,
      tyreWearMultiplier: 0.8
    },
    monza: {
      displayName: 'Autodromo Nazionale Monza',
      country: 'Italy',
      laps: 15,
      overtakingDifficulty: 0.22, // Long straights, slipstream & DRS
      baseLapTime: 81.0,
      tyreWearMultiplier: 0.9
    },
    spa: {
      displayName: 'Circuit de Spa-Francorchamps',
      country: 'Belgium',
      laps: 12,
      overtakingDifficulty: 0.35,
      baseLapTime: 104.0,
      tyreWearMultiplier: 1.15
    },
    silverstone: {
      displayName: 'Silverstone Circuit',
      country: 'Great Britain',
      laps: 15,
      overtakingDifficulty: 0.45,
      baseLapTime: 87.0,
      tyreWearMultiplier: 1.25
    },
    suzuka: {
      displayName: 'Suzuka International Racing Course',
      country: 'Japan',
      laps: 15,
      overtakingDifficulty: 0.60,
      baseLapTime: 89.0,
      tyreWearMultiplier: 1.20
    },
    interlagos: {
      displayName: 'Autódromo José Carlos Pace',
      country: 'Brazil',
      laps: 18,
      overtakingDifficulty: 0.30,
      baseLapTime: 70.5,
      tyreWearMultiplier: 1.0
    },
    albert_park: {
      displayName: 'Albert Park Circuit',
      country: 'Australia',
      laps: 16,
      overtakingDifficulty: 0.45,
      baseLapTime: 79.0,
      tyreWearMultiplier: 1.05
    },
    bahrain: {
      displayName: 'Bahrain International Circuit',
      country: 'Bahrain',
      laps: 16,
      overtakingDifficulty: 0.30,
      baseLapTime: 91.0,
      tyreWearMultiplier: 1.25
    },
    jeddah: {
      displayName: 'Jeddah Corniche Circuit',
      country: 'Saudi Arabia',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 88.0,
      tyreWearMultiplier: 1.10
    },
    baku: {
      displayName: 'Baku City Circuit',
      country: 'Azerbaijan',
      laps: 15,
      overtakingDifficulty: 0.20, // 2.2km main straight, low difficulty
      baseLapTime: 102.0,
      tyreWearMultiplier: 1.0
    },
    miami: {
      displayName: 'Miami International Autodrome',
      country: 'United States',
      laps: 16,
      overtakingDifficulty: 0.40,
      baseLapTime: 89.0,
      tyreWearMultiplier: 1.10
    },
    imola: {
      displayName: 'Autodromo Enzo e Dino Ferrari',
      country: 'Italy',
      laps: 17,
      overtakingDifficulty: 0.70, // Narrow traditional circuit
      baseLapTime: 75.0,
      tyreWearMultiplier: 1.05
    },
    barcelona: {
      displayName: 'Circuit de Barcelona-Catalunya',
      country: 'Spain',
      laps: 17,
      overtakingDifficulty: 0.55,
      baseLapTime: 76.0,
      tyreWearMultiplier: 1.20
    },
    montreal: {
      displayName: 'Circuit Gilles-Villeneuve',
      country: 'Canada',
      laps: 18,
      overtakingDifficulty: 0.38,
      baseLapTime: 73.0,
      tyreWearMultiplier: 1.0
    },
    red_bull_ring: {
      displayName: 'Red Bull Ring',
      country: 'Austria',
      laps: 19,
      overtakingDifficulty: 0.32,
      baseLapTime: 65.0,
      tyreWearMultiplier: 1.0
    },
    hungaroring: {
      displayName: 'Hungaroring',
      country: 'Hungary',
      laps: 18,
      overtakingDifficulty: 0.80, // High downforce, hard to pass
      baseLapTime: 76.0,
      tyreWearMultiplier: 1.10
    },
    zandvoort: {
      displayName: 'Circuit Zandvoort',
      country: 'Netherlands',
      laps: 18,
      overtakingDifficulty: 0.75,
      baseLapTime: 71.0,
      tyreWearMultiplier: 1.20
    },
    singapore: {
      displayName: 'Marina Bay Street Circuit',
      country: 'Singapore',
      laps: 16,
      overtakingDifficulty: 0.85, // Street circuit, high difficulty
      baseLapTime: 95.0,
      tyreWearMultiplier: 1.15
    },
    cota: {
      displayName: 'Circuit of the Americas',
      country: 'United States',
      laps: 15,
      overtakingDifficulty: 0.45,
      baseLapTime: 96.0,
      tyreWearMultiplier: 1.20
    },
    mexico_city: {
      displayName: 'Autódromo Hermanos Rodríguez',
      country: 'Mexico',
      laps: 18,
      overtakingDifficulty: 0.40,
      baseLapTime: 78.0,
      tyreWearMultiplier: 0.95
    },
    las_vegas: {
      displayName: 'Las Vegas Street Circuit',
      country: 'United States',
      laps: 15,
      overtakingDifficulty: 0.25, // Long Strip straight, easy overtakes
      baseLapTime: 93.0,
      tyreWearMultiplier: 0.90
    },
    lusail: {
      displayName: 'Losail International Circuit',
      country: 'Qatar',
      laps: 16,
      overtakingDifficulty: 0.45,
      baseLapTime: 83.0,
      tyreWearMultiplier: 1.30
    },
    yas_marina: {
      displayName: 'Yas Marina Circuit',
      country: 'United Arab Emirates',
      laps: 16,
      overtakingDifficulty: 0.42,
      baseLapTime: 84.0,
      tyreWearMultiplier: 1.05
    },
    shanghai: {
      displayName: 'Shanghai International Circuit',
      country: 'China',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 94.0,
      tyreWearMultiplier: 1.20
    },
    paul_ricard: {
      displayName: 'Circuit Paul Ricard',
      country: 'France',
      laps: 15,
      overtakingDifficulty: 0.40,
      baseLapTime: 92.0,
      tyreWearMultiplier: 1.15
    },
    hockenheimring: {
      displayName: 'Hockenheimring',
      country: 'Germany',
      laps: 17,
      overtakingDifficulty: 0.38,
      baseLapTime: 74.0,
      tyreWearMultiplier: 1.10
    },
    nurburgring: {
      displayName: 'Nürburgring GP',
      country: 'Germany',
      laps: 16,
      overtakingDifficulty: 0.50,
      baseLapTime: 88.0,
      tyreWearMultiplier: 1.10
    },
    portimao: {
      displayName: 'Autódromo Internacional do Algarve',
      country: 'Portugal',
      laps: 16,
      overtakingDifficulty: 0.48,
      baseLapTime: 78.0,
      tyreWearMultiplier: 1.15
    },
    mugello: {
      displayName: 'Autodromo Internazionale del Mugello',
      country: 'Italy',
      laps: 16,
      overtakingDifficulty: 0.60,
      baseLapTime: 77.0,
      tyreWearMultiplier: 1.30
    },
    sepang: {
      displayName: 'Sepang International Circuit',
      country: 'Malaysia',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 93.0,
      tyreWearMultiplier: 1.25
    },
    istanbul: {
      displayName: 'Intercity Istanbul Park',
      country: 'Turkey',
      laps: 16,
      overtakingDifficulty: 0.40,
      baseLapTime: 86.0,
      tyreWearMultiplier: 1.25
    },
    sochi: {
      displayName: 'Sochi Autodrom',
      country: 'Russia',
      laps: 16,
      overtakingDifficulty: 0.55,
      baseLapTime: 95.0,
      tyreWearMultiplier: 0.90
    }
  },

  // Tyre Compound Characteristics
  // paceDelta: lap time advantage (negative = faster, positive = slower)
  // wearRatePerLap: wear percentage added per lap
  TYRE_COMPOUNDS: {
    SOFT: {
      name: 'SOFT',
      code: 'S',
      color: '#E10600',
      paceDelta: -0.6,
      wearRatePerLap: 0.055,
      wetPacePenalty: 8.0
    },
    MEDIUM: {
      name: 'MEDIUM',
      code: 'M',
      color: '#FFD700',
      paceDelta: 0.0,
      wearRatePerLap: 0.035,
      wetPacePenalty: 9.0
    },
    HARD: {
      name: 'HARD',
      code: 'H',
      color: '#FFFFFF',
      paceDelta: +0.6,
      wearRatePerLap: 0.022,
      wetPacePenalty: 10.0
    },
    WET: {
      name: 'WET',
      code: 'W',
      color: '#0099FF',
      paceDelta: +3.0,
      wearRatePerLap: 0.030,
      wetPacePenalty: 0.0 // Optimized for rain
    }
  }
};

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

  // Fastest lap holder
  fastestLap: {
    time: Infinity,
    driverName: null,
    carId: null
  },

  // Cars Array
  cars: [],

  // Commentary Log
  commentaryLogs: [],

  populateTrackDropdown() {
    const selectEl = document.getElementById('sim-track-select');
    if (!selectEl) return;

    const currentVal = selectEl.value || 'monza';
    selectEl.innerHTML = '';

    Object.keys(SIM_CONFIG.TRACKS).forEach(key => {
      const t = SIM_CONFIG.TRACKS[key];
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `${t.displayName} (${t.country}) - ${t.laps} Laps`;
      if (key === currentVal) {
        opt.selected = true;
      }
      selectEl.appendChild(opt);
    });

    if (!selectEl.value) {
      selectEl.value = 'monza';
    }
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
    this.fastestLap = { time: Infinity, driverName: null, carId: null };
    this.commentaryLogs = [];

    // Dynamically populate track selector dropdown from SIM_CONFIG.TRACKS
    this.populateTrackDropdown();

    const selectEl = document.getElementById('sim-track-select');
    this.trackKey = selectEl && selectEl.value ? selectEl.value : 'monza';
    this.weather = document.getElementById('sim-weather-select').value || 'dry';

    const trackMeta = SIM_CONFIG.TRACKS[this.trackKey];
    this.totalLaps = trackMeta && trackMeta.laps ? trackMeta.laps : 15;

    // 1. Build Drivers Array strictly from human drafted players
    this.buildDraftedCarsList();

    // 2. Event Listeners for Controls
    document.getElementById('sim-track-select').addEventListener('change', (e) => {
      this.trackKey = e.target.value;
      this.resetSimulation();
    });

    document.getElementById('sim-weather-select').addEventListener('change', (e) => {
      this.weather = e.target.value;
      this.logCommentary(`Weather update: Track is now ${this.weather === 'wet' ? '🌧️ WET (Heavy Rain)' : '☀️ DRY'}.`, 'system');
      document.getElementById('telemetry-weather-indicator').textContent = this.weather === 'wet' ? '🌧️ WET' : '☀️ DRY';
      // Switch tyre compound strategies if needed
      this.cars.forEach(car => {
        if (!car.isDNF) {
          if (this.weather === 'wet' && car.tyreCompound !== 'WET') {
            car.tyreCompound = 'WET';
            car.tyreAge = 0;
          } else if (this.weather === 'dry' && car.tyreCompound === 'WET') {
            car.tyreCompound = 'MEDIUM';
            car.tyreAge = 0;
          }
        }
      });
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
    this.logCommentary(`Grid formed with ${this.cars.length} cars at ${trackName}. Click PLAY to start the Grand Prix!`, 'system');
    this.renderFrame();
  },

  buildDraftedCarsList() {
    this.cars = [];
    let carId = 1;

    if (typeof F1App !== 'undefined' && F1App.state && F1App.state.players) {
      F1App.state.players.forEach(player => {
        player.roster.forEach(item => {
          const driverData = F1App.state.driverMap ? F1App.state.driverMap[item.name] : null;
          const driverSkill = item.skill || (driverData ? driverData.skill : 82);

          // Generate 3-letter driver code (e.g. VER, HAM, NOR)
          const nameParts = item.name.trim().split(/\s+/);
          let label = '';
          if (nameParts.length >= 2) {
            label = nameParts[nameParts.length - 1].substring(0, 3).toUpperCase();
          } else {
            label = item.name.substring(0, 3).toUpperCase();
          }

          // Starting tyre compound based on weather and random team choice
          let startingCompound = 'MEDIUM';
          if (this.weather === 'wet') {
            startingCompound = 'WET';
          } else {
            // Strategic variety: alternate between SOFT and MEDIUM
            startingCompound = Math.random() < 0.45 ? 'SOFT' : 'MEDIUM';
          }

          // Qualifying time formula: reflects driver skill + setup variance
          const qualyTime = (100 - driverSkill) * 0.2 + (Math.random() * 0.8 - 0.4);

          this.cars.push({
            id: carId++,
            driverName: item.name,
            driverCode: label,
            playerName: player.name,
            color: player.color,
            skill: driverSkill,
            qualyTime: qualyTime,

            // Telemetry & Race Metrics
            lap: 1,
            progress: 0.0, // 0 to 1 continuous along circuit
            totalDistanceLaps: 0.0, // continuous distance for interpolation
            gapToLeader: 0.0, // in seconds
            lastLapTime: 0.0,
            bestLap: null,
            isDNF: false,
            dnfReason: null,

            // Tyres & Fuel
            tyreCompound: startingCompound,
            tyreAge: 0,
            tyreWear: 0.0,
            fuelLoadKg: SIM_CONFIG.STARTING_FUEL_KG,
            pitStops: 0,
            isPitting: false,
            pitTimeLossRemaining: 0.0,

            // Status string (RACING, IN PIT, DNF, SC)
            status: 'RACING'
          });
        });
      });
    }

    // Sort grid strictly by qualifying times
    this.cars.sort((a, b) => a.qualyTime - b.qualyTime);

    // Initial grid positions and staggered gaps
    this.cars.forEach((car, index) => {
      car.gridPos = index + 1;
      car.gapToLeader = index * 0.35; // 0.35s gap between grid slots
      car.progress = Math.max(0, 0.03 - index * 0.005);
      car.totalDistanceLaps = car.progress;
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
    const trackMeta = SIM_CONFIG.TRACKS[this.trackKey];
    this.totalLaps = trackMeta && trackMeta.laps ? trackMeta.laps : 15;
    this.safetyCarActive = false;
    this.safetyCarLapsRemaining = 0;
    this.fastestLap = { time: Infinity, driverName: null, carId: null };
    this.buildDraftedCarsList();
    this.commentaryLogs = [];
    document.getElementById('commentary-feed').innerHTML = '';

    const name = trackMeta ? `${trackMeta.displayName} (${trackMeta.country})` : this.trackKey;
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

  /**
   * Per-Lap realistic pace calculation:
   * base time (track) - skill bonus + tyre wear penalty - fuel effect + random variation.
   */
  computeCarLapPace(car) {
    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;
    const compound = SIM_CONFIG.TYRE_COMPOUNDS[car.tyreCompound] || SIM_CONFIG.TYRE_COMPOUNDS.MEDIUM;

    // 1. Base track lap time
    let lapTime = trackInfo.baseLapTime;

    // 2. Skill bonus (Driver skill 1 to 100 scales pace up to 2.2s per lap)
    const skillBonus = (car.skill / 100) * 2.2;
    lapTime -= skillBonus;

    // 3. Tyre Compound base pace advantage / disadvantage
    lapTime += compound.paceDelta;

    // 4. Tyre wear degradation penalty (grows quadratically with tyre age)
    const wearMultiplier = trackInfo.tyreWearMultiplier;
    const degradationPenalty = Math.pow(car.tyreWear, 1.8) * 4.5 * wearMultiplier;
    lapTime += degradationPenalty;

    // 5. Fuel effect: Car becomes faster as fuel burns down
    const fuelEffect = car.fuelLoadKg * SIM_CONFIG.FUEL_TIME_PENALTY_PER_KG;
    lapTime += fuelEffect;

    // 6. Weather adjustment
    if (this.weather === 'wet') {
      lapTime += 10.0; // Slower overall in wet
      lapTime += compound.wetPacePenalty; // Big penalty if on slicks in wet
      // Skill matters twice as much in rain
      lapTime -= ((car.skill - 50) / 100) * 2.0;
      // Bigger random variation in wet
      lapTime += (Math.random() * 1.6 - 0.8);
    } else {
      // Normal small random variation in dry
      lapTime += (Math.random() * 0.4 - 0.2);
    }

    return lapTime;
  },

  updatePhysics() {
    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;
    const trackObj = this.getTrackPathObj(this.trackKey);
    if (!trackObj) return;

    // Base nominal frame progress
    const baseLapDurationSeconds = trackInfo.baseLapTime;
    const baseFrameDelta = (1 / (baseLapDurationSeconds * 60)) * this.simSpeed;

    // Sort cars by current distance completed (leader first)
    const activeCars = this.cars.filter(c => !c.isDNF);
    activeCars.sort((a, b) => b.totalDistanceLaps - a.totalDistanceLaps);

    const leader = activeCars[0];

    // Process each car
    this.cars.forEach((car) => {
      if (car.isDNF) return;

      // Handle Pit Stop Time Loss
      if (car.isPitting) {
        car.pitTimeLossRemaining -= (1 / 60) * this.simSpeed;
        if (car.pitTimeLossRemaining <= 0) {
          car.isPitting = false;
          car.status = this.safetyCarActive ? 'SC' : 'RACING';
          this.logCommentary(`🔧 PIT EXIT: ${car.driverName} resumes on fresh ${car.tyreCompound}s.`, 'system');
        } else {
          car.status = 'IN PIT';
          // Car crawls down pit lane at 20% speed
          car.progress += baseFrameDelta * 0.2;
          car.totalDistanceLaps += baseFrameDelta * 0.2;
          return;
        }
      }

      // Compute dynamic lap pace
      const theoreticalPace = this.computeCarLapPace(car);
      // Speed factor relative to base lap time
      let speedFactor = baseLapDurationSeconds / theoreticalPace;

      // Curvature Slowdown Factor (using SVG path curvature)
      const distAlongPath = (car.progress % 1) * trackObj.length;
      const cornerFactor = this.getCurvatureSpeedFactor(trackObj, distAlongPath);
      speedFactor *= cornerFactor;

      // Safety Car Restrictions: Bunch up field, limit max speed to 45%
      if (this.safetyCarActive) {
        speedFactor = Math.min(speedFactor, 0.45);
        car.status = 'SC';
      } else {
        car.status = 'RACING';
      }

      // Advance car progress continuously along path
      const frameAdvance = baseFrameDelta * speedFactor;
      car.progress += frameAdvance;
      car.totalDistanceLaps += frameAdvance;

      // Burn fuel gradually
      car.fuelLoadKg = Math.max(5.0, car.fuelLoadKg - (SIM_CONFIG.FUEL_BURN_PER_LAP_KG * frameAdvance));

      // Degrade tyres
      const compound = SIM_CONFIG.TYRE_COMPOUNDS[car.tyreCompound] || SIM_CONFIG.TYRE_COMPOUNDS.MEDIUM;
      car.tyreAge += frameAdvance;
      car.tyreWear = Math.min(1.0, car.tyreWear + (compound.wearRatePerLap * trackInfo.tyreWearMultiplier * frameAdvance));

      // Lap Completion Check
      if (car.progress >= 1.0) {
        car.progress -= 1.0;
        car.lap += 1;

        const completedLapTime = theoreticalPace + (Math.random() * 0.3 - 0.15);
        car.lastLapTime = completedLapTime;

        // Check for Fastest Lap
        if (!car.bestLap || completedLapTime < car.bestLap) {
          car.bestLap = completedLapTime;
        }

        if (completedLapTime < this.fastestLap.time && car.lap > 1) {
          this.fastestLap.time = completedLapTime;
          this.fastestLap.driverName = car.driverName;
          this.fastestLap.carId = car.id;
          this.logCommentary(`🟣 FASTEST LAP: ${car.driverName} sets a ${completedLapTime.toFixed(3)}s!`, 'system');
        }

        // Random DNF Incident Chance
        const dnfChance = this.weather === 'wet' ? SIM_CONFIG.WET_DNF_CHANCE_PER_LAP : SIM_CONFIG.DRY_DNF_CHANCE_PER_LAP;
        if (Math.random() < dnfChance && car.lap > 1 && !this.safetyCarActive) {
          car.isDNF = true;
          car.dnfReason = this.weather === 'wet' ? 'Aquaplaned into Barriers' : 'Hydraulics Failure';
          car.status = 'DNF';
          this.logCommentary(`💥 CRASH / DNF: ${car.driverName} is OUT with ${car.dnfReason}!`, 'incident');

          // Trigger Safety Car with high probability
          if (Math.random() < SIM_CONFIG.SC_TRIGGER_CHANCE_ON_DNF) {
            this.triggerSafetyCar();
          }
        }

        // Pit Stop Strategy Decision: If tyres worn past threshold
        if (!car.isDNF && car.tyreWear >= SIM_CONFIG.TYRE_PIT_THRESHOLD && car.lap < (this.totalLaps - 1)) {
          this.executePitStop(car);
        }
      }
    });

    // Update global leader lap counter
    if (leader) {
      this.currentLap = Math.min(leader.lap, this.totalLaps + 1);
    }

    // Process Safety Car Laps
    if (this.safetyCarActive) {
      this.safetyCarLapsRemaining -= 0.0035 * this.simSpeed;
      if (this.safetyCarLapsRemaining <= 0) {
        this.safetyCarActive = false;
        this.logCommentary('🟢 SAFETY CAR IN THIS LAP: Track clear, green flag racing resumes!', 'system');
      }
    }

    // Process realistic DRS, close combat & overtaking
    this.processOvertaking();
  },

  executePitStop(car) {
    car.isPitting = true;
    car.pitStops += 1;
    car.pitTimeLossRemaining = SIM_CONFIG.PIT_STOP_TIME_SECONDS;

    const oldCompound = car.tyreCompound;
    // Choose new compound: If wet, stick to WET. If dry, switch between Soft/Medium/Hard
    if (this.weather === 'wet') {
      car.tyreCompound = 'WET';
    } else {
      const remainingLaps = this.totalLaps - car.lap;
      if (remainingLaps <= 6) {
        car.tyreCompound = 'SOFT'; // Sprint to finish on Softs
      } else if (oldCompound === 'SOFT') {
        car.tyreCompound = 'HARD';
      } else {
        car.tyreCompound = 'MEDIUM';
      }
    }

    car.tyreAge = 0;
    car.tyreWear = 0.0;
    this.logCommentary(`🛑 BOX BOX: ${car.driverName} pits for fresh ${car.tyreCompound} tyres! (~20s stop)`, 'system');
  },

  /**
   * Overtaking Logic:
   * Car within 1.0s gap with pace advantage has chance to pass based on pace difference & track difficulty.
   * Otherwise stays stuck behind slower car.
   */
  processOvertaking() {
    if (this.safetyCarActive) return;

    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;
    const activeCars = this.cars.filter(c => !c.isDNF && !c.isPitting);
    // Sort by total distance covered descending
    activeCars.sort((a, b) => b.totalDistanceLaps - a.totalDistanceLaps);

    const baseLapTime = trackInfo.baseLapTime;

    for (let i = 0; i < activeCars.length - 1; i++) {
      const ahead = activeCars[i];
      const behind = activeCars[i + 1];

      // Time gap between cars
      const lapDelta = ahead.totalDistanceLaps - behind.totalDistanceLaps;
      const gapSeconds = lapDelta * baseLapTime;
      behind.gapToLeader = (activeCars[0].totalDistanceLaps - behind.totalDistanceLaps) * baseLapTime;

      // DRS Zone proximity condition: within 1.0 second
      if (gapSeconds <= SIM_CONFIG.OVERTAKE_GAP_THRESHOLD_SECONDS && gapSeconds > 0) {
        const aheadPace = this.computeCarLapPace(ahead);
        const behindPace = this.computeCarLapPace(behind);
        const paceAdvantage = aheadPace - behindPace; // Positive if behind is faster

        if (paceAdvantage > 0.2) {
          // Overtaking probability depends on pace delta and track difficulty
          const difficultyFactor = 1.0 - trackInfo.overtakingDifficulty;
          const overtakeProb = (paceAdvantage * 0.08 + 0.02) * difficultyFactor;

          if (Math.random() < overtakeProb) {
            // Swap distance positions
            const tempDist = ahead.totalDistanceLaps;
            ahead.totalDistanceLaps = behind.totalDistanceLaps;
            behind.totalDistanceLaps = tempDist;

            const tempProg = ahead.progress;
            ahead.progress = behind.progress;
            behind.progress = tempProg;

            this.logCommentary(`⚔️ OVERTAKE: ${behind.driverName} (${behind.driverCode}) dives down the inside to pass ${ahead.driverName}!`, 'overtake');
            break;
          } else {
            // Stuck in dirty air behind slower car: cap speed to car ahead
            behind.progress = Math.min(behind.progress, ahead.progress - 0.002);
            behind.totalDistanceLaps = Math.min(behind.totalDistanceLaps, ahead.totalDistanceLaps - 0.002);
          }
        }
      }
    }
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

    // Tight corners slow car down, straights allow higher acceleration
    const factor = Math.max(0.48, 1.25 - diff * 2.0);
    return factor;
  },

  triggerSafetyCar() {
    this.safetyCarActive = true;
    this.safetyCarLapsRemaining = SIM_CONFIG.SAFETY_CAR_DURATION_LAPS;
    this.logCommentary('⚠️ SAFETY CAR DEPLOYED: Field compressed, pit lane open, overtaking strictly forbidden!', 'incident');
  },

  renderFrame() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    const trackObj = this.getTrackPathObj(this.trackKey);
    if (!trackObj) return;

    // 1. Draw Real GeoJSON Track Circuit Outline
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
    ctx.setLineDash([]);

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
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-12, -3, 24, 6);
    ctx.fillStyle = '#E10600';
    ctx.fillRect(-12, -1, 24, 2);
    ctx.restore();

    // 3. Render Cars Smoothly Along Path with Heading Rotation & 3-Letter Driver Codes
    this.cars.forEach((car) => {
      if (car.isDNF) return;

      const dist = (car.progress % 1) * trackObj.length;
      const p = trackObj.el.getPointAtLength(dist);
      const delta = 2;
      const pAhead = trackObj.el.getPointAtLength((dist + delta) % trackObj.length);
      const angle = Math.atan2(pAhead.y - p.y, pAhead.x - p.x);

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

      // Tyre Compound Dot Indicator on Car
      const compoundInfo = SIM_CONFIG.TYRE_COMPOUNDS[car.tyreCompound] || SIM_CONFIG.TYRE_COMPOUNDS.MEDIUM;
      ctx.fillStyle = compoundInfo.color;
      ctx.beginPath();
      ctx.arc(-2, 0, 2, 0, 2 * Math.PI);
      ctx.fill();

      ctx.restore();

      // Driver 3-Letter Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px "Chakra Petch", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(car.driverCode, p.x, p.y - 8);
      ctx.shadowBlur = 0;
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
      return b.totalDistanceLaps - a.totalDistanceLaps;
    });

    const leader = sortedCars[0];
    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;

    sortedCars.forEach((car, index) => {
      const tr = document.createElement('tr');

      const posTd = document.createElement('td');
      posTd.innerHTML = `<strong>P${index + 1}</strong>`;

      // Driver Name with Tyre Compound Pill
      const compoundInfo = SIM_CONFIG.TYRE_COMPOUNDS[car.tyreCompound] || SIM_CONFIG.TYRE_COMPOUNDS.MEDIUM;
      const driverTd = document.createElement('td');
      driverTd.innerHTML = `
        <span class="badge-tag" style="background-color: ${car.color}; color:#FFF;">•</span>${car.driverName}
        <span style="display:inline-block; margin-left:4px; padding:1px 4px; font-size:9px; font-weight:900; border-radius:2px; background:${compoundInfo.color}; color:#000;">${compoundInfo.code}</span>
      `;

      const teamTd = document.createElement('td');
      teamTd.textContent = car.playerName;

      // Realistic Gap in Seconds
      const gapTd = document.createElement('td');
      if (car.isDNF) {
        gapTd.textContent = 'OUT';
        gapTd.style.color = '#FF3333';
      } else if (index === 0) {
        gapTd.textContent = 'LEADER';
        gapTd.style.color = '#00E676';
      } else {
        const gapLaps = leader.totalDistanceLaps - car.totalDistanceLaps;
        const gapSec = Math.max(0.1, gapLaps * trackInfo.baseLapTime).toFixed(1);
        gapTd.textContent = `+${gapSec}s`;
      }

      // Live Status (RACING, PIT, SC, DNF)
      const statusTd = document.createElement('td');
      if (car.isDNF) {
        statusTd.innerHTML = `<span style="color:#FF3333; font-weight:bold;">DNF</span>`;
      } else if (car.isPitting) {
        statusTd.innerHTML = `<span style="color:#29B6F6; font-weight:bold;">PIT (${car.pitStops})</span>`;
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
        car.totalDistanceLaps = this.totalLaps + 0.99 - (car.gridPos * 0.02) + (Math.random() * 0.08);
      }
    });

    this.finishRace();
  },

  finishRace() {
    this.pause();
    document.getElementById('sim-status-badge').textContent = 'CHECKERED FLAG';
    document.getElementById('sim-status-badge').style.background = '#FFD700';
    document.getElementById('sim-status-badge').style.color = '#000';

    this.logCommentary('🏁 CHECKERED FLAG: The Grand Prix has concluded!', 'system');

    // 1. Calculate Final Classification
    const finalClassification = [...this.cars].sort((a, b) => {
      if (a.isDNF && !b.isDNF) return 1;
      if (!a.isDNF && b.isDNF) return -1;
      return b.totalDistanceLaps - a.totalDistanceLaps;
    });

    // 2. Award Points & Fastest Lap Bonus (+1 pt if in top 10)
    let overallBestLap = null;
    let fastestLapDriver = null;

    finalClassification.forEach(car => {
      if (car.bestLap && (!overallBestLap || car.bestLap < overallBestLap)) {
        overallBestLap = car.bestLap;
        fastestLapDriver = car;
      }
    });

    finalClassification.forEach((car, index) => {
      let points = index < SIM_CONFIG.POINTS_SCALE.length ? SIM_CONFIG.POINTS_SCALE[index] : 0;
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

    // Tie-Breaker Rules:
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

    // Populate Podium Names & Points
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

    // Open Modal with generic header and hidden trophy initially
    const resultsModal = document.getElementById('results-modal');
    resultsModal.classList.remove('hidden');

    const ceremonyTitle = document.getElementById('ceremony-status-title');
    const championAnnouncement = document.getElementById('champion-announcement');
    const trophyBadge = document.getElementById('p1-trophy-badge');

    // Reset initial hidden states
    if (ceremonyTitle) {
      ceremonyTitle.style.display = 'block';
      ceremonyTitle.style.opacity = '1';
    }
    if (championAnnouncement) {
      championAnnouncement.classList.remove('visible-banner');
      championAnnouncement.classList.add('hidden-banner');
      championAnnouncement.textContent = `${winningPlayer.playerName.toUpperCase()} WINS THE F1 DRAFT! 🏆`;
    }
    if (trophyBadge) {
      trophyBadge.classList.remove('revealed');
    }

    document.querySelectorAll('.podium-block').forEach(b => b.classList.remove('raised'));
    document.querySelectorAll('.podium-driver-info').forEach(i => i.classList.remove('revealed'));

    // PHASE 1: P3 reveals (podium rises, info reveals, trophy & winner banner stay hidden)
    setTimeout(() => {
      const p3Block = document.querySelector('.p3-block');
      const p3Info = document.querySelector('#podium-slot-p3 .podium-driver-info');
      if (p3Block) p3Block.classList.add('raised');
      if (p3Info) p3Info.classList.add('revealed');
    }, 400);

    // PHASE 2: P2 reveals (podium rises, info reveals, trophy & winner banner stay hidden)
    setTimeout(() => {
      const p2Block = document.querySelector('.p2-block');
      const p2Info = document.querySelector('#podium-slot-p2 .podium-driver-info');
      if (p2Block) p2Block.classList.add('raised');
      if (p2Info) p2Info.classList.add('revealed');
    }, 1400);

    // PHASE 3: P1 Champion reveal!
    // P1 pillar rises, info reveals, trophy pops in, winner banner fades in, and confetti bursts!
    setTimeout(() => {
      const p1Block = document.querySelector('.p1-block');
      const p1Info = document.querySelector('#podium-slot-p1 .podium-driver-info');
      if (p1Block) p1Block.classList.add('raised');
      if (p1Info) p1Info.classList.add('revealed');

      // Pop in floating trophy on P1 pedestal
      if (trophyBadge) {
        trophyBadge.classList.add('revealed');
      }

      // Transition header from generic ceremony title to Champion Announcement
      if (ceremonyTitle) {
        ceremonyTitle.style.opacity = '0';
        setTimeout(() => { ceremonyTitle.style.display = 'none'; }, 300);
      }
      if (championAnnouncement) {
        championAnnouncement.classList.remove('hidden-banner');
        championAnnouncement.classList.add('visible-banner');
      }

      // Trigger celebration confetti
      this.launchConfetti();
    }, 2500);
  },

  launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    const particles = [];
    const colors = ['#E10600', '#FFD700', '#FFFFFF', '#00D2BE', '#FF8000', '#3671C6'];

    for (let i = 0; i < 140; i++) {
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

    let duration = 200;
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
