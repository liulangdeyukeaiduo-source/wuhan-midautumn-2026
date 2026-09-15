(() => {
  const PIN_KEY = (typeof CLOUD_PIN_KEY !== "undefined" && CLOUD_PIN_KEY) ? CLOUD_PIN_KEY : "wuhan-trip-2026-sync-pin-v1";
  const REQUEST_TIMEOUT = 9000;
  const POLL_MS = 10000;
  let mode = "login";
  let v8PollTimer = null;
  let v8PushTimer = null;
  let inFlight = false;

  function fresh(id) {
    const old = document.getElementById(id);
    if (!old) return null;
    const neo = old.cloneNode(true);
    old.replaceWith(neo);
    return neo;
  }

  // Strip listeners registered by the older inline sync implementation.
  fresh("syncStatus");
  fresh("syncModal");

  const statusEl = document.getElementById("syncStatus");
  const modal = document.getElementById("syncModal");
  const later = document.getElementById("syncLater");
  if (later) later.style.display = "none";

  function setStatus(text, state = "syncing") {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = `sync-pill ${state}`;
  }

  function getPin() {
    try {
      const pin = localStorage.getItem(PIN_KEY) || "";
      if (!/^\d{4,12}$/.test(pin)) {
        if (pin) localStorage.removeItem(PIN_KEY);
        return "";
      }
      return pin;
    } catch (_) {
      return "";
    }
  }

  function clearPin() {
    try { localStorage.removeItem(PIN_KEY); } catch (_) {}
  }

  function showModal(nextMode, message = "") {
    mode = nextMode;
    if (!modal) return;
    const title = document.getElementById("syncModalTitle");
    const desc = document.getElementById("syncModalDesc");
    const submit = document.getElementById("syncSubmit");
    const input = document.getElementById("syncPinInput");
    const err = document.getElementById("syncError");
    if (input) input.value = "";
    if (err) err.textContent = message;
    if (nextMode === "setup") {
      if (title) title.textContent = "设置跨设备同步";
      if (desc) desc.textContent = "设置一个 4—12 位数字 PIN。当前设备的数据将写入云端，其他设备使用同一 PIN 即可同步。";
      if (submit) submit.textContent = "设置 PIN 并同步";
    } else {
      if (title) title.textContent = "连接云端数据";
      if (desc) desc.textContent = "请输入这份旅行手册的同步 PIN。连接成功后会读取云端最新数据。";
      if (submit) submit.textContent = "连接并同步";
    }
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("sync-modal-open");
    setTimeout(() => input && input.focus(), 120);
  }

  function hideModal() {
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("sync-modal-open");
  }

  async function request(method, body, pin, suffix = "") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (pin) headers["X-Trip-Pin"] = pin;
    try {
      return await fetch(`/api/state${suffix}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  }

  function applyRemote(data) {
    if (data && data.state) applyCloudState(data.state);
    cloudEnabled = true;
    cloudUpdatedAt = data?.updatedAt || "";
    localDirty = false;
    setStatus("云端已同步", "synced");
    startV8Polling();
  }

  async function probe() {
    const res = await request("GET", null, "", "?probe=1");
    if (!res.ok) throw new Error(`probe ${res.status}`);
    return await res.json();
  }

  async function bootstrap(forcePrompt = true) {
    if (inFlight) return;
    inFlight = true;
    setStatus("正在连接云端", "syncing");
    try {
      const pin = getPin();
      if (pin) {
        const res = await request("GET", null, pin);
        if (res.ok) {
          applyRemote(await res.json());
          hideModal();
          return;
        }
        if (res.status === 401) {
          clearPin();
          cloudEnabled = false;
          setStatus("需要输入 PIN", "error");
          if (forcePrompt) showModal("login", "原设备保存的 PIN 已失效，请重新输入。");
          return;
        }
        if (res.status === 428) {
          clearPin();
          cloudEnabled = false;
          setStatus("需要设置 PIN", "error");
          if (forcePrompt) showModal("setup");
          return;
        }
        if (res.status === 503) {
          cloudEnabled = false;
          setStatus("云端数据库未连接", "error");
          return;
        }
        throw new Error(`GET ${res.status}`);
      }

      const info = await probe();
      cloudEnabled = false;
      if (info.initialized) {
        setStatus("需要输入 PIN", "error");
        if (forcePrompt) showModal("login");
      } else {
        setStatus("需要设置 PIN", "error");
        if (forcePrompt) showModal("setup");
      }
    } catch (err) {
      cloudEnabled = false;
      setStatus(navigator.onLine ? "云端连接失败·点此重试" : "离线·待同步", "error");
      if (forcePrompt && !getPin() && navigator.onLine) {
        try {
          const info = await probe();
          showModal(info.initialized ? "login" : "setup");
        } catch (_) {}
      }
    } finally {
      inFlight = false;
    }
  }

  async function submitPin() {
    const input = document.getElementById("syncPinInput");
    const err = document.getElementById("syncError");
    const pin = (input?.value || "").trim();
    if (!/^\d{4,12}$/.test(pin)) {
      if (err) err.textContent = "请输入 4—12 位数字 PIN";
      return;
    }
    if (err) err.textContent = "正在连接云端…";

    try {
      let res;
      if (mode === "setup") {
        res = await request("POST", { action: "setup", pin, state: getSyncState() }, pin);
        if (res.status === 409) {
          mode = "login";
          if (err) err.textContent = "云端已设置 PIN，请输入原有 PIN。";
          const submit = document.getElementById("syncSubmit");
          if (submit) submit.textContent = "连接并同步";
          return;
        }
      } else {
        res = await request("GET", null, pin);
      }

      if (res.status === 401) {
        if (err) err.textContent = "PIN 不正确，请重新输入。";
        return;
      }
      if (res.status === 503) {
        if (err) err.textContent = "D1 数据库暂未连接。";
        return;
      }
      if (!res.ok) {
        if (err) err.textContent = `连接失败（${res.status}），请重试。`;
        return;
      }

      const data = await res.json();
      localStorage.setItem(PIN_KEY, pin);
      applyRemote(data);
      hideModal();
      showToast("跨设备同步已连接");
    } catch (_) {
      if (err) err.textContent = navigator.onLine ? "连接失败，请稍后重试。" : "当前离线，请联网后重试。";
    }
  }

  async function pushNow() {
    const pin = getPin();
    if (!pin) {
      cloudEnabled = false;
      setStatus("需要输入 PIN", "error");
      showModal("login");
      return;
    }
    try {
      const res = await request("PUT", { state: getSyncState() }, pin);
      if (res.status === 401) {
        clearPin();
        cloudEnabled = false;
        setStatus("需要重新输入 PIN", "error");
        showModal("login", "同步凭证已失效，请重新输入 PIN。");
        return;
      }
      if (!res.ok) throw new Error(`PUT ${res.status}`);
      const data = await res.json();
      cloudEnabled = true;
      cloudUpdatedAt = data.updatedAt || cloudUpdatedAt;
      localDirty = false;
      setStatus("云端已同步", "synced");
      startV8Polling();
    } catch (_) {
      cloudEnabled = false;
      setStatus(navigator.onLine ? "待重试同步" : "离线·待同步", "error");
      clearTimeout(v8PushTimer);
      v8PushTimer = setTimeout(() => navigator.onLine && pushNow(), 5000);
    }
  }

  async function pullLatest() {
    const pin = getPin();
    if (!pin || document.hidden || localDirty) return;
    try {
      const res = await request("GET", null, pin);
      if (res.status === 401) {
        clearPin();
        cloudEnabled = false;
        setStatus("需要重新输入 PIN", "error");
        showModal("login");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      cloudEnabled = true;
      if (data.updatedAt && data.updatedAt !== cloudUpdatedAt) {
        cloudUpdatedAt = data.updatedAt;
        applyCloudState(data.state || {});
        localDirty = false;
        setStatus("云端已更新", "synced");
        showToast("已收到另一设备更新");
      } else {
        setStatus("云端已同步", "synced");
      }
    } catch (_) {
      setStatus(navigator.onLine ? "云端暂不可用" : "离线·待同步", "error");
    }
  }

  function startV8Polling() {
    if (v8PollTimer) return;
    v8PollTimer = setInterval(pullLatest, POLL_MS);
  }

  // Replace the global hooks used by itinerary/prep code and by old timers.
  syncFromCloud = bootstrap;
  setupOrLogin = submitPin;
  scheduleCloudPush = function() {
    if (suppressCloudPush) return;
    localDirty = true;
    setStatus(navigator.onLine ? "正在同步" : "离线·待同步", "syncing");
    clearTimeout(v8PushTimer);
    v8PushTimer = setTimeout(pushNow, 320);
  };
  pushCloudState = pushNow;
  pollCloud = pullLatest;
  startPolling = startV8Polling;

  try {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  } catch (_) {}

  statusEl?.addEventListener("click", () => {
    if (cloudEnabled) pullLatest();
    else bootstrap(true);
  });
  document.getElementById("syncSubmit")?.addEventListener("click", submitPin);
  document.getElementById("syncPinInput")?.addEventListener("keydown", e => {
    if (e.key === "Enter") submitPin();
  });
  // No "local-only" close action in V8.
  later?.addEventListener("click", e => { e.preventDefault(); });

  window.addEventListener("online", () => localDirty ? pushNow() : bootstrap(false));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      if (getPin()) pullLatest();
      else bootstrap(true);
    }
  });

  // Boot immediately, and retry once after older inline timers have fired.
  bootstrap(true);
  setTimeout(() => {
    if (!cloudEnabled && !modal?.classList.contains("show")) bootstrap(true);
  }, 900);
})();