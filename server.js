const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function scrapeMercari(type, query, maxItems) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    let url = '';
    if (type === 'keyword') {
      url = 'https://jp.mercari.com/search?keyword=' + encodeURIComponent(query) + '&status=on_sale';
    } else if (type === 'shop') {
      url = 'https://mercari-shops.com/shops/' + query;
    } else if (type === 'user') {
      url = 'https://jp.mercari.com/user/profile/' + query;
    }
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    
    await new Promise(r => setTimeout(r, 3000));
    
    const items = await page.evaluate((maxCount) => {
      const results = [];
      const selectors = [
        'li[data-testid="item-cell"]',
        '[data-testid="merListItem"]',
        'a[href*="/item/m"]'
      ];
      
      let itemEls = [];
      for (const sel of selectors) {
        itemEls = Array.from(document.querySelectorAll(sel));
        if (itemEls.length > 0) break;
      }
      
      for (let i = 0; i < Math.min(itemEls.length, maxCount); i++) {
        const el = itemEls[i];
        try {
          const linkEl = el.tagName === 'A' ? el : el.querySelector('a[href*="/item/"]');
          if (!linkEl) continue;
          const href = linkEl.href || '';
          if (!href.includes('/item/m')) continue;
          
          const imgEl = el.querySelector('img');
          const priceEl = el.querySelector('[class*="price"], [data-testid*="price"]');
          const titleEl = el.querySelector('[class*="name"], [data-testid*="name"], [class*="title"]');
          
          const itemUrl = href.split('?')[0];
          const image = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
          const price = priceEl ? priceEl.textContent.replace(/[^0-9]/g, '') : '';
          const title = titleEl ? titleEl.textContent.trim() : '';
          
          if (itemUrl && itemUrl.includes('/item/m')) {
            results.push({ url: itemUrl, image, price, title });
          }
        } catch(e) {}
      }
      return results;
    }, maxItems || 30);
    
    return { success: true, items };
  } catch (err) {
    return { success: false, error: err.message, items: [] };
  } finally {
    if (browser) await browser.close();
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/scrape', async (req, res) => {
  const { type, query, max } = req.query;
  if (!type || !query) {
    return res.status(400).json({ error: 'type and query are required' });
  }
  const result = await scrapeMercari(type, query, parseInt(max) || 30);
  res.json(result);
});

app.listen(PORT, () => {
  console.log('Mercari scraper server running on port ' + PORT);
});
