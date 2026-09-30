# Salon WhatsApp Billing Automation
## Software Requirements Specification (SRS)
**Version:** 1.0

## Modules
- **Authentication:** login, logout, reset and roles.
- **Salon Settings:** business details, tax settings, invoice prefix, logo and WhatsApp configuration.
- **Customers:** create, update, search and history.
- **Services:** names, categories, prices and active/inactive status.
- **Billing:** cart, quantities, discounts, tax, payment and confirmation.
- **Invoices:** PDF generation, preview/download and history.
- **WhatsApp:** templates, document delivery and status.
- **Reports:** sales, payment method totals, service sales and bill counts.

## User Stories
- As a cashier, I want to select services and create a bill quickly.
- As a cashier, I want the invoice sent to the customer's WhatsApp automatically.
- As an owner, I want to search previous bills.
- As an owner, I want to see WhatsApp delivery status.
- As an admin, I want to manage services and prices.

## Acceptance Criteria
| Feature | Criteria |
|---|---|
| Billing | Correct total and unique invoice. |
| Invoice | PDF contains required salon/customer/amount data. |
| WhatsApp | Approved message is sent when configured. |
| Status | Webhook updates delivery status when available. |
| Security | Secrets are not exposed to frontend/source. |
| History | Authorized users can search bills. |

## Assumptions
- Client owns required Meta/WhatsApp assets.
- Salon has internet access.
- Current Meta rules/API requirements must be followed.
- Client/accounting professional confirms GST/tax rules.
