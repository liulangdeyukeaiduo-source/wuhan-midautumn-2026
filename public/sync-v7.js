(() => {
  const RECONNECT_DELAY = 250;
  let reconnectTimer = null;

  function pinValue() {
    try { return localStorage.getItem(CLOUD_PIN_KEY) || ""; } catch (_) { return ""; }
  }

  function hasCloudItems(state) {
    return !!(state && state.prepState && Array.isArray(state.prepState.items));
  }

  function localStateSnapshot() {
    try { return getSyncState(); } catch (_) { return { routeState: {}, prepState: { done: {}, items: [] } }; }
  }

  async function putLocalState(pin) {
    const res = await cloudRequest("PUT", { state: localStateSnapshot() }, pin);
    if (!res.ok) return { ok: false, res };
    const data = await res.json();
    cloudEnabled = true;
    cloudUpdatedAt = data.updatedAt || cloudUpdatedAt || "";
    localDirty = false;
    setSyncStatus("云端已同步", "synced");
    startPolling();
    return { ok: true, data };
  }

  function requireCloudPrompt(mode) {
    const later = document.getElementById("syncLater");
    if (later) later.style.display = "none";
    const modal = document.getElementById("syncModal");
    if (modal) {
      modal.addEventListener("click", e => {
        if (e.target === modal) e.stopPropagation();
      }, true);
    }
    openSyncModal(mode);
  }

  syncFromCloud = async function(showPrompt = true) {
    setSyncStatus("正在连接云端", "syncing");
    try {
      const res = await cloudRequest("GET");
      if (res.status === 503) {
        cloudEnabled = false;
        setSyncStatus("云端未配置", "error");
        return;
      }
      if (res.status === 428) {
        cloudEnabled = false;
        setSyncStatus("需要设置同步 PIN", "error");
        if (showPrompt) requireCloudPrompt("setup");
        return;
      }
      if (res.status === 401) {
        cloudEnabled = false;
        setSyncStatus("需要连接云端", "error");
        if (showPrompt) requireCloudPrompt("login");
        return;
      }
      if (!res.ok) throw new Error(`sync ${res.status}`);

      const data = await res.json();
      cloudEnabled = true;
      cloudUpdatedAt = data.updatedAt || "";

      if (localDirty) {
        const pushed = await putLocalState();
        if (!pushed.ok) throw new Error(`push ${pushed.res.status}`);
      } else if (!hasCloudItems(data.state)) {
        const local = localStateSnapshot();
        const remoteDone = data.state?.prepState?.done || {};
        const remoteRoute = data.state?.routeState || {};
        if (local.prepState) local.prepState.done = { ...remoteDone, ...(local.prepState.done || {}) };
        local.routeState = { ...(local.routeState || {}), ...remoteRoute };
        const put = await cloudRequest("PUT", { state: local });
        if (!put.ok) throw new Error(`migrate ${put.status}`);
        const saved = await put.json();
        cloudUpdatedAt = saved.updatedAt || cloudUpdatedAt;
        localDirty = false;
        setSyncStatus("云端已同步", "synced");
      } else {
        applyCloudState(data.state || {});
        localDirty = false;
        setSyncStatus("云端已同步", "synced");
      }
      startPolling();
    } catch (e) {
      cloudEnabled = false;
      setSyncStatus(navigator.onLine ? "云端连接失败" : "离线·待同步", "error");
    }
  };

  setupOrLogin = async function() {
    const input = document.getElementById("syncPinInput");
    const err = document.getElementById("syncError");
    const pin = input.value.trim();
    if (!/^\d{4,12}$/.test(pin)) {
      err.textContent = "请输入 4—12 位数字 PIN";
      return;
    }
    err.textContent = "正在连接云端…";

    try {
      let res;
      if (syncModalMode === "setup") {
        res = await cloudRequest("POST", { action: "setup", pin, state: localStateSnapshot() }, pin);
      } else {
        res = await cloudRequest("GET", null, pin);
      }

      if (res.status === 409) {
        err.textContent = "云端已经设置过 PIN，请输入原有 PIN";
        syncModalMode = "login";
        document.getElementById("syncSubmit").textContent = "连接并同步";
        return;
      }
      if (res.status === 401) { err.textContent = "PIN 不正确"; return; }
      if (res.status === 503) { err.textContent = "云端数据库尚未连接"; return; }
      if (!res.ok) { err.textContent = "暂时无法连接，请稍后重试"; return; }

      const data = await res.json();
      localStorage.setItem(CLOUD_PIN_KEY, pin);
      cloudEnabled = true;
      cloudUpdatedAt = data.updatedAt || "";

      if (syncModalMode === "login") {
        if (localDirty) {
          const pushed = await putLocalState(pin);
          if (!pushed.ok) throw new Error(`push ${pushed.res.status}`);
        } else if (!hasCloudItems(data.state)) {
          const local = localStateSnapshot();
          const remoteDone = data.state?.prepState?.done || {};
          const remoteRoute = data.state?.routeState || {};
          if (local.prepState) local.prepState.done = { ...remoteDone, ...(local.prepState.done || {}) };
          local.routeState = { ...(local.routeState || {}), ...remoteRoute };
          const put = await cloudRequest("PUT", { state: local }, pin);
          if (!put.ok) throw new Error(`migrate ${put.status}`);
          const saved = await put.json();
          cloudUpdatedAt = saved.updatedAt || cloudUpdatedAt;
        } else if (data.state) {
          applyCloudState(data.state);
        }
      } else if (data.state) {
        applyCloudState(data.state);
      }

      localDirty = false;
      closeSyncModal();
      setSyncStatus("云端已同步", "synced");
      showToast("跨设备同步已连接");
      startPolling();
    } catch (e) {
      err.textContent = navigator.onLine ? "连接失败，请稍后重试" : "当前离线，请联网后重试";
    }
  };

  scheduleCloudPush = function() {
    if (suppressCloudPush) return;
    localDirty = true;
    clearTimeout(pushTimer);
    clearTimeout(reconnectTimer);

    if (!cloudEnabled) {
      setSyncStatus(pinValue() ? "重新连接云端" : "需要连接云端", "syncing");
      reconnectTimer = setTimeout(() => syncFromCloud(true), RECONNECT_DELAY);
      return;
    }

    setSyncStatus("正在同步", "syncing");
    pushTimer = setTimeout(pushCloudState, 300);
  };

  pushCloudState = async function() {
    if (!cloudEnabled) {
      await syncFromCloud(true);
      return;
    }
    try {
      const res = await cloudRequest("PUT", { state: localStateSnapshot() });
      if (res.status === 401) {
        cloudEnabled = false;
        setSyncStatus("需要重新连接", "error");
        requireCloudPrompt("login");
        return;
      }
      if (!res.ok) throw new Error(`push ${res.status}`);
      const data = await res.json();
      cloudUpdatedAt = data.updatedAt || cloudUpdatedAt;
      localDirty = false;
      setSyncStatus("云端已同步", "synced");
    } catch (e) {
      setSyncStatus(navigator.onLine ? "待重试同步" : "离线·待同步", "error");
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => {
        if (navigator.onLine && localDirty) pushCloudState();
      }, 5000);
    }
  };

  pollCloud = async function() {
    if (!cloudEnabled || localDirty || document.hidden) return;
    try {
      const res = await cloudRequest("GET");
      if (res.status === 401) {
        cloudEnabled = false;
        setSyncStatus("需要重新连接", "error");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (data.updatedAt && data.updatedAt !== cloudUpdatedAt) {
        cloudUpdatedAt = data.updatedAt;
        applyCloudState(data.state || {});
        setSyncStatus("云端已更新", "synced");
        showToast("已收到另一设备更新");
      }
    } catch (_) {}
  };

  const later = document.getElementById("syncLater");
  if (later) later.style.display = "none";

  setTimeout(() => syncFromCloud(true), 0);
})();