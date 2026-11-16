import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { buildDiagnosticFixture } from './fixture-build.mjs';

let fixture;
test.beforeAll(async()=>{fixture=await buildDiagnosticFixture();});

async function mount(page,options={}) {
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url()==='https://t149.invalid/'?route.fulfill({contentType:'text/html',body:'<!doctype html><html data-windows-titlebar><body><div id="app"></div></body></html>'}):route.abort());
  await page.goto('https://t149.invalid/');
  await page.addStyleTag({content:fixture.css});
  await page.addScriptTag({content:fixture.js});
  await page.evaluate(options=>window.t149.render(options),options);
  await expect(page.locator('.wsp-session-action'),`mount errors: ${errors.join('; ')}`).toBeAttached();
  if(!options.onlyActions)await page.locator('[data-row-key="session:fake-session"]').hover({position:{x:60,y:16}});
  await expect(page.getByRole('button',{name:'Mark as unread',exact:true})).toBeVisible();
  expect(errors,'fixture errors, not symptom RED').toEqual([]);
  return errors;
}

async function measure(page) {
  return page.evaluate(async()=>{
    const rect=r=>({x:r.x,y:r.y,width:r.width,height:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2});
    const geometry=element=>{
      const b=element.getBBox(),m=element.getScreenCTM();
      const corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));
      const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
      return {tag:element.tagName,local:rect(b),ctm:{a:m.a,b:m.b,c:m.c,d:m.d,e:m.e,f:m.f},screen:rect({x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)})};
    };
    const painted=async(svg)=>{
      const viewport=svg.getBoundingClientRect(),clone=svg.cloneNode(true),scale=32;
      clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.style.color='black';
      const use=clone.querySelector('use');
      if(use){const defs=document.createElementNS('http://www.w3.org/2000/svg','defs');defs.append(document.querySelector(use.getAttribute('href')).cloneNode(true));clone.prepend(defs);}
      const image=new Image();image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(clone));await image.decode();
      const canvas=document.createElement('canvas');canvas.width=viewport.width*scale;canvas.height=viewport.height*scale;
      const context=canvas.getContext('2d');context.drawImage(image,0,0,canvas.width,canvas.height);
      const pixels=context.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=-1,y1=-1;
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
      return {method:'isolated SVG raster 32x, alpha>0, includes stroke; not optical centroid',screen:rect({x:viewport.x+x0/scale,y:viewport.y+y0/scale,width:(x1+1-x0)/scale,height:(y1+1-y0)/scale})};
    };
    const result={};
    for(const [id,label]of [['unread','Mark as unread'],['archive','Archive'],['pin','Pin']]) {
      const button=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label);
      if(!button)continue;
      const svg=button.querySelector('svg'),computed=getComputedStyle(button),wrapper=button.closest('[data-wsp-owned]');
      result[id]={button:rect(button.getBoundingClientRect()),viewport:rect(svg.getBoundingClientRect()),viewBox:svg.getAttribute('viewBox'),glyph:geometry(svg),painted:await painted(svg),parts:[...svg.querySelectorAll('path,circle,use')].map(geometry),style:{fontSize:computed.fontSize,lineHeight:computed.lineHeight,verticalAlign:computed.verticalAlign,display:computed.display,margin:computed.margin},wrapper:wrapper?{box:rect(wrapper.getBoundingClientRect()),lineHeight:getComputedStyle(wrapper).lineHeight}:null};
    }
    const owner=document.querySelector('[data-row-key]')??document.querySelector('[data-minimal-actions]');
    return {icons:result,owner:rect(owner.getBoundingClientRect()),counters:window.t149.counters(),dpr:devicePixelRatio};
  });
}

function signal(metrics) {
  const {unread,archive,pin}=metrics.icons;
  const references=[archive,pin].filter(Boolean);
  return references.flatMap((control,index)=>{
    const name=index===0?'archive':'pin';
    const mismatches=[];
    if(Math.abs(unread.viewport.width-control.viewport.width)>.01||Math.abs(unread.viewport.height-control.viewport.height)>.01)mismatches.push(`${name}: viewport ${unread.viewport.width}x${unread.viewport.height} vs ${control.viewport.width}x${control.viewport.height}`);
    const dy=unread.viewport.cy-control.viewport.cy;
    if(Math.abs(dy)>.01)mismatches.push(`${name}: SVG center dy=${dy}`);
    return mismatches;
  });
}

// The norm is the RC.1 Archive/Pin source and a native/native control, not an arbitrary 14px snapshot.
// Glyph bounds are measured, not equated: the three drawings have different shapes and optical centers.
test('production unread hover matches RC.1 native SVG viewport and vertical center',async({page},testInfo)=>{
  const errors=await mount(page);
  const metrics=await measure(page);
  const {archive,pin}=metrics.icons;
  expect(archive.viewport.width).toBe(pin.viewport.width);
  expect(archive.viewport.height).toBe(pin.viewport.height);
  expect(archive.viewport.cy).toBe(pin.viewport.cy);
  for(const control of [archive,pin])expect(control.viewport.cy).toBe(control.button.cy);
  expect(metrics.counters).toEqual({opens:0,marks:0,archives:0,pins:0,model:0,account:0});
  const report={tag:'t149-geometry',scenario:'native SessionNodeItem + production RowAction',provenance:fixture.provenance,metrics,signal:signal(metrics)};
  await writeFile(testInfo.outputPath('geometry.json'),JSON.stringify(report,null,2));
  await page.screenshot({path:testInfo.outputPath('hover.png')});
  const reductions=[
    ['remove-running',{running:false}],
    ['remove-title',{running:false,title:false}],
    ['remove-ellipsis',{running:false,title:false,ellipsis:false}],
    ['remove-session-row-shell',{running:false,title:false,ellipsis:false,onlyActions:true}],
    ['remove-pin',{running:false,title:false,ellipsis:false,onlyActions:true,removePin:true}],
  ];
  const minimized=[];
  for(const [name,options]of reductions){
    await page.evaluate(options=>new Promise(resolve=>{window.t149.render(options);requestAnimationFrame(()=>requestAnimationFrame(resolve));}),options);
    const next=await measure(page);const nextSignal=signal(next);
    minimized.push({name,options,metrics:next,signal:nextSignal});
    // This only checks reproduction retention during deletion, never changes CSS or artwork.
    const expectedSignal=report.signal.filter(value=>next.icons.pin||!value.startsWith('pin:'));
    expect(nextSignal,name).toEqual(expectedSignal);
  }
  await writeFile(testInfo.outputPath('minimization.json'),JSON.stringify(minimized,null,2));
  await page.screenshot({path:testInfo.outputPath('minimal.png')});
  console.log(JSON.stringify({tag:report.tag,full:report.signal,minimization:minimized.map(({name,signal})=>({name,signal})),nativeControl:{archiveSvg:archive.viewport,pinSvg:pin.viewport},zeroActions:metrics.counters}));
  expect(errors).toEqual([]);
  expect(report.signal,'exact size/upward symptom relative to RC.1 native controls').toEqual([]);
});
