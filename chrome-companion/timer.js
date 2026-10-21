globalThis.DailyScrollClock=class DailyScrollClock{
  constructor(now=()=>performance.now()){this.now=now;this.snapshot=null;this.shown=0;}
  accept(lease){this.snapshot={...lease,stamp:this.now()};}
  text(){
    if(!this.snapshot)return '…';
    const elapsed=Math.max(0,this.now()-this.snapshot.stamp);
    const amount=this.snapshot.testingMode?Math.max(this.shown,this.snapshot.elapsed+elapsed):Math.max(0,this.snapshot.remaining-elapsed);
    if(this.snapshot.testingMode)this.shown=amount;
    const seconds=this.snapshot.testingMode?Math.floor(amount/1000):Math.ceil(amount/1000);
    const time=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
    return this.snapshot.testingMode?time+' elapsed':time;
  }
};
