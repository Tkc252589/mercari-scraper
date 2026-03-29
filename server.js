const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MERCARI_API = 'https://api.mercari.jp/v2/entities:search';

const COMMON_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Platform': 'web',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://jp.mercari.com',
    'Referer': 'https://jp.mercari.com/'
};

function makeBody(overrides) {
    return Object.assign({
          pageSize: 30,
          pageToken: '',
          searchSessionId: Math.random().toString(36).substr(2, 9),
          indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
          thumbnailTypes: [],
          defaultDatasets: ['DATASET_TYPE_MERCARI', 'DATASET_TYPE_BEYOND'],
          serviceFrom: 'suruga',
          userId: '',
          withItemBrand: true,
          withItemSize: false,
          withItemPromotions: false,
          withRecommendBanner: false
    }, overrides);
}

function mapItems(data) {
    return (data.items || []).map(function(item) {
          return {
                  url: 'https://jp.mercari.com/item/' + item.id,
                  image: (item.thumbnails && item.thumbnails[0]) ? item.thumbnails[0] : '',
                  price: String(item.price || ''),
                  title: item.name || ''
          };
    });
}

async function searchByKeyword(keyword, maxItems) {
    try {
          var body = makeBody({
                  pageSize: maxItems || 30,
                  searchCondition: {
          keyword: keyword,
                            sortBy: 'SORT_BY_CREATED_TIME',
                            order: 'ORDER_DESC',
                            status: ['STATUS_ON_SALE'],
                            categoryId: [], brandId: [], sellerId: [],
                            priceMin: 0, priceMax: 0,
                            itemTypes: [], skuIds: [], shippingMethodId: ''
                  }
          });
          var res = await fetch(MERCARI_API, {
                  method: 'POST',
                  headers: COMMON_HEADERS,
                  body: JSON.stringify(body),
                  timeout: 20000
          });
          if (!res.ok) {
                  console.log('keyword API error:', res.status, res.statusText);
                  return [];
          }
          var data = await res.json();
          var items = mapItems(data);
          console.log('keyword search:', keyword, '->', items.length, 'items');
          return items;
    } catch (err) {
          console.log('searchByKeyword error:', err.message);
          return [];
    }
}

async function searchByShop(shopId, maxItems) {
    try {
          var body = makeBody({
                  pageSize: maxItems || 30,
                  defaultDatasets: ['DATASET_TYPE_MERCARI'],
                  searchCondition: {
                            keyword: '',
                            sortBy: 'SORT_BY_CREATED_TIME',
                            order: 'ORDER_DESC',
                            status: ['STATUS_ON_SALE'],
                            categoryId: [], brandId: [], sellerId: [shopId],
                            priceMin: 0, priceMax: 0,
                            itemTypes: [], skuIds: [], shippingMethodId: ''
                  }
          });
          var res = await fetch(MERCARI_API, {
                  method: 'POST',
                  headers: COMMON_HEADERS,
                  body: JSON.stringify(body),
                  timeout: 20000
          });
          if (!res.ok) {
                  console.log('shop API error:', res.status);
                  return [];
          }
          var data = await res.json();
          var items = mapItems(data);
          console.log('shop search:', shopId, '->', items.length, 'items');
          return items;
    } catch (err) {
          console.log('searchByShop error:', err.message);
          return [];
    }
}

async function searchByUser(userId, maxItems) {
    try {
          var body = makeBody({
                  pageSize: maxItems || 30,
                  userId: userId,
                  defaultDatasets: ['DATASET_TYPE_MERCARI'],
                  searchCondition: {
                            keyword: '',
                            sortBy: 'SORT_BY_CREATED_TIME',
                            order: 'ORDER_DESC',
                            status: ['STATUS_ON_SALE'],
                            categoryId: [], brandId: [], sellerId: [],
                            priceMin: 0, priceMax: 0,
                            itemTypes: [], skuIds: [], shippingMethodId: ''
                  }
          });
          var res = await fetch(MERCARI_API, {
                  method: 'POST',
                  headers: COMMON_HEADERS,
                  body: JSON.stringify(body),
                  timeout: 20000
          });
          if (!res.ok) {
                  console.log('user API error:', res.status);
                  return [];
          }
          var data = await res.json();
          var items = mapItems(data);
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
