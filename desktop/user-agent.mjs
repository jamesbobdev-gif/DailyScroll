// Google and other providers restrict sign-in when the browser identifies itself as an
// embedded app. The social view is a normal Chromium, so present it as the Chrome it is.
export function browserUserAgent(userAgent,appName=''){
  let ua=String(userAgent||'');
  if(appName)ua=ua.replace(new RegExp(' '+appName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/\\S+'),'');
  return ua.replace(/ Electron\/\S+/,'').replace(/\s{2,}/g,' ').trim();
}
