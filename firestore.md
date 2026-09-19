## Firestore Database Schema

## products (Collection)
Tracks item details, pricing, and active quantities.

{
  "id": "prod_1001",
  "barcode": "480000000001",
  "name": "Barako Ground Coffee 250g",
  "category": "Beverages",
  "costPrice": 120.00,
  "sellingPrice": 185.00,
  "stock": 42,
  "lowStockThreshold": 10,
  "isActive": true,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}

## orders (Collection)
Records sales, checkout types, and snapshot item data.

{
  "id": "ord_80291",
  "orderNumber": "ORD-20261012-001",
  "cashierId": "user_abc123",
  "items": [
    {
      "productId": "prod_1001",
      "name": "Barako Ground Coffee 250g",
      "quantity": 2,
      "unitPrice": 185.00,
      "subtotal": 370.00
    }
  ],
  "totalAmount": 370.00,
  "amountTendered": 500.00,
  "change": 130.00,
  "paymentMethod": "CASH",
  "status": "COMPLETED",
  "createdAt": "Timestamp"
}

## stock_logs (Collection)
Audit trail for manual adjustments, incoming shipments, or damaged goods.

{
  "id": "log_5501",
  "productId": "prod_1001",
  "changeType": "RESTOCK", 
  "quantityChanged": 20,
  "previousStock": 22,
  "newStock": 42,
  "reason": "Supplier Delivery Batch #48",
  "userId": "user_abc123",
  "timestamp": "Timestamp"
}

## users (Collection)
User accounts, role assignments, and approval status.

{
  "id": "user_abc123",
  "email": "cashier@poniostore.ph",
  "name": "Rachell Staff",
  "role": "CASHIER",
  "status": "PENDING",
  "provider": "password",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp",
  "approvedAt": "Timestamp",
  "approvedBy": "admin_uid"
}
