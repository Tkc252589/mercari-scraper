const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Mercari API経由でキーワード検索
async function searchByKeyword(keyword, maxItems) {
  try {
    const fetch = (await import('node-fetch')).default;
    
    // Mercari Search API
    const searchUrl = 'https://api.mercari.jp/v2/entities:search';
    const body = {
      pageSize: maxItems || 30,
      pageToken: '',
      searchSessionId: Math.random().toString(36).substr(2, 9),
      indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
      thumbnailTypes: [],
      searchCondition: {
        keyword: keyword,
        sortBy: 'SORT_BY_CREATED_TIME',
        order: 'ORDER_DESC',
        status: ['STATUS_ON_SALE'],
        categoryId: [],
        brandId: [],
        sellerId: [],
        priceMin: 0,
        priceMax: 0,
        itemTypes: [],
        skuIds: [],
        shippingMethodId: ''
      },
      defaultDatasets: ['DATASET_TYPE_MERCARI', 'DATASET_TYPE_BEYOND'],
      serviceFrom: 'suruga',
      userId: '',
      withItemBrand: true,
      withItemSize: false,
      withItemPromotions: false,
      withRecommendBanner: false
    };
    
    const res = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Platform': 'web',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://jp.mercari.com',
        'Referer': 'https://jp.mercari.com/'
      },
      body: JSON.stringify(body),
      timeout: 20000
    });
    
    if (!res.ok) {
      console.log('API error:', res.status, res.statusText);
      return [];
    }
    
    const data = await res.json();
    const items = (data.items || []).map(item => ({
      url: 'https://jp.mercari.com/item/' + item.id,
      image: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0] : '',
      price: String(item.price || ''),
      title: item.name || ''
    }));
    
    console.log('keyword search:', keyword, '->', items.length, 'items');
    return items;
  } catch (err) {
    console.log('searchByKeyword error:', err.message);
    return [];
  }
}

// メルカリショップ（puppeteer不要版 - HTMLパース）
async function searchByShop(shopId, maxItems) {
  try {
    const fetch = (await import('node-fetch')).default;
    // Shop検索はAPIが別なのでHTMLスクレイピング継続
    // まずショップのAPIを試す
    const url = 'https://api.mercari.jp/v2/entities:search';
    const body = {
      pageSize: maxItems || 30,
      pageToken: '',
      searchSessionId: Math.random().toString(36).substr(2, 9),
      indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
      thumbnailTypes: [],
      searchCondition: {
        keyword: '',
        sortBy: 'SORT_BY_CREATED_TIME',
        order: 'ORDER_DESC',
        status: ['STATUS_ON_SALE'],
        categoryId: [],
        brandId: [],
        sellerId: [shopId],
        priceMin: 0,
        priceMax: 0,
        itemTypes: [],
        skuIds: [],
        shippingMethodId: ''
      },
      defaultDatasets: ['DATASET_TYPE_MERCARI'],
      serviceFrom: 'suruga',
      userId: '',
      withItemBrand: true,
      withItemSize: false,
      withItemPromotions: false,
      withRecommendBanner: false
    };
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform': 'web',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://jp.mercari.com',
        'Referer': 'https://jp.mercari.com/'
      },
      body: JSON.stringify(body),
      timeout: 20000
    });
    
    if (!res.ok) {
      console.log('shop API error:', res.status);
      return [];
    }
    
    const data = await res.json();
    const items = (data.items || []).map(item => ({
      url: 'https://jp.mercari.com/item/' + item.id,
      image: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0] : '',
      price: String(item.price || ''),
      title: item.name || ''
    }));
    
    console.log('shop search:', shopId, '->', items.length, 'items');
    return items;
  } catch (err) {
    console.log('searchByShop error:', err.message);
    return [];
  }
}

// ユーザー出品検索
async function searchByUser(userId, maxItems) {
  try {
    const fetch = (await import('node-fetch')).default;
    const url = 'https://api.mercari.jp/v2/entities:search';
    const body = {
      pageSize: maxItems || 30,
      pageToken: '',
      searchSessionId: Math.random().toString(36).substr(2, 9),
      indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
      thumbnailTypes: [],
      searchCondition: {
        keyword: '',
        sortBy: 'SORT_BY_CREATED_TIME',
        order: 'ORDER_DESC',
        status: ['STATUS_ON_SALE'],
        categoryId: [],
        brandId: [],
        sellerId: [],
        priceMin: 0,
        priceMax: 0,
        itemTypes: [],
        skuIds: [],
        shippingMethodId: ''
      },
      defaultDatasets: ['DATASET_TYPE_MERCARI'],
      serviceFrom: 'suruga',
      userId: userId,
      withItemBrand: true,
      withItemSize: false,
      withItemPromotions: false,
      withRecommendBanner: false
    };
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Platform': 'web',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://jp.mercari.com',
        'Referer': 'https://jp.mercari.com/'
      },
      body: JSON.stringify(body),
      timeout: 20000
    });
    
    if (!res.ok) {
      console.log('user API error:', res.status);
      return [];
    }
    
    const data = await res.json();
    const items = (data.items || []).map(item => ({
      url: 'https://jp.mercari.com/item/' + item.id,
      image: item.thumbnails && item.thumbnails[0] ? item.thumbnails[0] : '',
      price: String(item.price || ''),
      title: item.name || ''
    }));
    
    console.log('user search:', userId, '->', items.length, 'items');
    return items;
  } catch (err) {
    console.log('searchByUser error:', err.message);
    return [];
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
  
  console.log('Scrape:', type, '=', query);
  
  let items = [];
  try {
    if (type === 'keyword') {
      items = await searchByKeyword(query, parseInt(max) || 30);
    } else if (type === 'shop') {
      items = await searchByShop(query, parseInt(max) || 30);
    } else if (type === 'user') {
      items = await searchByUser(query, parseInt(max) || 30);
    }
    res.json({ success: true, items });
  } catch (err) {
    console.log('scrape error:', err.message);
    res.json({ success: false, error: err.message, items: [] });
  }
});

app.listen(PORT, () => {
  console.log('Mercari scraper server running on port ' + PORT);
});
