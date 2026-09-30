# Private WhatsApp Business Cloud API Setup Guide

This guide is for platform administrators and system operators. It outlines the step-by-step procedure for configuring the official Meta WhatsApp Business Cloud API for the Salon CRM. 

These instructions are intentionally kept private on the server and are never exposed in the client-facing application.

---

## 1. Prerequisites

1. A Facebook Business Manager account (business.facebook.com).
2. A Meta Developer account (developers.facebook.com).
3. A dedicated business phone number that is not currently registered on a standard WhatsApp consumer or business mobile app (or one that can be deleted from the mobile app to migrate to Cloud API).

---

## 2. Create Meta Developer App

1. Log in to **Meta for Developers** (https://developers.facebook.com).
2. Click **My Apps** > **Create App**.
3. Select **Other** as the use case, then choose **Business** as the app type.
4. Set App Display Name (e.g., `Priya's Art Beauty CRM`).
5. Choose or link your Meta Business Account.
6. Click **Create app**.

---

## 3. Add WhatsApp Product to App

1. On the App Dashboard, locate **WhatsApp** and click **Set up**.
2. Review the Quickstart panel. Meta provides a temporary test phone number and a temporary 24-hour access token for testing.
3. In the WhatsApp API panel, copy the following values:
   - **Phone Number ID**: A numeric identifier for your sending number.
   - **WhatsApp Business Account ID (WABA ID)**: A numeric account identifier.

---

## 4. Generate Permanent System User Token

Temporary access tokens expire every 24 hours. For continuous operation, create a permanent System User Token:

1. Open **Meta Business Settings** (https://business.facebook.com/settings).
2. Navigate to **Users** > **System Users**.
3. Click **Add**, name the user (e.g., `crm-whatsapp-bot`), and assign the role **Admin**.
4. Click **Add Assets** and assign your WhatsApp Business Account with full control permissions.
5. Click **Generate New Token**.
6. Select your App, choose Token Expiration as **Never**, and select the following permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
7. Copy the generated permanent token immediately (it will not be shown again).

---

## 5. Configure Backend Environment Variables

Open `backend/.env` on the server and fill in the WhatsApp configuration:

```env
# Meta WhatsApp Cloud API Credentials
META_ACCESS_TOKEN=your_permanent_system_user_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_account_id_here
WHATSAPP_BUSINESS_PHONE_NUMBER=+919876543210
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_custom_secure_random_string_here
```

Keep your `.env` file protected with strict permissions:
```bash
chmod 600 backend/.env
```

---

## 6. Configure Webhook for Delivery Receipts

To receive real-time message statuses (`sent`, `delivered`, `read`, `failed`):

1. In Meta Developer Console, go to **WhatsApp** > **Configuration**.
2. Under **Webhook**, click **Edit**.
3. Set **Callback URL**:
   ```text
   https://your-domain.com/api/webhooks/whatsapp
   ```
4. Set **Verify Token**:
   Match the value set in `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env` file.
5. Click **Verify and Save**.
6. Under **Webhook Fields**, click **Manage** and subscribe to:
   - `messages`

---

## 7. Operational Testing & Verification

1. Verify status endpoint:
   Send an authenticated GET request to `/api/settings/whatsapp-status`. It must return:
   ```json
   {
     "success": true,
     "data": {
       "connected": true,
       "phone_number": "+91 98XXX XX210"
     }
   }
   ```
2. Send test message:
   In the CRM Admin Settings > WhatsApp tab, click **Send test message** to verify outbound delivery to your phone.

---

## 8. Security Requirements

- Never commit access tokens or phone number IDs into source code or Git.
- Never expose Meta tokens or IDs to frontend clients.
- Status checks must only return boolean `connected` and masked `phone_number`.
- Keep access restricted strictly to `admin` role server-side.
