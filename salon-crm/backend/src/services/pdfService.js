'use strict';
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const STORAGE_PATH = process.env.INVOICE_STORAGE_PATH || path.join(__dirname, '../../storage/invoices');

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

/**
 * Format currency amount as INR string
 */
function formatCurrency(amount, currency = 'INR') {
  const num = Number(amount) || 0;
  if (currency === 'INR') {
    return `Rs. ${num.toFixed(2)}`;
  }
  return `${currency} ${num.toFixed(2)}`;
}

/**
 * Generate a PDF invoice and save it to disk.
 * Returns the file path and a URL-safe filename.
 *
 * @param {Object} bill - Full bill object with items, customer, salon data
 * @returns {Promise<{ pdfPath: string, filename: string }>}
 */
async function generateInvoicePDF(bill) {
  return new Promise((resolve, reject) => {
    try {
      const filename = `invoice-${bill.invoice_no.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`;
      const pdfPath = path.join(STORAGE_PATH, filename);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 60, right: 60 },
      });

      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);

      // --- COLORS ---
      const PRIMARY = '#141312';
      const ACCENT = '#22201d';
      const GOLD = '#C5A059';
      const LIGHT_GRAY = '#f8f6f0';
      const MID_GRAY = '#888888';
      const TEXT = '#222222';

      const pageWidth = doc.page.width;
      const marginLeft = 60;
      const marginRight = 60;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // ---- HEADER BACKGROUND ----
      doc.rect(0, 0, pageWidth, 130).fill(PRIMARY);

      // ---- SALON NAME ----
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(24)
        .text(bill.salon_name || 'Salon', marginLeft, 30, { width: contentWidth * 0.6 });

      // ---- SALON CONTACT ----
      doc.fillColor('#cccccc')
        .font('Helvetica')
        .fontSize(9);

      let contactY = 60;
      if (bill.salon_address) {
        doc.text(bill.salon_address, marginLeft, contactY, { width: contentWidth * 0.6 });
        contactY += 14;
      }
      if (bill.salon_phone) {
        doc.text(`Phone: ${bill.salon_phone}`, marginLeft, contactY, { width: contentWidth * 0.6 });
        contactY += 14;
      }
      if (bill.salon_email) {
        doc.text(`Email: ${bill.salon_email}`, marginLeft, contactY, { width: contentWidth * 0.6 });
      }

      // ---- INVOICE LABEL (right side of header) ----
      doc.fillColor(GOLD)
        .font('Helvetica-Bold')
        .fontSize(28)
        .text('INVOICE', pageWidth - marginRight - 160, 30, { width: 160, align: 'right' });

      doc.fillColor('#ffffff')
        .font('Helvetica')
        .fontSize(9)
        .text(`Invoice No: ${bill.invoice_no}`, pageWidth - marginRight - 160, 68, { width: 160, align: 'right' })
        .text(`Date: ${new Date(bill.created_at).toLocaleDateString('en-IN', {
          year: 'numeric', month: 'long', day: 'numeric'
        })}`, pageWidth - marginRight - 160, 84, { width: 160, align: 'right' })
        .text(`Time: ${new Date(bill.created_at).toLocaleTimeString('en-IN')}`,
          pageWidth - marginRight - 160, 100, { width: 160, align: 'right' });

      // ---- BILL TO SECTION ----
      let y = 150;

      doc.fillColor(TEXT)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('BILL TO', marginLeft, y);

      doc.moveTo(marginLeft, y + 14).lineTo(marginLeft + 60, y + 14).stroke(GOLD);
      y += 22;

      doc.fillColor(TEXT)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(bill.customer_name || 'Walk-in Customer', marginLeft, y);
      y += 16;

      if (bill.customer_phone) {
        doc.fillColor(MID_GRAY)
          .font('Helvetica')
          .fontSize(10)
          .text(`Phone: ${bill.customer_phone}`, marginLeft, y);
        y += 14;
      }
      if (bill.customer_email) {
        doc.fillColor(MID_GRAY)
          .font('Helvetica')
          .fontSize(10)
          .text(`Email: ${bill.customer_email}`, marginLeft, y);
        y += 14;
      }

      // ---- PAYMENT INFO (right side) ----
      const infoX = pageWidth - marginRight - 200;
      const infoY = 150;

      doc.fillColor(TEXT)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('PAYMENT INFO', infoX, infoY);

      doc.moveTo(infoX, infoY + 14).lineTo(infoX + 80, infoY + 14).stroke(GOLD);

      doc.fillColor(MID_GRAY)
        .font('Helvetica')
        .fontSize(10)
        .text('Method:', infoX, infoY + 22)
        .fillColor(TEXT)
        .font('Helvetica-Bold')
        .text((bill.payment_method || 'Cash').toUpperCase(), infoX + 55, infoY + 22);

      doc.fillColor(MID_GRAY)
        .font('Helvetica')
        .fontSize(10)
        .text('Status:', infoX, infoY + 38)
        .fillColor(bill.payment_status === 'paid' ? '#2d8a4e' : '#e05252')
        .font('Helvetica-Bold')
        .text((bill.payment_status || 'Paid').toUpperCase(), infoX + 55, infoY + 38);

      // ---- ITEMS TABLE ----
      y = Math.max(y + 20, infoY + 80);

      // Table header
      doc.rect(marginLeft, y, contentWidth, 28).fill(ACCENT);

      const col = {
        no: marginLeft + 10,
        service: marginLeft + 40,
        qty: marginLeft + contentWidth * 0.55,
        price: marginLeft + contentWidth * 0.70,
        total: marginLeft + contentWidth * 0.84,
      };

      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('#', col.no, y + 9)
        .text('Service', col.service, y + 9)
        .text('Qty', col.qty, y + 9, { width: 50, align: 'right' })
        .text('Unit Price', col.price, y + 9, { width: 60, align: 'right' })
        .text('Total', col.total, y + 9, { width: 60, align: 'right' });

      y += 28;

      // Table rows
      const items = bill.items || [];
      items.forEach((item, index) => {
        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(marginLeft, y, contentWidth, 24).fill(LIGHT_GRAY);
        }

        doc.fillColor(TEXT)
          .font('Helvetica')
          .fontSize(9)
          .text(String(index + 1), col.no, y + 7)
          .text(item.service_name || item.name || '-', col.service, y + 7, {
            width: col.qty - col.service - 10,
            ellipsis: true,
          })
          .text(String(item.qty || 1), col.qty, y + 7, { width: 50, align: 'right' })
          .text(formatCurrency(item.unit_price, bill.currency), col.price, y + 7, {
            width: 60, align: 'right',
          })
          .text(formatCurrency(item.line_total, bill.currency), col.total, y + 7, {
            width: 60, align: 'right',
          });

        y += 24;
      });

      // Table border bottom
      doc.moveTo(marginLeft, y).lineTo(marginLeft + contentWidth, y).stroke('#cccccc');
      y += 15;

      // ---- TOTALS ----
      const totalsX = marginLeft + contentWidth * 0.55;
      const totalsWidth = contentWidth * 0.45;

      const addTotalRow = (label, value, bold = false, color = TEXT) => {
        doc.fillColor(MID_GRAY)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(10)
          .text(label, totalsX, y, { width: totalsWidth * 0.5 });

        doc.fillColor(color)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(10)
          .text(value, totalsX + totalsWidth * 0.5, y, { width: totalsWidth * 0.5, align: 'right' });

        y += 18;
      };

      addTotalRow('Subtotal', formatCurrency(bill.subtotal, bill.currency));

      if (Number(bill.discount) > 0) {
        addTotalRow(
          `Discount${bill.discount_type === 'percent' ? ' (%)' : ''}`,
          `- ${formatCurrency(bill.discount_amount || bill.discount, bill.currency)}`,
          false,
          '#2d8a4e'
        );
      }

      if (Number(bill.tax_rate) > 0) {
        addTotalRow(`Tax (${bill.tax_rate}%)`, formatCurrency(bill.tax_amount, bill.currency));
      }

      y += 5;
      doc.moveTo(totalsX, y).lineTo(totalsX + totalsWidth, y).stroke(ACCENT);
      y += 8;

      // TOTAL row with background
      doc.rect(totalsX, y, totalsWidth, 32).fill(PRIMARY);
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(13)
        .text('TOTAL', totalsX + 10, y + 9, { width: totalsWidth * 0.5 })
        .fillColor(GOLD)
        .text(formatCurrency(bill.total, bill.currency), totalsX + totalsWidth * 0.5, y + 9, {
          width: totalsWidth * 0.5 - 10, align: 'right',
        });

      y += 50;

      // ---- NOTES ----
      if (bill.notes) {
        doc.fillColor(TEXT)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('Notes:', marginLeft, y);
        doc.fillColor(MID_GRAY)
          .font('Helvetica')
          .fontSize(9)
          .text(bill.notes, marginLeft + 40, y, { width: contentWidth - 40 });
        y += 30;
      }

      // ---- FOOTER ----
      const footerY = doc.page.height - 80;
      doc.moveTo(marginLeft, footerY).lineTo(pageWidth - marginRight, footerY).stroke('#dddddd');

      doc.fillColor(MID_GRAY)
        .font('Helvetica')
        .fontSize(9)
        .text(
          bill.invoice_footer || 'Thank you for visiting! We look forward to serving you again.',
          marginLeft,
          footerY + 12,
          { width: contentWidth, align: 'center' }
        );

      if (bill.salon_tax_number) {
        doc.text(`GST/Tax No: ${bill.salon_tax_number}`, marginLeft, footerY + 28, {
          width: contentWidth, align: 'center',
        });
      }

      doc.end();

      writeStream.on('finish', () => {
        logger.info(`PDF generated: ${filename}`);
        resolve({ pdfPath, filename });
      });

      writeStream.on('error', (err) => {
        logger.error('PDF write stream error:', { error: err.message });
        reject(err);
      });
    } catch (err) {
      logger.error('PDF generation error:', { error: err.message });
      reject(err);
    }
  });
}

/**
 * Get a readable stream for a stored PDF
 */
function getPDFStream(filename) {
  const pdfPath = path.join(STORAGE_PATH, filename);
  if (!fs.existsSync(pdfPath)) {
    return null;
  }
  return fs.createReadStream(pdfPath);
}

/**
 * Check if a PDF file exists
 */
function pdfExists(filename) {
  const pdfPath = path.join(STORAGE_PATH, filename);
  return fs.existsSync(pdfPath);
}

module.exports = { generateInvoicePDF, getPDFStream, pdfExists, STORAGE_PATH };
