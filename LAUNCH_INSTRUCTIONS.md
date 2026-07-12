# LAUNCH_INSTRUCTIONS

## Windows
Open `index.html` directly, or run a local static server from this folder:

```powershell
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## iPhone
Use the GitHub Pages deployment URL, or serve the folder from Windows on the same network and open the computer's LAN URL in Safari.

## Validation
Run:

```powershell
node --check app.js
node --check tools\validate.js
node tools\validate.js
```
