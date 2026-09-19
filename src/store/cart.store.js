class CartStore extends EventTarget {
  constructor() {
    super();
    this.items = [];
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this);
    return () => this.listeners.delete(callback);
  }

  _notify() {
    this.dispatchEvent(new CustomEvent('cart-changed', { detail: this.getState() }));
    for (const cb of this.listeners) {
      cb(this);
    }
  }

  getState() {
    return {
      items: [...this.items],
      totalCount: this.getTotalCount(),
      subtotal: this.getSubtotal(),
      totalAmount: this.getTotalAmount(),
    };
  }

  getItems() {
    return [...this.items];
  }

  getTotalCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0);
  }

  getTotalAmount() {
    return this.getSubtotal();
  }

  addItem(product, qty = 1) {
    if (!product || product.stock <= 0) {
      return false;
    }

    const existingIndex = this.items.findIndex(item => item.productId === product.id);

    if (existingIndex > -1) {
      const existing = this.items[existingIndex];
      const newQty = existing.quantity + qty;
      if (newQty > product.stock) {
        return false;
      }
      existing.quantity = newQty;
      existing.subtotal = existing.quantity * existing.sellingPrice;
      existing.maxStock = product.stock;
    } else {
      const initialQty = Math.min(qty, product.stock);
      this.items.push({
        productId: product.id,
        name: product.name,
        sellingPrice: Number(product.sellingPrice) || 0,
        quantity: initialQty,
        subtotal: initialQty * (Number(product.sellingPrice) || 0),
        maxStock: product.stock,
        category: product.category || 'General',
        barcode: product.barcode || '',
      });
    }

    this._notify();
    return true;
  }

  updateQuantity(productId, newQty) {
    const item = this.items.find(i => i.productId === productId);
    if (!item) return;

    if (newQty <= 0) {
      this.removeItem(productId);
      return;
    }

    if (item.maxStock !== undefined && newQty > item.maxStock) {
      item.quantity = item.maxStock;
    } else {
      item.quantity = newQty;
    }

    item.subtotal = item.quantity * item.sellingPrice;
    this._notify();
  }

  removeItem(productId) {
    this.items = this.items.filter(i => i.productId !== productId);
    this._notify();
  }

  clearCart() {
    this.items = [];
    this._notify();
  }
}

export const cartStore = new CartStore();
