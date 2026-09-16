(() => {
  const PIN_KEY = "wuhan-trip-2026-sync-pin-v10";
  const OLD_KEYS = ["wuhan-trip-2026-sync-pin-v1","wuhan-trip-2026-sync-pin-v9"];
  const TIMEOUT_MS = 5000;
  const POLL_MS = 10000;
  let mode = "login";
  let pollHandle = null;
  let pushHandle = null;
  let connecting = false;
  let lastUpdatedAt = "";

  function replaceNode(id){
    const old=document.getElementById(id);
    if(!old) return null;
    const neo=old.cloneNode(true);
    old.replaceWith(neo);
    return neo;
  }

  // Remove every listener left by older sync generations.
  replaceNode("syncStatus");
  replaceNode("syncModal");

  const statusEl=document.getElementById("syncStatus");
  const modal=document.getElementById("syncModal");

  // V10 deliberately starts a fresh credential cycle once on each old browser.
  for(const key of OLD_KEYS){try{localStorage.removeItem(key)}catch(_){}}

  function setStatus(text,state="syncing"){
    if(!statusEl) return;
    statusEl.textContent=text;
    statusEl.className=`sync-pill ${state}`;
  }

  function getPin(){
    try{
      const pin=localStorage.getItem(PIN_KEY)||"";
      if(!/^\d{4,12}$/.test(pin)){
        if(pin) localStorage.removeItem(PIN_KEY);
        return "";
      }
      return pin;
    }catch(_){return ""}
  }
  function savePin(pin){try{localStorage.setItem(PIN_KEY,pin)}catch(_){}}
  function clearPin(){try{localStorage.removeItem(PIN_KEY)}catch(_){}}

  function parts(){return {
    title:document.getElementById("syncModalTitle"),
    desc:document.getElementById("syncModalDesc"),
    input:document.getElementById("syncPinInput"),
    error:document.getElementById("syncError"),
    submit:document.getElementById("syncSubmit"),
    later:document.getElementById("syncLater")
  }}

  function openModal(nextMode,message=""){
    mode=nextMode;
    if(!modal) return;
    const p=parts();
    if(p.later) p.later.style.display="none";
    if(p.input) p.input.value="";
    if(p.error) p.error.textContent=message;
    if(nextMode==="setup"){
      if(p.title) p.title.textContent="设置跨设备同步";
      if(p.desc) p.desc.textContent="设置一个 4—12 位数字 PIN。当前设备数据会写入云端，其他设备使用同一 PIN。";
      if(p.submit) p.submit.textContent="设置 PIN 并同步";
    }else{
      if(p.title) p.title.textContent="连接云端数据";
      if(p.desc) p.desc.textContent="请输入原来的同步 PIN。只有验证成功后，本设备才会进入云端同步模式。";
      if(p.submit) p.submit.textContent="验证 PIN 并同步";
    }
    modal.classList.add("show");
    modal.setAttribute("aria-hidden","false");
    document.documentElement.classList.add("sync-modal-open");
    setTimeout(()=>p.input&&p.input.focus(),120);
  }

  function closeModal(){
    if(!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden","true");
    document.documentElement.classList.remove("sync-modal-open");
  }

  async function api(method,{pin="",body=null}={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{
      const headers={"Content-Type":"application/json","Cache-Control":"no-store","Pragma":"no-cache"};
      if(pin) headers["X-Trip-Pin"]=pin;
      return await fetch(`/api/state?_=${Date.now()}`,{
        method,headers,body:body?JSON.stringify(body):undefined,cache:"no-store",signal:controller.signal
      });
    }finally{clearTimeout(timer)}
  }

  function applyRemote(data,toast=false){
    if(data&&data.state) applyCloudState(data.state);
    cloudEnabled=true;
    localDirty=false;
    lastUpdatedAt=data?.updatedAt||lastUpdatedAt||"";
    cloudUpdatedAt=lastUpdatedAt;
    setStatus("云端已同步","synced");
    closeModal();
    startPollingV10();
    if(toast) showToast("跨设备同步已连接");
  }

  async function bootstrap(forcePrompt=true){
    if(connecting) return;
    const pin=getPin();
    if(!pin){
      cloudEnabled=false;
      setStatus("需要输入 PIN","error");
      if(forcePrompt) openModal("login");
      return;
    }

    connecting=true;
    setStatus("正在连接云端","syncing");
    try{
      const res=await api("GET",{pin});
      if(res.ok){applyRemote(await res.json());return}
      if(res.status===401){
        clearPin();cloudEnabled=false;setStatus("需要重新输入 PIN","error");
        if(forcePrompt) openModal("login","保存的 PIN 已失效，请重新输入。");
        return;
      }
      if(res.status===428){
        clearPin();cloudEnabled=false;setStatus("需要设置 PIN","error");
        if(forcePrompt) openModal("setup");
        return;
      }
      throw new Error(`GET ${res.status}`);
    }catch(err){
      cloudEnabled=false;
      setStatus(navigator.onLine?"云端响应超时·点此重试":"离线·待同步","error");
      if(forcePrompt&&navigator.onLine) openModal("login","云端连接未完成。请输入 PIN 重新连接；若仍失败，请稍后再试。");
    }finally{connecting=false}
  }

  async function submitPin(){
    const p=parts();
    const pin=(p.input?.value||"").trim();
    if(!/^\d{4,12}$/.test(pin)){if(p.error)p.error.textContent="请输入 4—12 位数字 PIN";return}
    if(p.error)p.error.textContent="正在验证 PIN…";
    if(p.submit)p.submit.disabled=true;
    try{
      let res;
      if(mode==="setup"){
        res=await api("POST",{pin,body:{action:"setup",pin,state:getSyncState()}});
        if(res.status===409){
          mode="login";
          if(p.error)p.error.textContent="云端已经设置过 PIN，请输入原有 PIN。";
          if(p.submit)p.submit.textContent="验证 PIN 并同步";
          return;
        }
      }else{
        res=await api("GET",{pin});
      }

      if(res.status===401){clearPin();if(p.error)p.error.textContent="PIN 不正确，请重新输入。";return}
      if(res.status===428){mode="setup";if(p.error)p.error.textContent="云端尚未初始化，请设置一个新 PIN。";if(p.submit)p.submit.textContent="设置 PIN 并同步";return}
      if(res.status===503){if(p.error)p.error.textContent="云端数据库暂未连接。";return}
      if(!res.ok){if(p.error)p.error.textContent=`连接失败（${res.status}），请重试。`;return}

      savePin(pin);
      applyRemote(await res.json(),true);
    }catch(err){
      if(p.error)p.error.textContent=navigator.onLine?"云端响应超时，请再试一次。":"当前离线，请联网后重试。";
      setStatus(navigator.onLine?"云端响应超时":"离线·待同步","error");
    }finally{if(p.submit)p.submit.disabled=false}
  }

  async function pushNow(){
    const pin=getPin();
    if(!pin){cloudEnabled=false;setStatus("需要输入 PIN","error");openModal("login");return}
    try{
      const res=await api("PUT",{pin,body:{state:getSyncState()}});
      if(res.status===401){clearPin();cloudEnabled=false;setStatus("需要重新输入 PIN","error");openModal("login","同步凭证已失效，请重新输入 PIN。");return}
      if(!res.ok) throw new Error(`PUT ${res.status}`);
      const data=await res.json();
      cloudEnabled=true;localDirty=false;lastUpdatedAt=data.updatedAt||lastUpdatedAt;cloudUpdatedAt=lastUpdatedAt;
      setStatus("云端已同步","synced");
      startPollingV10();
    }catch(_){
      cloudEnabled=false;
      setStatus(navigator.onLine?"待重试同步":"离线·待同步","error");
      clearTimeout(pushHandle);
      pushHandle=setTimeout(()=>{if(navigator.onLine)pushNow()},6000);
    }
  }

  async function pullLatest(){
    if(document.hidden||localDirty) return;
    const pin=getPin();
    if(!pin){cloudEnabled=false;setStatus("需要输入 PIN","error");return}
    try{
      const res=await api("GET",{pin});
      if(res.status===401){clearPin();cloudEnabled=false;setStatus("需要重新输入 PIN","error");openModal("login");return}
      if(!res.ok) return;
      const data=await res.json();
      cloudEnabled=true;
      if(data.updatedAt&&data.updatedAt!==lastUpdatedAt){
        lastUpdatedAt=data.updatedAt;cloudUpdatedAt=lastUpdatedAt;applyCloudState(data.state||{});localDirty=false;
        setStatus("云端已更新","synced");showToast("已收到另一设备更新");
      }else setStatus("云端已同步","synced");
    }catch(_){setStatus(navigator.onLine?"云端暂不可用":"离线·待同步","error")}
  }

  function startPollingV10(){if(!pollHandle)pollHandle=setInterval(pullLatest,POLL_MS)}

  syncFromCloud=bootstrap;
  setupOrLogin=submitPin;
  scheduleCloudPush=function(){
    if(suppressCloudPush)return;
    localDirty=true;
    setStatus(navigator.onLine?"正在同步":"离线·待同步","syncing");
    clearTimeout(pushHandle);
    pushHandle=setTimeout(pushNow,320);
  };
  pushCloudState=pushNow;
  pollCloud=pullLatest;
  startPolling=startPollingV10;

  try{
    if(pollTimer){clearInterval(pollTimer);pollTimer=null}
    if(pushTimer){clearTimeout(pushTimer);pushTimer=null}
  }catch(_){}

  statusEl?.addEventListener("click",()=>cloudEnabled?pullLatest():bootstrap(true));
  document.getElementById("syncSubmit")?.addEventListener("click",submitPin);
  document.getElementById("syncPinInput")?.addEventListener("keydown",e=>{if(e.key==="Enter")submitPin()});
  document.getElementById("syncLater")?.addEventListener("click",e=>{e.preventDefault();openModal(mode)});

  window.addEventListener("online",()=>localDirty?pushNow():bootstrap(false));
  window.addEventListener("pageshow",()=>setTimeout(()=>bootstrap(true),80));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)setTimeout(()=>bootstrap(true),80)});

  // Watchdog: the UI may never remain in a verifying state indefinitely.
  setInterval(()=>{
    if(!navigator.onLine) return;
    if(!cloudEnabled&&!modal?.classList.contains("show")&&!connecting){
      const pin=getPin();
      if(pin) bootstrap(true); else openModal("login");
    }
  },3000);

  // V10 rule: if this browser has not completed V10 verification, PIN is shown immediately.
  if(getPin()) bootstrap(true);
  else {setStatus("需要输入 PIN","error");openModal("login")}
})();