import {cp, mkdir, rm, access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const binary=process.env.ESBUILD_BINARY_PATH || path.join(root,'node_modules','.bin',process.platform==='win32'?'esbuild.cmd':'esbuild');
execFileSync(process.execPath,['scripts/catalog.mjs'],{cwd:root,stdio:'inherit'});
await access(binary);
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});await cp(path.join(root,'public'),dist,{recursive:true});
execFileSync(binary,['src/app.mjs','--bundle','--target=es2020','--minify','--legal-comments=inline','--charset=utf8','--outfile=dist/js/mars-app.js'],{cwd:root,stdio:'inherit'});
// The complete corresponding source is served next to the browser bundle.
execFileSync('zip',['-q','-r',path.join(dist,'zdrojovy-kod.zip'),'README.md','LICENSE','package.json','scripts','src','data','tests','public'],{cwd:root,stdio:'inherit'});
