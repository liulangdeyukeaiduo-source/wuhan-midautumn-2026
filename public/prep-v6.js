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
    body{background:linear-gradient(180deg,#f7f4ef 0,#f2efe9 60%,#ece8e0 100%)}
    .app{max-width:420px;padding-left:max(16px,env(safe-area-inset-left));padding-right:max(16px,env(safe-area-inset-right))}
    .hero{border-radius:28px;box-shadow:0 20px 48px rgba(24,60,53,.16)}
    section{margin-top:30px}
    .section-head{align-items:center;margin-bottom:9px}
    .section-title{font-size:22px;letter-spacing:-.02em}
    .section-cap{font-size:8px;letter-spacing:.16em}
    .panel{border-color:#e3ded5;box-shadow:0 8px 26px rgba(30,36,33,.055)}
    .essential-row{padding:14px 15px}
    .journey{padding:11px}
    .task-card{box-shadow:none}
    .notes-grid{gap:10px}
    .note{padding:15px}
    .dock{width:min(calc(100% - 32px),388px);bottom:max(8px,env(safe-area-inset-bottom));padding:4px;border-radius:16px;background:rgba(250,248,244,.94);box-shadow:0 10px 28px rgba(34,40,37,.10)}
    .dock a{min-height:40px;font-size:10px}
    .footer{padding-bottom:14px}

    .prep-shell{overflow:hidden;background:rgba(251,250,247,.96)}
    .prep6-add{padding:15px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#fbfaf7,#f7f4ee)}
    .prep6-add-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
    .prep6-add-title{font-size:12px;font-weight:700}
    .prep6-hint{font-size:9px;color:var(--muted)}
    .prep6-input{width:100%;min-height:46px;border:1px solid #d6d1c8;border-radius:13px;background:#fff;padding:11px 12px;font-size:16px;color:var(--ink);outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}
    .prep6-input:focus{border-color:#95a69f;box-shadow:0 0 0 3px rgba(24,60,53,.06)}
    .prep6-add-row{display:grid;grid-template-columns:1fr 72px;gap:8px;margin-top:8px}
    .prep6-add-btn{min-height:46px;border:0;border-radius:13px;background:var(--pine);color:#fff;font-size:12px;font-weight:700;box-shadow:0 7px 16px rgba(24,60,53,.12)}

    .prep6-list{padding:2px 15px}
    .prep6-item{display:grid;grid-template-columns:34px minmax(0,1fr) 34px;gap:9px;align-items:center;min-height:74px;padding:13px 0;border-bottom:1px solid #e5e0d8;transition:background .18s,transform .18s,box-shadow .18s,border-radius .18s,padding .18s;-webkit-user-select:none;user-select:none}
    .prep6-item:last-child{border-bottom:0}
    .prep6-check{appearance:none;width:24px;height:24px;margin:0;border:1.5px solid #aeb7b1;border-radius:8px;background:var(--paper);display:grid;place-items:center;transition:.16s}
    .prep6-check:checked{background:var(--pine);border-color:var(--pine)}
    .prep6-check:checked:after{content:"✓";font-size:13px;color:#fff;font-weight:800}
    .prep6-copy{min-width:0}
    .prep6-copy b{display:block;font-size:13px;line-height:1.35;font-weight:680;letter-spacing:-.01em}
    .prep6-copy small{display:block;margin-top:4px;font-size:10px;line-height:1.45;color:var(--muted);word-break:break-word}
    .prep6-item.done .prep6-copy{opacity:.42}
    .prep6-item.done .prep6-copy b{text-decoration:line-through}
    .prep6-grip{width:34px;height:44px;border:0;background:transparent;border-radius:10px;color:#a9aaa5;display:flex;align-items:center;justify-content:center;font-size:19px;letter-spacing:-.12em;touch-action:none;-webkit-touch-callout:none;user-select:none;cursor:grab}
    .prep6-grip:active{background:#efebe4;color:#767b76}
    .prep6-item.dragging{position:relative;z-index:20;background:#fffdf9;border-bottom-color:transparent;border-radius:16px;padding:13px 10px;box-shadow:0 14px 34px rgba(25,34,30,.14);transform:scale(1.015)}
    .prep6-item.dragging .prep6-grip{cursor:grabbing;color:var(--pine)}
    .prep6-dragging{overflow:hidden}
    .prep6-drag-note{display:flex;align-items:center;gap:6px;padding:8px 15px 12px;color:var(--muted);font-size:9px;border-top:1px solid rgba(225,221,213,.72)}
    .prep6-drag-note:before{content:"⋮⋮";font-size:13px;color:#a3a69f}
    .prep6-actions{display:flex;justify-content:flex-end;padding:2px 15px 11px}
    .prep6-reset{min-height:38px;border:0;background:transparent;color:var(--muted);font-size:10px}

    .prep6-modal{position:fixed;inset:0;z-index:80;display:none;align-items:flex-end;justify-content:center;background:rgba(13,18,16,.38);backdrop-filter:blur(7px);padding:14px}
    .prep6-modal.show{display:flex}
    .prep6-sheet{width:min(100%,398px);background:#fbfaf7;border:1px solid #dfdad1;border-radius:24px;padding:20px 16px calc(16px + env(safe-area-inset-bottom));box-shadow:0 28px 74px rgba(15,22,18,.28)}
    .prep6-sheet h3{margin:0;font-size:18px;letter-spacing:-.02em}
    .prep6-sheet p{margin:5px 0 14px;font-size:10px;color:var(--muted)}
    .prep6-fields{display:grid;gap:8px}
    .prep6-label{font-size:9px;color:var(--muted);margin:2px 2px -3px}
    .prep6-modal-actions{display:grid;grid-template-columns:1fr 1.45fr;gap:8px;margin-top:12px}
    .prep6-action{min-height:46px;border-radius:13px;border:1px solid #d4d0c8;background:#fff;font-size:11px}
    .prep6-action.primary{border-color:var(--pine);background:var(--pine);color:#fff}
    .prep6-action.danger{border-color:#e1cbc6;color:var(--danger);background:#fff9f7}
    .prep6-menu{padding-top:8px}
    .prep6-menu-btn{width:100%;min-height:50px;border:0;border-top:1px solid #e4dfd7;background:transparent;text-align:left;padding:0 4px;font-size:13px}
    .prep6-menu-btn:first-child{border-top:0}
    .prep6-menu-btn.danger{color:var(--danger)}
    .prep6-menu-btn.cancel{text-align:center;color:var(--muted);margin-top:6px;border-top:1px solid #e4dfd7}
  `;
  const style=document.createElement("style");
  style.textContent=css;
  document.head.appendChild(style);

  function normalizeItem(item){
    return {id:String(item&&item.id||`item-${Date.now()}-${Math.random().toString(36).slice(2,6)}`),title:String(item&&item.title||"未命名事项"),detail:String(item&&item.detail||""),deadline:String(item&&item.deadline||"")};
  }
  function migrate(raw){
    const source=raw&&typeof raw==="object"?raw:{};
    const done=source.done&&typeof source.done==="object"?{...source.done}:{};
    if(Array.isArray(source.items)) return {done,items:source.items.map(normalizeItem)};
    const custom=Array.isArray(source.custom)?source.custom.map(normalizeItem):[];
    return {done,items:[...DEFAULTS.map(normalizeItem),...custom]};
  }
  function esc(value){return String(value).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
  function meta(item){const parts=[];if(item.detail)parts.push(esc(item.detail));if(item.deadline)parts.push(esc(item.deadline));return parts.join(" · ")||"未填写备注";}

  function buildPrepShell(){
    const section=document.getElementById("prep");if(!section)return;
    section.innerHTML=`<div class="section-head"><h2 class="section-title">行前准备</h2><div class="section-cap">SMART CHECKLIST</div></div><div class="panel prep-shell"><div class="prep6-add"><div class="prep6-add-head"><div class="prep6-add-title">新增准备事项</div><div class="prep6-hint">随时可编辑</div></div><input class="prep6-input" id="prep6Title" maxlength="60" placeholder="例如：下载武汉离线地图"><div class="prep6-add-row"><input class="prep6-input" id="prep6Deadline" maxlength="60" placeholder="时间 / 备注（可选）"><button class="prep6-add-btn" id="prep6Add" type="button">添加</button></div></div><div class="prep6-list" id="prep6List"></div><div class="prep6-drag-note">长按右侧手柄后拖动，即可调整顺序；轻点手柄可编辑或删除</div><div class="prep6-actions"><button class="prep6-reset" id="prep6Reset" type="button">撤销全部完成状态</button></div></div>`;
  }

  function buildModals(){
    const editor=document.createElement("div");editor.className="prep6-modal";editor.id="prep6Editor";editor.setAttribute("aria-hidden","true");editor.innerHTML=`<div class="prep6-sheet"><h3>编辑准备事项</h3><p>修改后会自动同步到其他设备。</p><div class="prep6-fields"><div class="prep6-label">事项名称</div><input class="prep6-input" id="prep6EditTitle" maxlength="60" placeholder="事项名称"><div class="prep6-label">说明</div><input class="prep6-input" id="prep6EditDetail" maxlength="120" placeholder="说明（可选）"><div class="prep6-label">时间 / 截止日期</div><input class="prep6-input" id="prep6EditDeadline" maxlength="40" placeholder="例如：9/24 或 出发前"></div><div class="prep6-modal-actions"><button class="prep6-action" id="prep6EditCancel" type="button">取消</button><button class="prep6-action primary" id="prep6EditSave" type="button">保存修改</button></div></div>`;document.body.appendChild(editor);
    const menu=document.createElement("div");menu.className="prep6-modal";menu.id="prep6Menu";menu.setAttribute("aria-hidden","true");menu.innerHTML=`<div class="prep6-sheet"><h3 id="prep6MenuTitle">准备事项</h3><p>轻点操作；长按列表右侧手柄可以直接拖动排序。</p><div class="prep6-menu"><button class="prep6-menu-btn" id="prep6MenuEdit" type="button">编辑事项</button><button class="prep6-menu-btn danger" id="prep6MenuDelete" type="button">删除事项</button><button class="prep6-menu-btn cancel" id="prep6MenuCancel" type="button">取消</button></div></div>`;document.body.appendChild(menu);
  }

  prepState=migrate(prepState);localStorage.setItem(PREP_STORE,JSON.stringify(prepState));buildPrepShell();buildModals();
  let editingId="",menuId="",dragRow=null,dragTimer=null,dragPointerId=null,dragStarted=false,downX=0,downY=0;

  function persistOrderFromDom(){const ids=[...document.querySelectorAll("#prep6List .prep6-item")].map(el=>el.dataset.id);const byId=new Map(prepState.items.map(item=>[item.id,item]));prepState.items=ids.map(id=>byId.get(id)).filter(Boolean);savePrep();}
  function render(){
    const list=document.getElementById("prep6List");if(!list)return;
    list.innerHTML=(prepState.items||[]).map(item=>{const done=!!prepState.done[item.id];return `<div class="prep6-item ${done?"done":""}" data-id="${esc(item.id)}"><input class="prep6-check" type="checkbox" ${done?"checked":""} aria-label="完成 ${esc(item.title)}"><div class="prep6-copy"><b>${esc(item.title)}</b><small>${meta(item)}</small></div><button class="prep6-grip" type="button" aria-label="长按拖动，轻点更多操作">⋮⋮</button></div>`;}).join("");
    list.querySelectorAll(".prep6-check").forEach(cb=>cb.addEventListener("change",e=>{const row=e.target.closest(".prep6-item");prepState.done[row.dataset.id]=e.target.checked;row.classList.toggle("done",e.target.checked);savePrep();showToast(e.target.checked?"准备项已完成":"已恢复准备项");}));
    list.querySelectorAll(".prep6-grip").forEach(grip=>{grip.addEventListener("pointerdown",beginPress,{passive:false});grip.addEventListener("pointermove",movePress,{passive:false});grip.addEventListener("pointerup",endPress,{passive:false});grip.addEventListener("pointercancel",cancelPress,{passive:false});grip.addEventListener("contextmenu",e=>e.preventDefault());});
  }

  function beginPress(e){if(e.button!==undefined&&e.button!==0)return;e.preventDefault();dragRow=e.currentTarget.closest(".prep6-item");dragPointerId=e.pointerId;downX=e.clientX;downY=e.clientY;dragStarted=false;try{e.currentTarget.setPointerCapture(e.pointerId)}catch(_){}clearTimeout(dragTimer);dragTimer=setTimeout(()=>{if(!dragRow)return;dragStarted=true;dragRow.classList.add("dragging");document.body.classList.add("prep6-dragging");if(navigator.vibrate)navigator.vibrate(12);},360);}
  function movePress(e){if(!dragRow||e.pointerId!==dragPointerId)return;const dx=e.clientX-downX,dy=e.clientY-downY;if(!dragStarted&&Math.hypot(dx,dy)>10){clearTimeout(dragTimer);return;}if(!dragStarted)return;e.preventDefault();const list=document.getElementById("prep6List");const siblings=[...list.querySelectorAll(".prep6-item:not(.dragging)")];const after=siblings.find(el=>{const r=el.getBoundingClientRect();return e.clientY<r.top+r.height/2;});if(after)list.insertBefore(dragRow,after);else list.appendChild(dragRow);}
  function endPress(e){if(!dragRow||e.pointerId!==dragPointerId)return;e.preventDefault();clearTimeout(dragTimer);const row=dragRow;const wasDragging=dragStarted;cleanupDrag();if(wasDragging){persistOrderFromDom();render();showToast("顺序已更新");}else{const moved=Math.hypot(e.clientX-downX,e.clientY-downY)>10;if(!moved)openMenu(row.dataset.id);}}
  function cancelPress(e){if(e.pointerId!==dragPointerId)return;clearTimeout(dragTimer);if(dragStarted&&dragRow){persistOrderFromDom();render();}cleanupDrag();}
  function cleanupDrag(){if(dragRow)dragRow.classList.remove("dragging");document.body.classList.remove("prep6-dragging");dragRow=null;dragPointerId=null;dragStarted=false;}

  function addItem(){const title=document.getElementById("prep6Title").value.trim(),note=document.getElementById("prep6Deadline").value.trim();if(!title){showToast("先填写准备事项");return;}const id=`custom-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;prepState.items.push({id,title,detail:"",deadline:note});prepState.done[id]=false;savePrep();document.getElementById("prep6Title").value="";document.getElementById("prep6Deadline").value="";render();showToast("已添加准备事项");}
  function openMenu(id){const item=prepState.items.find(x=>x.id===id);if(!item)return;menuId=id;document.getElementById("prep6MenuTitle").textContent=item.title;const modal=document.getElementById("prep6Menu");modal.classList.add("show");modal.setAttribute("aria-hidden","false");}
  function closeMenu(){const modal=document.getElementById("prep6Menu");modal.classList.remove("show");modal.setAttribute("aria-hidden","true");menuId="";}
  function openEditor(id){const item=prepState.items.find(x=>x.id===id);if(!item)return;editingId=id;document.getElementById("prep6EditTitle").value=item.title;document.getElementById("prep6EditDetail").value=item.detail||"";document.getElementById("prep6EditDeadline").value=item.deadline||"";closeMenu();const modal=document.getElementById("prep6Editor");modal.classList.add("show");modal.setAttribute("aria-hidden","false");setTimeout(()=>document.getElementById("prep6EditTitle").focus(),120);}
  function closeEditor(){const modal=document.getElementById("prep6Editor");modal.classList.remove("show");modal.setAttribute("aria-hidden","true");editingId="";}
  function saveEditor(){const item=prepState.items.find(x=>x.id===editingId);if(!item)return;const title=document.getElementById("prep6EditTitle").value.trim();if(!title){showToast("事项名称不能为空");return;}item.title=title;item.detail=document.getElementById("prep6EditDetail").value.trim();item.deadline=document.getElementById("prep6EditDeadline").value.trim();savePrep();render();closeEditor();showToast("已保存修改");}
  function deleteItem(id){if(!id)return;prepState.items=prepState.items.filter(x=>x.id!==id);delete prepState.done[id];savePrep();render();closeMenu();showToast("已删除");}

  renderPrep=render;
  getSyncState=function(){return {routeState:{...routeState},prepState:{done:{...(prepState.done||{})},items:(prepState.items||[]).map(item=>({...item}))}};};
  applyCloudState=function(state){if(!state||typeof state!=="object")return;suppressCloudPush=true;routeState=state.routeState&&typeof state.routeState==="object"?state.routeState:{};prepState=migrate(state.prepState&&typeof state.prepState==="object"?state.prepState:{});localStorage.setItem(ROUTE_STORE,JSON.stringify(routeState));localStorage.setItem(PREP_STORE,JSON.stringify(prepState));renderDay(activeDay);render();suppressCloudPush=false;};

  document.getElementById("prep6Add").addEventListener("click",addItem);document.getElementById("prep6Title").addEventListener("keydown",e=>{if(e.key==="Enter")addItem();});document.getElementById("prep6Deadline").addEventListener("keydown",e=>{if(e.key==="Enter")addItem();});document.getElementById("prep6Reset").addEventListener("click",()=>{prepState.done={};savePrep();render();showToast("已撤销全部完成状态");});document.getElementById("prep6MenuEdit").addEventListener("click",()=>openEditor(menuId));document.getElementById("prep6MenuDelete").addEventListener("click",()=>deleteItem(menuId));document.getElementById("prep6MenuCancel").addEventListener("click",closeMenu);document.getElementById("prep6EditCancel").addEventListener("click",closeEditor);document.getElementById("prep6EditSave").addEventListener("click",saveEditor);["prep6EditTitle","prep6EditDetail","prep6EditDeadline"].forEach(id=>{document.getElementById(id).addEventListener("keydown",e=>{if(e.key==="Enter")saveEditor();});});document.getElementById("prep6Menu").addEventListener("click",e=>{if(e.target.id==="prep6Menu")closeMenu();});document.getElementById("prep6Editor").addEventListener("click",e=>{if(e.target.id==="prep6Editor")closeEditor();});
  const footer=document.querySelector(".footer");if(footer)footer.innerHTML="WUHAN MID-AUTUMN JOURNEY · V6<br>行程以实时路况、景区与轮渡官方信息为准。";
  render();
})();
