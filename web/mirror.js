/* Local display only: no recording, upload, WebRTC connection, or audio output. */
globalThis.DailyScrollMirror=class DailyScrollMirror {
  constructor({video,mediaDevices,controllerFactory,onEnded=()=>{}}){
    this.video=video;this.mediaDevices=mediaDevices;this.controllerFactory=controllerFactory;this.onEnded=onEnded;this.stream=null;this.controller=null;this.generation=0;this.pending=false;this.endedHandler=null;
  }
  get active(){return !!this.stream;}
  get canScroll(){return this.stream?.getVideoTracks()[0]?.getSettings?.().displaySurface==='browser'&&typeof this.controller?.forwardWheel==='function';}
  async start({beforeStart=Promise.resolve(),requestLease}){
    if(!this.mediaDevices?.getDisplayMedia)throw Error('Screen sharing is unavailable here. Open Daily Scroll in desktop Chrome.');
    this.stop();const generation=this.generation;this.pending=true;
    const controller=this.controllerFactory?.();this.controller=controller||null;
    let stream;
    try{
      // Invoke directly from the user's click, before awaiting any network request.
      stream=await this.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:30,max:30}},audio:false,selfBrowserSurface:'exclude',surfaceSwitching:'exclude',monitorTypeSurfaces:'exclude',systemAudio:'exclude',windowAudio:'exclude',...(controller?{controller}:{})});
      if(generation!==this.generation){for(const track of stream.getTracks())track.stop();throw Error('Sharing cancelled.');}
      try{controller?.setFocusBehavior?.('no-focus-change');}catch{}
      // Discard unexpected audio even if a browser ignores the request options.
      for(const track of stream.getAudioTracks()){track.stop();stream.removeTrack(track);}
      const track=stream.getVideoTracks()[0];if(!track||track.readyState==='ended')throw Error('The shared tab is no longer available.');
      this.stream=stream;
      this.endedHandler=()=>{if(generation===this.generation){this.stop();this.onEnded();}};
      track.addEventListener('ended',this.endedHandler);
      await beforeStart;if(generation!==this.generation)throw Error('Sharing cancelled.');
      const lease=await requestLease();
      if(generation!==this.generation)throw Error('Sharing cancelled.');
      if(!lease.open||lease.remaining<=0||lease.allowedUntil<=lease.now)throw Error('Your daily scroll is closed.');
      this.video.muted=true;this.video.defaultMuted=true;this.video.volume=0;this.video.srcObject=stream;
      await this.video.play();if(generation!==this.generation)throw Error('Sharing cancelled.');
      this.pending=false;return lease;
    }catch(error){
      if(generation===this.generation)this.stop();
      if(stream)for(const track of stream.getTracks())track.stop();
      throw error;
    }
  }
  async enableScrolling(){
    if(!this.canScroll)throw Error('Scrolling requires a Chrome tab capture. A shared window is view-only.');
    await this.controller.forwardWheel(this.video);
  }
  stop(){
    this.generation++;this.pending=false;
    const stream=this.stream,controller=this.controller;this.stream=null;this.controller=null;
    if(stream){for(const track of stream.getVideoTracks())if(this.endedHandler)track.removeEventListener('ended',this.endedHandler);for(const track of stream.getTracks())track.stop();}
    this.endedHandler=null;
    try{const operation=controller?.forwardWheel?.(null);operation?.catch?.(()=>{});}catch{}
    this.video.pause();this.video.srcObject=null;
  }
};
