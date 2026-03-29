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

function parseItemsFromHtml(html, maxItems) {
        var items = [];
        try {
                  // Pattern 1: __NEXT_DATA__ script tag
          var nextDataStart = html.indexOf('"__NEXT_DATA__"');
                  if (nextDataStart === -1) nextDataStart = html.indexOf('id="__NEXT_DATA__"');

          if (nextDataStart !== -1) {
                      var tagEnd = html.indexOf('>', nextDataStart);
                      var scriptEnd = html.indexOf('</script>', tagEnd);
                      if (tagEnd > 0 && scriptEnd > 0) {
                                    var jsonStr = html.substring(tagEnd + 1, scriptEnd).trim();
                                    console.log('__NEXT_DATA__ snippet:', jsonStr.substring(0, 200));
                                    try {
                                                    var nd = JSON.parse(jsonStr);
                                                    var pp = nd && nd.props && nd.props.pageProps;
                                                    if (pp) {
                                                                      // Try various known keys
                                                      var candidates = [
                                                                          pp.items,
                                                                          pp.searchResult && pp.searchResult.items,
                                                                          pp.initialSearchResult && pp.initialSearchResult.items,
                                                                          pp.data && pp.data.items,
                                                                          pp.search && pp.search.items
                                                                        ];
                                                                      for (var c = 0; c < candidates.length; c++) {
                                                                                          if (candidates[c] && candidates[c].length > 0) {
                                                                                                                var src = candidates[c];
                                                                                                                for (var i = 0; i < Math.min(src.length, maxItems); i++) {
                                                                                                                                        var it = src[i];
                                                                                                                                        if (it.id) {
                                                                                                                                                                  items.push({
                                                                                                                                                                                              url: 'https://jp.mercari.com/item/' + it.id,
                                                                                                                                                                                              image: (it.thumbnails && it.thumbnails[0]) || it.thumbnail || '',
                                                                                                                                                                                              price: String(it.price || ''),
                                                                                                                                                                                              title: it.name || ''
                                                                                                                                                                        });
                                                                                                                                              }
                                                                                                                      }
                                                                                                                if (items.length > 0) {
                                                                                                                                        console.log('Found items via __NEXT_DATA__ key index', c);
                                                                                                                                        return items;
                                                                                                                      }
                                                                                                }
                                                                      }
                                                    }
                                                    console.log('__NEXT_DATA__ pageProps keys:', pp ? Object.keys(pp).join(',') : 'no pageProps');
                                    } catch(e2) {
                                                    console.log('__NEXT_DATA__ parse error:', e2.message.substring(0,100));
                                    }
                      }
          } else {
                      console.log('No __NEXT_DATA__ found in HTML');
          }

          // Pattern 2: Look for Apollo cache / GraphQL data
          var apolloStart = html.indexOf('window.__APOLLO_STATE__=');
                  if (apolloStart === -1) apolloStart = html.indexOf('window.__APOLLO_STATE__ =');
                  if (apolloStart !== -1) {
                              var apolloEnd = html.indexOf(';</script>', apolloStart);
                              if (apolloEnd > 0) {
                                            var apolloStr = html.substring(apolloStart + 25, apolloEnd);
                                            console.log('Apollo cache found, length:', apolloStr.length);
                                            try {
                                                            var apolloData = JSON.parse(apolloStr);
                                                            var keys = Object.keys(apolloData);
                                                            console.log('Apollo keys sample:', keys.slice(0,5).join(','));
                                                            for (var k = 0; k < keys.length && items.length < maxItems; k++) {
                                                                              var entry = apolloData[keys[k]];
                                                                              if (entry && entry.id && (entry.price !== undefined) && entry.name) {
                                                                                                  items.push({
                                                                                                                        url: 'https://jp.mercari.com/item/' + entry.id,
                                                                                                                        image: (entry.thumbnails && entry.thumbnails[0]) || '',
                                                                                                                        price: String(entry.price || ''),
                                                                                                                        title: entry.name || ''
                                                                                                        });
                                                                              }
                                                            }
                                                            if (items.length > 0) {
                                                                              console.log('Found items via Apollo cache:', items.length);
                                                                              return items;
                                                            }
                                            } catch(e3) {
                                                            console.log('Apollo parse error:', e3.message.substring(0,100));
                                            }
                              }
                  }

          // Pattern 3: window.__INITIAL_STATE__
          var initStart = html.indexOf('window.__INITIAL_STATE__=');
                  if (initStart === -1) initStart = html.indexOf('window.__INITIAL_STATE__ =');
                  if (initStart !== -1) {
                              var initEnd = html.indexOf(';</script>', initStart);
                              if (initEnd > 0) {
                                            var initStr = html.substring(initStart + 25, initEnd);
                                            console.log('__INITIAL_STATE__ found, length:', initStr.length);
                                            try {
                                                            var initData = JSON.parse(initStr);
                                                            var searchItems = initData && initData.search && initData.search.items;
                                                            if (searchItems && searchItems.length > 0) {
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
                                                            if (items.length > 0) return items;
                                            } catch(e4) {}
                              }
                  }

          // Pattern 4: Look for mercari item JSON pattern in script tags
          var itemJsonPattern = '"id":"m';
                  var searchPos = 0;
                  var seenIds = {};
                  while (items.length < maxItems) {
                              var idxP = html.indexOf(itemJsonPattern, searchPos);
                              if (idxP === -1) break;
                              // Extract the id value
                    var idStart = idxP + 5; // skip "id":"
                    var idEnd = html.indexOf('"', idStart);
                              if (idEnd === -1) { searchPos = idxP + 1; continue; }
                              var itemId = html.substring(idStart, idEnd);
                              if (itemId && itemId.length > 3 && itemId.length < 20 && !seenIds[itemId]) {
                                            seenIds[itemId] = true;
                                            items.push({
                                                            url: 'https://jp.mercari.com/item/' + itemId,
                                                            image: '',
                                                            price: '',
                                                            title: ''
                                            });
                              }
                              searchPos = idxP + 1;
                  }
                  if (items.length > 0) {
                              console.log('Found items via id pattern:', items.length);
                              return items;
                  }

          console.log('No items found in HTML. Checking patterns...');
                  // Log what data patterns exist
          if (html.indexOf('"__NEXT_DATA__"') !== -1) console.log('Has __NEXT_DATA__');
                  if (html.indexOf('window.__APOLLO_STATE__') !== -1) console.log('Has Apollo state');
                  if (html.indexOf('window.__INITIAL_STATE__') !== -1) console.log('Has initial state');
                  if (html.indexOf('/item/m') !== -1) console.log('Has /item/m links');

        } catch(e) {
                  console.log('parseItemsFromHtml top error:', e.message);
        }
        return items;
}

async function fetchAndParse(url, type, query, maxItems) {
        try {
                  console.log('Fetching:', url);
                  var res = await fetch(url, { headers: HEADERS, timeout: 25000 });
                  console.log('Status:', res.status, 'for', query);
                  if (!res.ok) {
                              console.log('fetch error:', res.status);
                              return [];
                  }
                  var html = await res.text();
                  console.log('HTML length:', html.length);
                  var items = parseItemsFromHtml(html, maxItems || 30);
                  console.log(type + ' search:', query, '->', items.length, 'items');
                  return items;
        } catch (err) {
                  console.log(type + ' error:', err.message);
                  return [];
        }
}

async function searchByKeyword(keyword, maxItems) {
        var url = 'https://jp.mercari.com/search?keyword=' + encodeURIComponent(keyword) + '&status=on_sale&sort=created_time&order=desc';
        return fetchAndParse(url, 'keyword', keyword, maxItems);
}

async function searchByShop(shopId, maxItems) {
        var url = 'https://mercari-shops.com/shops/' + shopId;
        return fetchAndParse(url, 'shop', shopId, maxItems);
}

async function searchByUser(userId, maxItems) {
        var url = 'https://jp.mercari.com/user/profile/' + userId + '?sort=created_time&order=desc&status=on_sale';
        return fetchAndParse(url, 'user', userId, maxItems);
}

app.get('/health', function(req, res) {
        res.json({ status: 'ok', time: new Date().toISOString() });
});

// Debug endpoint - returns HTML snippet for diagnosis
app.get('/debug', async function(req, res) {
        var keyword = req.query.keyword || 'トート';
        var url = 'https://jp.mercari.com/search?keyword=' + encodeURIComponent(keyword) + '&status=on_sale';
        try {
                  var r = await fetch(url, { headers: HEADERS, timeout: 25000 });
                  var html = await r.text();
                  // Return first 3000 chars for debugging
          res.json({
                      status: r.status,
                      htmlLength: html.length,
                      snippet: html.substring(0, 3000),
                      hasNextData: html.indexOf('__NEXT_DATA__') !== -1,
                      hasApollo: html.indexOf('__APOLLO_STATE__') !== -1,
                      hasInitialState: html.indexOf('__INITIAL_STATE__') !== -1,
                      hasItemLinks: html.indexOf('/item/m') !== -1
          });
        } catch(err) {
                  res.json({ error: err.message });
        }
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
