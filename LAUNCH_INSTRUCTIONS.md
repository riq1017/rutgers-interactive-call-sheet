# LAUNCH_INSTRUCTIONS

## Windows

1. Extract the final ZIP.
2. Open `Rutgers_Interactive_Call_Sheet_Purdue_v1/index.html` in Chrome or Edge.
3. Use the bottom navigation to switch between Gameplan, Top Plays, Personnel, Recruiting, and More.

## iPhone

1. Upload the extracted folder to GitHub Pages or any static web host.
2. Open the published URL in Safari.
3. Add it to the Home Screen if desired.

## Local Static Server Option

From the extracted project folder:

```powershell
node -e "require('http').createServer((req,res)=>{const fs=require('fs'),path=require('path');let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';fs.readFile(path.join(process.cwd(),p),(e,d)=>{res.writeHead(e?404:200);res.end(e?'not found':d)})}).listen(8766,'127.0.0.1')"
```

Then open `http://127.0.0.1:8766/`.
