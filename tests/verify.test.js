import assert from 'node:assert';

global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  removeItem(key) { delete this.store[key]; },
  clear() { this.store = {}; }
};

const { formatCurrency, generateOrderNumber } = await import('../src/utils/formatters.js');
const { cartStore } = await import('../src/store/cart.store.js');
const { inventoryService } = await import('../src/services/inventory.service.js');
const { ordersService } = await import('../src/services/orders.service.js');
const { authService } = await import('../src/services/auth.service.js');
const { usersService } = await import('../src/services/users.service.js');

console.log('Starting PonioStore POS Unit & Integration Verification...');

console.log('Testing Formatters...');
assert.strictEqual(formatCurrency(185), '₱185.00');
assert.strictEqual(formatCurrency(0), '₱0.00');
const orderNum = generateOrderNumber();
assert.match(orderNum, /^ORD-\d{8}-\d{3}$/);
console.log('[PASSED] Formatters');

console.log('Testing Authentication Service & Admin Approval Workflow...');
assert.strictEqual(typeof authService.signInWithEmail, 'function');
assert.strictEqual(typeof authService.signUpWithEmail, 'function');
assert.strictEqual(typeof authService.signInWithGoogle, 'function');
assert.strictEqual(typeof authService.signOutUser, 'function');
assert.strictEqual(typeof usersService.approveUser, 'function');
assert.strictEqual(typeof usersService.rejectUser, 'function');
assert.strictEqual(typeof usersService.updateUserRole, 'function');

const allInitialUsers = await usersService.getUsers();
assert(allInitialUsers.length >= 1, 'Initial admin user must exist');
const ybAdmin = allInitialUsers.find(u => u.email === 'ybponio@gmail.com');
assert(ybAdmin, 'ybponio@gmail.com must be present');
assert.strictEqual(ybAdmin.id, 'usr_admin_001');
assert.strictEqual(ybAdmin.name, 'Ycker');
assert.strictEqual(ybAdmin.role, 'ADMIN');
assert.strictEqual(ybAdmin.status, 'APPROVED');

const createdUser = await authService.signUpWithEmail('cashier@poniostore.ph', 'password123', 'Rachell Staff');
assert.strictEqual(createdUser.name, 'Rachell Staff');
assert.strictEqual(createdUser.email, 'cashier@poniostore.ph');
assert.strictEqual(createdUser.role, 'NONE');
assert.strictEqual(createdUser.status, 'PENDING');
assert.strictEqual(authService.isAuthenticated(), true);
assert.strictEqual(authService.isApproved(), false);

await authService.signOutUser();
assert.strictEqual(authService.isAuthenticated(), false);
assert.strictEqual(authService.getCurrentUser(), null);

const signedInUser = await authService.signInWithEmail('cashier@poniostore.ph', 'password123');
assert.strictEqual(signedInUser.status, 'PENDING');
assert.strictEqual(signedInUser.role, 'NONE');
assert.strictEqual(authService.isApproved(), false);

console.log('Testing Admin User Approval & Role Management...');
const approvedRecord = await usersService.approveUser(signedInUser.id, ybAdmin.id, 'CASHIER');
assert.strictEqual(approvedRecord.status, 'APPROVED');
assert.strictEqual(approvedRecord.role, 'CASHIER');
assert.strictEqual(approvedRecord.approvedBy, ybAdmin.id);

const refreshedUser = await authService.refreshCurrentUserProfile();
assert.strictEqual(refreshedUser.status, 'APPROVED');
assert.strictEqual(authService.isApproved(), true);

await usersService.updateUserRole(signedInUser.id, 'MANAGER');
const updatedRoleProfile = await usersService.getUserProfile(signedInUser.id);
assert.strictEqual(updatedRoleProfile.role, 'MANAGER');

await usersService.updateUserRole(signedInUser.id, 'CASHIER');
const resetRoleProfile = await usersService.getUserProfile(signedInUser.id);
assert.strictEqual(resetRoleProfile.role, 'CASHIER');

const savedSessionRaw = global.localStorage.getItem('poniostore_session_user');
assert(savedSessionRaw, 'Active session must be stored in localStorage');
const parsedSession = JSON.parse(savedSessionRaw);
assert.strictEqual(parsedSession.email, 'cashier@poniostore.ph');
assert.strictEqual(authService.isAuthenticated(), true);
assert.strictEqual(authService.isAdmin(), false, 'Cashier must not be recognized as admin');

authService.currentUser.role = 'ADMIN';
assert.strictEqual(authService.isAdmin(), true, 'Admin role must be recognized as admin');
authService.currentUser.role = 'CASHIER';
assert.strictEqual(authService.isAdmin(), false);

console.log('[PASSED] Authentication Service & User Management Approval Workflow');

console.log('Testing Inventory Service...');
const products = await inventoryService.getProducts();
assert(products.length >= 8, 'Expected at least 8 seed products');
const barako = products.find(p => p.id === 'prod_1001');
assert(barako, 'Barako coffee should be present');
assert.strictEqual(barako.name, 'Barako Ground Coffee 250g');
assert.strictEqual(barako.sellingPrice, 185.00);
assert.strictEqual(barako.stock, 42);

const initialStock = barako.stock;
const adjustResult = await inventoryService.adjustStock({
  productId: 'prod_1001',
  changeType: 'RESTOCK',
  quantityChanged: 10,
  reason: 'Test shipment batch',
  userId: signedInUser.id
});
assert.strictEqual(adjustResult.newStock, initialStock + 10);
const logs = await inventoryService.getStockLogs('prod_1001');
assert(logs.length > 0, 'Stock logs should have entries');
assert.strictEqual(logs[0].changeType, 'RESTOCK');
console.log('[PASSED] Inventory Service & Stock Logs');

console.log('Testing Cart Store...');
cartStore.clearCart();
assert.strictEqual(cartStore.getTotalCount(), 0);

const currentBarako = (await inventoryService.getProducts()).find(p => p.id === 'prod_1001');
const added = cartStore.addItem(currentBarako, 2);
assert.strictEqual(added, true);
assert.strictEqual(cartStore.getTotalCount(), 2);
assert.strictEqual(cartStore.getSubtotal(), 185.00 * 2);

const failAdd = cartStore.addItem(currentBarako, 9999);
assert.strictEqual(failAdd, false, 'Should reject adding more than max stock');
console.log('[PASSED] Cart Store operations');

console.log('Testing Checkout & Order Service with Approved Cashier...');
const stockBeforeCheckout = (await inventoryService.getProducts()).find(p => p.id === 'prod_1001').stock;

const checkoutOrder = await ordersService.processCheckout({
  items: cartStore.getItems(),
  totalAmount: 370.00,
  amountTendered: 500.00,
  change: 130.00,
  paymentMethod: 'CASH',
  cashierId: signedInUser.id,
  cashierName: signedInUser.name
});

assert(checkoutOrder.orderNumber, 'Order number must be generated');
assert.strictEqual(checkoutOrder.totalAmount, 370.00);
assert.strictEqual(checkoutOrder.amountTendered, 500.00);
assert.strictEqual(checkoutOrder.change, 130.00);
assert.strictEqual(checkoutOrder.cashierId, signedInUser.id);
assert.strictEqual(checkoutOrder.cashierName, signedInUser.name);
assert.strictEqual(checkoutOrder.status, 'COMPLETED');

const stockAfterCheckout = (await inventoryService.getProducts()).find(p => p.id === 'prod_1001').stock;
assert.strictEqual(stockAfterCheckout, stockBeforeCheckout - 2, 'Stock should be deducted by 2');

const orders = await ordersService.getOrders();
assert(orders.some(o => o.orderNumber === checkoutOrder.orderNumber), 'Order should exist in history');
console.log('[PASSED] Orders Service with approved cashier');

console.log('All automated tests passed successfully!');
