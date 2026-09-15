(() => {
  const DEFAULTS = [
    {id:"museum",title:"预约 9/26 湖北省博物馆",detail:"目标 09:00—10:00 入馆；实名预约，携带证件原件。",deadline:"9/21 17:18"},
    {id:"ccnu",title:"复核华师中秋入校规则",detail:"确认社会公众步行入校是否有临时调整。",deadline:"9/22—24"},
    {id:"tower",title:"复核黄鹤楼节日售票",detail:"大型节假日是否切换分时售票，以官方公告为准。",deadline:"9/23—24"},
    {id:"ferry",title:"复核武中线轮渡公告",detail:"重点看预约、限流、停航和码头调整。",deadline:"9/24"},
    {id:"weather",title:"查看武汉逐小时天气",detail:"决定雨具、防晒、薄外套，以及是否保留东湖。",deadline:"9/22—24"},
    {id:"flight",title:"保存电子登机牌 / 订单截图",detail:"确保两人航班、酒店与预约信息离线可查看。",deadline:"出发前"}
  ];

  const css = `
    .prep5-list{padding:2px 14px}.prep5-item{display:grid;grid-template-columns:34px 1fr;gap:8px;align-items:start;padding:13px 0;border-bottom:1px solid var(--line)}.prep5-item:last-child{border-bottom:0}
    .prep5-check{appearance:none;width:24px;height:24px;margin:2px 0 0;border:1.5px solid #b6bdb8;border-radius:7px;background:var(--paper);display:grid;place-items:center}.prep5-check:checked{background:var(--pine);border-color:var(--pine)}.prep5-check:checked:after{content:"✓";font-size:13px;color:#fff;font-weight:800}
    .prep5-item.done .prep5-copy{opacity:.46;text-decoration:line-through}.prep5-copy b{display:block;font-size:12px}.prep5-copy small{display:block;margin-top:3px;font-size:10px;color:var(--muted)}
    .prep5-actions{display:grid;grid-template-columns:1.25fr .75fr .75fr 1fr;gap:5px;margin-top:9px}.prep5-btn{min-height:36px;border:1px solid #d8d4cc;border-radius:9px;background:#fff;color:var(--muted);font-size:10px;padding:0 7px}.prep5-btn:active{background:#eeeae3}.prep5-btn.danger{color:var(--danger)}.prep5-btn:disabled{opacity:.28}
    .prep5-modal{position:fixed;inset:0;z-index:70;display:none;align-items:flex-end;justify-content:center;background:rgba(14,20,17,.42);backdrop-filter:blur(6px);padding:14px}.prep5-modal.show{display:flex}.prep5-sheet{width:min(100%,406px);background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:19px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 26px 70px rgba(16,24,20,.28)}
    .prep5-sheet h3{margin:0;font-size:18px}.prep5-sheet p{margin:6px 0 14px;font-size:11px;color:var(--muted)}.prep5-fields{display:grid;gap:8px}.prep5-label{font-size:9px;color:var(--muted);margin-bottom:-3px}.prep5-input{width:100%;min-height:46px;border:1px solid #d2cec6;border-radius:12px;background:#fff;padding:10px 11px;font-size:16px;color:var(--ink);outline:none}.prep5-input:focus{border-color:#8ea298;box-shadow:0 0 0 3px rgba(24,60,53,.07)}
    .prep5-modal-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:8px;margin-top:12px}.prep5-action{min-height:44px;border-radius:12px;border:1px solid #d4d0c8;background:#fff;font-size:11px}.prep5-action.primary{border-color:var(--pine);background:var(--pine);color:#fff}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  function normalizeItem(item) {
    return {
      id: String(item && item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`),
      title: String(item && item.title || "未命名事项"),
      detail: String(item && item.detail || ""),
      deadline: String(item && item.deadline || "")
    };
  }

  function migrate(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const done = source.done && typeof source.done === "object" ? {...source.done} : {};
    if (Array.isArray(source.items)) return {done, items: source.items.map(normalizeItem)};
    const custom = Array.isArray(source.custom) ? source.custom.map(normalizeItem) : [];
    return {done, items: [...DEFAULTS.map(normalizeItem), ...custom]};
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  }

  function meta(item) {
    const bits = [];
    if (item.detail) bits.push(escapeHtml(item.detail));
    if (item.deadline) bits.push(escapeHtml(item.deadline));
    return bits.join(" · ") || "未填写备注";
  }

  function buildPrepShell() {
    const section = document.getElementById("prep");
    if (!section) return;
    section.innerHTML = `
      <div class="section-head"><h2 class="section-title">行前准备</h2><div class="section-cap">EDITABLE CHECKLIST</div></div>
      <div class="panel prep-shell">
        <div class="prep-add">
          <div class="prep-add-title">新增准备事项</div>
          <input class="prep-input" id="prepTitle" maxlength="60" placeholder="例如：下载武汉离线地图">
          <div class="prep-add-row"><input class="prep-input" id="prepDeadline" maxlength="30" placeholder="时间/备注（可选）"><button class="add-btn" id="addPrep">添加</button></div>
        </div>
        <div class="prep5-list" id="prepList"></div>
        <div class="prep-actions"><button class="text-btn" id="resetPrep">撤销全部完成状态</button></div>
      </div>`;
  }

  function buildEditor() {
    if (document.getElementById("prep5Modal")) return;
    const modal = document.createElement("div");
    modal.className = "prep5-modal";
    modal.id = "prep5Modal";
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `
      <div class="prep5-sheet">
        <h3>编辑准备事项</h3>
        <p>名称、说明和时间都可以修改；保存后会同步到其他设备。</p>
        <div class="prep5-fields">
          <div class="prep5-label">事项名称</div><input class="prep5-input" id="prep5Title" maxlength="60" placeholder="事项名称">
          <div class="prep5-label">说明</div><input class="prep5-input" id="prep5Detail" maxlength="120" placeholder="说明（可选）">
          <div class="prep5-label">时间 / 截止日期</div><input class="prep5-input" id="prep5Deadline" maxlength="30" placeholder="例如：9/24 或 出发前">
        </div>
        <div class="prep5-modal-actions"><button class="prep5-action" id="prep5Cancel" type="button">取消</button><button class="prep5-action primary" id="prep5Save" type="button">保存修改</button></div>
      </div>`;
    document.body.appendChild(modal);
  }

  prepState = migrate(prepState);
  localStorage.setItem(PREP_STORE, JSON.stringify(prepState));
  buildPrepShell();
  buildEditor();

  let editingId = "";

  function renderV5() {
    const items = prepState.items || [];
    const list = document.getElementById("prepList");
    if (!list) return;
    list.innerHTML = items.map((item, i) => {
      const done = !!prepState.done[item.id];
      return `<div class="prep5-item ${done ? "done" : ""}" data-id="${escapeHtml(item.id)}">
        <input class="prep5-check" type="checkbox" ${done ? "checked" : ""} aria-label="完成 ${escapeHtml(item.title)}">
        <div><div class="prep5-copy"><b>${escapeHtml(item.title)}</b><small>${meta(item)}</small></div>
          <div class="prep5-actions">
            <button class="prep5-btn" data-edit="${escapeHtml(item.id)}">编辑</button>
            <button class="prep5-btn" data-move="-1" data-id="${escapeHtml(item.id)}" ${i === 0 ? "disabled" : ""}>↑</button>
            <button class="prep5-btn" data-move="1" data-id="${escapeHtml(item.id)}" ${i === items.length - 1 ? "disabled" : ""}>↓</button>
            <button class="prep5-btn danger" data-delete="${escapeHtml(item.id)}">删除</button>
          </div>
        </div>
      </div>`;
    }).join("");

    list.querySelectorAll(".prep5-check").forEach(cb => cb.addEventListener("change", event => {
      const row = event.target.closest(".prep5-item");
      prepState.done[row.dataset.id] = event.target.checked;
      row.classList.toggle("done", event.target.checked);
      savePrep();
      showToast(event.target.checked ? "准备项已完成" : "已恢复准备项");
    }));
    list.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openEditor(btn.dataset.edit)));
    list.querySelectorAll("[data-move]").forEach(btn => btn.addEventListener("click", () => moveItem(btn.dataset.id, Number(btn.dataset.move))));
    list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => deleteItem(btn.dataset.delete)));
  }

  function addItem() {
    const title = document.getElementById("prepTitle").value.trim();
    const deadline = document.getElementById("prepDeadline").value.trim();
    if (!title) { showToast("先填写准备事项"); return; }
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    prepState.items.push({id, title, detail:"", deadline});
    prepState.done[id] = false;
    savePrep();
    document.getElementById("prepTitle").value = "";
    document.getElementById("prepDeadline").value = "";
    renderV5();
    showToast("已添加准备事项");
  }

  function moveItem(id, delta) {
    const i = prepState.items.findIndex(x => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= prepState.items.length) return;
    [prepState.items[i], prepState.items[j]] = [prepState.items[j], prepState.items[i]];
    savePrep();
    renderV5();
    showToast(delta < 0 ? "已上移" : "已下移");
  }

  function deleteItem(id) {
    const item = prepState.items.find(x => x.id === id);
    if (!item) return;
    if (!confirm(`删除“${item.title}”？`)) return;
    prepState.items = prepState.items.filter(x => x.id !== id);
    delete prepState.done[id];
    savePrep();
    renderV5();
    showToast("已删除");
  }

  function openEditor(id) {
    const item = prepState.items.find(x => x.id === id);
    if (!item) return;
    editingId = id;
    document.getElementById("prep5Title").value = item.title;
    document.getElementById("prep5Detail").value = item.detail || "";
    document.getElementById("prep5Deadline").value = item.deadline || "";
    const modal = document.getElementById("prep5Modal");
    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => document.getElementById("prep5Title").focus(), 100);
  }

  function closeEditor() {
    const modal = document.getElementById("prep5Modal");
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    editingId = "";
  }

  function saveEditor() {
    const item = prepState.items.find(x => x.id === editingId);
    if (!item) return;
    const title = document.getElementById("prep5Title").value.trim();
    if (!title) { showToast("事项名称不能为空"); return; }
    item.title = title;
    item.detail = document.getElementById("prep5Detail").value.trim();
    item.deadline = document.getElementById("prep5Deadline").value.trim();
    savePrep();
    renderV5();
    closeEditor();
    showToast("已保存修改");
  }

  renderPrep = renderV5;
  getSyncState = function() {
    return {
      routeState: {...routeState},
      prepState: {
        done: {...(prepState.done || {})},
        items: (prepState.items || []).map(item => ({...item}))
      }
    };
  };
  applyCloudState = function(state) {
    if (!state || typeof state !== "object") return;
    suppressCloudPush = true;
    routeState = state.routeState && typeof state.routeState === "object" ? state.routeState : {};
    prepState = migrate(state.prepState && typeof state.prepState === "object" ? state.prepState : {});
    localStorage.setItem(ROUTE_STORE, JSON.stringify(routeState));
    localStorage.setItem(PREP_STORE, JSON.stringify(prepState));
    renderDay(activeDay);
    renderV5();
    suppressCloudPush = false;
  };

  document.getElementById("addPrep").addEventListener("click", addItem);
  document.getElementById("prepTitle").addEventListener("keydown", e => { if (e.key === "Enter") addItem(); });
  document.getElementById("prepDeadline").addEventListener("keydown", e => { if (e.key === "Enter") addItem(); });
  document.getElementById("resetPrep").addEventListener("click", () => {
    prepState.done = {};
    savePrep();
    renderV5();
    showToast("已撤销全部完成状态");
  });
  document.getElementById("prep5Cancel").addEventListener("click", closeEditor);
  document.getElementById("prep5Save").addEventListener("click", saveEditor);
  ["prep5Title","prep5Detail","prep5Deadline"].forEach(id => document.getElementById(id).addEventListener("keydown", e => { if (e.key === "Enter") saveEditor(); }));

  renderV5();
})();
