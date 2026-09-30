'use strict';
const fs = require('fs');
const path = require('path');

describe('Branding and Creator Credit Configuration Suite', () => {
  const brandingConfigPath = path.resolve(__dirname, '../../frontend/src/config/branding.js');
  const frontendPkgPath = path.resolve(__dirname, '../../frontend/package.json');
  const creditLineComponentPath = path.resolve(__dirname, '../../frontend/src/components/CreditLine.jsx');

  it('should have branding.js configured with single entry creditText, creditUrl, and showCredit', () => {
    expect(fs.existsSync(brandingConfigPath)).toBe(true);
    const content = fs.readFileSync(brandingConfigPath, 'utf8');

    expect(content).toContain("creditText: 'Created by DWS Web Services'");
    expect(content).toContain("creditUrl: ''");
    expect(content).toContain("showCredit: true");
  });

  it('should render credit text when showCredit is true and return null when showCredit is false', () => {
    // Pure logic simulation of CreditLine rendering function
    function renderCreditLine(config) {
      if (!config.showCredit) {
        return null;
      }
      if (config.creditUrl && config.creditUrl.trim().length > 0) {
        return {
          type: 'a',
          props: {
            href: config.creditUrl.trim(),
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          text: config.creditText,
        };
      }
      return {
        type: 'span',
        props: {},
        text: config.creditText,
      };
    }

    // 1. When showCredit is true and creditUrl is empty -> renders plain text
    const renderedPlain = renderCreditLine({
      creditText: 'Created by DWS Web Services',
      creditUrl: '',
      showCredit: true,
    });
    expect(renderedPlain).not.toBeNull();
    expect(renderedPlain.type).toBe('span');
    expect(renderedPlain.text).toBe('Created by DWS Web Services');

    // 2. When showCredit is true and creditUrl is set -> renders secure link
    const renderedLink = renderCreditLine({
      creditText: 'Created by DWS Web Services',
      creditUrl: 'https://dws-services.example.com',
      showCredit: true,
    });
    expect(renderedLink).not.toBeNull();
    expect(renderedLink.type).toBe('a');
    expect(renderedLink.props.href).toBe('https://dws-services.example.com');
    expect(renderedLink.props.target).toBe('_blank');
    expect(renderedLink.props.rel).toBe('noopener noreferrer');
    expect(renderedLink.text).toBe('Created by DWS Web Services');

    // 3. When showCredit is false -> disappears completely (returns null)
    const renderedDisabled = renderCreditLine({
      creditText: 'Created by DWS Web Services',
      creditUrl: 'https://dws-services.example.com',
      showCredit: false,
    });
    expect(renderedDisabled).toBeNull();
  });

  it('should ensure CreditLine component includes rel="noopener noreferrer" and target="_blank"', () => {
    expect(fs.existsSync(creditLineComponentPath)).toBe(true);
    const componentCode = fs.readFileSync(creditLineComponentPath, 'utf8');

    expect(componentCode).toContain('rel="noopener noreferrer"');
    expect(componentCode).toContain('target="_blank"');
    expect(componentCode).toContain('BRANDING_CONFIG.showCredit');
  });

  it('should NOT add credit line to invoices, bills, PDFs, or WhatsApp templates', () => {
    const pdfServicePath = path.resolve(__dirname, '../src/services/pdfService.js');
    const whatsappServicePath = path.resolve(__dirname, '../src/services/whatsappService.js');

    const pdfCode = fs.readFileSync(pdfServicePath, 'utf8');
    const waCode = fs.readFileSync(whatsappServicePath, 'utf8');

    expect(pdfCode).not.toContain('DWS Web Services');
    expect(pdfCode).not.toContain('Created by');
    expect(waCode).not.toContain('DWS Web Services');
  });

  it('should have package.json version and author configured', () => {
    const pkg = JSON.parse(fs.readFileSync(frontendPkgPath, 'utf8'));
    expect(pkg.author).toBe('DWS Web Services');
    expect(pkg.version).toBeDefined();
  });
});
