(() => {
  const PIN_KEY = "wuhan-trip-2026-sync-pin-v9";
  const LEGACY_PIN_KEYS = ["wuhan-trip-2026-sync-pin-v1"];
  const POLL_MS = 8000;
  const TIMEOUT_MS = 9000;
  let pollHandle = null;
  let pushHandle = null;
  let busy = false;
  let mode = "login";
  let lastUpdatedAt = "";

  function freshNode(id) {
    const old = document.getElementById(id);
    if (!old) return null;
    const neo = old.cloneNode(true);
    old.replaceWith(neo);
    return neo;
  }

  freshNode("syncStatus");
  freshNode("syncModal");

  const statusEl = document.getElementById("syncStatus");
  const modal = document.getElementById("syncModal");

  for (const key of LEGACY_PIN_KEYS) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  function setStatus(text, state = "syncing") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `sync-pill ${state}`;
  }

  function getPin() {
    try {
      const value = localStorage.getItem(PIN_KEY) || "";
      if (!/^\d{4,12}$/.test(value)) {
        if (value) localStorage.removeItem(PIN_KEY);
        return "";
      }
      return value;
    } catch (_) { return ""; }
  }

  function savePin(pin) { try { localStorage.setItem(PIN_KEY, pin); } catch (_) {} }
  function clearPin() { try { localStorage.removeItem(PIN_KEY); } catch (_) {} }

  function modalParts() {
    return {
      title: document.getElementById("syncModalTitle"),
      desc: document.getElementById("syncModalDesc"),
      input: document.getElementById("syncPinInput"),
      error: document.getElementById("syncError"),
      submit: document.getElementById("syncSubmit"),
      later: document.getElementById("syncLater")
    };
  }

  function openModal(nextMode, message = "") {
    mode = nextMode;
    if (!modal) return;
    const p = modalParts();
    if (p.later) p.later.style.display = "none";
    if (p.error) p.error.textContent = message;
    if (p.input) p.input.value = "";
    if (nextMode === "setup") {
      if (p.title) p.title.textContent = "设置跨设备同步";
      if (p.desc) p.desc.textContent = "设置一个 4—12 位数字 PIN。当前设备数据将写入云端，之后所有设备使用同一 PIN。";
      if (p.submit) p.submit.textContent = "设置 PIN 并同步";
    } else {
      if (p.title) p.title.textContent = "连接云端数据";
      if (p.desc) p.desc.textContent = "请输入同步 PIN。连接成功后，本设备会先读取云端最新数据。";
      if (p.submit) p.submit.textContent = "连接并同步";
    }
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("sync-modal-open");
    setTimeout(() => p.input && p.input.focus(), 120);
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("sync-modal-open");
  }

  async function api(method, { pin = "", body = null, probe = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const url = `/api/state${probe ? `?probe=1&_=${Date.now()}` : `?_=${Date.now()}`}`;
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store", "Pragma": "no-cache" };
    if (pin) headers["X-Trip-Pin"] = pin;
    try {
      return await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store", signal: controller.signal });
    } finally { clearTimeout(timer); }
  }

  async function getProbe() {
    const res = await api("GET", { probe: true });
    if (!res.ok) throw new Error(`probe:${res.status}`);
    return await res.json();
  }

  function applyRemote(data, toast = false) {
    if (data && data.state) applyCloudState(data.state);
    cloudEnabled = true;
    localDirty = false;
    lastUpdatedAt = data?.updatedAt || lastUpdatedAt || "";
    cloudUpdatedAt = lastUpdatedAt;
    setStatus("云端已同步", "synced");
    closeModal();
    startV9Polling();
    if (toast) showToast("跨设备同步已连接");
  }

  async function bootstrap(forcePrompt = true) {
    if (busy) return;
    busy = true;
    setStatus("正在验证云端", "syncing");
    try {
      const pin = getPin();
      if (pin) {
        const res = await api("GET", { pin });
        if (res.ok) { applyRemote(await res.json(), false); return; }
        if (res.status === 401) {
          clearPin(); cloudEnabled = false; setStatus("需要输入 PIN", "error");
          if (forcePrompt) openModal("login", "请重新输入同步 PIN。");
          return;
        }
        if (res.status === 428) {
          clearPin(); cloudEnabled = false; setStatus("需要设置 PIN", "error");
          if (forcePrompt) openModal("setup");
          return;
        }
        throw new Error(`get:${res.status}`);
      }

      const info = await getProbe();
      cloudEnabled = false;
      if (info.initialized) {
        setStatus("需要输入 PIN", "error");
        if (forcePrompt) openModal("login");
      } else {
        setStatus("需要设置 PIN", "error");
        if (forcePrompt) openModal("setup");
      }
    } catch (_) {
      cloudEnabled = false;
      setStatus(navigator.onLine ? "云端连接异常·点此重试" : "离线·待同步", "error");
      if (forcePrompt && navigator.onLine) {
        try { const info = await getProbe(); openModal(info.initialized ? "login" : "setup"); } catch (_) {}
      }
    } finally { busy = false; }
  }

  async function submitPin() {
    const p = modalParts();
    const pin = (p.input?.value || "").trim();
    if (!/^\d{4,12}$/.test(pin)) { if (p.error) p.error.textContent = "请输入 4—12 位数字 PIN"; return; }
    if (p.error) p.error.textContent = "正在连接云端…";
    try {
      if (mode === "setup") {
        const res = await api("POST", { pin, body: { action: "setup", pin, state: getSyncState() } });
        if (res.status === 409) {
          mode = "login";
          if (p.error) p.error.textContent = "云端已设置 PIN，请输入原有 PIN。";
          if (p.submit) p.submit.textContent = "连接并同步";
          return;
        }
        if (!res.ok) { if (p.error) p.error.textContent = `设置失败（${res.status}）`; return; }
        savePin(pin); applyRemote(await res.json(), true); return;
      }

      const res = await api("GET", { pin });
      if (res.status === 401) { clearPin(); if (p.error) p.error.textContent = "PIN 不正确，请重新输入。"; return; }
      if (!res.ok) { if (p.error) p.error.textContent = `连接失败（${res.status}），请重试。`; return; }
      savePin(pin);
      applyRemote(await res.json(), true);
    } catch (_) {
      if (p.error) p.error.textContent = navigator.onLine ? "连接失败，请稍后重试。" : "当前离线，请联网后重试。";
    }
  }

  async function pushNow() {
    const pin = getPin();
    if (!pin) { cloudEnabled = false; setStatus("需要输入 PIN", "error"); openModal("login"); return; }
    try {
      const res = await api("PUT", { pin, body: { state: getSyncState() } });
      if (res.status === 401) {
        clearPin(); cloudEnabled = false; setStatus("需要重新输入 PIN", "error");
        openModal("login", "同步凭证已失效，请重新输入 PIN。");
        return;
      }
      if (!res.ok) throw new Error(`put:${res.status}`);
      const data = await res.json();
      cloudEnabled = true; localDirty = false; lastUpdatedAt = data.updatedAt || lastUpdatedAt; cloudUpdatedAt = lastUpdatedAt;
      setStatus("云端已同步", "synced");
      startV9Polling();
    } catch (_) {
      cloudEnabled = false;
      setStatus(navigator.onLine ? "同步失败·自动重试" : "离线·待同步", "error");
      clearTimeout(pushHandle);
      pushHandle = setTimeout(() => { if (navigator.onLine) pushNow(); }, 5000);
    }
  }

  async function pullLatest() {
    if (document.hidden || localDirty) return;
    const pin = getPin();
    if (!pin) { setStatus("需要输入 PIN", "error"); openModal("login"); return; }
    try {
      const res = await api("GET", { pin });
      if (res.status === 401) { clearPin(); cloudEnabled = false; setStatus("需要重新输入 PIN", "error"); openModal("login"); return; }
      if (!res.ok) return;
      const data = await res.json();
      cloudEnabled = true;
      if (data.updatedAt && data.updatedAt !== lastUpdatedAt) {
        lastUpdatedAt = data.updatedAt; cloudUpdatedAt = lastUpdatedAt; applyCloudState(data.state || {}); localDirty = false;
        setStatus("云端已更新", "synced"); showToast("已收到另一设备更新");
      } else { setStatus("云端已同步", "synced"); }
    } catch (_) { setStatus(navigator.onLine ? "云端暂不可用" : "离线·待同步", "error"); }
  }

  function startV9Polling() { if (!pollHandle) pollHandle = setInterval(pullLatest, POLL_MS); }

  syncFromCloud = bootstrap;
  setupOrLogin = submitPin;
  scheduleCloudPush = function() {
    if (suppressCloudPush) return;
    localDirty = true;
    setStatus(navigator.onLine ? "正在同步" : "离线·待同步", "syncing");
    clearTimeout(pushHandle);
    pushHandle = setTimeout(pushNow, 300);
  };
  pushCloudState = pushNow;
  pollCloud = pullLatest;
  startPolling = startV9Polling;

  try {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  } catch (_) {}

  statusEl?.addEventListener("click", () => cloudEnabled ? pullLatest() : bootstrap(true));
  document.getElementById("syncSubmit")?.addEventListener("click", submitPin);
  document.getElementById("syncPinInput")?.addEventListener("keydown", e => { if (e.key === "Enter") submitPin(); });
  document.getElementById("syncLater")?.addEventListener("click", e => { e.preventDefault(); openModal(mode); });

  window.addEventListener("online", () => localDirty ? pushNow() : bootstrap(false));
  window.addEventListener("pageshow", event => { if (event.persisted || !cloudEnabled) setTimeout(() => bootstrap(true), 60); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(() => bootstrap(true), 60); });

  setInterval(() => {
    if (!navigator.onLine) return;
    if (!cloudEnabled && !modal?.classList.contains("show")) bootstrap(true);
  }, 2500);

  bootstrap(true);
})();