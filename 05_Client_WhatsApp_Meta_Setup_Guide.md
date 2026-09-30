# Salon WhatsApp Billing Automation
## Client WhatsApp / Meta Setup Guide
**Version:** 1.0

## Client Provides
- Salon business identity/contact details
- Business phone number for WhatsApp
- Access to client's Meta Business Portfolio
- Required verification information
- Appropriate admin/developer access
- Approval for message templates

## Ownership
The client should own the Meta Business Portfolio, WhatsApp Business Account and business phone number. The developer should receive appropriate access instead of owning the client's business assets.

## High-Level Setup
1. Create/use client's Meta Business Portfolio.
2. Create/use WhatsApp Business Account.
3. Configure salon business phone number.
4. Create/configure Meta developer app and WhatsApp product.
5. Configure required credentials and permissions.
6. Create required WhatsApp message templates.
7. Configure backend webhook.
8. Test with authorized numbers, then production customers.

## Example Transactional Template
```text
Hello {{1}}, thank you for visiting {{2}}.
Your invoice {{3}} has been generated for {{4}}.
Please find your invoice attached.
```

Final template/category/approval must follow current Meta/WhatsApp rules.

## Credential Rules
- Do not ask for client's WhatsApp password.
- Do not store OTPs.
- Never put access tokens in React.
- Store credentials in server-side secrets.
- Revoke developer access and rotate credentials when appropriate after project completion.

## Testing Checklist
- [ ] Valid Indian phone number
- [ ] Bill creation
- [ ] PDF readability
- [ ] Successful WhatsApp delivery
- [ ] Invalid/unreachable number
- [ ] Token failure
- [ ] Resend behavior
- [ ] Webhook status update
