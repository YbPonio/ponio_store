import assert from 'node:assert';

global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const { barcodeLookupService } = await import('../src/services/barcode-lookup.service.js');
const { inventoryService } = await import('../src/services/inventory.service.js');

console.log('Testing BarcodeLookupService API Configuration...');
assert.strictEqual(typeof barcodeLookupService.lookup, 'function');
assert.strictEqual(typeof barcodeLookupService.setApiKey, 'function');
assert.strictEqual(typeof barcodeLookupService.getApiKey, 'function');

barcodeLookupService.setApiKey('test_key_12345');
assert.strictEqual(barcodeLookupService.getApiKey(), 'test_key_12345');
assert.strictEqual(global.localStorage.getItem('ponio_barcodelookup_api_key'), 'test_key_12345');

barcodeLookupService.setApiKey('');
assert.strictEqual(barcodeLookupService.getApiKey(), '');

console.log('Testing Empty and Invalid Barcode Handling...');
const emptyResult = await barcodeLookupService.lookup('');
assert.strictEqual(emptyResult.found, false);
assert.strictEqual(emptyResult.barcode, '');

const spaceResult = await barcodeLookupService.lookup('   ');
assert.strictEqual(spaceResult.found, false);

console.log('Testing Mock BarcodeLookup.com API response parser...');
const originalFetch = global.fetch;

global.fetch = async (url) => {
  if (url.includes('barcodelookup.com')) {
    return {
      ok: true,
      json: async () => ({
        products: [
          {
            barcode_number: '012345678901',
            title: 'Mock Premium Coffee 500g',
            category: 'Food, Beverages & Tobacco > Beverages > Coffee',
            images: ['https://images.barcodelookup.com/sample/coffee.jpg'],
            stores: [{ store_name: 'Store', price: '250.50' }],
            description: 'Organic roast coffee',
          }
        ]
      })
    };
  }
  return { ok: false, status: 404 };
};

barcodeLookupService.setApiKey('mock_valid_key');
const lookupResult = await barcodeLookupService.lookup('012345678901');
assert.strictEqual(lookupResult.found, true);
assert.strictEqual(lookupResult.source, 'barcodelookup');
assert.strictEqual(lookupResult.name, 'Mock Premium Coffee 500g');
assert.strictEqual(lookupResult.category, 'Beverages');
assert.strictEqual(lookupResult.imageUrl, 'https://images.barcodelookup.com/sample/coffee.jpg');
assert.strictEqual(lookupResult.sellingPrice, 250.5);

console.log('Testing Public Database Fallback parser when BarcodeLookup fails...');
global.fetch = async (url) => {
  if (url.includes('world.openfoodfacts.org')) {
    return {
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          code: '5449000000996',
          product_name: 'Coca Cola 330ml',
          image_front_url: 'https://images.openfoodfacts.org/coke.jpg',
          categories: 'Beverages, Carbonated drinks',
        }
      })
    };
  }
  return { ok: false, status: 401 };
};

barcodeLookupService.setApiKey('');
const fallbackResult = await barcodeLookupService.lookup('5449000000996');
assert.strictEqual(fallbackResult.found, true);
assert.strictEqual(fallbackResult.source, 'openfoodfacts');
assert.strictEqual(fallbackResult.name, 'Coca Cola 330ml');
assert.strictEqual(fallbackResult.category, 'Beverages');
assert.strictEqual(fallbackResult.imageUrl, 'https://images.openfoodfacts.org/coke.jpg');

global.fetch = originalFetch;

console.log('Testing InventoryService Product Creation with Image URL...');
const newProduct = await inventoryService.addProduct({
  barcode: '480000000099',
  name: 'Test Image Product',
  category: 'Snacks',
  costPrice: 40,
  sellingPrice: 70,
  stock: 15,
  lowStockThreshold: 5,
  imageUrl: 'https://example.com/test-snack.jpg',
});

assert.strictEqual(newProduct.name, 'Test Image Product');
assert.strictEqual(newProduct.imageUrl, 'https://example.com/test-snack.jpg');

const stored = (await inventoryService.getProducts()).find(p => p.id === newProduct.id);
assert(stored, 'New product must be in storage');
assert.strictEqual(stored.imageUrl, 'https://example.com/test-snack.jpg');

console.log('All Barcode Lookup & Image tests passed successfully!');
