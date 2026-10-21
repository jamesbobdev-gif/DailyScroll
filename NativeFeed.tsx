import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,BackHandler,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {WebView} from 'react-native-webview';
import {nativePlatforms,allowedNativeNavigation,nativeAllowance} from './native-platforms.mjs';
export type NativePlatform=keyof typeof nativePlatforms;
export type NativeBudget={remaining:number;allowedUntil:number;now:number;open:boolean;testingMode?:boolean;elapsed?:number};
type Props={platform:NativePlatform;requestBudget:(route:'start'|'pulse'|'stop',platform:NativePlatform)=>Promise<NativeBudget>;onClose:()=>void};
export default function NativeFeed({platform,requestBudget,onClose}:Props){
  const [tab,setTab]=useState(0),[running,setRunning]=useState(true),[budget,setBudget]=useState<NativeBudget|null>(null),[stamp,setStamp]=useState(0),[now,setNow]=useState(Date.now()),[error,setError]=useState('');
  const [hasPage,setHasPage]=useState(false),[backgrounded,setBackgrounded]=useState(false);
  const pendingStop=useRef<Promise<unknown>>(Promise.resolve());
  const foreground=useRef(AppState.currentState==='active');
  const [connectionAttempt,setConnectionAttempt]=useState(0);
  const config=nativePlatforms[platform];
  const [currentHost,setCurrentHost]=useState(config.host);
  const browser=useRef<WebView<{}>>(null),lastRemaining=useRef<number|null>(null);
  const stop=()=>{browser.current?.injectJavaScript("document.querySelectorAll('video,audio').forEach(media=>media.pause());true;");setRunning(false);setBudget(null);pendingStop.current=requestBudget('stop',platform).catch(()=>{});};
  useEffect(()=>{const sub=BackHandler.addEventListener('hardwareBackPress',()=>{stop();onClose();return true;});return()=>sub.remove();},[platform,onClose,requestBudget]);
  // Preserve the sign-in page through autofill, biometrics, and password-manager app switches.
  useEffect(()=>{const sub=AppState.addEventListener('change',status=>{
    if(status==='background'){
      foreground.current=false;
      browser.current?.injectJavaScript("document.querySelectorAll('video,audio').forEach(media=>media.pause());true;");
      setBackgrounded(true);setBudget(null);
      pendingStop.current=requestBudget('stop',platform).catch(()=>{});
    }else if(status==='active'){foreground.current=true;setBudget(null);setBackgrounded(false);setConnectionAttempt(value=>value+1);}
  });return()=>sub.remove();},[platform,requestBudget]);
  useEffect(()=>{
    if(!running||backgrounded)return;let cancelled=false,busy=false;let renew:ReturnType<typeof setInterval>|undefined;
    const accept=(me:NativeBudget)=>{if(cancelled||!foreground.current)return;if(!me.open||nativeAllowance(me,0)<=0)throw Error('Your daily hour is closed.');setStamp(Date.now());setNow(Date.now());setBudget(me);setHasPage(true);};
    const fail=(e:Error)=>{if(cancelled||!foreground.current)return;if(renew)clearInterval(renew);setError(e.message);if(e.message==='Your daily hour is closed.'){stop();return;}setBudget(null);renew=setTimeout(()=>{if(!cancelled&&foreground.current)setConnectionAttempt(value=>value+1);},1500);};
    setError('');setBudget(null);
    pendingStop.current.then(()=>cancelled?null:requestBudget('start',platform)).then(me=>{if(cancelled||!me)return;accept(me);renew=setInterval(()=>{if(cancelled||busy||!foreground.current)return;busy=true;requestBudget('pulse',platform).then(accept).catch(fail).finally(()=>{busy=false;});},5000);}).catch(fail);
    return()=>{cancelled=true;if(renew){clearInterval(renew);clearTimeout(renew);}};
  },[platform,running,backgrounded,connectionAttempt,requestBudget]);
  useEffect(()=>{const tick=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(tick);},[]);
  const allowance=budget?nativeAllowance(budget,Math.max(0,now-stamp)):0;
  useEffect(()=>{if(running&&budget&&allowance<=0&&foreground.current){setBudget(null);setConnectionAttempt(value=>value+1);}},[allowance,running,budget]);
  const remaining=budget?Math.max(0,budget.remaining-Math.max(0,now-stamp)):lastRemaining.current;
  if(budget)lastRemaining.current=remaining;
  const seconds=budget?.testingMode?Math.floor(((budget.elapsed||0)+Math.max(0,now-stamp))/1000):Math.ceil((remaining||0)/1000),time=remaining===null?'--:--':`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}${budget?.testingMode?' elapsed':''}`;
  return <View style={s.root}>
    <View style={s.bar}><TouchableOpacity accessibilityLabel="Back to Daily Scroll" onPress={()=>{stop();onClose();}}><Text style={s.back}>‹ All apps</Text></TouchableOpacity><View style={s.heading}><Text style={s.brand}>DAILY SCROLL</Text><Text style={s.platform}>{currentHost}</Text></View><Text style={s.timer}>{time}</Text><TouchableOpacity accessibilityLabel="Pause scroll" onPress={stop}><Text style={s.pause}>Ⅱ</Text></TouchableOpacity></View>
    <View style={s.tabs}>{config.tabs.map((item,i)=><TouchableOpacity key={item.label} style={[s.tab,tab===i?s.selected:null]} onPress={()=>setTab(i)}><Text style={tab===i?s.selectedText:s.tabText}>{item.label}</Text></TouchableOpacity>)}</View>
    {platform==='YouTube'?<Text style={s.note}>Google sign-in requires the supported account connection.</Text>:null}
    {hasPage?<View style={{flex:1,display:running&&budget&&allowance>0?'flex':'none'}}><WebView<{}> ref={browser} source={{uri:config.tabs[tab].url}} style={s.web} sharedCookiesEnabled thirdPartyCookiesEnabled domStorageEnabled allowsBackForwardNavigationGestures mediaPlaybackRequiresUserAction allowsInlineMediaPlayback allowsFullscreenVideo={false} allowsPictureInPictureMediaPlayback={false} setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} originWhitelist={['https://*']} onNavigationStateChange={page=>{try{setCurrentHost(new URL(page.url).hostname);}catch{}}} onShouldStartLoadWithRequest={request=>!request.isTopFrame||allowedNativeNavigation(platform,request.url)} onError={event=>{if([-3,-999].includes(event.nativeEvent.code))return;setError('This page could not load. Use Home to try again.');}} startInLoadingState renderLoading={()=><ActivityIndicator style={s.loading}/>} /></View>:null}
    {!(running&&budget&&allowance>0)?<View style={s.paused}><Text style={s.title}>{running?'Opening…':'Paused'}</Text>{error?<Text style={s.note}>{error}</Text>:null}{running?<ActivityIndicator/>:<TouchableOpacity style={s.resume} onPress={()=>setRunning(true)}><Text style={s.selectedText}>Resume</Text></TouchableOpacity>}<TouchableOpacity onPress={()=>{stop();onClose();}}><Text style={s.tabText}>Back to all apps</Text></TouchableOpacity></View>:null}
  </View>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:'#fff'},bar:{flexDirection:'row',alignItems:'center',gap:8,padding:12,borderBottomWidth:1,borderBottomColor:'#eee'},back:{fontSize:14,fontWeight:'700',paddingHorizontal:8,paddingVertical:14,color:'#174737'},heading:{flex:1},brand:{fontSize:14,fontWeight:'800'},platform:{fontSize:11,color:'#777',marginTop:2},timer:{fontSize:15,fontWeight:'700',fontVariant:['tabular-nums'],backgroundColor:'#f2f2f2',paddingHorizontal:6,paddingVertical:7,borderRadius:20},pause:{fontSize:20,padding:4},tabs:{flexDirection:'row',alignItems:'center',gap:8,padding:12},tab:{backgroundColor:'#f2f2f2',borderRadius:20,paddingHorizontal:14,paddingVertical:8},selected:{backgroundColor:'#17191b'},tabText:{fontSize:12,color:'#17191b'},selectedText:{fontSize:12,color:'#fff'},muted:{marginLeft:'auto',fontSize:10,color:'#888'},note:{paddingHorizontal:16,paddingBottom:8,fontSize:11,color:'#777'},web:{flex:1,backgroundColor:'#fff'},paused:{flex:1,alignItems:'center',justifyContent:'center',gap:20,padding:20},title:{fontSize:28,fontWeight:'600'},resume:{backgroundColor:'#17191b',borderRadius:20,paddingHorizontal:24,paddingVertical:14},loading:{position:'absolute',top:'50%',left:'50%'}});
