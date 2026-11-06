const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('dailyScroll',Object.freeze({
  open:platform=>ipcRenderer.invoke('daily:open',platform),
  navigate:action=>ipcRenderer.invoke('daily:navigate',action),
  schedule:hour=>ipcRenderer.invoke('daily:schedule',hour),
  status:()=>ipcRenderer.invoke('daily:status'),
  onStatus:callback=>{const handler=(_event,value)=>callback(value);ipcRenderer.on('daily:status',handler);return()=>ipcRenderer.removeListener('daily:status',handler);}
}));
