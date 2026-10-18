/* The display is rasterized from source geometry, never a made-up flow field. */
function makeDisplay(mesh,field,river,project,invert,width,height,estuary){
  const cell=2,nx=Math.ceil(width/cell),ny=Math.ceil(height/cell),n=nx*ny;
  const u=new Float32Array(n),v=new Float32Array(n),t=new Float32Array(n),provider=new Uint8Array(n);u.fill(NaN);t.fill(NaN);
  const px=new Float64Array(mesh.lon.length),py=new Float64Array(mesh.lon.length);
  for(let i=0;i<px.length;i++){const p=project(mesh.lon[i],mesh.lat[i]);px[i]=p[0]/cell;py[i]=p[1]/cell;}
  if(field?.kind==='mesh')for(let f=0;f<mesh.triangles.length;f++){
    if(field.u[f]===null||field.v[f]===null)continue;
    const [a,b,c]=mesh.triangles[f],ax=px[a],ay=py[a],bx=px[b],by=py[b],cx=px[c],cy=py[c];
    const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(nx-1,Math.floor(Math.max(ax,bx,cx)-.5));
    const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(ny-1,Math.floor(Math.max(ay,by,cy)-.5));
    if(x0>x1||y0>y1)continue;
    const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(den)<1e-12)continue;
    for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
      const x=i+.5,y=j+.5,wa=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/den,wb=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/den,wc=1-wa-wb;
      if(wa<-.00001||wb<-.00001||wc<-.00001)continue;
      const k=j*nx+i;u[k]=field.u[f];v[k]=field.v[f];provider[k]=1;
      if(field.t[a]!==null&&field.t[b]!==null&&field.t[c]!==null)t[k]=field.t[a]*wa+field.t[b]*wb+field.t[c]*wc;
    }
  }
  const sources=[river,estuary];for(let ordinal=0;ordinal<sources.length;ordinal++){const river=sources[ordinal];if(!river)continue;
    const ll=project(river.west,river.south),ur=project(river.west+(river.width-1)*river.dx,river.south+(river.height-1)*river.dy);
    const x0=Math.max(0,Math.floor(Math.min(ll[0],ur[0])/cell)),x1=Math.min(nx-1,Math.ceil(Math.max(ll[0],ur[0])/cell));
    const y0=Math.max(0,Math.floor(Math.min(ll[1],ur[1])/cell)),y1=Math.min(ny-1,Math.ceil(Math.max(ll[1],ur[1])/cell));
    for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
      const [lon,lat]=invert((i+.5)*cell,(j+.5)*cell),x=(lon-river.west)/river.dx,y=(lat-river.south)/river.dy,ix=Math.round(x),iy=Math.round(y);
      if(ix<0||iy<0||ix>=river.width||iy>=river.height)continue;
      // A current is painted only within a wet source cell; no wide gap-filling.
      const source=iy*river.width+ix;if(river.u[source]===null||river.v[source]===null)continue;
      const k=j*nx+i;if(provider[k]===1)continue;u[k]=river.u[source];v[k]=river.v[source];provider[k]=ordinal+2;
    }
  }
  const valid=[];for(let i=0;i<n;i++)if(provider[i])valid.push(i);
  return {cell,nx,ny,u,v,t,provider,valid};
}
function displayRaster(g,layer,colour){
  const c=document.createElement('canvas');c.width=g.nx;c.height=g.ny;const ctx=c.getContext('2d'),image=ctx.createImageData(g.nx,g.ny);
  for(const k of g.valid){const speed=Math.hypot(g.u[k],g.v[k]);let rgb;if(layer==='speed')rgb=colour(speed/.6);else if(Number.isFinite(g.t[k]))rgb=colour(g.t[k]/25);else rgb=[36,133,183];const p=k*4;image.data[p]=rgb[0]*.46;image.data[p+1]=rgb[1]*.46;image.data[p+2]=rgb[2]*.46;image.data[p+3]=255;}
  ctx.putImageData(image,0,0);return c;
}
function displaySample(g,x,y){if(!g)return null;const i=Math.floor(x/g.cell),j=Math.floor(y/g.cell);if(i<0||j<0||i>=g.nx||j>=g.ny)return null;const k=j*g.nx+i;if(!g.provider[k])return null;return [g.u[k],g.v[k],Number.isFinite(g.t[k])?g.t[k]:null,g.provider[k]];}
