# Salon WhatsApp Billing Automation
## Documentation Pack

### Documents
1. [PRD](01_PRD.md) - Product requirements and scope
2. [TRD](02_TRD.md) - Architecture, security and deployment
3. [SRS](03_SRS.md) - Software requirements and acceptance criteria
4. [API & DB Specification](04_API_DB_Specification.md) - API/database plan
5. [Client WhatsApp/Meta Setup](05_Client_WhatsApp_Meta_Setup_Guide.md) - Client prerequisites and ownership
6. [Client Requirements & Handover](06_Client_Requirements_and_Handover.md) - Questionnaire and handover

### Recommended Build Order
```text
1. Confirm client requirements
2. Set up Meta/WhatsApp assets under client ownership
3. Build database and backend billing APIs
4. Build React billing dashboard
5. Generate PDF invoices
6. Integrate WhatsApp template/document workflow
7. Add webhook status handling
8. Test end-to-end
9. Deploy
10. Handover and training
```

### Production Notes
- Keep secrets out of Git.
- Use HTTPS.
- Use official WhatsApp Business Platform / Cloud API.
- Keep client Meta/WhatsApp assets owned by the client.
- Verify current Meta API versions, policies, template rules and pricing before production deployment.
