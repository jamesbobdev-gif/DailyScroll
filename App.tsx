import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,AppState,Platform,SafeAreaView,Share,StatusBar as NativeStatusBar,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {WebView} from 'react-native-webview';
import {StatusBar} from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import NativeFeed,{NativePlatform,NativeBudget} from './NativeFeed';
import {nativePlatforms} from './native-platforms.mjs';
const configured=process.env.EXPO_PUBLIC_SERVICE_URL||'';
export default function App(){
  const [url,setUrl]=useState('');const [input,setInput]=useState(configured);const [ready,setReady]=useState(false);const [error,setError]=useState('');const web=useRef<WebView<{}>>(null);
  const [nativePlatform,setNativePlatform]=useState<NativePlatform|null>(null);
  const nativeOpen=useRef(false);nativeOpen.current=nativePlatform!==null;
  const pending=useRef(new Map<string,{resolve:(me:NativeBudget)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
  const serial=useRef(0);
  const requestBudget=useCallback((route:'start'|'pulse'|'stop',platform:NativePlatform):Promise<NativeBudget>=>{
    const id=String(++serial.current);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.current.delete(id);reject(Error('Connection lost. Scroll paused.'));},6500);
      pending.current.set(id,{resolve,reject,timer});
      const request=JSON.stringify({route,platform,id});
      web.current?.injectJavaScript('(async()=>{const q='+request+';try{const me=await api(q.route,{platform:q.platform});window.ReactNativeWebView.postMessage(JSON.stringify({type:"native-budget",id:q.id,me}));}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:"native-budget",id:q.id,error:e.message||"Could not connect."}));}})();true;');
    });
  },[]);
  useEffect(()=>{AsyncStorage.getItem('daily-scroll-service').then(saved=>{setUrl(configured||saved||'');setInput(configured||saved||'');}).catch(()=>setError('Could not load your saved service address.')).finally(()=>setReady(true));const sub=AppState.addEventListener('change',status=>{if(status==='background'&&!nativeOpen.current)web.current?.injectJavaScript("if(typeof pause==='function'){pause();render();} true;");});return()=>sub.remove();},[]);
  async function connect(){try{const parsed=new URL(input.trim());if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error();const origin=parsed.origin;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),6000);try{const response=await fetch(origin+'/health',{signal:controller.signal});const data=await response.json();if(!response.ok||!data.ok)throw Error();}finally{clearTimeout(timeout);}await AsyncStorage.setItem('daily-scroll-service',origin);setUrl(origin);setError('');}catch{setError('Could not reach the service. Check the address and your connection.');}}
  if(!ready)return <SafeAreaView style={s.root}><ActivityIndicator color="#174737"/></SafeAreaView>;
  return <SafeAreaView style={[s.root,url?{backgroundColor:'#fff'}:null]}><StatusBar style="dark"/>{url?<>
    <View style={nativePlatform?s.serviceHidden:s.serviceVisible} pointerEvents={nativePlatform?'none':'auto'} accessibilityElementsHidden={!!nativePlatform} importantForAccessibility={nativePlatform?'no-hide-descendants':'auto'}><WebView<{}> ref={web} source={{uri:url}} style={{flex:1,backgroundColor:'#fff'}} sharedCookiesEnabled thirdPartyCookiesEnabled allowsInlineMediaPlayback allowsFullscreenVideo={false} mediaPlaybackRequiresUserAction setSupportMultipleWindows={false} javaScriptCanOpenWindowsAutomatically={false} originWhitelist={['http://*','https://*']} onMessage={async event=>{
      try{
        if(new URL(event.nativeEvent.url).origin!==new URL(url).origin)return;
        const message=JSON.parse(event.nativeEvent.data);
        if(message.type==='share-invite'){
          if(typeof message.text!=='string'||message.text.length>2000)return;
          try{await Share.share({title:'The Daily Scroll',message:message.text});}
          catch{web.current?.injectJavaScript("notice('Sharing could not open. Copy the invite below or share your room code.');true;");}
          return;
        }
        if(message.type==='native-budget'){

          const p=pending.current.get(message.id);if(!p)return;pending.current.delete(message.id);clearTimeout(p.timer);
          if(message.error)p.reject(Error(message.error));else if(message.me&&['remaining','allowedUntil','now'].every(k=>Number.isFinite(message.me[k])))p.resolve(message.me);else p.reject(Error('Invalid timer response.'));return;
        }
        if(message.type==='open-platform'&&Object.hasOwn(nativePlatforms,message.platform)){setNativePlatform(message.platform);return;}
        if(message.type!=='oauth')return;
        const target=new URL(message.url);
        if(message.type!=='oauth'||target.origin!==new URL(url).origin||!/^\/api\/oauth\/[a-z]+\/start$/.test(target.pathname))return;
        const result=await WebBrowser.openAuthSessionAsync(target.href,'dailyscroll://oauth');
        if(result.type==='success'){
          const callback=new URL(result.url);const ticket=callback.searchParams.get('ticket');
          if(callback.protocol==='dailyscroll:'&&callback.hostname==='oauth'&&ticket&&/^[a-f0-9]{64}$/.test(ticket))setUrl(`${target.origin}/api/oauth/native?ticket=${ticket}`);
        }
      }catch{setError('Sign-in could not finish. Try again.');}
    }} onShouldStartLoadWithRequest={request=>{
      if(!request.isTopFrame)return true;
      try{return new URL(request.url).origin===new URL(url).origin;}catch{return request.url==='about:blank';}
    }} onError={()=>setError('The service is unavailable. Check your connection.')} renderLoading={()=><ActivityIndicator style={s.loading} color="#174737"/>} startInLoadingState/></View>
    {nativePlatform?<NativeFeed key={nativePlatform} platform={nativePlatform} requestBudget={requestBudget} onClose={()=>{web.current?.injectJavaScript("if(typeof returnToApps==='function'){returnToApps(false);}else if(typeof state!=='undefined'){pause(false);state.roomMode=false;state.page='choose';render();}true;");setNativePlatform(null);}}/>:null}
    {error?<View style={s.error}><Text>{error}</Text><TouchableOpacity onPress={()=>{setError('');web.current?.reload();}}><Text style={s.link}>Try again</Text></TouchableOpacity></View>:null}
    {!configured&&!nativePlatform?<TouchableOpacity accessibilityLabel="Change development service" onPress={()=>{web.current?.injectJavaScript("if(typeof pause==='function')pause(); true;");setUrl('');setError('');}}><Text style={s.developer}>Change service</Text></TouchableOpacity>:null}
  </>:<View style={s.setup}><Text style={s.brand}>DAILY SCROLL</Text><Text style={s.title}>{'Your daily hour,\nready when you are.'}</Text><Text style={s.body}>Connect this phone to The Daily Scroll service. Your collection, friends, and daily limit stay together.</Text><Text style={s.label}>Service address</Text><TextInput accessibilityLabel="Service address" autoCapitalize="none" autoCorrect={false} keyboardType="url" style={s.input} value={input} onChangeText={setInput} placeholder="https://your-daily-scroll-service"/>{error?<Text style={s.errorText}>{error}</Text>:null}<TouchableOpacity style={s.button} onPress={connect}><Text style={s.buttonText}>Connect</Text></TouchableOpacity><Text style={s.hint}>For local testing, use your computer’s network address with port 8787. Both devices must be on the same Wi-Fi.</Text></View>}</SafeAreaView>;
}
const s=StyleSheet.create({serviceVisible:{flex:1},serviceHidden:{position:'absolute',width:1,height:1,opacity:0,overflow:'hidden'},root:{flex:1,backgroundColor:'#f6f7f0',justifyContent:'center',paddingTop:Platform.OS==='android'?NativeStatusBar.currentHeight||0:0},setup:{padding:28,gap:18},brand:{fontSize:28,fontWeight:'800',letterSpacing:-1,color:'#174737'},title:{fontSize:38,fontWeight:'600',letterSpacing:-1.5,color:'#174737'},body:{fontSize:15,lineHeight:24,color:'#64745d'},label:{fontSize:12,color:'#64745d'},input:{padding:16,borderWidth:1,borderColor:'#dce3d2',borderRadius:15,backgroundColor:'#fff',color:'#174737'},button:{padding:17,borderRadius:16,backgroundColor:'#174737',alignItems:'center'},buttonText:{fontWeight:'700',color:'#fff'},hint:{fontSize:11,lineHeight:18,color:'#7c8873'},errorText:{color:'#8c412f'},error:{padding:16,gap:8,backgroundColor:'#faeee5'},link:{color:'#174737',fontWeight:'700'},developer:{textAlign:'center',fontSize:10,padding:5,color:'#7c8873'},loading:{position:'absolute',top:'50%',left:'50%'}});

