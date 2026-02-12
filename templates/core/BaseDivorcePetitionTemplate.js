// templates/core/BaseDivorcePetitionTemplate.js
// Base template class for divorce petition/complaint generation
// Provides common functionality across all states

const { v4: uuidv4 } = require('uuid');

/**
 * Escape HTML special characters to prevent XSS/injection
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for HTML
 */
const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/**
 * Base template class for divorce petition generation
 * Provides common functionality across all states
 *
 * @class BaseDivorcePetitionTemplate
 * @description Abstract base class that defines the common interface and functionality
 * for all state-specific divorce petition templates. State templates should extend this class
 * and override state-specific methods as needed.
 *
 * A Divorce Petition (also called Complaint in some states) is the document that
 * initiates divorce proceedings. It includes:
 * - Identification of parties
 * - Grounds for divorce
 * - Requests for relief (property division, custody, support, etc.)
 * - Jurisdictional statements
 */
class BaseDivorcePetitionTemplate {
  constructor() {
    this.state = null;
    this.stateName = null;
    this.documentType = 'petition';
    this.documentTitle = 'PETITION FOR DIVORCE';

    // Required fields for a valid petition
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Sections that make up a divorce petition
    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      parties: true,
      jurisdiction: true,
      marriageInformation: true,
      groundsForDivorce: true,
      childrenInformation: true,
      propertyInformation: true,
      reliefRequested: true,
      verification: true,
      signatureBlock: true,
      certificateOfService: false
    };

    // Standard formatting for court documents
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in'
    };

    // Residency requirements (override in state-specific)
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 90,
      description: ''
    };

    // Waiting period after filing (override in state-specific)
    this.waitingPeriod = {
      days: 60,
      exceptions: [],
      description: ''
    };
  }

  /**
   * Get template requirements
   * @returns {Object} Template requirements including fields, sections, and formatting
   */
  getRequirements() {
    return {
      documentType: this.documentType,
      requiredFields: this.requiredFields,
      sections: this.sections,
      formatting: this.formatting,
      residencyRequirements: this.residencyRequirements,
      waitingPeriod: this.waitingPeriod
    };
  }

  /**
   * Get formatting rules for this template
   * @returns {Object} Formatting rules (font, size, margins, line height)
   */
  getFormattingRules() {
    return this.formatting;
  }

  /**
   * Validate petition data against template requirements
   *
   * @param {Object} divorceData - The divorce petition data to validate
   * @returns {Object} Validation result with isValid, errors, and warnings
   */
  validateData(divorceData) {
    const errors = [];
    const warnings = [];

    // Check required fields
    if (!divorceData.petitionerName || divorceData.petitionerName.trim().length < 2) {
      errors.push('Petitioner name is required and must be at least 2 characters');
    }

    if (!divorceData.respondentName || divorceData.respondentName.trim().length < 2) {
      errors.push('Respondent name is required and must be at least 2 characters');
    }

    if (!divorceData.state) {
      errors.push('State is required');
    }

    if (!divorceData.county || divorceData.county.trim().length === 0) {
      errors.push(`County is required for ${this.stateName} divorce petitions`);
    }

    if (!divorceData.marriageDate) {
      errors.push('Date of marriage is required');
    }

    if (!divorceData.groundsForDivorce) {
      errors.push('Grounds for divorce must be specified');
    }

    // Validate date format if provided
    if (divorceData.marriageDate && !this.isValidDate(divorceData.marriageDate)) {
      errors.push('Invalid marriage date format');
    }

    if (divorceData.separationDate && !this.isValidDate(divorceData.separationDate)) {
      errors.push('Invalid separation date format');
    }

    // Check children information if applicable
    if (divorceData.hasMinorChildren === true) {
      if (!divorceData.children || divorceData.children.length === 0) {
        errors.push('Children information is required when there are minor children');
      }
    }

    // Warnings for recommended but not required fields
    if (!divorceData.separationDate) {
      warnings.push('Date of separation is recommended');
    }

    if (!divorceData.petitionerAddress) {
      warnings.push('Petitioner address is recommended for service of process');
    }

    // State-specific validation
    const stateValidation = this.performStateSpecificValidation(divorceData);
    errors.push(...stateValidation.errors);
    warnings.push(...stateValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if a date string is valid
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} Whether the date is valid
   */
  isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Generate complete divorce petition document
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Complete document with sections, validation, and metadata
   */
  generateDocument(divorceData = {}) {
    const validation = this.validateData(divorceData);
    const id = uuidv4();

    // Generate all sections, threading paragraph numbers between them
    const header = this.generateHeader();
    const venue = this.generateVenue(divorceData.county);
    const caseCaption = this.generateCaseCaption(divorceData);
    const title = this.generateTitle();
    const parties = this.generatePartiesSection(divorceData);
    divorceData._paragraphNum = parties.nextParagraphNumber;
    const jurisdiction = this.generateJurisdictionSection(divorceData);
    divorceData._paragraphNum = jurisdiction.nextParagraphNumber;
    const marriageInfo = this.generateMarriageInformationSection(divorceData);
    divorceData._paragraphNum = marriageInfo.nextParagraphNumber;
    const grounds = this.generateGroundsSection(divorceData);
    divorceData._paragraphNum = grounds.nextParagraphNumber;
    const childrenInfo = this.generateChildrenSection(divorceData);
    divorceData._paragraphNum = childrenInfo.nextParagraphNumber;
    const propertyInfo = this.generatePropertySection(divorceData);
    divorceData._paragraphNum = propertyInfo.nextParagraphNumber;
    const reliefRequested = this.generateReliefSection(divorceData);
    const verification = this.generateVerificationSection(divorceData);
    const signatureBlock = this.generateSignatureBlock(divorceData.petitionerName);
    const footer = this.generateFooter();

    return {
      id,
      state: this.state,
      documentType: this.documentType,
      timestamp: new Date(),
      sections: {
        header,
        venue,
        caseCaption,
        title,
        parties,
        jurisdiction,
        marriageInfo,
        grounds,
        childrenInfo,
        propertyInfo,
        reliefRequested,
        verification,
        signatureBlock,
        footer
      },
      fullText: this.generateFullText({
        header, venue, caseCaption, title, parties, jurisdiction,
        marriageInfo, grounds, childrenInfo, propertyInfo,
        reliefRequested, verification, signatureBlock
      }),
      htmlContent: this.generateHTMLContent({
        header, venue, caseCaption, title, parties, jurisdiction,
        marriageInfo, grounds, childrenInfo, propertyInfo,
        reliefRequested, verification, signatureBlock
      }),
      validation,
      formatting: this.formatting
    };
  }

  /**
   * Generate document header
   * Override in state-specific templates for custom formatting
   *
   * @returns {string} Header text
   */
  generateHeader() {
    return `STATE OF ${this.stateName.toUpperCase()}`;
  }

  /**
   * Generate venue section
   * Override in state-specific templates for custom formatting
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate case caption for divorce petition
   * Override in state-specific templates if needed
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court name
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    // Case number
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `${caseLabel} ${caseNumber}\n\n`;

    // Party names in family law format
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    caption += `IN THE MATTER OF THE MARRIAGE OF:\n\n`;
    caption += `${petitioner}, Petitioner\n\n`;
    caption += `AND\n\n`;
    caption += `${respondent}, Respondent`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Get the case number label for this state
   * Override in state-specific templates (e.g., Texas uses "CAUSE NO.")
   *
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get the default court name for a county
   * Override in state-specific templates
   *
   * @param {string} county - County name
   * @returns {string} Default court name
   */
  getDefaultCourt(county) {
    return `DISTRICT COURT OF ${(county || '[COUNTY]').toUpperCase()} COUNTY`;
  }

  /**
   * Generate document title
   *
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Generate parties identification section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Parties section
   */
  generatePartiesSection(divorceData) {
    const items = [];
    let paragraphNum = 1;

    items.push({
      number: paragraphNum++,
      content: `Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, is a resident of ${divorceData.county || '[COUNTY]'} County, ${this.stateName}.`,
      type: 'party_identification'
    });

    items.push({
      number: paragraphNum++,
      content: `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, is ${divorceData.respondentAddress ? `a resident of ${divorceData.respondentAddress}` : 'a resident of this state'}.`,
      type: 'party_identification'
    });

    return {
      title: 'I. PARTIES',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate jurisdiction and venue section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 3;

    items.push({
      number: paragraphNum++,
      content: this.getJurisdictionStatement(divorceData),
      type: 'jurisdiction'
    });

    items.push({
      number: paragraphNum++,
      content: `Venue is proper in ${divorceData.county || '[COUNTY]'} County because ${this.getVenueReason(divorceData)}.`,
      type: 'venue'
    });

    return {
      title: 'II. JURISDICTION AND VENUE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get jurisdiction statement for this state
   * Override in state-specific templates
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the State of ${this.stateName} for at least ${this.residencyRequirements.stateMonths} months and of ${divorceData.county || '[COUNTY]'} County for at least ${this.residencyRequirements.countyDays} days immediately preceding the filing of this petition.`;
  }

  /**
   * Get venue reason for this state
   * Override in state-specific templates
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner resides in this county`;
  }

  /**
   * Generate marriage information section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Marriage information section
   */
  generateMarriageInformationSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 5;

    items.push({
      number: paragraphNum++,
      content: `Petitioner and Respondent were married on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}.`,
      type: 'marriage_info'
    });

    if (divorceData.separationDate) {
      items.push({
        number: paragraphNum++,
        content: `The parties separated on or about ${this.formatDate(divorceData.separationDate)}.`,
        type: 'marriage_info'
      });
    }

    return {
      title: 'III. MARRIAGE INFORMATION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Format a date string for display
   *
   * @param {string} dateStr - Date string to format
   * @returns {string} Formatted date
   */
  formatDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;

    const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    return date.toLocaleDateString('en-US', options);
  }

  /**
   * Generate grounds for divorce section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irreconcilable_differences';
    const groundsText = this.getGroundsText(grounds, divorceData);

    items.push({
      number: paragraphNum++,
      content: groundsText,
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get grounds text for the specified grounds type
   * Override in state-specific templates for state-specific language
   *
   * @param {string} grounds - Type of grounds
   * @param {Object} divorceData - The divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'irreconcilable_differences':
      case 'insupportability':
        return 'The marriage has become insupportable because of discord or conflict of personalities that destroys the legitimate ends of the marriage relationship and prevents any reasonable expectation of reconciliation.';
      case 'separation':
        return `The parties have lived separate and apart without cohabitation for a period of at least ${divorceData.separationPeriod || '[PERIOD]'}.`;
      case 'abandonment':
        return `Respondent voluntarily left Petitioner with intention of abandonment and remained away for at least ${divorceData.abandonmentPeriod || 'one year'}.`;
      case 'cruelty':
        return 'Respondent has been guilty of cruel treatment toward Petitioner of such nature as to render further living together insupportable.';
      case 'adultery':
        return 'Respondent has committed adultery.';
      default:
        return 'The marriage has become insupportable because of discord or conflict of personalities that destroys the legitimate ends of the marriage relationship and prevents any reasonable expectation of reconciliation.';
    }
  }

  /**
   * Generate children information section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children of this marriage.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following children were born of or adopted during this marriage:',
        type: 'children_info'
      });

      if (divorceData.children && divorceData.children.length > 0) {
        divorceData.children.forEach((child, index) => {
          const childInfo = typeof child === 'string'
            ? child
            : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      // Add statement about no other children
      items.push({
        number: paragraphNum++,
        content: 'No other children were born to or adopted by Petitioner and Respondent during the marriage, and none are expected.',
        type: 'children_info'
      });
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate property information section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    if (divorceData.hasProperty === false) {
      items.push({
        number: paragraphNum++,
        content: 'There is no community or marital property to be divided.',
        type: 'property_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties have accumulated community/marital property during the marriage, including but not limited to real property, personal property, and financial accounts.',
        type: 'property_info'
      });

      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests that the Court divide the community/marital property in a just and right manner.',
        type: 'property_request'
      });
    }

    if (divorceData.hasDebts !== false) {
      items.push({
        number: paragraphNum++,
        content: 'The parties have accumulated debts during the marriage. Petitioner requests that the Court allocate responsibility for such debts in a just and equitable manner.',
        type: 'debt_info'
      });
    }

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate relief requested section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner requests that the Court:',
      type: 'relief_intro'
    });

    // Standard relief requests
    const reliefItems = [
      'Grant a divorce dissolving the marriage between Petitioner and Respondent;',
      'Divide the community/marital property in a just and right manner;',
      'Allocate responsibility for debts in an equitable manner;'
    ];

    // Add child-related relief if applicable
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine conservatorship/custody of the minor child(ren);');
      reliefItems.push('Determine possession and access to the minor child(ren);');
      reliefItems.push('Order child support in accordance with state guidelines;');
    }

    // Add spousal support if requested
    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal maintenance/alimony to Petitioner;');
    }

    // Add name change if requested
    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name: ${divorceData.previousName};`);
    }

    // Add general relief
    reliefItems.push('Grant such other and further relief to which Petitioner may be entitled.');

    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c format
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter: letter
      });
    });

    return {
      title: 'VII. PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate verification section
   *
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Verification section
   */
  generateVerificationSection(divorceData) {
    const verificationText = this.getVerificationText(divorceData);

    return {
      title: 'VERIFICATION',
      text: verificationText,
      type: 'verification'
    };
  }

  /**
   * Get verification text for this state
   * Override in state-specific templates
   *
   * @param {Object} divorceData - The divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Petitioner, declare under penalty of perjury that the facts stated in this Petition are true and correct to the best of my knowledge and belief.`;
  }

  /**
   * Generate signature block
   *
   * @param {string} petitionerName - Name of petitioner
   * @returns {Object} Signature block
   */
  generateSignatureBlock(petitionerName) {
    const name = petitionerName || '[PETITIONER NAME]';
    return {
      line: '_________________________________',
      name,
      title: 'Petitioner, Pro Se',
      date: 'Date: _____________________',
      formatted: `_________________________________\n${name}\nPetitioner, Pro Se\n\nDate: _____________________`
    };
  }

  /**
   * Generate footer with metadata
   *
   * @returns {Object} Footer
   */
  generateFooter() {
    return {
      disclaimer: 'This document was generated for informational purposes only and does not constitute legal advice. Consult with a licensed attorney for legal advice.',
      timestamp: new Date().toISOString(),
      version: '1.0',
      documentType: this.documentType
    };
  }

  /**
   * Generate full text representation of document
   *
   * @param {Object} sections - All document sections
   * @returns {string} Complete document as plain text
   */
  generateFullText(sections) {
    let text = '';

    if (sections.header) text += sections.header + '\n';
    if (sections.venue) text += sections.venue + '\n\n';
    if (sections.caseCaption?.formatted) text += sections.caseCaption.formatted + '\n\n';
    if (sections.title) text += sections.title + '\n\n';

    // Generate numbered paragraphs from each section
    const sectionOrder = ['parties', 'jurisdiction', 'marriageInfo', 'grounds', 'childrenInfo', 'propertyInfo'];

    sectionOrder.forEach(sectionKey => {
      const section = sections[sectionKey];
      if (section?.title) {
        text += `\n${section.title}\n\n`;
      }
      if (section?.items) {
        section.items.forEach(item => {
          if (item.number !== null) {
            text += `${item.number}. ${item.content}\n\n`;
          } else {
            text += `${item.content}\n\n`;
          }
        });
      }
    });

    // Relief section
    if (sections.reliefRequested?.title) {
      text += `\n${sections.reliefRequested.title}\n\n`;
      sections.reliefRequested.items.forEach((item, index) => {
        if (item.type === 'relief_intro') {
          text += `${item.content}\n\n`;
        } else {
          const letter = String.fromCharCode(97 + index - 1); // a, b, c...
          text += `  ${letter}. ${item.content}\n`;
        }
      });
      text += '\n';
    }

    // Verification
    if (sections.verification?.title) {
      text += `\n${sections.verification.title}\n\n`;
      text += sections.verification.text + '\n\n';
    }

    // Signature block
    if (sections.signatureBlock?.formatted) {
      text += '\n' + sections.signatureBlock.formatted + '\n';
    }

    return text;
  }

  /**
   * Generate HTML representation of document
   *
   * @param {Object} sections - All document sections
   * @returns {string} Complete document as HTML
   */
  generateHTMLContent(sections) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Petition for Divorce - ${escapeHtml(this.stateName)}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 2;
      margin: 1in;
      color: #000;
      background: white;
    }
    .header {
      text-align: center;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .venue {
      text-align: center;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .case-caption {
      text-align: center;
      margin-bottom: 20px;
      white-space: pre-line;
    }
    .title {
      text-align: center;
      font-weight: bold;
      text-decoration: underline;
      margin: 20px 0;
    }
    .section-title {
      font-weight: bold;
      text-decoration: underline;
      margin: 20px 0 10px 0;
    }
    .paragraph {
      margin-bottom: 15px;
      text-align: justify;
      text-indent: 0.5in;
    }
    .relief-item {
      margin-left: 0.5in;
      margin-bottom: 5px;
    }
    .verification {
      margin-top: 30px;
    }
    .signature-block {
      margin-top: 40px;
      margin-bottom: 30px;
      white-space: pre-line;
    }
    @media print {
      body {
        margin: 0;
        padding: 1in;
      }
    }
  </style>
</head>
<body>
  ${sections.header ? `<div class="header">${escapeHtml(sections.header)}</div>` : ''}
  ${sections.venue ? `<div class="venue">${escapeHtml(sections.venue)}</div>` : ''}
  ${sections.caseCaption?.formatted ? `<div class="case-caption">${escapeHtml(sections.caseCaption.formatted)}</div>` : ''}
  ${sections.title ? `<div class="title">${escapeHtml(sections.title)}</div>` : ''}

  ${this.renderSectionHTML(sections.parties)}
  ${this.renderSectionHTML(sections.jurisdiction)}
  ${this.renderSectionHTML(sections.marriageInfo)}
  ${this.renderSectionHTML(sections.grounds)}
  ${this.renderSectionHTML(sections.childrenInfo)}
  ${this.renderSectionHTML(sections.propertyInfo)}
  ${this.renderReliefSectionHTML(sections.reliefRequested)}
  ${this.renderVerificationHTML(sections.verification)}

  ${sections.signatureBlock?.formatted ? `<div class="signature-block"><pre>${escapeHtml(sections.signatureBlock.formatted)}</pre></div>` : ''}
</body>
</html>`;
  }

  /**
   * Render a section as HTML
   * @param {Object} section - Section to render
   * @returns {string} HTML string
   */
  renderSectionHTML(section) {
    if (!section) return '';

    let html = '';
    if (section.title) {
      html += `<div class="section-title">${escapeHtml(section.title)}</div>`;
    }
    if (section.items) {
      section.items.forEach(item => {
        if (item.number !== null) {
          html += `<p class="paragraph">${item.number}. ${escapeHtml(item.content)}</p>`;
        } else {
          html += `<p class="paragraph">${escapeHtml(item.content)}</p>`;
        }
      });
    }
    return html;
  }

  /**
   * Render relief section as HTML
   * @param {Object} section - Relief section to render
   * @returns {string} HTML string
   */
  renderReliefSectionHTML(section) {
    if (!section) return '';

    let html = `<div class="section-title">${escapeHtml(section.title)}</div>`;

    section.items.forEach((item, index) => {
      if (item.type === 'relief_intro') {
        html += `<p class="paragraph">${escapeHtml(item.content)}</p>`;
      } else {
        const letter = String.fromCharCode(97 + index - 1);
        html += `<p class="relief-item">${letter}. ${escapeHtml(item.content)}</p>`;
      }
    });

    return html;
  }

  /**
   * Render verification section as HTML
   * @param {Object} section - Verification section to render
   * @returns {string} HTML string
   */
  renderVerificationHTML(section) {
    if (!section) return '';

    return `
      <div class="verification">
        <div class="section-title">${escapeHtml(section.title)}</div>
        <p class="paragraph">${escapeHtml(section.text)}</p>
      </div>
    `;
  }

  /**
   * Perform state-specific validation
   * Override in state-specific templates
   *
   * @param {Object} divorceData - The divorce data to validate
   * @returns {Object} Validation result with errors and warnings arrays
   */
  performStateSpecificValidation(divorceData) {
    return { errors: [], warnings: [] };
  }
}

module.exports = BaseDivorcePetitionTemplate;
