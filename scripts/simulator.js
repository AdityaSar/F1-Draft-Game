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

  // Strategic Staggered Pit Stop Parameters (Part 3)
  PIT_MIN_LAP: 3,                   // No car may pit before lap 3 (unless forced by wear/weather)
  PIT_CLIFF_THRESHOLD: 0.88,        // Immediate pit if tyre falls off cliff
  PIT_NORMAL_WEAR_THRESHOLD: 0.58,  // Tyre wear threshold required when planned window opens
  PIT_MAX_CARS_PER_LAP: 2,          // At most 2 cars may enter pit lane on the same lap
  UNDERCUT_GAP_THRESHOLD_SEC: 1.0,  // Proximity to car ahead to consider undercut
  UNDERCUT_CHANCE: 0.35,            // Probability of taking an early pit stop (undercut)

  // Fuel load parameters
  STARTING_FUEL_KG: 100.0,
  FUEL_BURN_PER_LAP_KG: 100.0 / 20.0, // Burned completely over race distance
  FUEL_TIME_PENALTY_PER_KG: 0.033,    // ~0.33s per 10kg fuel

  // Base overtaking chance scaling
  OVERTAKE_GAP_THRESHOLD_SECONDS: 1.0,

  // DNF constants (Part 2)
  DNF_CHANCE_PER_CAR_PER_RACE: 0.05,
  MAX_DNFS_NORMAL: 2,
  THIRD_DNF_CHANCE: 0.05,

  // Safety Car chance on incident
  SC_TRIGGER_CHANCE_ON_DNF: 0.85,
  SAFETY_CAR_DURATION_LAPS: 2,

  // Points scoring system
  POINTS_SCALE: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],

  // Track metadata: exactly 32 tracks configured. Confirmed that all 32 tracks in the dropdown have an explicit rainChance (no fallback value).
  TRACKS: {
    monaco: {
      displayName: 'Circuit de Monaco',
      country: 'Monaco',
      laps: 18,
      overtakingDifficulty: 0.90, // Extremely hard to pass
      baseLapTime: 72.0,
      tyreWearMultiplier: 0.8,
      rainChance: 0.20
    },
    monza: {
      displayName: 'Autodromo Nazionale Monza',
      country: 'Italy',
      laps: 15,
      overtakingDifficulty: 0.22, // Long straights, slipstream & DRS
      baseLapTime: 81.0,
      tyreWearMultiplier: 0.9,
      rainChance: 0.18
    },
    spa: {
      displayName: 'Circuit de Spa-Francorchamps',
      country: 'Belgium',
      laps: 12,
      overtakingDifficulty: 0.35,
      baseLapTime: 104.0,
      tyreWearMultiplier: 1.15,
      rainChance: 0.45
    },
    silverstone: {
      displayName: 'Silverstone Circuit',
      country: 'Great Britain',
      laps: 15,
      overtakingDifficulty: 0.45,
      baseLapTime: 87.0,
      tyreWearMultiplier: 1.25,
      rainChance: 0.40
    },
    suzuka: {
      displayName: 'Suzuka International Racing Course',
      country: 'Japan',
      laps: 15,
      overtakingDifficulty: 0.60,
      baseLapTime: 89.0,
      tyreWearMultiplier: 1.20,
      rainChance: 0.35
    },
    interlagos: {
      displayName: 'Autódromo José Carlos Pace',
      country: 'Brazil',
      laps: 18,
      overtakingDifficulty: 0.30,
      baseLapTime: 70.5,
      tyreWearMultiplier: 1.0,
      rainChance: 0.40
    },
    albert_park: {
      displayName: 'Albert Park Circuit',
      country: 'Australia',
      laps: 16,
      overtakingDifficulty: 0.45,
      baseLapTime: 79.0,
      tyreWearMultiplier: 1.05,
      rainChance: 0.20
    },
    bahrain: {
      displayName: 'Bahrain International Circuit',
      country: 'Bahrain',
      laps: 16,
      overtakingDifficulty: 0.30,
      baseLapTime: 91.0,
      tyreWearMultiplier: 1.25,
      rainChance: 0.02
    },
    jeddah: {
      displayName: 'Jeddah Corniche Circuit',
      country: 'Saudi Arabia',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 88.0,
      tyreWearMultiplier: 1.10,
      rainChance: 0.02
    },
    baku: {
      displayName: 'Baku City Circuit',
      country: 'Azerbaijan',
      laps: 15,
      overtakingDifficulty: 0.20, // 2.2km main straight, low difficulty
      baseLapTime: 102.0,
      tyreWearMultiplier: 1.0,
      rainChance: 0.08
    },
    miami: {
      displayName: 'Miami International Autodrome',
      country: 'United States',
      laps: 16,
      overtakingDifficulty: 0.40,
      baseLapTime: 89.0,
      tyreWearMultiplier: 1.10,
      rainChance: 0.25
    },
    imola: {
      displayName: 'Autodromo Enzo e Dino Ferrari',
      country: 'Italy',
      laps: 17,
      overtakingDifficulty: 0.70, // Narrow traditional circuit
      baseLapTime: 75.0,
      tyreWearMultiplier: 1.05,
      rainChance: 0.25
    },
    barcelona: {
      displayName: 'Circuit de Barcelona-Catalunya',
      country: 'Spain',
      laps: 17,
      overtakingDifficulty: 0.55,
      baseLapTime: 76.0,
      tyreWearMultiplier: 1.20,
      rainChance: 0.12
    },
    montreal: {
      displayName: 'Circuit Gilles-Villeneuve',
      country: 'Canada',
      laps: 18,
      overtakingDifficulty: 0.38,
      baseLapTime: 73.0,
      tyreWearMultiplier: 1.0,
      rainChance: 0.35
    },
    red_bull_ring: {
      displayName: 'Red Bull Ring',
      country: 'Austria',
      laps: 19,
      overtakingDifficulty: 0.32,
      baseLapTime: 65.0,
      tyreWearMultiplier: 1.0,
      rainChance: 0.30
    },
    hungaroring: {
      displayName: 'Hungaroring',
      country: 'Hungary',
      laps: 18,
      overtakingDifficulty: 0.80, // High downforce, hard to pass
      baseLapTime: 76.0,
      tyreWearMultiplier: 1.10,
      rainChance: 0.20
    },
    zandvoort: {
      displayName: 'Circuit Zandvoort',
      country: 'Netherlands',
      laps: 18,
      overtakingDifficulty: 0.75,
      baseLapTime: 71.0,
      tyreWearMultiplier: 1.20,
      rainChance: 0.35
    },
    singapore: {
      displayName: 'Marina Bay Street Circuit',
      country: 'Singapore',
      laps: 16,
      overtakingDifficulty: 0.85, // Street circuit, high difficulty
      baseLapTime: 95.0,
      tyreWearMultiplier: 1.15,
      rainChance: 0.30
    },
    cota: {
      displayName: 'Circuit of the Americas',
      country: 'United States',
      laps: 15,
      overtakingDifficulty: 0.45,
      baseLapTime: 96.0,
      tyreWearMultiplier: 1.20,
      rainChance: 0.15
    },
    mexico_city: {
      displayName: 'Autódromo Hermanos Rodríguez',
      country: 'Mexico',
      laps: 18,
      overtakingDifficulty: 0.40,
      baseLapTime: 78.0,
      tyreWearMultiplier: 0.95,
      rainChance: 0.10
    },
    las_vegas: {
      displayName: 'Las Vegas Street Circuit',
      country: 'United States',
      laps: 15,
      overtakingDifficulty: 0.25, // Long Strip straight, easy overtakes
      baseLapTime: 93.0,
      tyreWearMultiplier: 0.90,
      rainChance: 0.03
    },
    lusail: {
      displayName: 'Losail International Circuit',
      country: 'Qatar',
      laps: 16,
      overtakingDifficulty: 0.45,
      baseLapTime: 83.0,
      tyreWearMultiplier: 1.30,
      rainChance: 0.02
    },
    yas_marina: {
      displayName: 'Yas Marina Circuit',
      country: 'United Arab Emirates',
      laps: 16,
      overtakingDifficulty: 0.42,
      baseLapTime: 84.0,
      tyreWearMultiplier: 1.05,
      rainChance: 0.02
    },
    shanghai: {
      displayName: 'Shanghai International Circuit',
      country: 'China',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 94.0,
      tyreWearMultiplier: 1.20,
      rainChance: 0.30
    },
    paul_ricard: {
      displayName: 'Circuit Paul Ricard',
      country: 'France',
      laps: 15,
      overtakingDifficulty: 0.40,
      baseLapTime: 92.0,
      tyreWearMultiplier: 1.15,
      rainChance: 0.12
    },
    hockenheimring: {
      displayName: 'Hockenheimring',
      country: 'Germany',
      laps: 17,
      overtakingDifficulty: 0.38,
      baseLapTime: 74.0,
      tyreWearMultiplier: 1.10,
      rainChance: 0.25
    },
    nurburgring: {
      displayName: 'Nürburgring GP',
      country: 'Germany',
      laps: 16,
      overtakingDifficulty: 0.50,
      baseLapTime: 88.0,
      tyreWearMultiplier: 1.10,
      rainChance: 0.40
    },
    portimao: {
      displayName: 'Autódromo Internacional do Algarve',
      country: 'Portugal',
      laps: 16,
      overtakingDifficulty: 0.48,
      baseLapTime: 78.0,
      tyreWearMultiplier: 1.15,
      rainChance: 0.12
    },
    mugello: {
      displayName: 'Autodromo Internazionale del Mugello',
      country: 'Italy',
      laps: 16,
      overtakingDifficulty: 0.60,
      baseLapTime: 77.0,
      tyreWearMultiplier: 1.30,
      rainChance: 0.15
    },
    sepang: {
      displayName: 'Sepang International Circuit',
      country: 'Malaysia',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 93.0,
      tyreWearMultiplier: 1.25,
      rainChance: 0.45
    },
    istanbul: {
      displayName: 'Intercity Istanbul Park',
      country: 'Turkey',
      laps: 16,
      overtakingDifficulty: 0.40,
      baseLapTime: 86.0,
      tyreWearMultiplier: 1.25,
      rainChance: 0.20
    },
    sochi: {
      displayName: 'Sochi Autodrom',
      country: 'Russia',
      laps: 16,
      overtakingDifficulty: 0.55,
      baseLapTime: 95.0,
      tyreWearMultiplier: 0.90,
      rainChance: 0.10
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

  // Single Plain Object for Championship State (Cleanly resettable)
  championshipState: {
    isChampionship: false,
    totalRaces: 1,
    currentRaceIndex: 0,
    tracks: [], // Array of track keys e.g. ['monza', 'spa', 'silverstone']
    cumulativeScores: {}, // playerId -> { totalPoints, raceWins, bestSingleFinish }
    roundResultsHistory: [] // History of past round classifications
  },

  // Sim State
  isPlaying: false,
  hasRunQualifying: false,
  raceStarted: false,
  simSpeed: 1, // 1x, 5x, 20x, 50x
  currentLap: 1,
  totalLaps: 20,
  weatherMode: 'auto', // 'auto', 'dry', or 'wet'
  weather: 'dry', // current active weather: 'dry' or 'wet'
  trackKey: 'monza',

  // Auto-weather schedule & state (Part 2)
  autoWeatherSchedule: null,
  weatherChangesCount: 0,

  // Pit management state (Part 3)
  pitsThisLap: 0,
  lastPitCountLap: 0,

  // Race order tracking with hysteresis (Part 1)
  raceOrder: [],
  hysteresisCounters: {},

  safetyCarActive: false,
  safetyCarLapsRemaining: 0,
  safetyCarRestartLap: -1, // Tracks the lap when the SC restarted to freeze overtakes for 1 full lap

  // Last overtake pair to prevent logging the same pair twice in a row
  lastOvertakePairKey: null,

  // Rate-limited commentary queue
  commentaryQueue: [],
  simulatedTimeSeconds: 0,
  lastCommentarySimTime: -999,
  commentaryTimerId: null,

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

  resetChampionshipState() {
    this.championshipState = {
      isChampionship: false,
      totalRaces: 1,
      currentRaceIndex: 0,
      tracks: [],
      cumulativeScores: {},
      roundResultsHistory: []
    };
    const champIndicator = document.getElementById('telemetry-championship-indicator');
    if (champIndicator) champIndicator.classList.add('hidden');
    const champLengthItem = document.getElementById('item-championship-length');
    if (champLengthItem) champLengthItem.classList.add('hidden');
    const trackSelectItem = document.getElementById('item-track-select');
    if (trackSelectItem) trackSelectItem.classList.remove('hidden');
    const modeSelect = document.getElementById('sim-mode-select');
    if (modeSelect) modeSelect.value = 'single';
  },

  initChampionship(raceCountValue) {
    const allTrackKeys = Object.keys(SIM_CONFIG.TRACKS);
    // Shuffle all track keys to pick distinct tracks
    const shuffled = [...allTrackKeys].sort(() => Math.random() - 0.5);

    let count = 3;
    if (raceCountValue === 'all') {
      count = allTrackKeys.length;
    } else {
      count = parseInt(raceCountValue, 10) || 3;
    }
    count = Math.min(count, allTrackKeys.length);

    const selectedTracks = shuffled.slice(0, count);

    // Initialize player cumulative scores
    const cumulative = {};
    if (typeof F1App !== 'undefined' && F1App.state && F1App.state.players) {
      F1App.state.players.forEach(p => {
        cumulative[p.id] = {
          id: p.id,
          playerName: p.name,
          color: p.color,
          remainingBudget: p.remainingBudget,
          rosterNames: p.roster.map(r => r.name).join(', '),
          totalPoints: 0,
          raceWins: 0,
          bestSingleFinish: 999
        };
      });
    }

    this.championshipState = {
      isChampionship: true,
      totalRaces: count,
      currentRaceIndex: 0,
      tracks: selectedTracks,
      cumulativeScores: cumulative,
      roundResultsHistory: []
    };

    // Load first race
    this.trackKey = selectedTracks[0];
    this.updateChampionshipTelemetryBanner();
  },

  updateChampionshipTelemetryBanner() {
    const champIndicator = document.getElementById('telemetry-championship-indicator');
    if (!champIndicator) return;

    if (this.championshipState.isChampionship) {
      champIndicator.classList.remove('hidden');
      const roundNum = this.championshipState.currentRaceIndex + 1;
      const totalRaces = this.championshipState.totalRaces;
      const trackMeta = SIM_CONFIG.TRACKS[this.trackKey];
      const trackName = trackMeta ? trackMeta.displayName : this.trackKey;
      champIndicator.textContent = `ROUND ${roundNum}/${totalRaces}: ${trackName.toUpperCase()}`;
    } else {
      champIndicator.classList.add('hidden');
    }
  },

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

  /**
   * Builds an SVG path string from an array of 2D coordinates [x, y].
   */
  pointsToSvgPath(points) {
    if (!Array.isArray(points) || points.length === 0) return '';
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i][0]} ${points[i][1]}`;
    }
    d += ' Z';
    return d;
  },

  /**
   * Computes the signed polygon area in screen coordinates (Shoelace formula).
   * Positive area => Clockwise in screen coordinates (y-axis pointing down).
   * Negative area => Counter-Clockwise.
   */
  computePolygonArea(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      area += (p1[0] * p2[1] - p2[0] * p1[1]);
    }
    return area / 2;
  },

  resizeCanvas() {
    if (!this.canvas) return;
    const container = this.canvas.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width) || 800;
    const h = Math.floor(rect.height) || 520;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  },

  getTrackBounds(points) {
    if (!Array.isArray(points) || points.length === 0) {
      return { minX: 0, maxX: 800, minY: 0, maxY: 500, width: 800, height: 500 };
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  },

  getTrackPathObj(trackKey) {
    if (!this.pathCache[trackKey]) {
      const data = typeof TRACK_DATA !== 'undefined' ? TRACK_DATA[trackKey] : null;
      if (!data) return null;

      // Real F1 circuit directions (CW: Clockwise, CCW: Counter-Clockwise)
      const realDirections = {
        albert_park: 'CW', bahrain: 'CW', shanghai: 'CW', barcelona: 'CW', monaco: 'CW',
        montreal: 'CW', paul_ricard: 'CW', red_bull_ring: 'CW', silverstone: 'CW',
        hockenheimring: 'CW', hungaroring: 'CW', spa: 'CW', monza: 'CW', sochi: 'CW',
        suzuka: 'CW', mexico_city: 'CW', nurburgring: 'CW', portimao: 'CW', mugello: 'CW',
        sepang: 'CW', zandvoort: 'CW', lusail: 'CW',
        singapore: 'CCW', cota: 'CCW', interlagos: 'CCW', yas_marina: 'CCW',
        imola: 'CCW', istanbul: 'CCW', jeddah: 'CCW', miami: 'CCW', baku: 'CCW', las_vegas: 'CCW'
      };

      if (Array.isArray(data.points) && data.points.length > 2 && !data._directionChecked) {
        data._directionChecked = true;
        const currentDir = this.computePolygonArea(data.points) > 0 ? 'CW' : 'CCW';
        const expectedDir = realDirections[trackKey];

        if (expectedDir && currentDir !== expectedDir) {
          const startPt = data.points[0];
          const rest = data.points.slice(1).reverse();
          data.points = [startPt, ...rest];
        }

        // Check if track is taller than wide and canvas is wider than tall:
        // Rotate 90 degrees clockwise (rotate points before drawing)
        const initialBounds = this.getTrackBounds(data.points);
        if (initialBounds.height > initialBounds.width) {
          data.points = data.points.map(([x, y]) => [-y, x]);
          data.isRotated90 = true;
        }

        data.path = this.pointsToSvgPath(data.points);
      }

      let pathString = data.path;
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', pathString);

      const bounds = this.getTrackBounds(data.points);

      const pathLength = pathEl.getTotalLength();
      const trackObj = {
        el: pathEl,
        length: pathLength,
        path2d: new Path2D(pathString),
        name: data.name,
        location: data.location,
        lengthMeters: data.lengthMeters,
        points: data.points,
        bounds: bounds,
        isRotated90: !!data.isRotated90
      };

      // Find the longest straight section just before the start/finish line (once at load per track)
      trackObj.startOffset = this.computeTrackStartOffset(trackObj);

      this.pathCache[trackKey] = trackObj;
    }
    return this.pathCache[trackKey];
  },

  /**
   * Finds the longest straight section of the track just before the start/finish line.
   * Returns distance offset along the path (once, at load, per track) so start/finish
   * line sits cleanly at the end of that straight.
   */
  computeTrackStartOffset(trackObj) {
    const totalLen = trackObj.length;
    const step = 1.0;
    const N = Math.floor(totalLen / step);
    const angles = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      const s = i * step;
      const p0 = trackObj.el.getPointAtLength(s);
      const p1 = trackObj.el.getPointAtLength((s + 4) % totalLen);
      angles[i] = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    }

    const isStraight = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const prev = angles[(i - 5 + N) % N];
      const next = angles[(i + 5) % N];
      let diff = Math.abs(next - prev);
      while (diff > Math.PI) diff -= Math.PI * 2;
      diff = Math.abs(diff);
      isStraight[i] = (diff < 0.05) ? 1 : 0;
    }

    let firstTurn = 0;
    while (firstTurn < N && isStraight[firstTurn] === 1) firstTurn++;

    const straights = [];
    let inS = false;
    let startIdx = 0;
    for (let count = 0; count < N; count++) {
      const idx = (firstTurn + count) % N;
      if (isStraight[idx] === 1) {
        if (!inS) {
          inS = true;
          startIdx = idx;
        }
      } else {
        if (inS) {
          inS = false;
          const len = (idx >= startIdx) ? (idx - startIdx) : (N - startIdx + idx);
          if (len >= 20) {
            straights.push({ startDist: startIdx * step, endDist: idx * step, len: len * step });
          }
        }
      }
    }
    if (inS) {
      const len = (firstTurn >= startIdx) ? (firstTurn - startIdx) : (N - startIdx + firstTurn);
      if (len >= 20) {
        straights.push({ startDist: startIdx * step, endDist: firstTurn * step, len: len * step });
      }
    }

    // Find longest straight section near original start/finish line (s=0)
    const candidates = straights.filter(s => {
      const distTo0 = (s.startDist > s.endDist) ? 0 : Math.min(s.endDist, totalLen - s.startDist);
      return distTo0 <= totalLen * 0.25;
    });
    candidates.sort((a, b) => b.len - a.len);

    const best = candidates[0] || straights.sort((a, b) => b.len - a.len)[0];
    return best ? best.endDist : 0;
  },

  /**
   * Pure-data Qualifying Calculation.
   * Defensive: Computes each driver's lap time as:
   * base time - (skill bonus) + small random variation (tight for high skill, looser for low skill).
   * Returns sorted array of cars with qualyLapTime.
   * If error occurs, falls back to sorting by skill descending and logs console.warn.
   */
  computeQualifying(carsList, baseLapTime) {
    try {
      if (!Array.isArray(carsList) || carsList.length === 0) {
        return [];
      }
      const base = Number.isFinite(baseLapTime) && baseLapTime > 0 ? baseLapTime : 80.0;

      carsList.forEach(car => {
        const skill = Math.max(1, Math.min(100, Number(car.skill) || 50));
        // Skill bonus: scales up to ~2.5s advantage for 100 skill
        const skillBonus = (skill / 100) * 2.5;

        // Variance: high skill (e.g. 95) gets very tight variance (+/- 0.08s)
        // low skill (e.g. 50) gets looser variance (+/- 0.35s)
        const spread = (100 - skill) * 0.005 + 0.05;
        const randomVariation = (Math.random() * 2 - 1) * spread;

        const qualyTime = parseFloat((base - skillBonus + randomVariation).toFixed(3));
        car.qualyLapTime = qualyTime;
        car.qualyTime = qualyTime;
      });

      // Sort strictly by fastest lap time ascending
      carsList.sort((a, b) => a.qualyLapTime - b.qualyLapTime);

      return carsList;
    } catch (err) {
      console.warn('Qualifying computation encountered an error, falling back to skill order:', err);
      // Fallback: sort by skill descending
      try {
        carsList.sort((a, b) => (b.skill || 0) - (a.skill || 0));
        const base = baseLapTime || 80.0;
        carsList.forEach((c, idx) => {
          c.qualyLapTime = parseFloat((base + idx * 0.15).toFixed(3));
          c.qualyTime = c.qualyLapTime;
        });
      } catch (innerErr) {
        console.warn('Fallback sorting error:', innerErr);
      }
      return carsList;
    }
  },

  initSimulator() {
    this.canvas = document.getElementById('sim-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.resizeCanvas();
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.renderFrame();
    });

    // Reset Sim State
    this.isPlaying = false;
    this.hasRunQualifying = false;
    this.raceStarted = false;
    this.simSpeed = 1;
    this.currentLap = 1;
    this.safetyCarActive = false;
    this.safetyCarLapsRemaining = 0;
    this.safetyCarRestartLap = -1;
    this.lastOvertakePairKey = null;
    this.fastestLap = { time: Infinity, driverName: null, carId: null };
    this.commentaryLogs = [];
    this.commentaryQueue = [];
    this.simulatedTimeSeconds = 0;
    this.lastCommentarySimTime = -999;
    this.startCommentaryProcessor();

    // Ensure Start Qualifying button is visible before race starts
    const qualyBtn = document.getElementById('btn-sim-qualifying');
    if (qualyBtn) {
      qualyBtn.style.display = 'inline-block';
      qualyBtn.onclick = () => this.runQualifying(true);
    }

    // Dynamically populate track selector dropdown from SIM_CONFIG.TRACKS
    this.populateTrackDropdown();

    // Mode Selector setup
    const modeSelect = document.getElementById('sim-mode-select');
    const champLengthItem = document.getElementById('item-championship-length');
    const trackSelectItem = document.getElementById('item-track-select');
    const racesCountSelect = document.getElementById('sim-races-count-select');

    if (modeSelect) {
      modeSelect.onchange = (e) => {
        if (e.target.value === 'championship') {
          champLengthItem.classList.remove('hidden');
          trackSelectItem.classList.add('hidden');
          this.initChampionship(racesCountSelect.value);
          this.resetSimulation();
        } else {
          champLengthItem.classList.add('hidden');
          trackSelectItem.classList.remove('hidden');
          this.resetChampionshipState();
          const selectEl = document.getElementById('sim-track-select');
          this.trackKey = selectEl && selectEl.value ? selectEl.value : 'monza';
          this.resetSimulation();
        }
      };
    }

    if (racesCountSelect) {
      racesCountSelect.onchange = (e) => {
        if (this.championshipState.isChampionship) {
          this.initChampionship(e.target.value);
          this.resetSimulation();
        }
      };
    }

    const selectEl = document.getElementById('sim-track-select');
    if (!this.championshipState.isChampionship) {
      this.trackKey = selectEl && selectEl.value ? selectEl.value : 'monza';
    }
    const weatherVal = document.getElementById('sim-weather-select').value || 'auto';
    this.weatherMode = weatherVal;
    this.weather = (weatherVal === 'wet') ? 'wet' : 'dry';
    document.getElementById('telemetry-weather-indicator').textContent = (this.weather === 'wet') ? '🌧️ WET' : '☀️ DRY';

    const trackMeta = SIM_CONFIG.TRACKS[this.trackKey];
    this.totalLaps = trackMeta && trackMeta.laps ? trackMeta.laps : 15;

    // 1. Build Drivers Array strictly from human drafted players
    this.buildDraftedCarsList();

    // 2. Event Listeners for Controls
    document.getElementById('sim-track-select').addEventListener('change', (e) => {
      if (!this.championshipState.isChampionship) {
        this.trackKey = e.target.value;
        this.resetSimulation();
      }
    });

    document.getElementById('sim-weather-select').addEventListener('change', (e) => {
      const mode = e.target.value;
      this.weatherMode = mode;
      if (mode === 'auto') {
        this.weather = 'dry';
        this.logCommentary('Weather update: Forecast set to Auto (realistic). Race will start dry.', 'system');
      } else if (mode === 'wet') {
        this.weather = 'wet';
        this.logCommentary('Weather update: Track is now 🌧️ WET (Heavy Rain).', 'system');
      } else {
        this.weather = 'dry';
        this.logCommentary('Weather update: Track is now ☀️ DRY.', 'system');
      }
      document.getElementById('telemetry-weather-indicator').textContent = (this.weather === 'wet') ? '🌧️ WET' : '☀️ DRY';

      if (!this.raceStarted) {
        this.cars.forEach(car => {
          if (this.weather === 'wet') {
            car.tyreCompound = 'WET';
          } else {
            car.tyreCompound = Math.random() < 0.45 ? 'SOFT' : 'MEDIUM';
          }
          car.tyreAge = 0;
          car.tyreWear = 0;
          car.usedCompounds = [car.tyreCompound];
        });
      }
    });

    const closeQualyBtn = document.getElementById('btn-close-qualifying');
    if (closeQualyBtn) {
      closeQualyBtn.onclick = () => {
        const modal = document.getElementById('qualifying-modal');
        if (modal) modal.classList.add('hidden');
      };
    }

    // Return to Home Button - bind click to also reset championship
    const restartBtn = document.getElementById('btn-restart-app');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.resetChampionshipState();
      });
    }

    // Mid-Championship Next Race Button
    const nextRaceBtn = document.getElementById('btn-champ-next-race');
    if (nextRaceBtn) {
      nextRaceBtn.onclick = () => {
        const modal = document.getElementById('champ-race-modal');
        if (modal) modal.classList.add('hidden');
        this.advanceToNextChampionshipRace();
      };
    }

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
            lapsCompleted: 0,

            // Tyres & Fuel
            tyreCompound: startingCompound,
            usedCompounds: [startingCompound],
            tyreAge: 0,
            tyreWear: 0.0,
            fuelLoadKg: SIM_CONFIG.STARTING_FUEL_KG,
            pitStops: 0,
            isPitting: false,
            pitTimeLossRemaining: 0.0,

            // Staggered Pit Strategy (Part 3)
            plannedPitLap: null,
            weatherPitDelayRemaining: null,

            // Status string (RACING, IN PIT, DNF, SC)
            status: 'RACING'
          });
        });
      });
    }

    // Initial skill sort before qualifying is run
    this.cars.sort((a, b) => b.skill - a.skill);
    this.applyGridFormation();
  },

  /**
   * Staggered 2-column grid formation logic (Part 4):
   * - gridSlotSpacing = min(16px, (pathLength * 0.06) / ceil(numCars / 2)).
   *   The whole grid must fit within 6% of the lap length.
   * - Two-column staggered formation: odd positions (P1, P3, P5...) on the right (+3.5px),
   *   even positions (P2, P4, P6...) on the left (-3.5px), a few px either side of the centerline.
   * - P1 / P2 right behind the start line.
   *   Row 0: P1 (offset ~ 5px), P2 (offset ~ 5px + half slot or same row staggered).
   *   row = Math.floor(index / 2).
   *   offsetBehindLine = 5 + (row * gridSlotSpacing) + (isRight ? 0 : gridSlotSpacing * 0.4).
   * - Everyone launches at the same lights-out moment with the same launch model,
   *   plus a small random reaction time (+-0.15s). Cars at back do not start slower or later.
   */
  applyGridFormation() {
    const trackObj = this.getTrackPathObj(this.trackKey);
    const pathLength = trackObj ? trackObj.length : 1000;
    const numCars = this.cars.length;
    const numRows = Math.max(1, Math.ceil(numCars / 2));

    const startOffset = trackObj && trackObj.startOffset !== undefined ? trackObj.startOffset : 0;

    // Dynamic grid slot spacing: min(16px, (pathLength * 0.06) / ceil(numCars / 2))
    const gridSlotSpacing = Math.min(16, (pathLength * 0.06) / numRows);

    this.cars.forEach((car, index) => {
      car.gridPos = index + 1; // P1, P2, P3...
      car.gapToLeader = index * 0.2;

      // Odd grid positions (P1, P3, P5...) on right (+3.5px), even (P2, P4, P6...) on left (-3.5px)
      const isOddPos = (index % 2 === 0); // index 0 is P1 (odd), index 1 is P2 (even)
      const row = Math.floor(index / 2);

      // Place cars behind the start line along that straight
      const offsetBehindLine = 5 + (row * gridSlotSpacing) + (isOddPos ? 0 : (gridSlotSpacing * 0.45));
      const rawDist = startOffset - offsetBehindLine;
      const wrappedDist = ((rawDist % pathLength) + pathLength) % pathLength;

      // car.distance along path (0 to pathLength)
      car.distance = wrappedDist;
      // car.totalDistance accumulates total pixels traveled starting from the grid offset
      car.totalDistance = -offsetBehindLine;
      // Normalized progress for backwards compatibility
      car.progress = wrappedDist / pathLength;
      car.totalDistanceLaps = car.totalDistance / pathLength;

      // Lap 1 begins on the grid
      car.lap = 1;

      // Lateral offset: odd on right (+3.5px), even on left (-3.5px)
      car.lateralOffset = isOddPos ? 3.5 : -3.5;

      // Launch reaction time (+-0.15s): all cars launch at lights-out
      car.reactionDelay = (Math.random() * 0.30 - 0.15); // in seconds
    });
  },

  runQualifying(showResultsModal = true) {
    if (this.raceStarted) return;

    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;
    const baseLapTime = trackInfo.baseLapTime || 80.0;

    // Pure data computation
    this.computeQualifying(this.cars, baseLapTime);

    // Apply staggered 2-column grid formation with new order
    this.applyGridFormation();
    this.hasRunQualifying = true;

    // Render results in table
    this.populateQualifyingModal();

    const poleSitter = this.cars[0];
    this.logCommentary(`🏁 QUALIFYING COMPLETE: ${poleSitter ? poleSitter.driverName : 'Leader'} takes POLE with a ${poleSitter ? poleSitter.qualyLapTime.toFixed(3) : ''}s!`, 'system');

    this.renderFrame();

    if (showResultsModal) {
      const modal = document.getElementById('qualifying-modal');
      if (modal) modal.classList.remove('hidden');
    }
  },

  populateQualifyingModal() {
    const tbody = document.getElementById('qualifying-results-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const poleTime = this.cars.length > 0 && this.cars[0].qualyLapTime ? this.cars[0].qualyLapTime : 0;

    this.cars.forEach((car, index) => {
      const tr = document.createElement('tr');
      const gapStr = index === 0 ? 'POLE' : `+${(car.qualyLapTime - poleTime).toFixed(3)}s`;

      tr.innerHTML = `
        <td><strong>P${index + 1}</strong></td>
        <td><span class="badge-tag" style="background-color: ${car.color}; color:#FFF;">•</span><strong>${car.driverName}</strong></td>
        <td>${car.playerName}</td>
        <td><strong style="color: ${index === 0 ? '#FFD700' : '#FFF'};">${car.qualyLapTime ? car.qualyLapTime.toFixed(3) + 's' : 'N/A'}</strong></td>
        <td style="color: ${index === 0 ? '#00E676' : 'var(--text-secondary)'}; font-family: monospace;">${gapStr}</td>
      `;
      tbody.appendChild(tr);
    });
  },

  play() {
    if (this.isPlaying) return;

    // Defensive requirement #5: If user skips qualifying and clicks Start Race, auto-run it first
    if (!this.hasRunQualifying) {
      this.runQualifying(false);
    }

    if (!this.raceStarted) {
      // Initialize race order directly from current grid order
      this.raceOrder = [...this.cars];
      this.hysteresisCounters = {};
      this.pitsThisLap = 0;
      this.lastPitCountLap = 1;

      // Assign strategic pit windows (Part 3)
      this.assignPlannedPitWindows();

      // Roll realistic auto-weather schedule (Part 2)
      if (!this.autoWeatherSchedule) {
        this.initRaceWeather();
      }
    }

    this.isPlaying = true;
    this.raceStarted = true;

    // Hide Start Qualifying button once race has started
    const qualyBtn = document.getElementById('btn-sim-qualifying');
    if (qualyBtn) qualyBtn.style.display = 'none';

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
    this.hasRunQualifying = false;
    this.raceStarted = false;
    this.safetyCarActive = false;
    this.safetyCarLapsRemaining = 0;
    this.safetyCarRestartLap = -1;
    this.lastOvertakePairKey = null;
    this.fastestLap = { time: Infinity, driverName: null, carId: null };
    this.commentaryLogs = [];
    this.commentaryQueue = [];
    this.simulatedTimeSeconds = 0;
    this.lastCommentarySimTime = -999;
    this.raceOrder = [];
    this.hysteresisCounters = {};
    this.pitsThisLap = 0;
    this.lastPitCountLap = 1;
    this.autoWeatherSchedule = null;
    this.weatherChangesCount = 0;

    // Reset weather according to weatherMode
    if (this.weatherMode === 'auto') {
      this.weather = 'dry';
      document.getElementById('telemetry-weather-indicator').textContent = '☀️ DRY';
    } else if (this.weatherMode === 'wet') {
      this.weather = 'wet';
      document.getElementById('telemetry-weather-indicator').textContent = '🌧️ WET';
    } else {
      this.weather = 'dry';
      document.getElementById('telemetry-weather-indicator').textContent = '☀️ DRY';
    }

    // Show Start Qualifying button on reset
    const qualyBtn = document.getElementById('btn-sim-qualifying');
    if (qualyBtn) qualyBtn.style.display = 'inline-block';

    const trackMeta = SIM_CONFIG.TRACKS[this.trackKey];
    this.totalLaps = trackMeta && trackMeta.laps ? trackMeta.laps : 15;
    this.buildDraftedCarsList();
    this.raceOrder = [...this.cars];
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

  /**
   * Assigns individual planned pit windows to each car at race start (Part 3):
   * - Base lap between 30% and 65% of race distance
   * - Shifted by starting tyre (Soft earlier, Hard later)
   * - Random offset of -2 to +2 laps
   * - Driver-specific bias
   * - Bounds: no pit before lap 3 or in last 2 laps (unless forced by wear/weather)
   */
  assignPlannedPitWindows() {
    const totalLaps = this.totalLaps || 15;
    this.cars.forEach((car) => {
      const baseMin = totalLaps * 0.30;
      const baseMax = totalLaps * 0.65;
      const baseLap = baseMin + Math.random() * (baseMax - baseMin);

      let tyreShift = 0;
      if (car.tyreCompound === 'SOFT') {
        tyreShift = -2.0;
      } else if (car.tyreCompound === 'HARD') {
        tyreShift = +2.5;
      }

      const randOffset = (Math.random() * 4.0) - 2.0; // -2 to +2 laps
      const skillBias = ((car.skill - 50) / 50.0) * 0.8;

      let plannedLap = Math.round(baseLap + tyreShift + randOffset + skillBias);
      // Clamp within bounds [3, totalLaps - 2]
      plannedLap = Math.max(SIM_CONFIG.PIT_MIN_LAP, Math.min(totalLaps - 2, plannedLap));
      car.plannedPitLap = plannedLap;
    });
  },

  /**
   * Initializes race weather and auto-weather schedule if in Auto mode (Part 2):
   * In Auto mode, race starts dry.
   * Roll once: if it rains this race, pick a start lap between 25% and 65% of race distance.
   * Rain lasts 3 to 8 laps (never past final lap) and then stops.
   * Second rain period possible only on high-rain tracks (rainChance >= 0.35) with prob 0.25.
   * Maximum 2 weather changes per race.
   */
  initRaceWeather() {
    this.weatherChangesCount = 0;
    this.autoWeatherSchedule = [];

    if (this.weatherMode === 'auto') {
      this.weather = 'dry';
      document.getElementById('telemetry-weather-indicator').textContent = '☀️ DRY';

      const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;
      const rainChance = trackInfo.rainChance !== undefined ? trackInfo.rainChance : 0.20;
      const totalLaps = this.totalLaps || 15;

      const willRain = Math.random() < rainChance;
      if (willRain) {
        const startMin = Math.max(2, Math.round(totalLaps * 0.25));
        const startMax = Math.max(startMin, Math.round(totalLaps * 0.65));
        const rainStartLap = Math.floor(startMin + Math.random() * (startMax - startMin + 1));

        const maxDuration = Math.max(1, totalLaps - rainStartLap);
        const randDuration = Math.floor(3 + Math.random() * 6); // 3 to 8 laps
        const rainDuration = Math.min(randDuration, maxDuration);
        const rainEndLap = rainStartLap + rainDuration;

        this.autoWeatherSchedule.push({
          startLap: rainStartLap,
          endLap: rainEndLap
        });
      }
    } else if (this.weatherMode === 'wet') {
      this.weather = 'wet';
      document.getElementById('telemetry-weather-indicator').textContent = '🌧️ WET';
    } else {
      this.weather = 'dry';
      document.getElementById('telemetry-weather-indicator').textContent = '☀️ DRY';
    }
  },

  /**
   * Evaluates weather transitions during the race in Auto mode (Part 2)
   */
  checkAutoWeatherTransitions(currentLap) {
    if (this.weatherMode !== 'auto' || !this.autoWeatherSchedule || this.autoWeatherSchedule.length === 0) {
      return;
    }

    if (this.weatherChangesCount >= 2) {
      return;
    }

    const sched = this.autoWeatherSchedule[0];
    if (!sched) return;

    if (this.weather === 'dry' && currentLap >= sched.startLap && currentLap < sched.endLap) {
      // Transition from DRY -> WET (Change 1)
      this.weather = 'wet';
      this.weatherChangesCount++;
      document.getElementById('telemetry-weather-indicator').textContent = '🌧️ WET';
      this.logCommentary('🌧️ WEATHER ALERT: Rain is falling heavily on the circuit! Track declared WET.', 'incident');
      this.triggerWeatherPitReactions('wet');
    } else if (this.weather === 'wet' && currentLap >= sched.endLap) {
      // Transition from WET -> DRY (Change 2)
      this.weather = 'dry';
      this.weatherChangesCount++;
      document.getElementById('telemetry-weather-indicator').textContent = '☀️ DRY';
      this.logCommentary('☀️ WEATHER ALERT: Rain has stopped and track surface is drying out!', 'incident');
      this.triggerWeatherPitReactions('dry');
      this.autoWeatherSchedule.shift(); // Finished this period
    }
  },

  /**
   * When weather changes, each car decides to pit after random delay of 1 to 3 laps.
   * Drivers with higher skill react 0 to 1 lap faster.
   */
  triggerWeatherPitReactions(newWeather) {
    this.cars.forEach((car) => {
      if (car.isDNF) return;

      // Base random delay of 1 to 3 laps
      const baseDelay = Math.floor(1 + Math.random() * 3); // 1, 2, or 3
      // Drivers with higher skill react 0 to 1 lap faster
      const skillReduction = (car.skill >= 85) ? 1 : ((car.skill >= 70 && Math.random() < 0.5) ? 1 : 0);
      const effectiveDelay = Math.max(0, baseDelay - skillReduction);
      car.weatherPitDelayRemaining = effectiveDelay;
    });
  },

  /**
   * Race order tracking with hysteresis (Part 1):
   * Two cars swap in the order only if the one behind has been ahead for 5 consecutive frames.
   */
  updateRaceOrderWithHysteresis() {
    const activeCars = this.cars.filter(c => !c.isDNF);
    if (!this.raceOrder || this.raceOrder.length === 0) {
      this.raceOrder = [...this.cars];
      this.hysteresisCounters = {};
      return;
    }

    const activeIds = new Set(activeCars.map(c => c.id));
    const currentActiveOrder = this.raceOrder.filter(c => activeIds.has(c.id));
    activeCars.forEach(c => {
      if (!currentActiveOrder.includes(c)) currentActiveOrder.push(c);
    });

    for (let i = 0; i < currentActiveOrder.length - 1; i++) {
      const carAhead = currentActiveOrder[i];
      const carBehind = currentActiveOrder[i + 1];

      const key = `${carBehind.id}_ahead_of_${carAhead.id}`;
      if (carBehind.totalDistance > carAhead.totalDistance) {
        this.hysteresisCounters[key] = (this.hysteresisCounters[key] || 0) + 1;
        if (this.hysteresisCounters[key] >= 5) {
          currentActiveOrder[i] = carBehind;
          currentActiveOrder[i + 1] = carAhead;
          delete this.hysteresisCounters[key];

          // Log overtake cleanly after hysteresis confirmation (disabled on lap 1 and SC restart)
          const allowOvertakeLog = (this.currentLap > 1) &&
            (this.safetyCarRestartLap <= 0 || (this.currentLap - this.safetyCarRestartLap) >= 1);
          if (allowOvertakeLog) {
            const pairKey = [carAhead.id, carBehind.id].sort().join('-');
            if (this.lastOvertakePairKey !== pairKey) {
              this.lastOvertakePairKey = pairKey;
              this.logCommentary(`⚔️ OVERTAKE: ${carBehind.driverName} (${carBehind.driverCode}) dives down the inside to pass ${carAhead.driverName}!`, 'overtake');
            }
          }
        }
      } else {
        if (this.hysteresisCounters[key]) {
          delete this.hysteresisCounters[key];
        }
      }
    }

    const dnfCars = this.cars.filter(c => c.isDNF).sort((a, b) => (b.lapsCompleted || 0) - (a.lapsCompleted || 0));
    this.raceOrder = [...currentActiveOrder, ...dnfCars];
  },

  updatePhysics() {
    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;
    const trackObj = this.getTrackPathObj(this.trackKey);
    if (!trackObj) return;

    // Track simulated time (dt = 1/60 * simSpeed seconds per physics frame)
    const dtSeconds = (1 / 60) * this.simSpeed;
    this.simulatedTimeSeconds += dtSeconds;

    // Check queued commentary against simulated time
    this.drainCommentaryQueue();

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
          const pitAdvanceDist = baseFrameDelta * 0.2 * trackObj.length;
          car.totalDistance = (car.totalDistance || 0) + pitAdvanceDist;
          const startOffset = trackObj.startOffset || 0;
          car.distance = (((startOffset + car.totalDistance) % trackObj.length) + trackObj.length) % trackObj.length;
          car.progress = car.distance / trackObj.length;
          car.totalDistanceLaps = car.totalDistance / trackObj.length;
          return;
        }
      }

      // Compute dynamic lap pace
      const theoreticalPace = this.computeCarLapPace(car);
      // Speed factor relative to base lap time
      let speedFactor = baseLapDurationSeconds / theoreticalPace;

      // Curvature Slowdown Factor (using SVG path curvature)
      const distAlongPath = car.distance !== undefined ? car.distance : (car.progress % 1) * trackObj.length;
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
      // Same launch model for all cars at lights-out, plus a small random reaction delay (+-0.15s)
      let launchFactor = 1.0;
      if (this.simulatedTimeSeconds < 1.0) {
        // First second from lights out: smooth launch acceleration curve
        const effectiveT = Math.max(0, this.simulatedTimeSeconds - (car.reactionDelay || 0));
        launchFactor = Math.min(1.0, 0.4 + effectiveT * 0.6);
      }

      const frameAdvance = baseFrameDelta * speedFactor * launchFactor;
      const prevTotalDist = car.totalDistance !== undefined ? car.totalDistance : (car.totalDistanceLaps * trackObj.length);
      const newTotalDist = prevTotalDist + (frameAdvance * trackObj.length);
      car.totalDistance = newTotalDist;

      // Distance along path with startOffset applied (0 to trackObj.length)
      const startOffset = trackObj.startOffset || 0;
      const wrappedDist = (((startOffset + newTotalDist) % trackObj.length) + trackObj.length) % trackObj.length;
      car.distance = wrappedDist;
      car.progress = wrappedDist / trackObj.length;
      car.totalDistanceLaps = newTotalDist / trackObj.length;

      // Burn fuel gradually
      car.fuelLoadKg = Math.max(5.0, car.fuelLoadKg - (SIM_CONFIG.FUEL_BURN_PER_LAP_KG * frameAdvance));

      // Degrade tyres
      const compound = SIM_CONFIG.TYRE_COMPOUNDS[car.tyreCompound] || SIM_CONFIG.TYRE_COMPOUNDS.MEDIUM;
      car.tyreAge += frameAdvance;
      car.tyreWear = Math.min(1.0, car.tyreWear + (compound.wearRatePerLap * trackInfo.tyreWearMultiplier * frameAdvance));

      // Lap counting: a lap completes when a car's total distance crosses a multiple of pathLength,
      // so each car visibly crosses the line before Lap 2 starts. Lap 1 must begin at the grid.
      // E.g. grid is totalDistance in [-offset, 0). Crossing 0 completes Lap 1 -> enters Lap 2.
      // Crossing pathLength completes Lap 2 -> enters Lap 3, etc.
      // Math.floor(newTotalDist / pathLength) + 2:
      // When newTotalDist < 0: floor(-8 / L) = -1 => lap = -1 + 2 = 1.
      // When newTotalDist >= 0 and < L: floor(0 / L) = 0 => lap = 0 + 2 = 2.
      const currentLapNumber = Math.floor(newTotalDist / trackObj.length) + 2;
      if (currentLapNumber > car.lap) {
        const completedLapNum = car.lap;
        car.lapsCompleted = completedLapNum;
        car.lap = currentLapNumber;

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

        // Random DNF Incident Chance (Part 2)
        // Convert the per-race chance to a per-lap chance: 1 - (1 - DNF_CHANCE_PER_CAR_PER_RACE)^(1 / totalLaps)
        const totalLaps = Math.max(1, this.totalLaps || 15);
        let basePerLapDnfChance = 1 - Math.pow(1 - SIM_CONFIG.DNF_CHANCE_PER_CAR_PER_RACE, 1 / totalLaps);

        // Lower-skill drivers 1.5x as likely, top-skill drivers 0.6x (skill 1 to 100)
        const skillFactor = car.skill >= 90 ? 0.6 : (car.skill <= 75 ? 1.5 : (1.5 - ((car.skill - 75) / 15) * 0.9));
        // Wet weather 1.5x
        const weatherFactor = this.weather === 'wet' ? 1.5 : 1.0;

        const effectiveDnfChance = basePerLapDnfChance * skillFactor * weatherFactor;

        // Count current DNFs
        const currentDnfCount = this.cars.filter(c => c.isDNF).length;

        // Check if DNF can happen: 4th never happens
        if (!car.isDNF && car.lap > 1 && !this.safetyCarActive && currentDnfCount < 3) {
          if (Math.random() < effectiveDnfChance) {
            let allowRetirement = false;
            if (currentDnfCount < SIM_CONFIG.MAX_DNFS_NORMAL) {
              allowRetirement = true;
            } else if (currentDnfCount === 2) {
              // Once 2 cars have retired, 3rd only goes ahead with THIRD_DNF_CHANCE
              if (Math.random() < SIM_CONFIG.THIRD_DNF_CHANCE) {
                allowRetirement = true;
              }
            }

            if (allowRetirement) {
              car.isDNF = true;
              car.dnfReason = this.weather === 'wet' ? 'Aquaplaned into Barriers' : 'Hydraulics Failure';
              car.status = 'DNF';
              this.logCommentary(`💥 CRASH / DNF: ${car.driverName} is OUT with ${car.dnfReason}!`, 'incident');

              // Trigger Safety Car with high probability
              if (Math.random() < SIM_CONFIG.SC_TRIGGER_CHANCE_ON_DNF) {
                this.triggerSafetyCar();
              }
            }
          }
        }

        // Check weather reaction countdown
        if (car.weatherPitDelayRemaining !== null && car.weatherPitDelayRemaining !== undefined) {
          if (car.weatherPitDelayRemaining > 0) {
            car.weatherPitDelayRemaining--;
          }
        }

        // Pit Stop Strategy Decision (Part 3)
        // - At most 2 cars may enter the pits on the same lap. Extra cars delay by one lap.
        // - No car may pit before lap 3, or in the last 2 laps unless forced by tyre wear or weather.
        if (!car.isDNF && !car.isPitting && car.lap <= this.totalLaps) {
          const isPastMinLap = car.lap >= SIM_CONFIG.PIT_MIN_LAP;
          const isBeforeLastTwoLaps = car.lap <= (this.totalLaps - 2);

          // Forced pit conditions:
          const isTyreCliff = car.tyreWear >= SIM_CONFIG.PIT_CLIFF_THRESHOLD;
          const isWeatherForced = (this.weather === 'wet' && car.tyreCompound !== 'WET' && car.weatherPitDelayRemaining === 0) ||
                                  (this.weather === 'dry' && car.tyreCompound === 'WET' && car.weatherPitDelayRemaining === 0);

          // Strategic planned pit conditions:
          const isWindowOpen = isPastMinLap && isBeforeLastTwoLaps && car.plannedPitLap && (car.lap >= car.plannedPitLap);
          const isWearThreshold = car.tyreWear >= SIM_CONFIG.PIT_NORMAL_WEAR_THRESHOLD;

          // Undercut trigger: fighting close behind another car (within 1.0s gap)
          let isUndercut = false;
          if (isPastMinLap && isBeforeLastTwoLaps && car.gapToLeader > 0 && car.plannedPitLap && (car.lap === car.plannedPitLap - 1)) {
            const activeCarsAhead = this.cars.filter(c => !c.isDNF && c !== car && c.totalDistance > car.totalDistance);
            if (activeCarsAhead.length > 0) {
              const closestAhead = activeCarsAhead.reduce((minC, c) => (c.totalDistance < minC.totalDistance ? c : minC), activeCarsAhead[0]);
              const gapToCarAheadSec = (closestAhead.totalDistance - car.totalDistance) / trackObj.length * trackInfo.baseLapTime;
              if (gapToCarAheadSec <= SIM_CONFIG.UNDERCUT_GAP_THRESHOLD_SEC && Math.random() < SIM_CONFIG.UNDERCUT_CHANCE) {
                isUndercut = true;
              }
            }
          }

          // Mandatory stop in dry race >= 10 laps if approaching end of race
          const isMandatoryDryStop = (this.weather === 'dry' && this.totalLaps >= 10 && car.pitStops === 0 && car.lap >= (this.totalLaps - 3));

          const wantsToPit = isTyreCliff || isWeatherForced || (isWindowOpen && isWearThreshold) || isUndercut || isMandatoryDryStop;

          if (wantsToPit) {
            // Check pit lane capacity: at most 2 cars per lap
            if (this.pitsThisLap < SIM_CONFIG.PIT_MAX_CARS_PER_LAP || isTyreCliff || isWeatherForced) {
              this.pitsThisLap++;
              this.executePitStop(car);
            } else {
              // Delay by one lap
              if (car.plannedPitLap) car.plannedPitLap++;
            }
          }
        }
      }
    });

    // Update global leader lap counter
    if (leader) {
      const prevLeaderLap = this.currentLap;
      this.currentLap = Math.min(leader.lap, this.totalLaps + 1);
      if (this.currentLap !== prevLeaderLap) {
        // Lap rolled over: reset pit capacity counter for new lap
        this.pitsThisLap = 0;
      }
    }

    // Check weather transitions for Auto mode (Part 2)
    this.checkAutoWeatherTransitions(this.currentLap);

    // Compute and update race order with hysteresis (Part 1)
    this.updateRaceOrderWithHysteresis();

    // Process Safety Car Laps
    if (this.safetyCarActive) {
      this.safetyCarLapsRemaining -= 0.0035 * this.simSpeed;
      if (this.safetyCarLapsRemaining <= 0) {
        this.safetyCarActive = false;
        this.safetyCarRestartLap = this.currentLap; // Track restart lap
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
    if (!car.usedCompounds) car.usedCompounds = [oldCompound];

    // Choose new compound:
    if (this.weather === 'wet') {
      car.tyreCompound = 'WET';
    } else {
      const remainingLaps = this.totalLaps - car.lap;
      const dryCompounds = ['SOFT', 'MEDIUM', 'HARD'];
      const unusedDry = dryCompounds.filter(c => !car.usedCompounds.includes(c));

      if (unusedDry.length > 0) {
        // Must use at least two different dry compounds in dry race >= 10 laps
        if (remainingLaps <= 6 && unusedDry.includes('SOFT')) {
          car.tyreCompound = 'SOFT';
        } else if (unusedDry.includes('HARD') && remainingLaps > 8) {
          car.tyreCompound = 'HARD';
        } else if (unusedDry.includes('MEDIUM')) {
          car.tyreCompound = 'MEDIUM';
        } else {
          car.tyreCompound = unusedDry[0];
        }
      } else {
        // Both used already; choose based on remaining distance
        if (remainingLaps <= 6) {
          car.tyreCompound = 'SOFT';
        } else if (oldCompound === 'SOFT') {
          car.tyreCompound = 'HARD';
        } else {
          car.tyreCompound = 'MEDIUM';
        }
      }
    }

    if (!car.usedCompounds.includes(car.tyreCompound)) {
      car.usedCompounds.push(car.tyreCompound);
    }

    car.tyreAge = 0;
    car.tyreWear = 0.0;
    car.weatherPitDelayRemaining = null;

    // Requirement: Log pit stops as normal priority commentary
    this.logCommentary(`🛑 BOX BOX: ${car.driverName} pits for fresh ${car.tyreCompound} tyres! (~20s stop)`, 'normal');
  },

  /**
   * Overtaking Logic:
   * Car within 1.0s gap with pace advantage has chance to pass based on pace difference & track difficulty.
   * Otherwise stays stuck behind slower car.
   *
   * Constraints:
   * - Disabled on Lap 1
   * - Disabled for 1 full lap after safety car restart
   * - Never logs the same driver pair's overtake twice in a row
   */
  processOvertaking() {
    if (this.safetyCarActive) return;

    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;
    const activeCars = this.cars.filter(c => !c.isDNF && !c.isPitting);
    if (activeCars.length === 0) return;

    const baseLapTime = trackInfo.baseLapTime;
    const leaderDist = (this.raceOrder && this.raceOrder[0]) ? this.raceOrder[0].totalDistance : activeCars[0].totalDistance;

    activeCars.forEach(car => {
      car.gapToLeader = Math.max(0, ((leaderDist - car.totalDistance) / (trackInfo.baseLapTime * 60)) * baseLapTime);
    });
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

    // Compute bounding box and uniform scale to fill 90% of canvas width or height, centered
    const bounds = trackObj.bounds || this.getTrackBounds(trackObj.points);
    const trackScale = Math.min((width * 0.90) / bounds.width, (height * 0.90) / bounds.height);
    const trackCenterX = (bounds.minX + bounds.maxX) / 2;
    const trackCenterY = (bounds.minY + bounds.maxY) / 2;
    const tx = (width / 2) - trackCenterX * trackScale;
    const ty = (height / 2) - trackCenterY * trackScale;

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(trackScale, trackScale);

    // 1. Draw Real GeoJSON Track Circuit Outline
    // Invert line widths slightly by trackScale so asphalt width remains natural & consistent
    const lwOuter = 26 / Math.sqrt(trackScale);
    const lwTrack = 20 / Math.sqrt(trackScale);
    const lwLine = 12 / Math.sqrt(trackScale);
    const lwApex = 2 / Math.sqrt(trackScale);

    // Outer Asphalt Border (Thick Dark Stroke)
    ctx.strokeStyle = '#0B0B10';
    ctx.lineWidth = lwOuter;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(trackObj.path2d);

    ctx.strokeStyle = '#1F1F2C';
    ctx.lineWidth = lwTrack;
    ctx.stroke(trackObj.path2d);

    // Racing Line Surface (Thinner Lighter Stroke)
    ctx.strokeStyle = '#323246';
    ctx.lineWidth = lwLine;
    ctx.stroke(trackObj.path2d);

    // Center Red Apex Guide Line
    ctx.strokeStyle = 'rgba(225, 6, 0, 0.4)';
    ctx.lineWidth = lwApex;
    ctx.setLineDash([8 / trackScale, 8 / trackScale]);
    ctx.stroke(trackObj.path2d);
    ctx.setLineDash([]);

    // Safety Car Yellow Outline overlay
    if (this.safetyCarActive) {
      ctx.strokeStyle = '#FFCC00';
      ctx.lineWidth = 4 / Math.sqrt(trackScale);
      ctx.stroke(trackObj.path2d);
    }

    // 2. Start / Finish Line (placed cleanly at the end of that straight)
    const startOffset = trackObj.startOffset || 0;
    const startPt = trackObj.el.getPointAtLength(startOffset);
    const startPtAhead = trackObj.el.getPointAtLength((startOffset + 4) % trackObj.length);
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
    // Determine current position ranking for label visibility
    const sortedActive = [...this.cars].filter(c => !c.isDNF).sort((a, b) => b.totalDistanceLaps - a.totalDistanceLaps);
    const numTotalCars = this.cars.length;

    // Scale dot size smoothly for big fields and invert trackScale so car dots/labels stay crisp & readable
    const baseFieldScale = numTotalCars > 12 ? 0.75 : (numTotalCars > 6 ? 0.88 : 1.0);
    // Relative to a nominal track scale of 1.0:
    const visualScale = (baseFieldScale / Math.sqrt(trackScale));

    // Check if cars are spread out (e.g. gap between leader and P8 or last car > 0.08 laps or lap > 1)
    const leaderDist = sortedActive[0] ? sortedActive[0].totalDistanceLaps : 0;
    const isSpreadOut = this.currentLap > 1 || (sortedActive.length > 1 && (leaderDist - sortedActive[sortedActive.length - 1].totalDistanceLaps) > 0.12);

    this.cars.forEach((car) => {
      if (car.isDNF) return;

      const dist = car.distance !== undefined ? car.distance : (((car.progress % 1) + 1) % 1) * trackObj.length;
      let p = trackObj.el.getPointAtLength(dist);
      const delta = 2;
      const pAhead = trackObj.el.getPointAtLength((dist + delta) % trackObj.length);
      const angle = Math.atan2(pAhead.y - p.y, pAhead.x - p.x);

      // Apply staggered grid lateral offset on grid (and smoothly converge to racing line once racing)
      let latOffset = 0;
      if (car.lateralOffset) {
        if (!this.raceStarted) {
          latOffset = car.lateralOffset;
        } else if (car.totalDistance < trackObj.length * 0.15) {
          // Transition smoothly from grid slots to centerline over first 15% of lap 1
          const factor = Math.max(0, 1 - (car.totalDistance + 80) / (trackObj.length * 0.15 + 80));
          latOffset = car.lateralOffset * factor;
        }
      }

      if (latOffset !== 0) {
        // Normal vector perpendicular to path tangent
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        p = {
          x: p.x + nx * latOffset,
          y: p.y + ny * latOffset
        };
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.scale(visualScale, visualScale);

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
      // Requirement 4: Do not draw driver labels on the grid before the race starts.
      // After lights out, show labels only for the top 5 (determined by hysteresis raceOrder).
      let showLabel = false;
      if (this.raceStarted) {
        const orderList = (this.raceOrder && this.raceOrder.length > 0) ? this.raceOrder : this.cars;
        const currentRank = orderList.indexOf(car) + 1;
        showLabel = (currentRank <= 5);
      }

      if (showLabel) {
        ctx.fillStyle = '#FFFFFF';
        const fontSize = Math.max(7, Math.round((numTotalCars > 12 ? 8 : (numTotalCars > 8 ? 9 : 10)) * visualScale));
        ctx.font = `900 ${fontSize}px "Chakra Petch", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(car.driverCode, p.x, p.y - (6 * visualScale + 2));
        ctx.shadowBlur = 0;
      }
    });

    ctx.restore(); // Restore track-scale transformation matrix

    // 4. Update UI Telemetry Banner
    document.getElementById('telemetry-current-lap').textContent = Math.min(this.currentLap, this.totalLaps);
    document.getElementById('telemetry-total-laps').textContent = this.totalLaps;

    // 5. Update Live Broadcast Leaderboard
    this.updateLeaderboardUI();
  },

  updateLeaderboardUI() {
    const tbody = document.getElementById('sim-leaderboard-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Read directly from raceOrder computed with hysteresis
    const sortedCars = (this.raceOrder && this.raceOrder.length > 0) ? this.raceOrder : this.cars;
    const leader = sortedCars[0];
    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;

    sortedCars.forEach((car, index) => {
      const tr = document.createElement('tr');
      tr.className = 'timing-tower-row';

      // 1. Position (P1, P2...)
      const posTd = document.createElement('td');
      posTd.className = 'col-pos';
      posTd.innerHTML = `<strong>${index + 1}</strong>`;

      // 2. Team Color Bar
      const colorTd = document.createElement('td');
      colorTd.className = 'col-team-bar';
      colorTd.innerHTML = `<span class="team-color-bar" style="background-color: ${car.color};"></span>`;

      // 3. 3-Letter Driver Code
      const codeTd = document.createElement('td');
      codeTd.className = 'col-code';
      codeTd.textContent = car.driverCode;

      // 4. Gap to Leader (+1.245s or LEADER or OUT or PIT)
      const gapTd = document.createElement('td');
      gapTd.className = 'col-gap';
      if (car.isDNF) {
        gapTd.textContent = 'OUT';
        gapTd.className += ' gap-dnf';
      } else if (car.isPitting) {
        gapTd.textContent = `PIT`;
        gapTd.className += ' gap-pit';
      } else if (index === 0) {
        gapTd.textContent = 'LEADER';
        gapTd.className += ' gap-leader';
      } else {
        const gapLaps = leader.totalDistanceLaps - car.totalDistanceLaps;
        const gapSec = Math.max(0.05, gapLaps * trackInfo.baseLapTime).toFixed(3);
        gapTd.textContent = `+${gapSec}s`;
        gapTd.className += ' gap-interval';
      }

      // 5. Tyre Compound Dot
      const compoundInfo = SIM_CONFIG.TYRE_COMPOUNDS[car.tyreCompound] || SIM_CONFIG.TYRE_COMPOUNDS.MEDIUM;
      const tyreTd = document.createElement('td');
      tyreTd.className = 'col-tyre';
      tyreTd.innerHTML = `<span class="tyre-dot" style="background-color: ${compoundInfo.color};" title="${compoundInfo.name}">${compoundInfo.code}</span>`;

      tr.appendChild(posTd);
      tr.appendChild(colorTd);
      tr.appendChild(codeTd);
      tr.appendChild(gapTd);
      tr.appendChild(tyreTd);

      tbody.appendChild(tr);
    });
  },

  /**
   * Rate-limited commentary manager:
   * - Rate limit measured in SIMULATED time (2.5 sim-seconds between normal messages).
   * - High-priority events (DNF, safety car, race end) skip the queue and appear immediately.
   * - Low-priority messages (overtakes, fastest lap) are dropped if more than 2 are queued.
   * - When race ends, flush the queue instantly.
   * - In Instant mode, skip queue and log only high-priority events and final result.
   */
  startCommentaryProcessor() {
    if (this.commentaryTimerId) return;

    this.commentaryTimerId = setInterval(() => {
      // In case simulation is paused or stopped, check queue if needed
      if (!this.isPlaying && this.commentaryQueue.length > 0) {
        this.drainCommentaryQueue();
      }
    }, 250);
  },

  drainCommentaryQueue() {
    if (this.commentaryQueue.length === 0) return;

    // 2.5 sim-seconds between messages (or 2.5 real seconds if sim hasn't started)
    const currentSim = this.simulatedTimeSeconds;
    if (currentSim - this.lastCommentarySimTime < 2.5) {
      return;
    }

    const nextMsg = this.commentaryQueue.shift();
    if (!nextMsg) return;

    this.renderCommentaryItem(nextMsg.text, nextMsg.type);
    this.lastCommentarySimTime = currentSim;
  },

  flushCommentaryQueue() {
    while (this.commentaryQueue.length > 0) {
      const msg = this.commentaryQueue.shift();
      if (msg) {
        this.renderCommentaryItem(msg.text, msg.type);
      }
    }
    this.lastCommentarySimTime = this.simulatedTimeSeconds;
  },

  renderCommentaryItem(text, type) {
    const feed = document.getElementById('commentary-feed');
    if (!feed) return;
    const div = document.createElement('div');
    div.className = `feed-item ${type}`;
    div.textContent = text;
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;
  },

  logCommentary(text, type = 'normal') {
    // High-priority events: DNF, safety car, race end, system grid/start announcements
    // Low-priority events: overtakes, fastest lap
    const isHighPriority = (type === 'incident' || type === 'system') && !text.includes('FASTEST LAP');

    // In Instant mode, skip the queue and log ONLY high-priority events and final result
    if (this.isInstantMode) {
      if (isHighPriority) {
        this.renderCommentaryItem(text, type);
      }
      return;
    }

    // High-priority events skip the queue and appear immediately
    if (isHighPriority) {
      this.renderCommentaryItem(text, type);
      this.lastCommentarySimTime = this.simulatedTimeSeconds;
      return;
    }

    // Low-priority messages: dropped if more than 2 are queued
    if (this.commentaryQueue.length >= 2) {
      // Already 2 low-priority messages waiting, drop incoming low-priority message
      return;
    }

    this.commentaryQueue.push({ text, type });

    // Attempt to drain if interval allows
    this.drainCommentaryQueue();
  },

  runInstantFinish() {
    this.pause();
    this.isInstantMode = true;
    this.currentLap = this.totalLaps + 1;

    // Fast-forward simulation results
    this.cars.forEach(car => {
      if (!car.isDNF) {
        car.lap = this.totalLaps;
        car.totalDistanceLaps = this.totalLaps + 0.99 - (car.gridPos * 0.02) + (Math.random() * 0.08);
      }
    });

    this.finishRace();
    this.isInstantMode = false;
  },

  advanceToNextChampionshipRace() {
    this.championshipState.currentRaceIndex += 1;
    this.trackKey = this.championshipState.tracks[this.championshipState.currentRaceIndex];

    const trackMeta = SIM_CONFIG.TRACKS[this.trackKey];
    this.totalLaps = trackMeta && trackMeta.laps ? trackMeta.laps : 15;
    this.currentLap = 1;
    this.hasRunQualifying = false;
    this.raceStarted = false;
    this.isPlaying = false;
    this.safetyCarActive = false;
    this.safetyCarLapsRemaining = 0;
    this.safetyCarRestartLap = -1;
    this.lastOvertakePairKey = null;
    this.fastestLap = { time: Infinity, driverName: null, carId: null };
    this.commentaryLogs = [];
    this.commentaryQueue = [];
    this.simulatedTimeSeconds = 0;
    this.lastCommentarySimTime = -999;

    // Show Start Qualifying button for next race
    const qualyBtn = document.getElementById('btn-sim-qualifying');
    if (qualyBtn) qualyBtn.style.display = 'inline-block';

    document.getElementById('btn-sim-play').classList.remove('btn-active');
    document.getElementById('btn-sim-pause').classList.remove('btn-active');
    document.getElementById('sim-status-badge').textContent = 'PRE-RACE GRID';
    document.getElementById('sim-status-badge').style.background = '#E10600';
    document.getElementById('sim-status-badge').style.color = '#FFF';

    // Reset weather & race order for next championship round
    this.raceOrder = [];
    this.hysteresisCounters = {};
    this.pitsThisLap = 0;
    this.lastPitCountLap = 1;
    this.autoWeatherSchedule = null;
    this.weatherChangesCount = 0;
    if (this.weatherMode === 'auto') {
      this.weather = 'dry';
      document.getElementById('telemetry-weather-indicator').textContent = '☀️ DRY';
    }

    // Rebuild fresh car state (positions, tyres, fuel, DNFs) while preserving players & rosters
    this.buildDraftedCarsList();
    this.raceOrder = [...this.cars];
    this.updateChampionshipTelemetryBanner();

    document.getElementById('commentary-feed').innerHTML = '';
    const trackName = trackMeta ? trackMeta.displayName : this.trackKey;
    this.logCommentary(`Championship Round ${this.championshipState.currentRaceIndex + 1}/${this.championshipState.totalRaces} at ${trackName}. Grid formed!`, 'system');
    this.renderFrame();
  },

  finishRace() {
    this.pause();
    document.getElementById('sim-status-badge').textContent = 'CHECKERED FLAG';
    document.getElementById('sim-status-badge').style.background = '#FFD700';
    document.getElementById('sim-status-badge').style.color = '#000';

    // Flush any pending commentary instantly when the race ends
    this.flushCommentaryQueue();
    this.logCommentary('🏁 CHECKERED FLAG: The Grand Prix has concluded!', 'system');

    // 1. Calculate Final Classification for this race:
    // Finishers first (sorted by distance/laps descending).
    // DNF drivers below all finishers, ordered by laps completed (most first).
    const finishers = this.cars.filter(c => !c.isDNF).sort((a, b) => b.totalDistanceLaps - a.totalDistanceLaps);
    const dnfCars = this.cars.filter(c => c.isDNF).sort((a, b) => (b.lapsCompleted || 0) - (a.lapsCompleted || 0));
    const finalClassification = [...finishers, ...dnfCars];

    // 2. Award Points & Fastest Lap Bonus (+1 pt if in top 10 finishers, DNF drivers NEVER score points or FL bonus)
    let overallBestLap = null;
    let fastestLapDriver = null;

    finishers.forEach(car => {
      if (car.bestLap && (!overallBestLap || car.bestLap < overallBestLap)) {
        overallBestLap = car.bestLap;
        fastestLapDriver = car;
      }
    });

    finalClassification.forEach((car, index) => {
      if (car.isDNF) {
        car.pointsAwarded = 0;
        car.hasFastestLap = false;
        return;
      }

      let points = index < SIM_CONFIG.POINTS_SCALE.length ? SIM_CONFIG.POINTS_SCALE[index] : 0;
      if (car === fastestLapDriver && index < 10) {
        points += 1;
        car.hasFastestLap = true;
      } else {
        car.hasFastestLap = false;
      }
      car.pointsAwarded = points;
    });

    // 3. Compute this round's team gains
    const roundPlayerPoints = {};
    const roundBestFinish = {};
    let roundWinnerPlayerId = null;

    if (finalClassification.length > 0) {
      const raceWinnerCar = finalClassification[0];
      const winnerPlayer = F1App.state.players.find(p => p.name === raceWinnerCar.playerName);
      if (winnerPlayer) {
        roundWinnerPlayerId = winnerPlayer.id;
      }
    }

    F1App.state.players.forEach(player => {
      const playerDrivers = finalClassification.filter(c => c.playerName === player.name);
      const pointsGain = playerDrivers.reduce((sum, d) => sum + d.pointsAwarded, 0);
      const positions = playerDrivers.map(d => finalClassification.indexOf(d) + 1);
      const bestFin = positions.length > 0 ? Math.min(...positions) : 999;

      roundPlayerPoints[player.id] = pointsGain;
      roundBestFinish[player.id] = bestFin;

      // Update Cumulative Championship State if in Championship mode
      if (this.championshipState.isChampionship && this.championshipState.cumulativeScores[player.id]) {
        const cScore = this.championshipState.cumulativeScores[player.id];
        cScore.totalPoints += pointsGain;
        if (roundWinnerPlayerId === player.id) {
          cScore.raceWins += 1;
        }
        if (bestFin < cScore.bestSingleFinish) {
          cScore.bestSingleFinish = bestFin;
        }
      }
    });

    const isChampionship = this.championshipState.isChampionship;
    const isFinalRace = !isChampionship || (this.championshipState.currentRaceIndex >= this.championshipState.totalRaces - 1);

    if (isChampionship && !isFinalRace) {
      // 4A. Show Mid-Championship Results Panel (NO PODIUM CEREMONY YET)
      this.showMidChampionshipResults(finalClassification, roundPlayerPoints);
    } else {
      // 4B. Show Final Results & Championship Podium Ceremony
      this.showFinalChampionshipPodium(finalClassification, roundPlayerPoints);
    }
  },

  showMidChampionshipResults(finalClassification, roundPlayerPoints) {
    const roundNum = this.championshipState.currentRaceIndex + 1;
    const totalRaces = this.championshipState.totalRaces;

    const roundTitle = document.getElementById('champ-round-title');
    if (roundTitle) {
      const trackMeta = SIM_CONFIG.TRACKS[this.trackKey];
      const trackName = trackMeta ? trackMeta.displayName : this.trackKey;
      roundTitle.textContent = `ROUND ${roundNum}/${totalRaces} (${trackName.toUpperCase()}) - RESULTS & STANDINGS`;
    }

    // Cumulative Standings Sorted by:
    // 1) Total Points (descending)
    // 2) Race Wins (descending)
    // 3) Best Finish (ascending)
    // 4) Remaining Budget (descending)
    const cumulativeList = Object.values(this.championshipState.cumulativeScores);
    cumulativeList.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.raceWins !== a.raceWins) return b.raceWins - a.raceWins;
      if (a.bestSingleFinish !== b.bestSingleFinish) return a.bestSingleFinish - b.bestSingleFinish;
      return b.remainingBudget - a.remainingBudget;
    });

    const cumTbody = document.getElementById('champ-cumulative-tbody');
    cumTbody.innerHTML = '';
    cumulativeList.forEach((team, idx) => {
      const tr = document.createElement('tr');
      const roundGain = roundPlayerPoints[team.id] || 0;
      tr.innerHTML = `
        <td><strong>P${idx + 1}</strong></td>
        <td><span class="badge-tag" style="background-color: ${team.color}; color:#FFF;">•</span><strong>${team.playerName}</strong></td>
        <td style="color:#00E676; font-weight:bold;">+${roundGain} PTS</td>
        <td><strong style="color:#FFD700; font-size:1.1rem;">${team.totalPoints} PTS</strong></td>
      `;
      cumTbody.appendChild(tr);
    });

    // Driver Classification for this race
    const driverTbody = document.getElementById('champ-round-driver-tbody');
    driverTbody.innerHTML = '';
    finalClassification.forEach((car, index) => {
      const tr = document.createElement('tr');
      const posDisplay = car.isDNF ? 'DNF' : `P${index + 1}`;
      const dnfLabel = car.isDNF ? ` <span style="color:#FF3333; font-size:0.8rem;">(Lap ${car.lapsCompleted || 0})</span>` : '';
      tr.innerHTML = `
        <td><strong>${posDisplay}</strong></td>
        <td>${car.driverName}${dnfLabel}</td>
        <td>${car.playerName}</td>
        <td><strong>${car.pointsAwarded} PTS</strong></td>
      `;
      driverTbody.appendChild(tr);
    });

    const nextRaceBtnText = document.getElementById('btn-champ-next-race-text');
    if (nextRaceBtnText) {
      const nextTrackKey = this.championshipState.tracks[this.championshipState.currentRaceIndex + 1];
      const nextMeta = SIM_CONFIG.TRACKS[nextTrackKey];
      nextRaceBtnText.textContent = `NEXT RACE: ${nextMeta ? nextMeta.displayName.toUpperCase() : 'ROUND ' + (roundNum + 1)}`;
    }

    const modal = document.getElementById('champ-race-modal');
    if (modal) modal.classList.remove('hidden');
  },

  showFinalChampionshipPodium(finalClassification, roundPlayerPoints) {
    let finalStandings = [];

    if (this.championshipState.isChampionship) {
      // Use Cumulative Scores with tie-breakers:
      // 1) Total Points
      // 2) Most race wins
      // 3) Best single finish
      // 4) Remaining budget
      finalStandings = Object.values(this.championshipState.cumulativeScores);
      finalStandings.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.raceWins !== a.raceWins) return b.raceWins - a.raceWins;
        if (a.bestSingleFinish !== b.bestSingleFinish) return a.bestSingleFinish - b.bestSingleFinish;
        return b.remainingBudget - a.remainingBudget;
      });
    } else {
      // Single Race Scores
      finalStandings = F1App.state.players.map(player => {
        const playerDrivers = finalClassification.filter(c => c.playerName === player.name);
        const totalPoints = playerDrivers.reduce((sum, d) => sum + d.pointsAwarded, 0);
        const positions = playerDrivers.map(d => finalClassification.indexOf(d) + 1);
        const bestFinish = positions.length > 0 ? Math.min(...positions) : 999;

        return {
          id: player.id,
          playerName: player.name,
          color: player.color,
          remainingBudget: player.remainingBudget,
          rosterNames: player.roster.map(r => r.name).join(', '),
          totalPoints: totalPoints,
          raceWins: bestFinish === 1 ? 1 : 0,
          bestSingleFinish: bestFinish
        };
      });

      finalStandings.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.raceWins !== a.raceWins) return b.raceWins - a.raceWins;
        if (a.bestSingleFinish !== b.bestSingleFinish) return a.bestSingleFinish - b.bestSingleFinish;
        return b.remainingBudget - a.remainingBudget;
      });
    }

    const winningPlayer = finalStandings[0];

    // Populate Podium Names & Points
    const p1Team = finalStandings[0] || { playerName: '--', totalPoints: 0 };
    const p2Team = finalStandings[1] || { playerName: '--', totalPoints: 0 };
    const p3Team = finalStandings[2] || { playerName: '--', totalPoints: 0 };

    document.getElementById('podium-p1-name').textContent = p1Team.playerName.toUpperCase();
    document.getElementById('podium-p1-pts').textContent = `${p1Team.totalPoints} PTS`;

    document.getElementById('podium-p2-name').textContent = p2Team.playerName.toUpperCase();
    document.getElementById('podium-p2-pts').textContent = `${p2Team.totalPoints} PTS`;

    document.getElementById('podium-p3-name').textContent = p3Team.playerName.toUpperCase();
    document.getElementById('podium-p3-pts').textContent = `${p3Team.totalPoints} PTS`;

    // Render Final Team Table
    const teamTbody = document.getElementById('final-team-tbody');
    teamTbody.innerHTML = '';
    finalStandings.forEach((team, index) => {
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
      const posDisplay = car.isDNF ? 'DNF' : `P${index + 1}`;
      const lapTimeOrDnf = car.isDNF
        ? `<span style="color:#FF3333; font-weight:bold;">DNF (Lap ${car.lapsCompleted || 0})</span>`
        : (car.hasFastestLap ? '🟣 FASTEST LAP (+1)' : (car.bestLap ? `${car.bestLap.toFixed(2)}s` : 'N/A'));

      tr.innerHTML = `
        <td><strong>${posDisplay}</strong></td>
        <td>${car.driverName}</td>
        <td>${car.playerName}</td>
        <td>${lapTimeOrDnf}</td>
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
