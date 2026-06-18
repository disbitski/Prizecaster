const CONTRACT_ABI = [
  "function requestWinner(uint256 participantCount,bool enableNativePayment) external returns (uint256 requestId)",
  "function getRequestStatus(uint256 requestId) view returns (bool fulfilled,uint256 participantCount,uint256 winnerNumber,uint256 randomWord)",
  "event RequestSent(uint256 indexed requestId,uint256 participantCount)",
  "event WinnerFulfilled(uint256 indexed requestId,uint256 indexed winnerNumber,uint256 randomWord)"
];

const STORAGE_KEY = "prizecaster-state";

const els = {
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
  themeToggle: document.querySelector("#themeToggle"),
  modeBadge: document.querySelector("#modeBadge"),
  walletBadge: document.querySelector("#walletBadge"),
  eventName: document.querySelector("#eventName"),
  participantCount: document.querySelector("#participantCount"),
  prizeCount: document.querySelector("#prizeCount"),
  uniqueWinners: document.querySelector("#uniqueWinners"),
  prizeFields: document.querySelector("#prizeFields"),
  addPrize: document.querySelector("#addPrize"),
  loadSample: document.querySelector("#loadSample"),
  demoModeButton: document.querySelector("#demoModeButton"),
  vrfModeButton: document.querySelector("#vrfModeButton"),
  modeNote: document.querySelector("#modeNote"),
  contractAddress: document.querySelector("#contractAddress"),
  nativePayment: document.querySelector("#nativePayment"),
  connectWallet: document.querySelector("#connectWallet"),
  saveSetup: document.querySelector("#saveSetup"),
  drawEventName: document.querySelector("#drawEventName"),
  currentPrize: document.querySelector("#currentPrize"),
  numberDisplay: document.querySelector("#numberDisplay"),
  drawStatus: document.querySelector("#drawStatus"),
  drawWinner: document.querySelector("#drawWinner"),
  skipPrize: document.querySelector("#skipPrize"),
  winnerInfo: document.querySelector("#winnerInfo"),
  assignWinner: document.querySelector("#assignWinner"),
  prizeQueue: document.querySelector("#prizeQueue"),
  winnerListCompact: document.querySelector("#winnerListCompact"),
  winnerListFull: document.querySelector("#winnerListFull"),
  fullscreenButton: document.querySelector("#fullscreenButton"),
  exportResults: document.querySelector("#exportResults"),
  resetEvent: document.querySelector("#resetEvent")
};

const defaultPrizes = [
  "Grand Prize",
  "Hardware Wallet",
  "Builder Swag Kit",
  "VIP Mentor Lunch"
];

let state = {
  eventName: "Hack Night Prize Draw",
  participantCount: 120,
  prizeCount: 4,
  prizes: [...defaultPrizes],
  uniqueWinners: true,
  mode: "demo",
  contractAddress: "",
  nativePayment: false,
  activePrizeIndex: 0,
  pendingNumber: null,
  pendingRequestId: null,
  winners: [],
  theme: "dark"
};

let provider;
let signer;
let connectedAccount = "";
let rollTimer;
let ethersLib;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    state = {
      ...state,
      ...saved,
      prizes: Array.isArray(saved.prizes) && saved.prizes.length ? saved.prizes : [...defaultPrizes],
      winners: Array.isArray(saved.winners) ? saved.winners : []
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const theme = params.get("theme");
  if (theme === "light" || theme === "dark") {
    state.theme = theme;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyTheme() {
  document.body.dataset.theme = state.theme;
  els.themeToggle.textContent = state.theme === "dark" ? "Light theme" : "Dark theme";
}

function syncStateFromForm() {
  state.eventName = els.eventName.value.trim() || "Prizecaster Event";
  state.participantCount = clampNumber(els.participantCount.value, 1, 1_000_000);
  state.prizeCount = clampNumber(els.prizeCount.value, 1, 50);
  state.uniqueWinners = els.uniqueWinners.checked;
  state.contractAddress = els.contractAddress.value.trim();
  state.nativePayment = els.nativePayment.checked;
  state.prizes = [...document.querySelectorAll("[data-prize-input]")]
    .map((input, index) => input.value.trim() || `Prize ${index + 1}`)
    .slice(0, state.prizeCount);

  while (state.prizes.length < state.prizeCount) {
    state.prizes.push(`Prize ${state.prizes.length + 1}`);
  }

  state.activePrizeIndex = Math.min(state.activePrizeIndex, state.prizes.length);
  persist();
  render();
}

function clampNumber(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
}

function renderPrizeFields() {
  const currentInputs = [...document.querySelectorAll("[data-prize-input]")].map((input) => input.value);
  if (currentInputs.length) state.prizes = currentInputs;
  state.prizeCount = clampNumber(els.prizeCount.value, 1, 50);

  while (state.prizes.length < state.prizeCount) {
    state.prizes.push(`Prize ${state.prizes.length + 1}`);
  }

  state.prizes = state.prizes.slice(0, state.prizeCount);
  els.prizeFields.innerHTML = "";

  state.prizes.forEach((prize, index) => {
    const row = document.createElement("div");
    row.className = "prize-row";
    row.innerHTML = `
      <span class="prize-index">${index + 1}</span>
      <input data-prize-input type="text" value="${escapeAttribute(prize)}" aria-label="Prize ${index + 1} name" />
      <button class="remove-prize" type="button" aria-label="Remove prize ${index + 1}" title="Remove prize">-</button>
    `;
    row.querySelector("input").addEventListener("input", syncStateFromForm);
    row.querySelector("button").addEventListener("click", () => removePrize(index));
    els.prizeFields.appendChild(row);
  });
}

function render() {
  applyTheme();
  els.eventName.value = state.eventName;
  els.participantCount.value = state.participantCount;
  els.prizeCount.value = state.prizeCount;
  els.uniqueWinners.checked = state.uniqueWinners;
  els.contractAddress.value = state.contractAddress;
  els.nativePayment.checked = state.nativePayment;

  els.modeBadge.textContent = state.mode === "vrf" ? "Chainlink VRF" : "Demo mode";
  els.modeBadge.className = `badge ${state.mode === "vrf" ? "badge-vrf" : "badge-demo"}`;
  els.demoModeButton.classList.toggle("active", state.mode === "demo");
  els.vrfModeButton.classList.toggle("active", state.mode === "vrf");
  els.modeNote.textContent =
    state.mode === "vrf"
      ? "Verified draw mode sends an on-chain Chainlink VRF request and waits for fulfillment before revealing the winner number."
      : "Demo mode uses browser crypto for rehearsals and layout testing. Use verified draw mode when you want Chainlink VRF.";

  const nextPrize = state.prizes[state.activePrizeIndex];
  els.drawEventName.textContent = state.eventName;
  els.currentPrize.textContent = nextPrize || "All prizes assigned";
  els.drawWinner.disabled = !nextPrize || Boolean(state.pendingRequestId);
  els.skipPrize.disabled = !nextPrize || Boolean(state.pendingRequestId);
  els.assignWinner.disabled = state.pendingNumber === null;
  els.winnerInfo.disabled = state.pendingNumber === null;

  if (state.pendingNumber !== null) {
    els.numberDisplay.textContent = state.pendingNumber;
    els.drawStatus.textContent = "Winner number ready. Add winner info and assign it to the prize.";
  } else if (!nextPrize) {
    els.numberDisplay.textContent = "Done";
    els.drawStatus.textContent = "Every configured prize has been assigned.";
  } else if (state.pendingRequestId) {
    els.drawStatus.textContent = `Waiting for VRF fulfillment for request ${state.pendingRequestId}...`;
  } else {
    els.numberDisplay.textContent = "Ready";
    els.drawStatus.textContent = `Next draw: ${nextPrize}`;
  }

  renderQueue();
  renderWinners();
}

function renderQueue() {
  els.prizeQueue.innerHTML = "";
  state.prizes.forEach((prize, index) => {
    const winner = state.winners.find((item) => item.prizeIndex === index);
    const item = document.createElement("div");
    item.className = `queue-item ${index === state.activePrizeIndex ? "current" : ""}`;
    item.innerHTML = `
      <strong>${escapeHtml(prize)}</strong>
      <span class="queue-state">${winner ? "Assigned" : index === state.activePrizeIndex ? "Current" : "Queued"}</span>
    `;
    els.prizeQueue.appendChild(item);
  });

  if (!state.prizes.length) {
    els.prizeQueue.innerHTML = `<div class="empty-state">No prizes configured yet.</div>`;
  }
}

function renderWinners() {
  const markup = state.winners.length
    ? state.winners
        .map(
          (winner) => `
          <article class="winner-item">
            <span class="winner-number">${winner.number}</span>
            <span class="winner-meta">
              <strong>${escapeHtml(winner.prize)}</strong>
              <span>${escapeHtml(winner.info || "Winner info not recorded")}</span>
              <span>${winner.source}${winner.requestId ? ` - request ${winner.requestId}` : ""}</span>
            </span>
          </article>
        `
        )
        .join("")
    : `<div class="empty-state">No winners assigned yet.</div>`;

  els.winnerListCompact.innerHTML = markup;
  els.winnerListFull.innerHTML = markup;
}

function setTab(tabName) {
  const validTab = els.tabs.some((tab) => tab.dataset.tab === tabName) ? tabName : "setup";
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === validTab));
  els.views.forEach((view) => view.classList.toggle("active", view.id === validTab));
}

function setMode(mode) {
  state.mode = mode;
  persist();
  render();
}

function addPrize() {
  syncStateFromForm();
  state.prizes.push(`Prize ${state.prizes.length + 1}`);
  state.prizeCount = state.prizes.length;
  els.prizeCount.value = state.prizeCount;
  renderPrizeFields();
  syncStateFromForm();
}

function removePrize(index) {
  syncStateFromForm();
  if (state.prizes.length <= 1) return;
  state.prizes.splice(index, 1);
  state.prizeCount = state.prizes.length;
  state.winners = state.winners.filter((winner) => winner.prizeIndex !== index);
  state.winners.forEach((winner) => {
    if (winner.prizeIndex > index) winner.prizeIndex -= 1;
  });
  state.activePrizeIndex = Math.min(state.activePrizeIndex, state.prizes.length - 1);
  els.prizeCount.value = state.prizeCount;
  renderPrizeFields();
  syncStateFromForm();
}

async function connectWallet() {
  if (!window.ethereum) {
    setStatus("MetaMask or another EIP-1193 wallet is required for verified draw mode.");
    return;
  }

  const ethers = await loadEthers();
  provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  connectedAccount = accounts[0] || "";
  signer = await provider.getSigner();
  els.walletBadge.textContent = connectedAccount ? shortAddress(connectedAccount) : "Wallet not connected";
}

async function loadEthers() {
  if (!ethersLib) {
    const mod = await import("https://cdn.jsdelivr.net/npm/ethers@6.13.4/+esm");
    ethersLib = mod.ethers;
  }
  return ethersLib;
}

async function drawWinner() {
  syncStateFromForm();
  const prize = state.prizes[state.activePrizeIndex];
  if (!prize) return;

  if (state.mode === "vrf") {
    await drawWithVRF();
    return;
  }

  startRoll();
  await wait(1700);
  const number = drawDemoNumber();
  stopRoll(number);
  state.pendingNumber = number;
  state.pendingRequestId = null;
  persist();
  render();
}

async function drawWithVRF() {
  const ethers = await loadEthers();
  if (!ethers.isAddress(state.contractAddress)) {
    setStatus("Paste a deployed PrizecasterVRF contract address before using verified draw mode.");
    setTab("setup");
    return;
  }

  if (!signer) await connectWallet();
  if (!signer) return;

  const contract = new ethers.Contract(state.contractAddress, CONTRACT_ABI, signer);
  startRoll();
  setStatus("Confirm the verified draw request in your wallet.");

  try {
    const tx = await contract.requestWinner(BigInt(state.participantCount), state.nativePayment);
    setStatus("Verified draw request submitted. Waiting for the transaction receipt...");
    const receipt = await tx.wait();
    const requestId = readRequestId(receipt, ethers);

    if (!requestId) {
      throw new Error("RequestSent event was not found in the transaction receipt.");
    }

    state.pendingRequestId = requestId.toString();
    persist();
    setStatus(`Request ${state.pendingRequestId} confirmed. Waiting for Chainlink VRF fulfillment...`);
    const result = await pollForFulfillment(contract, requestId);
    stopRoll(result.winnerNumber);
    state.pendingNumber = result.winnerNumber;
    state.pendingRequestId = requestId.toString();
    persist();
    render();
  } catch (error) {
    stopRoll(null);
    state.pendingRequestId = null;
    persist();
    render();
    setStatus(error?.shortMessage || error?.message || "Verified draw failed.");
  }
}

function readRequestId(receipt, ethers) {
  const iface = new ethers.Interface(CONTRACT_ABI);
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "RequestSent") return parsed.args.requestId;
    } catch {
      // Ignore unrelated logs in the transaction receipt.
    }
  }
  return null;
}

async function pollForFulfillment(contract, requestId) {
  const timeoutAt = Date.now() + 8 * 60 * 1000;
  while (Date.now() < timeoutAt) {
    const [fulfilled, , winnerNumber] = await contract.getRequestStatus(requestId);
    if (fulfilled) {
      return { winnerNumber: Number(winnerNumber) };
    }
    await wait(5000);
  }
  throw new Error("Timed out waiting for VRF fulfillment. Leave the request open and check it again on-chain.");
}

function drawDemoNumber() {
  const used = new Set(state.winners.map((winner) => winner.number));
  const maxAttempts = Math.max(12, state.participantCount * 2);

  for (let i = 0; i < maxAttempts; i += 1) {
    const value = secureRandomInt(1, state.participantCount);
    if (!state.uniqueWinners || !used.has(value)) return value;
  }

  return secureRandomInt(1, state.participantCount);
}

function secureRandomInt(min, max) {
  const range = max - min + 1;
  const bucketCount = Math.floor(0xffffffff / range) * range;
  const buffer = new Uint32Array(1);

  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= bucketCount);

  return min + (buffer[0] % range);
}

function startRoll() {
  els.drawWinner.disabled = true;
  els.assignWinner.disabled = true;
  els.winnerInfo.disabled = true;
  els.numberDisplay.classList.add("rolling");
  els.drawStatus.textContent = state.mode === "vrf" ? "Requesting Chainlink VRF randomness..." : "Drawing a rehearsal number...";
  rollTimer = window.setInterval(() => {
    els.numberDisplay.textContent = secureRandomInt(1, Math.max(1, state.participantCount));
  }, 58);
}

function stopRoll(finalNumber) {
  window.clearInterval(rollTimer);
  els.numberDisplay.classList.remove("rolling");
  if (finalNumber === null) {
    els.numberDisplay.textContent = "Ready";
    return;
  }
  els.numberDisplay.textContent = finalNumber;
}

function assignWinner() {
  if (state.pendingNumber === null) return;

  const prize = state.prizes[state.activePrizeIndex];
  state.winners.push({
    prizeIndex: state.activePrizeIndex,
    prize,
    number: state.pendingNumber,
    info: els.winnerInfo.value.trim(),
    source: state.mode === "vrf" ? "Chainlink VRF" : "Demo draw",
    requestId: state.pendingRequestId,
    assignedAt: new Date().toISOString()
  });

  state.pendingNumber = null;
  state.pendingRequestId = null;
  state.activePrizeIndex = nextOpenPrizeIndex(state.activePrizeIndex + 1);
  els.winnerInfo.value = "";
  persist();
  render();
}

function skipPrize() {
  state.activePrizeIndex = nextOpenPrizeIndex(state.activePrizeIndex + 1);
  state.pendingNumber = null;
  state.pendingRequestId = null;
  els.winnerInfo.value = "";
  persist();
  render();
}

function nextOpenPrizeIndex(start) {
  const assigned = new Set(state.winners.map((winner) => winner.prizeIndex));
  for (let index = start; index < state.prizes.length; index += 1) {
    if (!assigned.has(index)) return index;
  }
  return state.prizes.length;
}

function loadSampleEvent() {
  state = {
    ...state,
    eventName: "Prizecaster Live",
    participantCount: 256,
    prizeCount: 5,
    prizes: ["Grand Prize Laptop", "Conference Pass", "Hardware Wallet", "VIP Hoodie Bundle", "Coffee With Judges"],
    activePrizeIndex: 0,
    pendingNumber: null,
    pendingRequestId: null,
    winners: []
  };
  renderPrizeFields();
  persist();
  render();
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  persist();
  applyTheme();
}

function exportResults() {
  const payload = {
    eventName: state.eventName,
    participantCount: state.participantCount,
    prizes: state.prizes,
    winners: state.winners,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "prizecaster"}-winners.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetEvent() {
  const confirmed = window.confirm("Reset this event and clear all winners?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

function setStatus(message) {
  els.drawStatus.textContent = message;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => setTab(tab.dataset.tab)));
  els.themeToggle.addEventListener("click", toggleTheme);
  els.eventName.addEventListener("input", syncStateFromForm);
  els.participantCount.addEventListener("input", syncStateFromForm);
  els.prizeCount.addEventListener("input", () => {
    renderPrizeFields();
    syncStateFromForm();
  });
  els.uniqueWinners.addEventListener("change", syncStateFromForm);
  els.contractAddress.addEventListener("input", syncStateFromForm);
  els.nativePayment.addEventListener("change", syncStateFromForm);
  els.addPrize.addEventListener("click", addPrize);
  els.loadSample.addEventListener("click", loadSampleEvent);
  els.demoModeButton.addEventListener("click", () => setMode("demo"));
  els.vrfModeButton.addEventListener("click", () => setMode("vrf"));
  els.connectWallet.addEventListener("click", connectWallet);
  els.saveSetup.addEventListener("click", () => {
    syncStateFromForm();
    setTab("draw");
  });
  els.drawWinner.addEventListener("click", drawWinner);
  els.assignWinner.addEventListener("click", assignWinner);
  els.skipPrize.addEventListener("click", skipPrize);
  els.fullscreenButton.addEventListener("click", () => document.documentElement.requestFullscreen?.());
  els.exportResults.addEventListener("click", exportResults);
  els.resetEvent.addEventListener("click", resetEvent);
}

loadState();
applyUrlParams();
renderPrizeFields();
bindEvents();
render();
setTab(new URLSearchParams(window.location.search).get("tab") || "setup");
