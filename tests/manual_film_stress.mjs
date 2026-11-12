import assert from 'node:assert/strict';
import {realpathSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH=resolve('.runtime/openfilm-browser');
const require=createRequire(realpathSync(resolve('tools/openfilm/node_modules/openfilm/package.json')));
const {chromium}=require('playwright-core');
const seconds=Number(process.env.FILM_STRESS_SECONDS||180);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1703,height:871}});
const errors=[], crashes=[];page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>crashes.push('renderer'));
try{
 await page.goto(process.env.FILM_STRESS_URL,{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('[data-block-id]:not([data-block-id^="pending:"])').first().waitFor({timeout:60000});
 // Count actual persisted clips rather than visible clips: the timeline uses virtualization.
 const persisted=await page.evaluate(async()=>{const id=location.pathname.split('/')[2];const r=await fetch(`/api/projects/${id}/film`);return r.json();});
 await writeFile('build-private/acceptance-20261111/stress-document-shape.json',JSON.stringify(persisted).slice(0,50000));
 await page.evaluate(()=>{window.fixtureMetrics={frames:0,gaps:[],longTasks:[],heap:[]};let last=performance.now();const tick=now=>{window.fixtureMetrics.frames++;window.fixtureMetrics.gaps.push(now-last);last=now;window.fixtureRaf=requestAnimationFrame(tick);};window.fixtureRaf=requestAnimationFrame(tick);if(PerformanceObserver.supportedEntryTypes.includes('longtask')){window.fixtureObserver=new PerformanceObserver(list=>window.fixtureMetrics.longTasks.push(...list.getEntries().map(e=>e.duration)));window.fixtureObserver.observe({type:'longtask'});}});
 const play=page.getByRole('button',{name:/^(播放|Play)(\s|$)/}).first();
 await play.click();
 const started=Date.now(), samples=[];
 while(Date.now()-started<seconds*1000){
  await page.waitForTimeout(10000);
  samples.push(await page.evaluate(()=>({heap:performance.memory?.usedJSHeapSize||null,frames:window.fixtureMetrics.frames,videos:[...document.querySelectorAll('video')].map(v=>({paused:v.paused,time:v.currentTime,frames:v.getVideoPlaybackQuality?.().totalVideoFrames||0}))})));
  assert.equal(crashes.length,0);assert.equal(errors.length,0,errors.join('\n'));
 }
 const metrics=await page.evaluate(()=>{cancelAnimationFrame(window.fixtureRaf);window.fixtureObserver?.disconnect();const m=window.fixtureMetrics;return {frames:m.frames,p95GapMs:m.gaps.sort((a,b)=>a-b)[Math.floor(m.gaps.length*.95)],maxGapMs:Math.max(...m.gaps),longTasks:m.longTasks.length,maxLongTaskMs:Math.max(0,...m.longTasks)};});
 await page.getByRole('button',{name:/^(暂停|Pause)(\s|$)/}).first().click();
 await page.screenshot({path:'preview/film-workbench/stress-100clips.png'});
 const report={seconds,errors,crashes,samples,...metrics};await writeFile('build-private/acceptance-20261111/stress-browser.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await browser.close();}
