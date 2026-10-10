// Local-only server for the exported Expo Web smoke tests.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve('dist-web');
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json'};
http.createServer((req,res)=>{
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file = path.resolve(root, `.${pathname}`);
  if(file!==root && !file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).on('error',()=>{res.statusCode=404;res.end();}).pipe(res);
}).listen(8790,'127.0.0.1');
