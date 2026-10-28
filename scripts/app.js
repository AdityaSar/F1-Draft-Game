/**
 * F1 Draft - Core App Manager & State Store
 */

const F1App = {
  // Global Application State
  state: {
    drivers: [],              // Remaining drivers on the wheel
    allDrivers: [],           // Master list of driver names
    players: [],              // Player list [{ id, name, budget, remainingBudget, color, roster: [] }]
    globalBudget: 100,        // Default fixed budget ($M)
    maxDriversPerPlayer: 2,   // Max roster size per player
    auctionHistory: []        // History stack for undo functionality
  },

  // Color Palette for Players
  playerColors: [
    '#E10600', // Official F1 Red
    '#00D2BE', // Mercedes Cyan/Teal
    '#FF8000', // McLaren Papaya
    '#3671C6', // Red Bull Racing Blue
    '#006F62', // Aston Martin Green
    '#C92D4B', // Alfa Romeo Burgundy
    '#52E252', // Sauber Neon Green
    '#B6BABD'  // Haas Silver
  ],

  // Navigation Controller
  navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }
  },

  // Initialize Setup Form Dynamic Inputs
  initSetupControls() {
    const playerCountInput = document.getElementById('input-player-count');
    const rosterTextarea = document.getElementById('setup-roster-input');
    const rosterCountEl = document.getElementById('roster-count');

    // Ensure textarea loads completely blank as requested
    rosterTextarea.value = '';

    const updateRosterCount = () => {
      const rawText = rosterTextarea.value;
      const drivers = rawText
        .split('\n')
        .map(d => d.trim())
        .filter(d => d.length > 0);

      // Filter unique
      const uniqueDrivers = [...new Set(drivers)];
      rosterCountEl.textContent = uniqueDrivers.length;
    };

    rosterTextarea.addEventListener('input', updateRosterCount);
    updateRosterCount();

    const generatePlayerInputs = () => {
      const count = parseInt(playerCountInput.value, 10) || 2;
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
    };

    playerCountInput.addEventListener('change', generatePlayerInputs);
    playerCountInput.addEventListener('input', generatePlayerInputs);
    generatePlayerInputs();
  },

  // Validate Screen 1 Inputs and Launch Auction
  validateAndStartAuction() {
    const errorBanner = document.getElementById('setup-error');
    errorBanner.classList.add('hidden');
    errorBanner.textContent = '';

    // 1. Validate Driver Roster
    const rawRoster = document.getElementById('setup-roster-input').value;
    const drivers = rawRoster
      .split('\n')
      .map(d => d.trim())
      .filter(d => d.length > 0);

    // Deduplicate drivers
    const uniqueDrivers = [...new Set(drivers)];

    if (uniqueDrivers.length < 2) {
      errorBanner.textContent = 'ERROR: Please enter at least 2 unique driver names (separated strictly by line breaks).';
      errorBanner.classList.remove('hidden');
      return;
    }

    // 2. Validate Player Settings
    const playerCount = parseInt(document.getElementById('input-player-count').value, 10);
    if (isNaN(playerCount) || playerCount < 2 || playerCount > 8) {
      errorBanner.textContent = 'ERROR: Number of players must be between 2 and 8.';
      errorBanner.classList.remove('hidden');
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

    // 3. Validate Global Budget & Max Drivers
    const budget = parseFloat(document.getElementById('input-budget').value);
    if (isNaN(budget) || budget <= 0) {
      errorBanner.textContent = 'ERROR: Please enter a valid positive Global Fixed Budget ($M).';
      errorBanner.classList.remove('hidden');
      return;
    }

    const maxDrivers = parseInt(document.getElementById('input-max-drivers').value, 10);
    const minRequiredDrivers = playerCount * maxDrivers;

    if (uniqueDrivers.length < minRequiredDrivers) {
      errorBanner.textContent = `WARNING: You entered ${uniqueDrivers.length} drivers, but ${playerCount} players with max ${maxDrivers} drivers require at least ${minRequiredDrivers} drivers. Please add more driver names.`;
      errorBanner.classList.remove('hidden');
      return;
    }

    // Initialize Game State
    this.state.allDrivers = [...uniqueDrivers];
    this.state.drivers = [...uniqueDrivers];
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

    // Restart App Button
    document.getElementById('btn-restart-app').addEventListener('click', () => {
      document.getElementById('results-modal').classList.add('hidden');
      this.navigateTo('screen-setup');
    });

    // Initialize Setup Controls
    this.initSetupControls();
  }
};

// Auto-run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  F1App.init();
});
