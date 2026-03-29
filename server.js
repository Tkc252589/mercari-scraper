const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const HEADERS = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
};

// HTMLからメルカリ商品データを抽出
function parseItemsFromHtml(html, maxItems) {
      var items = [];
      try {
              // __NEXT_DATA__ スクリプトタグからJSONを取得
        var start = html.indexOf('"__NEXT_DATA__"');
              if (start === -1) start = html.indexOf('id="__NEXT_DATA__"');

        var scriptStart = html.indexOf('>', html.indexOf('id="__NEXT_DATA__"'));
              var scriptEnd = html.indexOf('</script>', scriptStart);

        if (scriptStart > 0 && scriptEnd > 0) {
                  var jsonStr = html.substring(scriptStart + 1, scriptEnd).trim();
                  try {
                              var nextData = JSON.parse(jsonStr);
                              var pageProps = nextData && nextData.props && nextData.props.pageProps;
                              var itemList = pageProps && (pageProps.items || (pageProps.searchResult && pageProps.searchResult.items));
                              if (itemList && itemList.length > 0) {
                                            for (var i = 0; i < Math.min(itemList.length, maxItems); i++) {
                                                            var item = itemList[i];
                                                            if (item.id && item.price) {
                                                                              items.push({
                                                                                                  url: 'https://jp.mercari.com/item/' + item.id,
                                                                                                  image: (item.thumbnails && item.thumbnails[0]) || item.thumbnail || '',
                                                                                                  price: String(item.price || ''),
                                                                                                  title: item.name || ''
                                                                              });
                                                            }
                                            }
                                            return items;
                              }
                  } catch(e2) {}
        }

        // fallback: window.__INITIAL_STATE__ 形式
        var initStart = html.indexOf('window.__INITIAL_STATE__=');
              if (initStart > -1) {
                        var initEnd = html.indexOf(';</script>', initStart);
                        if (initEnd > -1) {
                                    var initStr = html.substring(initStart + 25, initEnd);
                                    try {
                                                  var initData = JSON.parse(initStr);
                                                  var searchItems = initData && initData.search && initData.search.items;
                                                  if (searchItems) {
                                                                  for (var j = 0; j < Math.min(searchItems.length, maxItems); j++) {
                                                                                    var si = searchItems[j];
                                                                                    if (si.id) {
                                                                                                        items.push({
                                                                                                                              url: 'https://jp.mercari.com/item/' + si.id,
                                                                                                                              image: si.thumbnails ? si.thumbnails[0] || '' : '',
                                                                                                                              price: String(si.price || ''),
                                                                                                                              title: si.name || ''
                                                                                                            });
                                                                                        }
                                                                  }
                                                  }
                                    } catch(e3) {}
                        }
              }

        // fallback2: meta og:image + JSON-LD
        if (items.length === 0) {
                  // item URLパターンを探す
                var urlPattern = '/item/m';
                  var pos = 0;
                  var seen = {};
                  while (items.length < maxItems) {
                              var idx = html.indexOf(urlPattern, pos);
                              if (idx === -1) break;
                              var endIdx = html.indexOf('"', idx);
                              if (endIdx === -1) { pos = idx + 1; continue; }
                              var itemPath = html.substring(idx, endIdx);
                              var itemId = itemPath.replace('/item/', '').split('?')[0].split('"')[0];
                              if (itemId && itemId.indexOf('m') === 0 && !seen[itemId]) {
                                            seen[itemId] = true;
                                            items.push({
                                                            url: 'https://jp.mercari.com/item/' + itemId,
                                                            image: '',
                                                            price: '',
                                                            title: ''
                                            });
                              }
                              pos = idx + urlPattern.length;
                  }
        }
      } catch(e) {
              console.log('parseItemsFromHtml error:', e.message);
      }
      return items;
}

async function searchByKeyword(keyword, maxItems) {
      try {
              var url = 'https://jp.mercari.com/search?keyword=' + encodeURIComponent(keyword) + '&status=on_sale&sort=created_time&order=desc';
              console.log('Fetching keyword URL:', url);
              var res = await fetch(url, { headers: HEADERS, timeout: 25000 });
              if (!res.ok) {
                        console.log('keyword fetch error:', res.status);
                        return [];
              }
              var html = await res.text();
              console.log('HTML length:', html.length);
              var items = parseItemsFromHtml(html, maxItems || 30);
              console.log('keyword search:', keyword, '->', items.length, 'items');
              return items;
      } catch (err) {
              console.log('searchByKeyword error:', err.message);
              return [];
      }
}

async function searchByShop(shopId, maxItems) {
      try {
              // メルカリショップはshops.mercari-shops.com
        var url = 'https://mercari-shops.com/shops/' + shopId;
              console.log('Fetching shop URL:', url);
              var res = await fetch(url, { headers: HEADERS, timeout: 25000 });
              if (!res.ok) {
                        console.log('shop fetch error:', res.status);
                        return [];
              }
              var html = await res.text();
              console.log('Shop HTML length:', html.length);
              var items = parseItemsFromHtml(html, maxItems || 30);
              console.log('shop search:', shopId, '->', items.length, 'items');
              return items;
      } catch (err) {
              console.log('searchByShop error:', err.message);
              return [];
      }
}

async function searchByUser(userId, maxItems) {
      try {
              var url = 'https://jp.mercari.com/user/profile/' + userId + '?sort=created_time&order=desc&status=on_sale';
              console.log('Fetching user URL:', url);
              var res = await fetch(url, { headers: HEADERS, timeout: 25000 });
              if (!res.ok) {
                        console.log('user fetch error:', res.status);
                        return [];
              }
              var html = await res.text();
              console.log('User HTML length:', html.length);
              var items = parseItemsFromHtml(html, maxItems || 30);
              console.log('user search:', userId, '->', items.length, 'items');
              return items;
      } catch (err) {
              console.log('searchByUser error:', err.message);
              return [];
      }
}

app.get('/health', function(req, res) {
      res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/scrape', async function(req, res) {
      var type = req.query.type;
      var query = req.query.query;
      var max = parseInt(req.query.max) || 30;
      if (!type || !query) {
              return res.status(400).json({ error: 'type and query are required' });
      }
      console.log('Scrape:', type, '=', query);
      var items = [];
      try {
              if (type === 'keyword') {
                        items = await searchByKeyword(query, max);
              } else if (type === 'shop') {
                        items = await searchByShop(query, max);
              } else if (type === 'user') {
                        items = await searchByUser(query, max);
              }
              res.json({ success: true, items: items });
      } catch (err) {
              console.log('scrape error:', err.message);
              res.json({ success: false, error: err.message, items: [] });
      }
});

app.listen(PORT, function() {
      console.log('Mercari scraper server running on port ' + PORT);
});
