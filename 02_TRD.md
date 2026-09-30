# Salon WhatsApp Billing Automation
## Technical Requirements Document (TRD)
**Version:** 1.0

## Architecture
```text
Browser
   ↓ HTTPS
React Frontend
   ↓ REST API
Node.js + Express
   ├── PostgreSQL
   ├── PDF/Invoice Service
   └── WhatsApp Service
           ↓
      Meta Graph API
           ↓
    Customer WhatsApp

Meta Webhook
   ↓
Node.js Webhook
   ↓
Update WhatsApp Status
   ↓
PostgreSQL
```

## Technology Stack
| Layer | Technology |
|---|---|
| Frontend | React.js |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| PDF | PDFKit or equivalent |
| WhatsApp | Meta WhatsApp Business Platform / Cloud API |
| Auth | JWT + bcrypt/argon2 |
| Hosting | Render/Railway/VPS or equivalent |
| Storage | Object storage if required |

## Security
- HTTPS in production.
- Store Meta tokens, app secrets and DB credentials in server-side secrets.
- Never expose Meta tokens to React.
- Validate/normalize phone numbers.
- Protect routes with authentication.
- Use parameterized SQL.
- Add rate limiting.
- Keep audit logs.
- Restrict CORS.
- Use least-privilege permissions.

## WhatsApp Integration
- Client owns the Meta Business Portfolio and WhatsApp Business Account.
- Client's business phone number is connected to WhatsApp Business Platform.
- Use approved templates where required.
- Backend calls Meta Graph API.
- Store message IDs/status, not credentials.
- Implement webhook handling.

## PDF Requirements
- Unique invoice number
- Salon name/logo/contact
- Customer name/phone
- Date/time
- Service items
- Subtotal/discount/tax/total
- Payment method/status
- Optional footer/terms

## Error Handling
| Scenario | Expected behavior |
|---|---|
| Invalid number | Flag/reject before sending; keep bill stored. |
| PDF failure | Record failure and allow retry. |
| WhatsApp API failure | Store error and allow controlled retry. |
| Token revoked | Mark integration error and notify admin. |
| Webhook update | Update status by message ID. |
| DB failure | Return safe error and log server-side detail. |

## Environment Variables
```env
DATABASE_URL=...
JWT_SECRET=...
META_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_BUSINESS_ACCOUNT_ID=...
META_APP_ID=...
META_APP_SECRET=...
PUBLIC_API_URL=...
INVOICE_STORAGE_URL=...
```

Never commit real values to Git.

## Deployment
1. Create production PostgreSQL.
2. Deploy backend over HTTPS.
3. Configure secrets.
4. Configure Meta integration/webhook.
5. Deploy React frontend.
6. Run migrations.
7. Test billing, PDF, WhatsApp and webhooks.
8. Enable monitoring, backups and logs.
