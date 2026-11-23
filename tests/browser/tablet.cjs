'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const base = 'https://mars-teraformace.netlify.app/';
const out = process.env.SCREENSHOTS;
const landscape = {width:1024,height:768};
const portrait = {width:768,height:1024};
function intersects(a,b) {
  return a && b && a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
}
async function layout(page, sz) {
  const metrics = await page.evaluate(() => {
    const rect = selector => {
      const el=document.querySelector(selector);
      if (!el || !el.getClientRects().length) return null;
      const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
    };
    return {width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,
      hand:rect('#hand-dock'),rail:rect('#hand-rail'),badge:rect('#nl-badge-frame'),map:rect('#map-pane'),turn:rect('#turn'),ready:rect('.spread-hand')};
  });
  assert.equal(metrics.width,sz.width);
  assert.equal(metrics.height,sz.height);
  assert.ok(metrics.pageWidth <= sz.width+1);
  assert.ok(metrics.pageHeight <= sz.height+1);
  assert.ok(metrics.hand.y>=0 && metrics.hand.bottom <= sz.height+1);
  assert.ok(metrics.rail.width>240 && metrics.rail.height>35);
  assert.ok(metrics.ready.height>=44);
  assert.ok(!intersects(metrics.badge,metrics.rail),'Hosting badge overlaps private cards');
  return metrics;
}
async function newGame(browser, size, count) {
  const context=await browser.newContext({viewport:size,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();
  page.setDefaultTimeout(7500);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Sólová mise',exact:true}).tap();
  await page.getByRole('textbox',{name:'Tvoje jméno'}).fill('Tharsis');
  await page.getByRole('button',{name:'Spustit misi'}).tap();
  const corps=await page.locator('#turn .pick').evaluateAll(items=>items.map(e=>({key:e.dataset.value,budget:+e.querySelector('small').textContent.match(/\d+/)[0]})));
  const corp=corps.sort((a,b)=>b.budget-a.budget).find(c=>!['Tharsis Republic','Inventrix','United Nations Mars Initiative'].includes(c.key))||corps[0];
  await page.locator('#turn .pick').filter({hasText:new RegExp(corp.budget+' M€')}).first().tap();
  await page.getByRole('button',{name:'Další krok',exact:true}).tap();
  const projects=await page.locator('#turn .pick').evaluateAll(items=>items.map((e,i)=>({i,cost:+e.querySelector('small').textContent.match(/\d+/)[0]})).sort((a,b)=>a.cost-b.cost));
  for (const p of projects.slice(0,count)) await page.locator('#turn .pick').nth(p.i).tap();
  assert.equal(await page.locator('#hand-count').textContent(),String(count));
  await page.getByRole('button',{name:'Potvrdit volbu',exact:true}).tap();
  await page.getByRole('heading',{name:'Moje ruka'}).waitFor();
  return {context,page};
}
async function cardGame(browser) {
  for (let attempt=0;attempt<6;attempt++) {
    const {context,page}=await newGame(browser,landscape,7);
    try {
      const rail=page.locator('#hand-rail');
      if (!await rail.locator('.playable').count()) continue;
      const initial=await layout(page,landscape);
      assert.ok(initial.map && initial.turn);
      const next=page.getByRole('button',{name:'Další karty',exact:true});
      await next.tap();
      await page.waitForFunction(()=>document.querySelector('#hand-rail').scrollLeft>20);
      await page.getByRole('button',{name:'Předchozí karty'}).tap();
      await page.waitForFunction(()=>document.querySelector('#hand-rail').scrollLeft<5);
      await page.screenshot({path:out+'/Mars-tablet-na-sirku.jpg',type:'jpeg',quality:87});
      await page.setViewportSize(portrait);
      const before=await layout(page,portrait);
      assert.ok(!before.map && before.turn);
      await page.getByRole('button',{name:'Mapa',exact:true}).tap();
      const after=await layout(page,portrait);
      assert.ok(after.map && !after.turn);
      assert.equal(after.hand.y,before.hand.y);
      await page.getByRole('button',{name:'Přehled',exact:true}).tap();
      assert.ok(await page.locator('#overview-panel .stock').isVisible());
      assert.equal((await layout(page,portrait)).hand.y,before.hand.y);
      await page.getByRole('button',{name:'Rozložit',exact:true}).tap();
      assert.equal(await page.locator('.hand-gallery .held-effect').count(),7);
      await page.locator('#hand-dock .spread-hand').tap();
      await page.getByRole('button',{name:'Tah',exact:true}).tap();
      const ready=rail.locator('.playable').first();
      await ready.tap();
      assert.ok(await page.locator('dialog .detail-text').isVisible());
      await page.getByRole('button',{name:/Přejít k platbě/}).tap();
      const pay=page.getByRole('button',{name:'Zaplatit a zahrát'});
      assert.ok(await pay.isEnabled());
      await pay.tap();
      await page.waitForFunction(()=>document.querySelector('#hand-count').textContent==='6');
      console.log('Seven cards, paging, gallery, overview, rotation, touch payment and private hand verified on production.');
      return;
    } finally {await context.close();}
  }
  throw Error('Unable to draw a playable opening project in six games');
}
async function oceanGame(browser) {
  for (let attempt=0;attempt<6;attempt++) {
    const {context,page}=await newGame(browser,portrait,3);
    try {
      const standard=page.getByRole('button',{name:/Provést standardní projekt/i});
      if(!await standard.count()) continue;
      await standard.tap();
      await page.locator('#turn .action-list button').filter({hasText:/Zavodňování/i}).tap();
      await page.locator('#turn .turn-foot .primary').tap();
      await page.locator('.map-placement').waitFor();
      const submit=page.getByRole('button',{name:'Potvrdit umístění'});
      assert.ok(await submit.isDisabled());
      await page.locator('.hex-cell.eligible').first().tap();
      assert.ok(await submit.isEnabled());
      const selected=await page.locator('.hex-cell.picked').getAttribute('data-value');
      assert.ok((await layout(page,portrait)).map);
      const hand=await page.locator('#hand-count').textContent();
      await page.screenshot({path:out+'/Mars-tablet-na-vysku.jpg',type:'jpeg',quality:87});
      await submit.tap();
      const ocean=page.locator('.hex-cell.occupied[data-value="'+selected+'"]');
      await ocean.waitFor({state:'attached'});
      assert.equal(await page.locator('#hand-count').textContent(),hand);
      assert.ok(await page.locator('#turn').isVisible());
      console.log('Automatic map, highlighted hexagon, placement confirmation, ocean tile and return to turn verified.');
      return;
    } finally {await context.close();}
  }
  throw Error('Unable to start ocean placement');
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN});
  try {await cardGame(browser);await oceanGame(browser);} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
