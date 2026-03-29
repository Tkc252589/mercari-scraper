// =================================================================
// Mercari Scraper Server v3 - Playwright Headless Browser
// =================================================================
const express = require('express');
const { chromium } = require('playwright-core');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

let browserInstance = null;
let browserLastUsed = Date.now();

async function getBrowser() {
    if (browserInstance && Date.now() - browserLastUsed > 5 * 60 * 1000) {
          try { await browserInstance.close(); } catch(e) {}
          browserInstance = null;
    }
    if (!browserInstance) {
          var execPath = chromium.executablePath();
          console.log('Launching browser:', execPath);
          browserInstance = await chromium.launch({
                  executablePath: execPath,
                  headless: true,
                  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
                                 '--disable-accelerated-2d-canvas','--no-first-run','--no-zygote',
                                 '--disable-gpu','--single-process','--disable-extensions']
          });
          console.log('Browser launched');
    }
    browserLastUsed = Date.now();
    return browserInstance;
}

const EXTRACT_SCRIPT = (function(){
    function getItemData(el) {
          var fk = Object.keys(el).find(function(k){ return k.indexOf('__reactFiber') === 0; });
          if (!fk) return null;
          var f = el[fk], vis = [], n = 0;
          while (f && vis.indexOf(f) === -1 && n++ < 100) {
                  vis.push(f);
                  if (f.memoizedProps && f.memoizedProps.item && f.memoizedProps.item.id && f.memoizedProps.item.name)
                            return f.memoizedProps.item;
                  f = f.return;
          }
          return null;
    }
    var links = document.querySelectorAll('a[href*="/item/m"]');
    var out = [];
    links.forEach(function(link) {
          var d = getItemData(link);
          if (d && d.id && d.name) {
                  out.push({
                            id: d.id, name: d.name,
                            price: parseInt(d.price)||0,
                            thumbnail: d.thumbnails && d.thumbnails[0] ? d.thumbnails[0] : '',
                            href: link.href,
                            brand: d.itemBrand ? d.itemBrand.name : '',
                            condition: d.itemConditionId || ''
                  });
          }
    });
    return out;
}).toString();

async function scrapeUrl(url) {
    var browser = await getBrowser();
    var ctx = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          locale: 'ja-JP', timezoneId: 'Asia/Tokyo'
    });
    var page = await ctx.newPage();
    try {
          console.log('Navigating:', url);
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForSelector('a[href*="/item/m"]', { timeout: 15000 }).catch(function(){});
          await page.waitForTimeout(2000);
          var script = '(' + EXTRACT_SCRIPT + ')()';
          var items = await page.evaluate(script);
          console.log('Items found:', items.length);
          return items;
    } finally {
          await ctx.close();
    }
}

app.get('/', function(req, res) {
    res.json({ status:'ok', version:'3.0-playwright' });
});

app.get('/health', function(req, res) {
    res.json({ status:'ok', time: new Date().toISOString() });
});

app.post('/scrape', async function(req, res) {
    var type = req.body.type, value = req.body.value, max = req.body.maxItems || 30;
    if (!type || !value) return res.status(400).json({ error:'type and value required' });
    try {
          var url = '';
          if (type === 'keyword') url = 'https://jp.mercari.com/search?keyword=' + encodeURIComponent(value) + '&status=on_sale';
          else if (type === 'shop') url = 'https://jp.mercari.com/shop/product/list/' + value + '?status=on_sale';
          else if (type === 'user') url = 'https://jp.mercari.com/user/profile/' + value + '?status=on_sale';
          else return res.status(400).json({ error:'type must be keyword/shop/user' });
          var items = await scrapeUrl(url);
          res.json({ success:true, type:type, value:value, count:items.length, items:items.slice(0,max) });
    } catch(e) {
          console.error('Error:', e.message);
          res.status(500).json({ error: e.message });
    }
});

app.get('/scrape', async function(req, res) {
    var type = req.query.type, value = req.query.value, max = parseInt(req.query.maxItems)||30;
    if (!type || !value) return res.status(400).json({ error:'type and value required' });
    try {
          var url = '';
          if (type === 'keyword') url = 'https://jp.mercari.com/search?keyword=' + encodeURIComponent(value) + '&status=on_sale';
          else if (type === 'shop') url = 'https://jp.mercari.com/shop/product/list/' + value + '?status=on_sale';
          else if (type === 'user') url = 'https://jp.mercari.com/user/profile/' + value + '?status=on_sale';
          else return res.status(400).json({ error:'type must be keyword/shop/user' });
          var items = await scrapeUrl(url);
          res.json({ success:true, type:type, value:value, count:items.length, items:items.slice(0,max) });
    } catch(e) {
          console.error('Error:', e.message);
          res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, function() {
    console.log('Mercari Scraper v3 Playwright running on port', PORT);
});
