/**
 * F1 Draft - Core App Manager & State Store
 */

const F1App = {
  // Global Application State
  state: {
    drivers: [],              // Remaining driver names on the wheel
    allDrivers: [],           // Master list of driver names
    driverMap: {},            // Map of driverName -> { name, skill }
    players: [],              // Player list [{ id, name, budget, remainingBudget, color, roster: [] }]
    globalBudget: 100,        // Default fixed budget ($M)
    maxDriversPerPlayer: 2,   // Max roster size per player
    auctionHistory: []        // History stack for undo functionality
  },

  // Color Palette for Players (supports up to 10 players)
  playerColors: [
    '#E10600', // Official F1 Red
    '#00D2BE', // Mercedes Cyan/Teal
    '#FF8000', // McLaren Papaya
    '#3671C6', // Red Bull Racing Blue
    '#006F62', // Aston Martin Green
    '#C92D4B', // Alfa Romeo Burgundy
    '#52E252', // Sauber Neon Green
    '#B6BABD', // Haas Silver
    '#FFD700', // Ferrari Gold
    '#9C27B0'  // Alpine Purple
  ],

  // Parse driver roster line formatted as "Driver Name - Skill"
  parseDriverLine(line) {
    if (!line || !line.trim()) return null;
    const parts = line.split('-');
    const name = parts[0].trim();
    if (!name) return null;

    let skill = 82; // Default fallback baseline
    if (parts.length > 1) {
      const rawVal = parseFloat(parts[1].trim());
      if (!isNaN(rawVal)) {
        if (rawVal <= 10 && rawVal >= 1) {
          // Normalize 1-10 scale up cleanly to 70-99 rating scale
          skill = Math.round(70 + ((rawVal - 1) / 9) * 29);
        } else if (rawVal > 10 && rawVal <= 100) {
          // Standard scale 11-100 used directly
          skill = Math.round(rawVal);
        }
      }
    }
    return { name, skill };
  },

  // Navigation Controller
  navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }
  },

  // Initialize Setup Form Dynamic Inputs
  initSetupControls() {
    const playerCountInput = document.getElementById('input-player-count');
    const maxDriversInput = document.getElementById('input-max-drivers');
    const rosterTextarea = document.getElementById('setup-roster-input');
    const rosterCountEl = document.getElementById('roster-count');
    const errorBanner = document.getElementById('setup-error');
    const startAuctionBtn = document.getElementById('btn-start-auction');

    // Ensure textarea loads completely blank as requested
    rosterTextarea.value = '';

    const validateSetupRealTime = () => {
      const rawText = rosterTextarea.value;
      const lines = rawText.split('\n');
      const parsedDrivers = lines.map(line => this.parseDriverLine(line)).filter(d => d !== null);

      // Unique driver names
      const uniqueNames = [...new Set(parsedDrivers.map(d => d.name))];
      rosterCountEl.textContent = uniqueNames.length;

      const playerCount = parseInt(playerCountInput.value, 10) || 2;
      const maxDrivers = parseInt(maxDriversInput.value, 10) || 2;
      const requiredDrivers = playerCount * maxDrivers;

      if (uniqueNames.length < requiredDrivers) {
        errorBanner.textContent = `⚠️ WARNING: You need at least ${requiredDrivers} unique drivers for ${playerCount} players with ${maxDrivers} drivers each! (Currently entered: ${uniqueNames.length})`;
        errorBanner.classList.remove('hidden');
        startAuctionBtn.disabled = true;
      } else {
        errorBanner.classList.add('hidden');
        errorBanner.textContent = '';
        startAuctionBtn.disabled = false;
      }
    };

    const generatePlayerInputs = () => {
      const count = Math.min(10, Math.max(2, parseInt(playerCountInput.value, 10) || 2));
      const container = document.getElementById('player-names-container');
      container.innerHTML = '';

      for (let i = 1; i <= count; i++) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
          <label for="player-name-${i}">Player ${i} Name</label>
          <input type="text" id="player-name-${i}" class="form-input player-name-input" value="Player ${i}" placeholder="Enter Player ${i} Name">
        `;
        container.appendChild(div);
      }

      validateSetupRealTime();
    };

    rosterTextarea.addEventListener('input', validateSetupRealTime);
    playerCountInput.addEventListener('input', generatePlayerInputs);
    playerCountInput.addEventListener('change', generatePlayerInputs);
    maxDriversInput.addEventListener('input', validateSetupRealTime);
    maxDriversInput.addEventListener('change', validateSetupRealTime);

    generatePlayerInputs();
  },

  // Validate Screen 1 Inputs and Launch Auction
  validateAndStartAuction() {
    const errorBanner = document.getElementById('setup-error');
    const startAuctionBtn = document.getElementById('btn-start-auction');

    const rawRoster = document.getElementById('setup-roster-input').value;
    const lines = rawRoster.split('\n');
    const parsedDrivers = lines.map(line => this.parseDriverLine(line)).filter(d => d !== null);

    // Build unique driver list & driverMap
    const driverMap = {};
    const uniqueNames = [];

    parsedDrivers.forEach(d => {
      if (!driverMap[d.name]) {
        driverMap[d.name] = d;
        uniqueNames.push(d.name);
      }
    });

    const playerCount = Math.min(10, Math.max(2, parseInt(document.getElementById('input-player-count').value, 10) || 2));
    const maxDrivers = Math.min(10, Math.max(1, parseInt(document.getElementById('input-max-drivers').value, 10) || 2));
    const requiredDrivers = playerCount * maxDrivers;

    if (uniqueNames.length < requiredDrivers) {
      errorBanner.textContent = `⚠️ WARNING: You need at least ${requiredDrivers} unique drivers for ${playerCount} players with ${maxDrivers} drivers each!`;
      errorBanner.classList.remove('hidden');
      startAuctionBtn.disabled = true;
      return;
    }

    const playerInputs = document.querySelectorAll('.player-name-input');
    const playerNames = [];
    for (let i = 0; i < playerInputs.length; i++) {
      const name = playerInputs[i].value.trim();
      if (!name) {
        errorBanner.textContent = `ERROR: Please enter a valid name for Player ${i + 1}.`;
        errorBanner.classList.remove('hidden');
        return;
      }
      playerNames.push(name);
    }

    const budget = parseFloat(document.getElementById('input-budget').value) || 100;

    // Initialize Game State
    this.state.driverMap = driverMap;
    this.state.allDrivers = [...uniqueNames];
    this.state.drivers = [...uniqueNames];
    this.state.globalBudget = budget;
    this.state.maxDriversPerPlayer = maxDrivers;
    this.state.auctionHistory = [];

    this.state.players = playerNames.map((name, index) => ({
      id: `player_${index + 1}`,
      name: name,
      budget: budget,
      remainingBudget: budget,
      color: this.playerColors[index % this.playerColors.length],
      roster: []
    }));

    // Launch Auction Room Module
    AuctionManager.initAuctionRoom();
    this.navigateTo('screen-auction');
  },

  // Bind Global Screen 0 & Setup Event Listeners
  init() {
    // Start Draft Button on Landing
    document.getElementById('btn-start-draft').addEventListener('click', () => {
      this.navigateTo('screen-setup');
    });

    // Start Auction Button on Setup
    document.getElementById('btn-start-auction').addEventListener('click', () => {
      this.validateAndStartAuction();
    });

    // Restart App Button - Takes user back to Landing Page (Screen 0)
    document.getElementById('btn-restart-app').addEventListener('click', () => {
      document.getElementById('results-modal').classList.add('hidden');
      this.navigateTo('screen-landing');
    });

    // Initialize Setup Controls
    this.initSetupControls();
  }
};

// Auto-run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  F1App.init();
});
