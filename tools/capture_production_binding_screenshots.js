const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function serveFile(req, res) {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, ''));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function withServer(fn) {
  const server = http.createServer(serveFile);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}/`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function capture(page, dir, name, setup = async () => {}) {
  await setup();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
}

async function run() {
  const edgePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const sizes = [
    { label: '390x844', width: 390, height: 844 },
    { label: '430x932', width: 430, height: 932 }
  ];
  await withServer(async baseUrl => {
    const browser = await chromium.launch({ headless: true, executablePath: edgePath });
    for (const size of sizes) {
      const dir = path.join(root, 'screenshots', `production_binding_${size.label}`);
      fs.mkdirSync(dir, { recursive: true });
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, isMobile: true });
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await capture(page, dir, 'compact_gameplan');
      await capture(page, dir, 'best_run_arrow', async () => page.locator('.coordinator-run-card').scrollIntoViewIfNeeded());
      await capture(page, dir, 'protection_card', async () => page.locator('.coordinator-protection-card').scrollIntoViewIfNeeded());
      await capture(page, dir, 'topplays_best', async () => page.click('[data-tab="topplays"]'));
      await capture(page, dir, 'topplays_top3', async () => page.click('[data-top-play-control="top3"]'));
      await capture(page, dir, 'full_play_list', async () => page.locator('#rankList').scrollIntoViewIfNeeded());
      await capture(page, dir, 'purdue_full_roster', async () => {
        await page.click('[data-tab="personnel"]');
        await page.evaluate(() => renderPersonnelMatchups('opponent'));
      });
      await capture(page, dir, 'purdue_player_detail', async () => page.evaluate(() => showOpponentPlayerDetail((loadOpponentPlayers()[0] || {}).player_id)));
      await capture(page, dir, 'recruiting_compact_board', async () => page.click('[data-tab="recruiting"]'));
      await capture(page, dir, 'recruiting_top3', async () => page.locator('#actionPlanList').scrollIntoViewIfNeeded());
      await capture(page, dir, 'recruit_detail_scouting', async () => page.evaluate(() => showRecruitDetail('w-boudreaux', 'prospects')));
      await capture(page, dir, 'recovered_recruit_detail', async () => page.locator('[data-recruit-detail]').scrollIntoViewIfNeeded());
      await page.close();
    }
    await browser.close();
  });
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
