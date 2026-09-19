const STORAGE_KEY = 'ponio_barcodelookup_api_key';

function mapCategory(rawCategory = '') {
  const cat = String(rawCategory).toLowerCase();
  if (cat.includes('beverage') || cat.includes('drink') || cat.includes('coffee') || cat.includes('tea') || cat.includes('juice') || cat.includes('water') || cat.includes('soda')) {
    return 'Beverages';
  }
  if (cat.includes('snack') || cat.includes('chip') || cat.includes('candy') || cat.includes('chocolate') || cat.includes('biscuit') || cat.includes('cookie')) {
    return 'Snacks';
  }
  if (cat.includes('grocer') || cat.includes('food') || cat.includes('sauce') || cat.includes('oil') || cat.includes('canned') || cat.includes('rice') || cat.includes('noodle')) {
    return 'Groceries';
  }
  if (cat.includes('house') || cat.includes('clean') || cat.includes('detergent') || cat.includes('soap') || cat.includes('bath') || cat.includes('paper')) {
    return 'Household';
  }
  return 'General';
}

export class BarcodeLookupService {
  constructor() {
    this.apiKey = this.loadApiKey();
  }

  loadApiKey() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return stored.trim();
      }
    } catch {
      return '';
    }

    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BARCODELOOKUP_API_KEY) {
      return String(import.meta.env.VITE_BARCODELOOKUP_API_KEY).trim();
    }

    if (typeof process !== 'undefined' && process.env?.VITE_BARCODELOOKUP_API_KEY) {
      return String(process.env.VITE_BARCODELOOKUP_API_KEY).trim();
    }

    return '';
  }

  setApiKey(key) {
    const trimmed = String(key || '').trim();
    this.apiKey = trimmed;
    try {
      if (typeof localStorage !== 'undefined') {
        if (trimmed) {
          localStorage.setItem(STORAGE_KEY, trimmed);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      console.warn('Failed saving BarcodeLookup API key', e);
    }
  }

  getApiKey() {
    return this.apiKey || '';
  }

  async lookup(barcode) {
    const cleanCode = String(barcode || '').trim().replace(/[^0-9a-zA-Z]/g, '');
    if (!cleanCode) {
      return { found: false, barcode: '', name: '', category: 'General', imageUrl: '', sellingPrice: 0 };
    }

    if (this.apiKey) {
      try {
        const result = await this.fetchFromBarcodeLookup(cleanCode, this.apiKey);
        if (result && result.found) {
          return result;
        }
      } catch (err) {
        console.warn('BarcodeLookup API request error', err);
      }
    }

    try {
      const fallbackResult = await this.fetchFromOpenFoodFacts(cleanCode);
      if (fallbackResult && fallbackResult.found) {
        return fallbackResult;
      }
    } catch (err) {
      console.warn('Fallback barcode database lookup error', err);
    }

    return {
      found: false,
      barcode: cleanCode,
      name: '',
      category: 'General',
      imageUrl: '',
      sellingPrice: 0,
    };
  }

  async fetchFromBarcodeLookup(barcode, key) {
    const isBrowser = typeof window !== 'undefined';
    const endpoints = isBrowser
      ? [
          `/api/barcodelookup/products?barcode=${encodeURIComponent(barcode)}&formatted=y&key=${encodeURIComponent(key)}`,
          `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&formatted=y&key=${encodeURIComponent(key)}`
        ]
      : [
          `https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(barcode)}&formatted=y&key=${encodeURIComponent(key)}`
        ];

    let lastError = null;

    for (const url of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!res.ok) {
          lastError = new Error(`BarcodeLookup returned status ${res.status}`);
          continue;
        }

        const data = await res.json();
        const product = data?.products?.[0];
        if (product) {
          const rawPrice = product.stores?.[0]?.price;
          const parsedPrice = parseFloat(rawPrice);
          const images = Array.isArray(product.images) ? product.images : [];
          const primaryImage = images.length > 0 ? String(images[0]).trim() : '';

          return {
            found: true,
            source: 'barcodelookup',
            barcode: product.barcode_number || barcode,
            name: product.title || product.product_name || product.brand || '',
            category: mapCategory(product.category || ''),
            imageUrl: primaryImage,
            sellingPrice: !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0,
            description: product.description || '',
            manufacturer: product.manufacturer || product.brand || '',
          };
        }
      } catch (e) {
        lastError = e;
      }
    }

    if (lastError) throw lastError;
    return { found: false, barcode };
  }

  async fetchFromOpenFoodFacts(barcode) {
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return { found: false, barcode };

    const data = await res.json();
    if (data?.status === 1 && data?.product) {
      const p = data.product;
      const title = p.product_name || p.generic_name || p.brands || '';
      const imageUrl = p.image_front_url || p.image_url || p.image_small_url || '';
      const category = mapCategory(p.categories || p.categories_tags?.join(' ') || '');

      return {
        found: true,
        source: 'openfoodfacts',
        barcode: p.code || barcode,
        name: title,
        category,
        imageUrl,
        sellingPrice: 0,
        description: p.generic_name || '',
      };
    }

    return { found: false, barcode };
  }
}

export const barcodeLookupService = new BarcodeLookupService();
