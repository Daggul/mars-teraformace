// Export a directly playable single HTML file, including the source downloads.
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const target=process.argv[2];if(!target)throw Error('Zadej cestu pro HTML soubor.');
const mime={'.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.zip':'application/zip'};
const read=(file,encoding)=>readFile(path.join(dist,file),encoding);
async function data(file){return `data:${mime[path.extname(file)]};base64,${(await read(file)).toString('base64')}`;}
let html=await read('index.html','utf8'),css=await read('style.css','utf8');
for(const [,file] of [...css.matchAll(/url\('((?:art|vendor)\/[^']+)'\)/g)])css=css.replaceAll(`url('${file}')`,`url('${await data(file)}')`);
html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${css}</style>`).replace(/<link rel="preload"[^>]+>/g,'');
for(const [,file] of [...html.matchAll(/(?:href|src)="(art\/[^"]+|icon.svg)"/g)])html=html.replaceAll('="'+file+'"','="'+await data(file)+'"');
const images=Object.fromEntries(await Promise.all((await readdir(path.join(dist,'art'))).filter(f=>f.endsWith('.webp')).map(async f=>['art/'+f,await data('art/'+f)])));
for(const file of ['zdrojovy-kod.zip','vendor/mars-rules-source.zip'])images[file]=await data(file);
html=html.replace(/<script defer src="[^"]+"><\/script>/g,'');
let scripts=`<script>globalThis.MarsAsset=${JSON.stringify(images)};</script>`;
for(const file of ['vendor/peerjs-1.5.5.min.js','vendor/mars-rules.js','js/mars-app.js'])scripts+='<script>'+ (await read(file,'utf8')).replace(/<\/script/gi,'<\\/script')+'</script>';
html=html.replace('</body>',()=>scripts+'</body>');await writeFile(target,html);
