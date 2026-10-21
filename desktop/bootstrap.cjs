const {app,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const log=path.join(app.getPath('userData'),'startup.log');
fs.mkdirSync(path.dirname(log),{recursive:true});
function record(error){fs.appendFileSync(log,new Date().toISOString()+' '+String(error?.stack||error)+'\n');}
process.on('uncaughtException',error=>{record(error);dialog.showErrorBox('Daily Scroll could not start',error.message);app.exit(1);});
process.on('unhandledRejection',error=>{record(error);dialog.showErrorBox('Daily Scroll could not start',error?.message||String(error));app.exit(1);});
record('Starting Daily Scroll');
import('./main.mjs').catch(error=>{record(error);dialog.showErrorBox('Daily Scroll could not start',error.message);app.exit(1);});
