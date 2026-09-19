import assert from 'node:assert';

global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const { inventoryService } = await import('../src/services/inventory.service.js');
const { cartStore } = await import('../src/store/cart.store.js');

console.log('Testing Price Checker Inventory Lookup...');

const products = await inventoryService.getProducts();
assert(products.length > 0, 'Products should exist in inventory');

const testProduct = products[0];
assert(testProduct.barcode, 'Test product should have a barcode');

const matchByBarcode = products.find(p => p.barcode === testProduct.barcode);
assert(matchByBarcode, 'Product should be found by barcode');
assert.strictEqual(matchByBarcode.sellingPrice, testProduct.sellingPrice);
assert.strictEqual(matchByBarcode.name, testProduct.name);

const notFound = products.find(p => p.barcode === '9999999999999');
assert.strictEqual(notFound, undefined, 'Unregistered barcode should return undefined');

console.log('Testing Price Checker Cart Integration...');
cartStore.clearCart();
const added = cartStore.addItem(matchByBarcode, 1);
assert.strictEqual(added, true, 'Item should be successfully added to cart');
assert.strictEqual(cartStore.getTotalCount(), 1);

console.log('All Price Checker tests passed successfully!');
