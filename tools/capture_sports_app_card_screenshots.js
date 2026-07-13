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

async function clickDetailTab(page, label) {
  const buttons = page.locator('.detail-tab-strip span', { hasText: label });
  if (await buttons.count()) await buttons.first().click();
}

async function run() {
  const edgePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const sizes = [
    { label: '390x844', width: 390, height: 844 },
    { label: '430x932', width: 430, height: 932 }
  ];
  const screenshotNames = [
    'rutgers_compact_player_list',
    'rutgers_player_card_with_dev_trait',
    'rutgers_player_detail_overview',
    'rutgers_player_detail_stats',
    'purdue_compact_roster_list',
    'purdue_player_detail',
    'recruiting_compact_board',
    'recruit_card_with_star_rating',
    'recruit_card_with_gem',
    'recruit_detail_scouting',
    'back_navigation_restored'
  ];

  await withServer(async baseUrl => {
    const browser = await chromium.launch({ headless: true, executablePath: edgePath });
    for (const size of sizes) {
      const dir = path.join(root, 'screenshots', `sports_app_cards_${size.label}`);
      fs.mkdirSync(dir, { recursive: true });
      const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, isMobile: true });
      page.on('console', msg => {
        if (msg.type() === 'error') console.error(`[console] ${msg.text()}`);
      });
      await page.goto(baseUrl, { waitUntil: 'networkidle' });

      await capture(page, dir, 'rutgers_compact_player_list', async () => {
        await page.click('[data-tab="personnel"]');
        await page.evaluate(() => showRosterGroup('QB'));
      });
      await capture(page, dir, 'rutgers_player_card_with_dev_trait', async () => {
        await page.locator('.player-compact-card').first().scrollIntoViewIfNeeded();
      });
      await capture(page, dir, 'rutgers_player_detail_overview', async () => {
        await page.evaluate(() => showPlayerDetail((loadRutgersRoster().players[0] || {}).player_id, 'rutgers', 'QB'));
      });
      await capture(page, dir, 'rutgers_player_detail_stats', async () => {
        await clickDetailTab(page, 'Stats');
        await page.locator('[data-detail-section="Stats"]').first().scrollIntoViewIfNeeded();
      });
      await capture(page, dir, 'purdue_compact_roster_list', async () => {
        await page.evaluate(() => renderPersonnelMatchups('opponent'));
      });
      await capture(page, dir, 'purdue_player_detail', async () => {
        await page.evaluate(() => showOpponentPlayerDetail((loadOpponentPlayers()[0] || {}).player_id));
      });
      await capture(page, dir, 'recruiting_compact_board', async () => {
        await page.click('[data-tab="recruiting"]');
      });
      await capture(page, dir, 'recruit_card_with_star_rating', async () => {
        await page.locator('.recruit-compact-card').first().scrollIntoViewIfNeeded();
      });
      await capture(page, dir, 'recruit_card_with_gem', async () => {
        await page.locator('.recruit-compact-card').first().scrollIntoViewIfNeeded();
      });
      await capture(page, dir, 'recruit_detail_scouting', async () => {
        await page.evaluate(() => showRecruitDetail('w-boudreaux', 'prospects'));
        await clickDetailTab(page, 'Scouting');
        await page.locator('[data-detail-section="Scouting"]').first().scrollIntoViewIfNeeded();
      });
      await capture(page, dir, 'back_navigation_restored', async () => {
        await page.evaluate(() => {
          renderRecruitList('board');
          window.scrollTo(0, 360);
          const first = document.querySelector('.recruit-compact-card');
          if (first) first.click();
          const back = document.querySelector('[data-recruit-detail] .back-button');
          if (back) back.click();
        });
      });

      const missing = screenshotNames.filter(name => !fs.existsSync(path.join(dir, `${name}.png`)));
      if (missing.length) throw new Error(`Missing screenshots for ${size.label}: ${missing.join(', ')}`);
      await page.close();
    }
    await browser.close();
  });
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
