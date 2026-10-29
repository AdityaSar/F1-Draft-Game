/**
 * F1 Draft - Auction Room & Bidding Controller
 */

const AuctionManager = {
  currentDrawnDriver: null,

  initAuctionRoom() {
    // 1. Initialize Canvas Wheel Engine
    if (!globalWheelEngine) {
      globalWheelEngine = new WheelEngine('wheel-canvas');
    }
    globalWheelEngine.setDrivers(F1App.state.drivers);

    // 2. Render Initial Player Dashboard Table
    this.renderPlayerTable();
    this.updateControlsState();

    // 3. Attach Event Listeners
    const btnSpin = document.getElementById('btn-spin');
    btnSpin.replaceWith(btnSpin.cloneNode(true));
    document.getElementById('btn-spin').addEventListener('click', () => {
      this.spinWheel();
    });

    const btnUndo = document.getElementById('btn-undo');
    btnUndo.replaceWith(btnUndo.cloneNode(true));
    document.getElementById('btn-undo').addEventListener('click', () => {
      this.undoLastSale();
    });

    const btnProceed = document.getElementById('btn-proceed-race');
    btnProceed.replaceWith(btnProceed.cloneNode(true));
    document.getElementById('btn-proceed-race').addEventListener('click', () => {
      F1Simulator.initSimulator();
      F1App.navigateTo('screen-sim');
    });

    const btnConfirm = document.getElementById('btn-confirm-bid');
    btnConfirm.replaceWith(btnConfirm.cloneNode(true));
    document.getElementById('btn-confirm-bid').addEventListener('click', () => {
      this.confirmAssignment();
    });

    const btnPass = document.getElementById('btn-pass-bid');
    btnPass.replaceWith(btnPass.cloneNode(true));
    document.getElementById('btn-pass-bid').addEventListener('click', () => {
      this.passUnsold();
    });

    // Real-time Bid Validation Listener
    const selectPlayer = document.getElementById('select-winning-player');
    const inputBid = document.getElementById('input-bid-amount');

    selectPlayer.addEventListener('change', () => this.validateModalInput());
    inputBid.addEventListener('input', () => this.validateModalInput());
  },

  spinWheel() {
    if (F1App.state.drivers.length === 0) return;

    const btnSpin = document.getElementById('btn-spin');
    btnSpin.disabled = true;

    globalWheelEngine.spin((selectedDriver) => {
      btnSpin.disabled = false;
      this.currentDrawnDriver = selectedDriver;
      this.openAuctionModal(selectedDriver);
    });
  },

  openAuctionModal(driverName) {
    document.getElementById('modal-driver-name').textContent = driverName.toUpperCase();

    // Populate Player Dropdown
    const select = document.getElementById('select-winning-player');
    select.innerHTML = '';

    F1App.state.players.forEach(p => {
      const option = document.createElement('option');
      option.value = p.id;
      const slotsLeft = F1App.state.maxDriversPerPlayer - p.roster.length;
      option.textContent = `${p.name} (Budget: $${p.remainingBudget}M, Slots: ${p.roster.length}/${F1App.state.maxDriversPerPlayer})`;

      // Disable player if roster is full
      if (slotsLeft <= 0) {
        option.disabled = true;
        option.textContent += ' [FULL]';
      }
      select.appendChild(option);
    });

    // Select first valid non-disabled player option
    const firstValidOption = Array.from(select.options).find(opt => !opt.disabled);
    if (firstValidOption) {
      select.value = firstValidOption.value;
    }

    // Default bid input
    const inputBid = document.getElementById('input-bid-amount');
    inputBid.value = 10;

    // Hide warning banner initially
    document.getElementById('modal-warning-banner').classList.add('hidden');

    this.validateModalInput();
    document.getElementById('auction-modal').classList.remove('hidden');
  },

  closeAuctionModal() {
    document.getElementById('auction-modal').classList.add('hidden');
    this.currentDrawnDriver = null;
  },

  validateModalInput() {
    const warningBanner = document.getElementById('modal-warning-banner');
    const confirmBtn = document.getElementById('btn-confirm-bid');
    warningBanner.classList.add('hidden');
    warningBanner.textContent = '';
    confirmBtn.disabled = false;

    const playerId = document.getElementById('select-winning-player').value;
    const bidAmount = parseFloat(document.getElementById('input-bid-amount').value);

    const player = F1App.state.players.find(p => p.id === playerId);
    if (!player) return;

    // Check Max Capacity
    if (player.roster.length >= F1App.state.maxDriversPerPlayer) {
      warningBanner.textContent = `WARNING: ${player.name} has already reached the maximum roster limit (${F1App.state.maxDriversPerPlayer} drivers).`;
      warningBanner.classList.remove('hidden');
      confirmBtn.disabled = true;
      return;
    }

    // Check Invalid/Negative Bid Amount
    if (isNaN(bidAmount) || bidAmount < 0) {
      warningBanner.textContent = 'WARNING: Bid amount must be $0M or greater.';
      warningBanner.classList.remove('hidden');
      confirmBtn.disabled = true;
      return;
    }

    // Check Budget Exceeding
    if (bidAmount > player.remainingBudget) {
      warningBanner.textContent = `WARNING: Bid of $${bidAmount}M exceeds ${player.name}'s remaining budget ($${player.remainingBudget}M)!`;
      warningBanner.classList.remove('hidden');
      confirmBtn.disabled = true;
      return;
    }
  },

  confirmAssignment() {
    const playerId = document.getElementById('select-winning-player').value;
    const bidAmount = parseFloat(document.getElementById('input-bid-amount').value) || 0;
    const driverName = this.currentDrawnDriver;

    const player = F1App.state.players.find(p => p.id === playerId);
    if (!player) return;

    // Final safety validations
    if (bidAmount > player.remainingBudget || player.roster.length >= F1App.state.maxDriversPerPlayer) {
      return;
    }

    // 1. Record in History Stack for Undo
    F1App.state.auctionHistory.push({
      type: 'ASSIGNMENT',
      driverName: driverName,
      playerId: playerId,
      bidAmount: bidAmount
    });

    // 2. Mutate State
    player.remainingBudget -= bidAmount;
    player.roster.push({
      name: driverName,
      cost: bidAmount
    });

    F1App.state.drivers = F1App.state.drivers.filter(d => d !== driverName);
    globalWheelEngine.removeDriver(driverName);

    // 3. UI Updates
    this.closeAuctionModal();
    this.renderPlayerTable();
    this.updateControlsState();
  },

  passUnsold() {
    const driverName = this.currentDrawnDriver;

    // 1. Push into Undo Stack
    F1App.state.auctionHistory.push({
      type: 'UNSOLD',
      driverName: driverName
    });

    // 2. Remove driver from active wheel
    F1App.state.drivers = F1App.state.drivers.filter(d => d !== driverName);
    globalWheelEngine.removeDriver(driverName);

    // 3. UI Updates
    this.closeAuctionModal();
    this.renderPlayerTable();
    this.updateControlsState();
  },

  undoLastSale() {
    if (F1App.state.auctionHistory.length === 0) return;

    const lastAction = F1App.state.auctionHistory.pop();

    if (lastAction.type === 'ASSIGNMENT') {
      const player = F1App.state.players.find(p => p.id === lastAction.playerId);
      if (player) {
        player.remainingBudget += lastAction.bidAmount;
        player.roster = player.roster.filter(item => item.name !== lastAction.driverName);
      }
    }

    // Return driver to wheel state
    if (!F1App.state.drivers.includes(lastAction.driverName)) {
      F1App.state.drivers.push(lastAction.driverName);
    }

    globalWheelEngine.setDrivers(F1App.state.drivers);
    this.renderPlayerTable();
    this.updateControlsState();
  },

  renderPlayerTable() {
    const tbody = document.getElementById('player-dashboard-tbody');
    tbody.innerHTML = '';

    F1App.state.players.forEach(p => {
      const tr = document.createElement('tr');
      // Full-height player color left border accent
      tr.style.borderLeft = `5px solid ${p.color}`;

      // Player Name Column with Color Indicator Tag
      const tdPlayer = document.createElement('td');
      tdPlayer.innerHTML = `
        <span class="badge-tag" style="background-color: ${p.color}; color: #FFF;">•</span>
        <strong>${p.name.toUpperCase()}</strong>
      `;

      // Remaining Budget Column
      const tdBudget = document.createElement('td');
      tdBudget.innerHTML = `<strong style="color:var(--text-primary);">$${p.remainingBudget}M</strong> <span style="color:#8E8E9F; font-size:0.8rem;">/ $${p.budget}M</span>`;

      // Graphical Roster Slots Bar
      const tdSlots = document.createElement('td');
      const slotContainer = document.createElement('div');
      slotContainer.className = 'slot-bar';

      const maxSlots = F1App.state.maxDriversPerPlayer;
      const filledCount = p.roster.length;

      for (let s = 0; s < maxSlots; s++) {
        const slotBox = document.createElement('div');
        slotBox.className = `slot-box ${s < filledCount ? 'filled' : ''}`;
        slotContainer.appendChild(slotBox);
      }
      tdSlots.appendChild(slotContainer);

      // Drafted Roster Column
      const tdRoster = document.createElement('td');
      if (p.roster.length === 0) {
        tdRoster.innerHTML = `<span class="telemetry-placeholder">-- / --</span>`;
      } else {
        const pillsDiv = document.createElement('div');
        pillsDiv.className = 'roster-pills';

        p.roster.forEach(d => {
          const pill = document.createElement('span');
          pill.className = 'driver-pill';
          pill.style.borderLeftColor = p.color;
          pill.innerHTML = `${d.name.toUpperCase()} <span class="cost">($${d.cost}M)</span>`;
          pillsDiv.appendChild(pill);
        });
        tdRoster.appendChild(pillsDiv);
      }

      tr.appendChild(tdPlayer);
      tr.appendChild(tdBudget);
      tr.appendChild(tdSlots);
      tr.appendChild(tdRoster);

      tbody.appendChild(tr);
    });

    // Update Drivers Left Badge
    document.getElementById('remaining-drivers-badge').textContent = `${F1App.state.drivers.length} DRIVERS LEFT`;
  },

  updateControlsState() {
    // Undo button state
    document.getElementById('btn-undo').disabled = F1App.state.auctionHistory.length === 0;

    // Spin button state
    document.getElementById('btn-spin').disabled = F1App.state.drivers.length === 0;

    // Proceed to Race Button condition:
    // Unlocked if all players have at least 1 driver, OR all wheel options are exhausted/filled
    const totalDraftedDrivers = F1App.state.players.reduce((sum, p) => sum + p.roster.length, 0);
    const allPlayersHaveMinDrivers = F1App.state.players.every(p => p.roster.length >= 1);
    const wheelExhausted = F1App.state.drivers.length === 0;

    const canProceed = (totalDraftedDrivers >= 1 && (allPlayersHaveMinDrivers || wheelExhausted));
    document.getElementById('btn-proceed-race').disabled = !canProceed;
  }
};
