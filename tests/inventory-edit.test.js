import assert from 'node:assert';

global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const { inventoryService } = await import('../src/services/inventory.service.js');

console.log('Testing Inventory Item Edit Functionality...');

const products = await inventoryService.getProducts();
assert(products.length > 0, 'Products catalog should contain items');

const targetProduct = products[0];
const originalName = targetProduct.name;
const originalSellingPrice = targetProduct.sellingPrice;

const updatedProduct = await inventoryService.updateProduct(targetProduct.id, {
  name: 'Updated ' + originalName,
  sellingPrice: originalSellingPrice + 25.50,
  costPrice: 99.00,
  category: 'Beverages',
  stock: 50,
  lowStockThreshold: 12,
  isActive: true,
  imageUrl: 'https://example.com/item.png'
});

assert.strictEqual(updatedProduct.name, 'Updated ' + originalName);
assert.strictEqual(updatedProduct.sellingPrice, originalSellingPrice + 25.50);
assert.strictEqual(updatedProduct.costPrice, 99.00);
assert.strictEqual(updatedProduct.stock, 50);
assert.strictEqual(updatedProduct.lowStockThreshold, 12);
assert.strictEqual(updatedProduct.isActive, true);
assert.strictEqual(updatedProduct.imageUrl, 'https://example.com/item.png');

const refetched = (await inventoryService.getProducts()).find(p => p.id === targetProduct.id);
assert(refetched, 'Updated product must exist in inventory');
assert.strictEqual(refetched.name, 'Updated ' + originalName);
assert.strictEqual(refetched.sellingPrice, originalSellingPrice + 25.50);

await inventoryService.updateProduct(targetProduct.id, {
  name: originalName,
  sellingPrice: originalSellingPrice
});

const restored = (await inventoryService.getProducts()).find(p => p.id === targetProduct.id);
assert.strictEqual(restored.name, originalName);
assert.strictEqual(restored.sellingPrice, originalSellingPrice);

console.log('All Inventory Item Edit tests passed successfully!');
