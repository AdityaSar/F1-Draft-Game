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
// DRS & OVERTAKING CONSTANTS
// ============================================================================
const OFF_DRS_OVERTAKE_FACTOR = 0.2; // Overtake probability outside DRS zones
const DRS_SPEED_BOOST = 1.06;         // Speed boost inside DRS zones (+6% top speed)
const DRS_OVERTAKE_GAP_THRESHOLD_SECONDS = 1.0; // Within 1.0s gap required for DRS

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

  // DNF constants (Part 2)
  DNF_CHANCE_PER_CAR_PER_RACE: 0.05,
  MAX_DNFS_NORMAL: 2,
  THIRD_DNF_CHANCE: 0.05,

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
      tyreWearMultiplier: 0.8,
      drsZones: [{"startFraction":0.795,"endFraction":0.953}]
    },
    monza: {
      displayName: 'Autodromo Nazionale Monza',
      country: 'Italy',
      laps: 15,
      overtakingDifficulty: 0.22, // Long straights, slipstream & DRS
      baseLapTime: 81.0,
      tyreWearMultiplier: 0.9,
      drsZones: [{"startFraction":0.442,"endFraction":0.599}, {"startFraction":0.623,"endFraction":0.834}]
    },
    spa: {
      displayName: 'Circuit de Spa-Francorchamps',
      country: 'Belgium',
      laps: 12,
      overtakingDifficulty: 0.35,
      baseLapTime: 104.0,
      tyreWearMultiplier: 1.15,
      drsZones: [{"startFraction":0.091,"endFraction":0.33}, {"startFraction":0.455,"endFraction":0.538}, {"startFraction":0.854,"endFraction":0.941}]
    },
    silverstone: {
      displayName: 'Silverstone Circuit',
      country: 'Great Britain',
      laps: 15,
      overtakingDifficulty: 0.45,
      baseLapTime: 87.0,
      tyreWearMultiplier: 1.25,
      drsZones: [{"startFraction":0.045,"endFraction":0.156}, {"startFraction":0.202,"endFraction":0.372}, {"startFraction":0.726,"endFraction":0.85}]
    },
    suzuka: {
      displayName: 'Suzuka International Racing Course',
      country: 'Japan',
      laps: 15,
      overtakingDifficulty: 0.60,
      baseLapTime: 89.0,
      tyreWearMultiplier: 1.20,
      drsZones: [{"startFraction":0,"endFraction":0.108}, {"startFraction":0.129,"endFraction":0.347}, {"startFraction":0.654,"endFraction":0.852}]
    },
    interlagos: {
      displayName: 'Autódromo José Carlos Pace',
      country: 'Brazil',
      laps: 18,
      overtakingDifficulty: 0.30,
      baseLapTime: 70.5,
      tyreWearMultiplier: 1.0,
      drsZones: [{"startFraction":0.153,"endFraction":0.321}, {"startFraction":0.365,"endFraction":0.451}, {"startFraction":0.852,"endFraction":1}]
    },
    albert_park: {
      displayName: 'Albert Park Circuit',
      country: 'Australia',
      laps: 16,
      overtakingDifficulty: 0.45,
      baseLapTime: 79.0,
      tyreWearMultiplier: 1.05,
      drsZones: [{"startFraction":0.14,"endFraction":0.372}, {"startFraction":0.397,"endFraction":0.655}, {"startFraction":0.704,"endFraction":0.826}]
    },
    bahrain: {
      displayName: 'Bahrain International Circuit',
      country: 'Bahrain',
      laps: 16,
      overtakingDifficulty: 0.30,
      baseLapTime: 91.0,
      tyreWearMultiplier: 1.25,
      drsZones: [{"startFraction":0.131,"endFraction":0.269}, {"startFraction":0.484,"endFraction":0.628}, {"startFraction":0.873,"endFraction":1}]
    },
    jeddah: {
      displayName: 'Jeddah Corniche Circuit',
      country: 'Saudi Arabia',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 88.0,
      tyreWearMultiplier: 1.10,
      drsZones: [{"startFraction":0.27,"endFraction":0.377}, {"startFraction":0.507,"endFraction":0.675}, {"startFraction":0.893,"endFraction":1}]
    },
    baku: {
      displayName: 'Baku City Circuit',
      country: 'Azerbaijan',
      laps: 15,
      overtakingDifficulty: 0.20, // 2.2km main straight, low difficulty
      baseLapTime: 102.0,
      tyreWearMultiplier: 1.0,
      drsZones: [{"startFraction":0.103,"endFraction":0.23}, {"startFraction":0.537,"endFraction":0.626}, {"startFraction":0.797,"endFraction":1}]
    },
    miami: {
      displayName: 'Miami International Autodrome',
      country: 'United States',
      laps: 16,
      overtakingDifficulty: 0.40,
      baseLapTime: 89.0,
      tyreWearMultiplier: 1.10,
      drsZones: [{"startFraction":0.279,"endFraction":0.44}, {"startFraction":0.487,"endFraction":0.564}, {"startFraction":0.654,"endFraction":0.894}]
    },
    imola: {
      displayName: 'Autodromo Enzo e Dino Ferrari',
      country: 'Italy',
      laps: 17,
      overtakingDifficulty: 0.70, // Narrow traditional circuit
      baseLapTime: 75.0,
      tyreWearMultiplier: 1.05,
      drsZones: [{"startFraction":0,"endFraction":0.144}, {"startFraction":0.695,"endFraction":0.841}, {"startFraction":0.869,"endFraction":1}]
    },
    barcelona: {
      displayName: 'Circuit de Barcelona-Catalunya',
      country: 'Spain',
      laps: 17,
      overtakingDifficulty: 0.55,
      baseLapTime: 76.0,
      tyreWearMultiplier: 1.20,
      drsZones: [{"startFraction":0,"endFraction":0.155}, {"startFraction":0.595,"endFraction":0.722}]
    },
    montreal: {
      displayName: 'Circuit Gilles-Villeneuve',
      country: 'Canada',
      laps: 18,
      overtakingDifficulty: 0.38,
      baseLapTime: 73.0,
      tyreWearMultiplier: 1.0,
      drsZones: [{"startFraction":0.322,"endFraction":0.601}, {"startFraction":0.672,"endFraction":0.952}]
    },
    red_bull_ring: {
      displayName: 'Red Bull Ring',
      country: 'Austria',
      laps: 19,
      overtakingDifficulty: 0.32,
      baseLapTime: 65.0,
      tyreWearMultiplier: 1.0,
      drsZones: [{"startFraction":0.068,"endFraction":0.307}, {"startFraction":0.337,"endFraction":0.498}, {"startFraction":0.721,"endFraction":0.854}]
    },
    hungaroring: {
      displayName: 'Hungaroring',
      country: 'Hungary',
      laps: 18,
      overtakingDifficulty: 0.80, // High downforce, hard to pass
      baseLapTime: 76.0,
      tyreWearMultiplier: 1.10,
      drsZones: [{"startFraction":0.249,"endFraction":0.352}, {"startFraction":0.871,"endFraction":1}]
    },
    zandvoort: {
      displayName: 'Circuit Zandvoort',
      country: 'Netherlands',
      laps: 18,
      overtakingDifficulty: 0.75,
      baseLapTime: 71.0,
      tyreWearMultiplier: 1.20,
      drsZones: [{"startFraction":0,"endFraction":0.097}, {"startFraction":0.616,"endFraction":0.728}, {"startFraction":0.914,"endFraction":1}]
    },
    singapore: {
      displayName: 'Marina Bay Street Circuit',
      country: 'Singapore',
      laps: 16,
      overtakingDifficulty: 0.85, // Street circuit, high difficulty
      baseLapTime: 95.0,
      tyreWearMultiplier: 1.15,
      drsZones: [{"startFraction":0.143,"endFraction":0.249}, {"startFraction":0.295,"endFraction":0.401}, {"startFraction":0.727,"endFraction":0.827}]
    },
    cota: {
      displayName: 'Circuit of the Americas',
      country: 'United States',
      laps: 15,
      overtakingDifficulty: 0.45,
      baseLapTime: 96.0,
      tyreWearMultiplier: 1.20,
      drsZones: [{"startFraction":0.071,"endFraction":0.245}, {"startFraction":0.313,"endFraction":0.428}, {"startFraction":0.452,"endFraction":0.682}]
    },
    mexico_city: {
      displayName: 'Autódromo Hermanos Rodríguez',
      country: 'Mexico',
      laps: 18,
      overtakingDifficulty: 0.40,
      baseLapTime: 78.0,
      tyreWearMultiplier: 0.95,
      drsZones: [{"startFraction":0,"endFraction":0.241}, {"startFraction":0.272,"endFraction":0.483}, {"startFraction":0.538,"endFraction":0.629}]
    },
    las_vegas: {
      displayName: 'Las Vegas Street Circuit',
      country: 'United States',
      laps: 15,
      overtakingDifficulty: 0.25, // Long Strip straight, easy overtakes
      baseLapTime: 93.0,
      tyreWearMultiplier: 0.90,
      drsZones: [{"startFraction":0.072,"endFraction":0.247}, {"startFraction":0.493,"endFraction":0.772}, {"startFraction":0.848,"endFraction":0.954}]
    },
    lusail: {
      displayName: 'Losail International Circuit',
      country: 'Qatar',
      laps: 16,
      overtakingDifficulty: 0.45,
      baseLapTime: 83.0,
      tyreWearMultiplier: 1.30,
      drsZones: [{"startFraction":0,"endFraction":0.108}, {"startFraction":0.846,"endFraction":1}]
    },
    yas_marina: {
      displayName: 'Yas Marina Circuit',
      country: 'United Arab Emirates',
      laps: 16,
      overtakingDifficulty: 0.42,
      baseLapTime: 84.0,
      tyreWearMultiplier: 1.05,
      drsZones: [{"startFraction":0.259,"endFraction":0.463}, {"startFraction":0.493,"endFraction":0.676}]
    },
    shanghai: {
      displayName: 'Shanghai International Circuit',
      country: 'China',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 94.0,
      tyreWearMultiplier: 1.20,
      drsZones: [{"startFraction":0.086,"endFraction":0.223}, {"startFraction":0.395,"endFraction":0.513}, {"startFraction":0.568,"endFraction":0.848}]
    },
    paul_ricard: {
      displayName: 'Circuit Paul Ricard',
      country: 'France',
      laps: 15,
      overtakingDifficulty: 0.40,
      baseLapTime: 92.0,
      tyreWearMultiplier: 1.15,
      drsZones: [{"startFraction":0.344,"endFraction":0.495}, {"startFraction":0.515,"endFraction":0.716}, {"startFraction":0.797,"endFraction":0.899}]
    },
    hockenheimring: {
      displayName: 'Hockenheimring',
      country: 'Germany',
      laps: 17,
      overtakingDifficulty: 0.38,
      baseLapTime: 74.0,
      tyreWearMultiplier: 1.10,
      drsZones: [{"startFraction":0.061,"endFraction":0.181}, {"startFraction":0.3,"endFraction":0.456}, {"startFraction":0.655,"endFraction":0.745}]
    },
    nurburgring: {
      displayName: 'Nürburgring GP',
      country: 'Germany',
      laps: 16,
      overtakingDifficulty: 0.50,
      baseLapTime: 88.0,
      tyreWearMultiplier: 1.10,
      drsZones: [{"startFraction":0,"endFraction":0.12}, {"startFraction":0.55,"endFraction":0.661}]
    },
    portimao: {
      displayName: 'Autódromo Internacional do Algarve',
      country: 'Portugal',
      laps: 16,
      overtakingDifficulty: 0.48,
      baseLapTime: 78.0,
      tyreWearMultiplier: 1.15,
      drsZones: [{"startFraction":0,"endFraction":0.087}, {"startFraction":0.184,"endFraction":0.311}, {"startFraction":0.851,"endFraction":1}]
    },
    mugello: {
      displayName: 'Autodromo Internazionale del Mugello',
      country: 'Italy',
      laps: 16,
      overtakingDifficulty: 0.60,
      baseLapTime: 77.0,
      tyreWearMultiplier: 1.30,
      drsZones: [{"startFraction":0,"endFraction":0.132}, {"startFraction":0.881,"endFraction":1}]
    },
    sepang: {
      displayName: 'Sepang International Circuit',
      country: 'Malaysia',
      laps: 15,
      overtakingDifficulty: 0.35,
      baseLapTime: 93.0,
      tyreWearMultiplier: 1.25,
      drsZones: [{"startFraction":0.142,"endFraction":0.231}, {"startFraction":0.432,"endFraction":0.519}, {"startFraction":0.712,"endFraction":0.873}]
    },
    istanbul: {
      displayName: 'Intercity Istanbul Park',
      country: 'Turkey',
      laps: 16,
      overtakingDifficulty: 0.40,
      baseLapTime: 86.0,
      tyreWearMultiplier: 1.25,
      drsZones: [{"startFraction":0.258,"endFraction":0.37}, {"startFraction":0.523,"endFraction":0.629}, {"startFraction":0.743,"endFraction":0.871}]
    },
    sochi: {
      displayName: 'Sochi Autodrom',
      country: 'Russia',
      laps: 16,
      overtakingDifficulty: 0.55,
      baseLapTime: 95.0,
      tyreWearMultiplier: 0.90,
      drsZones: [{"startFraction":0.034,"endFraction":0.147}, {"startFraction":0.507,"endFraction":0.582}, {"startFraction":0.61,"endFraction":0.782}]
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
  weather: 'dry', // 'dry' or 'wet'
  trackKey: 'monza',

  safetyCarActive: false,
  safetyCarLapsRemaining: 0,
  safetyCarRestartLap: -1, // Tracks the lap when the SC restarted to freeze overtakes for 1 full lap

  // Last overtake pair to prevent logging the same pair twice in a row
  lastOvertakePairKey: null,
  // Set to track overtakes per car pair per lap (at most one per pair per lap)
  pairOvertakesThisLap: new Set(),

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

  // Hysteresis-filtered race ranking:
  // Array of car objects representing the stable race order
  stableRankedCars: [],
  // Map of consecutive frames challenger has been ahead: key "behindId-aheadId" -> frameCount
  rankLeadFrames: new Map(),

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
    this.pairOvertakesThisLap = new Set();
    this.stableRankedCars = [];
    this.rankLeadFrames = new Map();
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
    this.weather = document.getElementById('sim-weather-select').value || 'dry';

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

      // Fixed lane offset: odd on right (+3.5px), even on left (-3.5px)
      car.laneOffset = isOddPos ? 3.5 : -3.5;
      car.currentLateralOffset = car.laneOffset;
      car.targetLateralOffset = car.laneOffset;
      car.lateralOffset = car.laneOffset;

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
    this.pairOvertakesThisLap = new Set();
    this.stableRankedCars = [];
    this.rankLeadFrames = new Map();
    this.fastestLap = { time: Infinity, driverName: null, carId: null };
    this.commentaryLogs = [];
    this.commentaryQueue = [];
    this.simulatedTimeSeconds = 0;
    this.lastCommentarySimTime = -999;

    // Show Start Qualifying button on reset
    const qualyBtn = document.getElementById('btn-sim-qualifying');
    if (qualyBtn) qualyBtn.style.display = 'inline-block';

    const trackMeta = SIM_CONFIG.TRACKS[this.trackKey];
    this.totalLaps = trackMeta && trackMeta.laps ? trackMeta.laps : 15;
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

      // Smooth lane offset transition towards targetLateralOffset over ~1.0 second
      if (car.currentLateralOffset === undefined) {
        car.currentLateralOffset = car.laneOffset || 0;
        car.targetLateralOffset = car.laneOffset || 0;
      }
      if (car.currentLateralOffset !== car.targetLateralOffset) {
        // Shift speed ~7.0 px/sec => 7.0px * 1.0s = full 7px width swap between +3.5 and -3.5 in ~1s
        const maxShift = 7.0 * dtSeconds;
        const diff = car.targetLateralOffset - car.currentLateralOffset;
        if (Math.abs(diff) <= maxShift) {
          car.currentLateralOffset = car.targetLateralOffset;
        } else {
          car.currentLateralOffset += Math.sign(diff) * maxShift;
        }
      }
      car.lateralOffset = car.currentLateralOffset;

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

      // DRS Zone Speed Boost: No DRS on lap 1 or 1 lap after safety car restart
      const drsAllowed = this.currentLap > 1 && !(this.safetyCarRestartLap > 0 && (this.currentLap - this.safetyCarRestartLap) < 1) && !this.safetyCarActive;
      if (drsAllowed && this.isCarInDrsZone(car, trackObj, trackInfo)) {
        speedFactor *= DRS_SPEED_BOOST;
      }

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
   * Helper: Check if a car is currently inside a DRS zone on the track
   */
  isCarInDrsZone(car, trackObj, trackInfo) {
    if (!trackInfo || !trackInfo.drsZones || trackInfo.drsZones.length === 0) return false;
    const pathLength = trackObj ? trackObj.length : 1000;
    const distAlongPath = car.distance !== undefined ? car.distance : (((car.progress % 1) + 1) % 1) * pathLength;
    const fraction = (distAlongPath % pathLength) / pathLength;

    return trackInfo.drsZones.some(zone => {
      if (zone.startFraction <= zone.endFraction) {
        return fraction >= zone.startFraction && fraction <= zone.endFraction;
      } else {
        // Wraps over track start/end
        return fraction >= zone.startFraction || fraction <= zone.endFraction;
      }
    });
  },

  /**
   * Overtaking Logic:
   * Trailing car within 1.0s gap of car ahead and has pace advantage.
   * - Inside DRS zone: normal pass probability plus small speed boost.
   * - Outside DRS zone: allowed at OFF_DRS_OVERTAKE_FACTOR = 0.2 of DRS probability.
   * - Per-track overtakingDifficulty scales everything.
   * - At most one overtake per car pair per lap.
   * - No overtakes or DRS on lap 1, or for 1 lap after safety car restart.
   * - Commentary is low priority through rate limiter, never same pair twice in a row.
   */
  processOvertaking() {
    if (this.safetyCarActive) return;

    // Requirement 4: No overtakes or DRS on lap 1
    if (this.currentLap <= 1) return;

    // Requirement 4: No overtakes or DRS for 1 lap after a safety car restart
    if (this.safetyCarRestartLap > 0 && (this.currentLap - this.safetyCarRestartLap) < 1) {
      return;
    }

    const trackInfo = SIM_CONFIG.TRACKS[this.trackKey] || SIM_CONFIG.TRACKS.monza;
    const trackObj = this.getTrackPathObj(this.trackKey);
    const pathLength = trackObj ? trackObj.length : 1000;
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

      // Trailing car must be within 1.0s of the car ahead
      if (gapSeconds <= DRS_OVERTAKE_GAP_THRESHOLD_SECONDS && gapSeconds > 0) {
        const aheadPace = this.computeCarLapPace(ahead);
        const behindPace = this.computeCarLapPace(behind);
        const paceAdvantage = aheadPace - behindPace; // Positive if behind is faster

        // Trailing car must have a pace advantage
        if (paceAdvantage > 0.05) {
          // Check pair key and lap limit: at most one overtake per car pair per lap
          const pairKey = [ahead.id, behind.id].sort().join('-');
          const lapKey = `${pairKey}-lap${behind.lap}`;
          if (this.pairOvertakesThisLap.has(lapKey)) {
            continue; // Already overtook each other on this lap
          }

          // Check if trailing car is inside a DRS zone
          const inDrs = this.isCarInDrsZone(behind, trackObj, trackInfo);

          // Base overtake probability inside DRS zone
          // Scaled by track overtakingDifficulty
          const difficultyFactor = 1.0 - trackInfo.overtakingDifficulty;
          const baseDrsProb = (paceAdvantage * 0.09 + 0.03) * difficultyFactor;

          // Inside DRS: normal pass probability. Outside DRS: OFF_DRS_OVERTAKE_FACTOR = 0.2
          const overtakeProb = inDrs ? baseDrsProb : (baseDrsProb * OFF_DRS_OVERTAKE_FACTOR);

          if (Math.random() < overtakeProb) {
            // Record that this pair completed an overtake on this lap
            this.pairOvertakesThisLap.add(lapKey);

            // Overtake completed: boost behind car slightly ahead without decreasing ahead car's distance
            // e.g. behind advances past ahead
            const overtakeLead = 0.001 * pathLength;
            behind.totalDistance = ahead.totalDistance + overtakeLead;
            behind.totalDistanceLaps = behind.totalDistance / pathLength;
            const startOffset = trackObj.startOffset || 0;
            behind.distance = (((startOffset + behind.totalDistance) % pathLength) + pathLength) % pathLength;
            behind.progress = behind.distance / pathLength;

            // Overtake lane change: swap target lateral lane offsets between cars
            // so they smoothly transition lanes over ~1 second
            const tempTargetLane = ahead.targetLateralOffset;
            ahead.targetLateralOffset = behind.targetLateralOffset;
            behind.targetLateralOffset = tempTargetLane;

            // Overtake commentary is low priority, through existing rate limiter,
            // and never the same pair twice in a row
            if (this.lastOvertakePairKey !== pairKey) {
              this.lastOvertakePairKey = pairKey;
              const zoneTag = inDrs ? ' [DRS]' : '';
              this.logCommentary(`⚔️ OVERTAKE${zoneTag}: ${behind.driverName} (${behind.driverCode}) dives down the inside to pass ${ahead.driverName}!`, 'overtake');
            }
            break;
          } else {
            // Stuck in dirty air behind slower car: don't pull distance backwards!
            // If behind got too close or ahead without overtaking, match ahead distance minus min gap without decreasing
            const minGap = 0.001 * pathLength;
            if (behind.totalDistance > ahead.totalDistance - minGap) {
              // Cap at current distance or ahead minus gap, whichever doesn't decrease behind.totalDistance
              // Simply hold behind pace/progress from exceeding ahead
              behind.totalDistance = Math.min(behind.totalDistance, ahead.totalDistance - 0.0001);
              behind.totalDistanceLaps = behind.totalDistance / pathLength;
              const startOffset = trackObj.startOffset || 0;
              behind.distance = (((startOffset + behind.totalDistance) % pathLength) + pathLength) % pathLength;
              behind.progress = behind.distance / pathLength;
            }
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

    // 1b. Render Neon Green DRS Zones (#00FF66) with "DRS" label at start
    const currentTrackConfig = SIM_CONFIG.TRACKS[this.trackKey] || {};
    if (currentTrackConfig.drsZones && currentTrackConfig.drsZones.length > 0) {
      const totalLen = trackObj.length;
      ctx.save();
      ctx.strokeStyle = '#00FF66';
      ctx.lineWidth = lwLine;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#00FF66';
      ctx.shadowBlur = 6 / Math.sqrt(trackScale);

      currentTrackConfig.drsZones.forEach((zone) => {
        const sDist = zone.startFraction * totalLen;
        const eDist = zone.endFraction * totalLen;
        const segLen = eDist >= sDist ? (eDist - sDist) : (totalLen - sDist + eDist);
        const step = 4; // Sample every 4px along curve
        const numSteps = Math.max(2, Math.ceil(segLen / step));

        ctx.beginPath();
        for (let s = 0; s <= numSteps; s++) {
          const d = (sDist + (s / numSteps) * segLen) % totalLen;
          const pt = trackObj.el.getPointAtLength(d);
          if (s === 0) {
            ctx.moveTo(pt.x, pt.y);
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
        ctx.stroke();

        // Draw small "DRS" label at the start of the zone
        const startPt = trackObj.el.getPointAtLength(sDist);
        const tangentPt = trackObj.el.getPointAtLength((sDist + 4) % totalLen);
        const heading = Math.atan2(tangentPt.y - startPt.y, tangentPt.x - startPt.x);
        // Normal vector perpendicular to track heading
        const nx = -Math.sin(heading);
        const ny = Math.cos(heading);
        const offsetDist = (lwTrack / 2 + 8) / Math.sqrt(trackScale);
        const labelX = startPt.x + nx * offsetDist;
        const labelY = startPt.y + ny * offsetDist;

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00FF66';
        ctx.font = `900 ${Math.max(7, Math.round(9 / Math.sqrt(trackScale)))}px "Chakra Petch", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DRS', labelX, labelY);
        ctx.restore();
      });
      ctx.restore();
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

      // Single source of truth: car.distance (computed directly from car.totalDistance along path)
      const dist = car.distance;
      let p = trackObj.el.getPointAtLength(dist);
      const delta = 2;
      const pAhead = trackObj.el.getPointAtLength((dist + delta) % trackObj.length);
      const angle = Math.atan2(pAhead.y - p.y, pAhead.x - p.x);

      // Requirement 2: Lane offset must NOT depend on rank or which car is ahead.
      // Fixed lane assigned at the grid kept throughout race, only changing smoothly on overtakes.
      let latOffset = car.lateralOffset !== undefined ? car.lateralOffset : (car.laneOffset || 0);

      if (latOffset !== 0) {
        // Normal vector perpendicular to path tangent
        const nx = -Math.sin(angle);
        const ny = Math.cos(angle);
        p = {
          x: p.x + nx * latOffset,
          y: p.y + ny * latOffset
        };
      }

      // Store dot coordinates for label placement pass
      car._renderPoint = p;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      // Make car dots about 30% smaller, scaled with the track (0.70x factor)
      ctx.scale(visualScale * 0.70, visualScale * 0.70);

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
    });

    // 3b. Render Labels on Top of All Dots with Collision Avoidance
    // Driver tags shown next to every car in race order
    const rankedActive = (this.stableRankedCars && this.stableRankedCars.length > 0 ? this.stableRankedCars : this.cars).filter(c => !c.isDNF && c._renderPoint);
    const placedBoxes = [];

    // Scaled candidate offsets (in world/track coordinates)
    // When track is scaled by trackScale, visualScale = baseFieldScale / sqrt(trackScale).
    // In track coordinates, 1 screen pixel = 1 / trackScale.
    // A readable label box is ~22px wide and ~11px high on screen.
    const screenPx = 1 / trackScale;
    const baseR = 15 * screenPx;
    const diagR = 11 * screenPx;

    // Screen-space label dimensions
    const fontPt = numTotalCars > 12 ? 8 : (numTotalCars > 8 ? 9 : 10);
    const labelFontSize = Math.max(6, Math.round(fontPt * screenPx));
    ctx.font = `900 ${labelFontSize}px "Chakra Petch", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Width and height of label bounding box on screen
    const boxScreenW = fontPt * 3.2; // ~32px screen
    const boxScreenH = fontPt * 1.6; // ~16px screen
    const boxW = boxScreenW * screenPx;
    const boxH = boxScreenH * screenPx;

    // Radius needed so label clears the dot and doesn't overlap adjacent labels:
    // Screen radius ~20px for base, ~40px for 2x radius
    const rBase = 20 * screenPx;
    const rDiag = 16 * screenPx;

    // Ordered offsets according to Part 3 specifications:
    // default: above-right, up, down, right, left, up-right, down-left, then the same list at 2x radius
    const baseOffsets = [
      { x: rDiag, y: -rDiag }, // default: above-right
      { x: 0, y: -rBase },     // up
      { x: 0, y: rBase },      // down
      { x: rBase, y: 0 },      // right
      { x: -rBase, y: 0 },     // left
      { x: rDiag, y: -rDiag }, // up-right
      { x: -rDiag, y: rDiag }  // down-left
    ];

    const candidateOffsets = [
      ...baseOffsets,
      ...baseOffsets.map(o => ({ x: o.x * 2, y: o.y * 2 }))
    ];

    // Track bounds for boundary clamping
    const bMinX = bounds.minX;
    const bMaxX = bounds.maxX;
    const bMinY = bounds.minY;
    const bMaxY = bounds.maxY;

    rankedActive.forEach(car => {
      const dot = car._renderPoint;
      if (!dot) return;

      if (!car.chosenOffset) {
        car.chosenOffset = { x: candidateOffsets[0].x, y: candidateOffsets[0].y };
        car.currentLabelOffset = { x: candidateOffsets[0].x, y: candidateOffsets[0].y };
      }

      const overlapsAny = (box) => {
        return placedBoxes.some(b => {
          return !(box.x + box.w < b.x || box.x > b.x + b.w || box.y + box.h < b.y || box.y > b.y + b.h);
        });
      };

      // Test whether previously chosen offset still fits without overlap
      let testBox = {
        x: dot.x + car.chosenOffset.x - boxW / 2,
        y: dot.y + car.chosenOffset.y - boxH / 2,
        w: boxW,
        h: boxH
      };

      let selectedOffset = car.chosenOffset;
      if (overlapsAny(testBox)) {
        let foundFit = false;
        for (const cand of candidateOffsets) {
          const candBox = {
            x: dot.x + cand.x - boxW / 2,
            y: dot.y + cand.y - boxH / 2,
            w: boxW,
            h: boxH
          };
          if (!overlapsAny(candBox)) {
            selectedOffset = { x: cand.x, y: cand.y };
            foundFit = true;
            break;
          }
        }
        if (!foundFit) {
          selectedOffset = { x: candidateOffsets[0].x, y: candidateOffsets[0].y };
        }
      }

      car.chosenOffset = selectedOffset;

      // Smooth offset transition over a few frames
      if (!car.currentLabelOffset) {
        car.currentLabelOffset = { ...selectedOffset };
      } else {
        car.currentLabelOffset.x += (selectedOffset.x - car.currentLabelOffset.x) * 0.35;
        car.currentLabelOffset.y += (selectedOffset.y - car.currentLabelOffset.y) * 0.35;
      }

      let labelX = dot.x + car.currentLabelOffset.x;
      let labelY = dot.y + car.currentLabelOffset.y;

      // Boundary clamping inside canvas / track bounds
      labelX = Math.max(bMinX + boxW / 2, Math.min(bMaxX - boxW / 2, labelX));
      labelY = Math.max(bMinY + boxH / 2, Math.min(bMaxY - boxH / 2, labelY));

      placedBoxes.push({
        x: labelX - boxW / 2,
        y: labelY - boxH / 2,
        w: boxW,
        h: boxH
      });

      // Draw thin leader line (1px, team color, 60% opacity) when label is > ~12px away
      const distFromDot = Math.hypot(labelX - dot.x, labelY - dot.y);
      const thresholdDist = 12 * screenPx;
      if (distFromDot > thresholdDist) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = car.color;
        ctx.globalAlpha = 0.60;
        ctx.lineWidth = 1.0 * screenPx;
        ctx.moveTo(dot.x, dot.y);
        ctx.lineTo(labelX, labelY);
        ctx.stroke();
        ctx.restore();
      }

      // Draw driver 3-letter code on top of all dots
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 3;
      ctx.fillText(car.driverCode, labelX, labelY);
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    ctx.restore(); // Restore track-scale transformation matrix

    // 4. Update UI Telemetry Banner
    document.getElementById('telemetry-current-lap').textContent = Math.min(this.currentLap, this.totalLaps);
    document.getElementById('telemetry-total-laps').textContent = this.totalLaps;

    // 5. Update Live Broadcast Leaderboard
    this.updateLeaderboardUI();
  },

  /**
   * Computes the race order from distance with 5-consecutive-frame hysteresis.
   * Two cars swap in the order only if the one behind has been ahead in distance
   * for at least 5 consecutive frames.
   */
  updateRankingsWithHysteresis() {
    // If not initialized, initialize from raw distance order
    if (!this.stableRankedCars || this.stableRankedCars.length !== this.cars.length) {
      this.stableRankedCars = [...this.cars].sort((a, b) => {
        if (a.isDNF && !b.isDNF) return 1;
        if (!a.isDNF && b.isDNF) return -1;
        return (b.totalDistance || 0) - (a.totalDistance || 0);
      });
      this.rankLeadFrames = new Map();
      return this.stableRankedCars;
    }

    // Active cars vs DNF cars
    // Active cars keep their stable relative order unless a swap condition is met
    const active = this.stableRankedCars.filter(c => !c.isDNF);
    const dnf = this.stableRankedCars.filter(c => c.isDNF).sort((a, b) => (b.lapsCompleted || 0) - (a.lapsCompleted || 0));

    // Check adjacent pairs in the active order
    // In bubble-style pass from top to bottom
    for (let i = 0; i < active.length - 1; i++) {
      const ahead = active[i];
      const behind = active[i + 1];

      // Does the car behind have greater totalDistance than the car ahead?
      if ((behind.totalDistance || 0) > (ahead.totalDistance || 0)) {
        const key = `${behind.id}-${ahead.id}`;
        const frames = (this.rankLeadFrames.get(key) || 0) + 1;
        this.rankLeadFrames.set(key, frames);

        // Hysteresis threshold: swap only if ahead for at least 5 consecutive frames
        if (frames >= 5) {
          active[i] = behind;
          active[i + 1] = ahead;
          this.rankLeadFrames.delete(key);
        }
      } else {
        const key = `${behind.id}-${ahead.id}`;
        this.rankLeadFrames.delete(key);
      }
    }

    this.stableRankedCars = [...active, ...dnf];
    return this.stableRankedCars;
  },

  updateLeaderboardUI() {
    const tbody = document.getElementById('sim-leaderboard-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sortedCars = this.updateRankingsWithHysteresis();
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
    this.pairOvertakesThisLap = new Set();
    this.stableRankedCars = [];
    this.rankLeadFrames = new Map();
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

    // Rebuild fresh car state (positions, tyres, fuel, DNFs) while preserving players & rosters
    this.buildDraftedCarsList();
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
