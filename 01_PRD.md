# Salon WhatsApp Billing Automation
## Product Requirements Document (PRD)

## Product Overview
A web-based salon billing system that creates invoices and automatically sends the bill/invoice to a customer's WhatsApp number using the official WhatsApp Business Platform / Cloud API.

## Problem
Salon staff may create bills manually and then separately send receipts on WhatsApp. The product combines billing, invoice generation, and WhatsApp delivery into one workflow.

## Goals
- Create bills quickly.
- Generate professional PDF invoices.
- Send approved WhatsApp invoice messages automatically.
- Store customer, bill and delivery status.
- Provide a simple salon dashboard.

## Users
| Role | Responsibilities |
|---|---|
| Owner/Admin | Manage salon settings, staff, services, reports and WhatsApp integration. |
| Staff/Cashier | Create bills, select services, collect payment and trigger invoice delivery. |
| Customer | Receives invoice/receipt through WhatsApp. |

## Core Features
- Authentication and role-based access
- Customer management
- Service catalog and pricing
- Billing/cart
- Discount and tax configuration
- PDF invoice generation
- WhatsApp template/document delivery
- Bill history and search
- WhatsApp delivery status
- Basic reports
- Salon branding
- Error/retry handling

## Main Workflow
1. Staff selects or creates customer.
2. Staff selects services and quantities.
3. System calculates subtotal, discount, tax and total.
4. Staff confirms payment.
5. Backend stores the bill.
6. System generates PDF invoice.
7. System sends the approved WhatsApp message/document.
8. System stores WhatsApp message ID/status.
9. Staff can view delivery status.

## Functional Requirements
| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Create customer with name and WhatsApp number. | High |
| FR-02 | Create/edit services and prices. | High |
| FR-03 | Generate unique invoice number. | High |
| FR-04 | Calculate subtotal, discount, tax and total. | High |
| FR-05 | Generate PDF invoice. | High |
| FR-06 | Send invoice through WhatsApp Cloud API. | High |
| FR-07 | Store WhatsApp delivery status. | High |
| FR-08 | Search/view previous bills. | High |
| FR-09 | Controlled invoice resend. | Medium |
| FR-10 | Dashboard/reporting. | Medium |

## Non-Functional Requirements
- Validate API input.
- Keep credentials server-side.
- Securely hash passwords.
- Use parameterized PostgreSQL queries.
- Keep invoice numbers unique.
- Log failures without exposing secrets.
- Support desktop/tablet responsive UI.
- Plan production backups and recovery.

## MVP Out of Scope
- Full appointment booking
- Inventory management
- Payroll
- Advanced loyalty
- Multi-location accounting
- Marketing campaigns

## Success Criteria
- Staff can create a bill without technical knowledge.
- Every confirmed bill can produce a PDF.
- WhatsApp delivery succeeds or records a clear failure.
- Bills are searchable by invoice/customer/date.
- Secrets never reach the frontend.
