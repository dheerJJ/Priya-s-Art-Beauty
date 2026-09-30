# Salon WhatsApp Billing Automation
## API & Database Specification
**Version:** 1.0

## API Conventions
- Base URL: `/api`
- JSON requests/responses
- Bearer JWT for protected routes
- Consistent HTTP status codes
- Request validation

## Endpoints
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Staff login |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers` | Search customers |
| POST | `/api/services` | Create service |
| GET | `/api/services` | List services |
| POST | `/api/bills` | Create bill and trigger workflow |
| GET | `/api/bills` | List/search bills |
| GET | `/api/bills/:id` | Bill details |
| POST | `/api/bills/:id/resend` | Controlled resend |
| POST | `/api/webhooks/whatsapp` | Meta webhook |
| GET | `/api/reports/sales` | Sales summary |

## Create Bill Request
```json
{
  "customer": {
    "name": "Rahul",
    "phone": "919876543210"
  },
  "items": [
    {"serviceId": 1, "name": "Haircut", "qty": 1, "price": 500},
    {"serviceId": 2, "name": "Beard", "qty": 1, "price": 200}
  ],
  "discount": 0,
  "tax": 0,
  "paymentMethod": "UPI"
}
```

## Database Tables
| Table | Key fields |
|---|---|
| users | id, name, email, password_hash, role, created_at |
| salons | id, name, address, phone, tax_number, logo_url, invoice_prefix |
| customers | id, salon_id, name, phone, email, created_at |
| services | id, salon_id, name, category, price, active |
| bills | id, salon_id, customer_id, invoice_no, subtotal, discount, tax, total, payment_method, status, created_at |
| bill_items | id, bill_id, service_id, service_name, qty, unit_price, line_total |
| invoices | id, bill_id, pdf_url, generated_at |
| whatsapp_messages | id, bill_id, recipient_phone, template_name, meta_message_id, status, error_message, sent_at, updated_at |
| audit_logs | id, salon_id, user_id, action, entity_type, entity_id, created_at |

## Relationships
```text
salons
  ├── users
  ├── customers
  ├── services
  └── bills
        ├── bill_items
        ├── invoice
        └── whatsapp_messages
```

## Transaction Rule
```text
Create bill
   ↓
Create bill items
   ↓
Commit
   ↓
Generate PDF
   ↓
Send WhatsApp
   ↓
Store message status
```

A WhatsApp failure must not delete the bill.
