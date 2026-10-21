// Display settings shared by the speed raster, trails and legend. SI vectors
// and the source clock are never transformed by this colour normalization.
(function(global){
  'use strict';
  const stops=Object.freeze([[59,131,174],[71,173,206],[95,211,220],[164,235,220],[240,242,185]].map(Object.freeze));
  const maximum=1.5,offset=.02;
  const clamp=value=>Math.max(0,Math.min(1,value));
  function position(speed,ceiling=maximum){
    if(!Number.isFinite(speed)||speed<0)return 0;
    // The separately labelled Simcoe experiment retains its 0–5 cm/s linear scale.
    return clamp(ceiling===.05?speed/ceiling:Math.log1p(speed/offset)/Math.log1p(ceiling/offset));
  }
  function color(value){
    const q=clamp(value)*(stops.length-1),i=Math.min(stops.length-2,Math.floor(q)),t=q-i;
    return stops[i].map((c,j)=>Math.round(c*(1-t)+stops[i+1][j]*t));
  }
  function ticks(ceiling=maximum){
    const values=ceiling===.05?[0,1,2,3,4,5]:[0,2,10,50,150];
    return values.map(value=>({value,label:String(value)+(value===150?'+':''),position:position(value/100,ceiling)}));
  }
  global.SpeedStyle=Object.freeze({position,color,ticks,stops,maximum,offset,rasterBrightness:.10,bucketCount:24,particleOpacity:.94});
})(globalThis);
