// templates/core/IndiaTemplateFactory.js
// Factory for creating Indian state divorce templates with minimal boilerplate.
// Indian divorce law is primarily personal law (HMA/SMA/IDA/DMMA) — the template
// structure is identical across all states. Only court names, stamp paper values,
// and High Court names differ.

'use strict';

const BaseAffidavitTemplate = require('./BaseAffidavitTemplate');
const BaseDivorcePetitionTemplate = require('./BaseDivorcePetitionTemplate');
const BaseDivorceDecreeTemplate = require('./BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('./parenting');

/**
 * Create an Indian state affidavit template class.
 * @param {Object} config
 * @param {string} config.stateCode - e.g. 'IN_GJ'
 * @param {string} config.stateName - e.g. 'Gujarat'
 * @param {string} config.defaultCourt - e.g. 'FAMILY COURT, AHMEDABAD'
 * @param {string} config.defaultCity - e.g. 'Ahmedabad'
 * @param {string} config.stampPaperValue - e.g. 'INR 20'
 * @param {string} config.metadataPath - relative path to metadata.json
 */
function createIndiaAffidavitTemplate(config) {
  class IndiaAffidavitTemplate extends BaseAffidavitTemplate {
    constructor() {
      super();
      this.metadata = require(config.metadataPath);
      this.state = config.stateCode;
      this.stateName = config.stateName;
      this.countryCode = 'IN';
      this.requiredFields = this.metadata.requiredFields;
      this.sections.perjuryStatement = false;
    }

    generateHeader() {
      return `IN THE ${config.defaultCourt.toUpperCase()}`;
    }

    generateVenue(county) {
      return `AT ${(county || config.defaultCity).toUpperCase()}`;
    }

    generateCaseCaption(d) {
      const court = d.court || d.courtName || config.defaultCourt;
      const loc = (d.county || d.city || config.defaultCity).toUpperCase();
      const caseNo = d.caseNumber || '[CASE NUMBER]';
      const p = d.plaintiff || d.petitionerName || '[PETITIONER NAME]';
      const r = d.defendant || d.respondentName || '[RESPONDENT NAME]';
      return {
        courtName: court,
        caseNumber: d.caseNumber,
        plaintiff: p,
        defendant: r,
        formatted: `${court.toUpperCase()}\n${loc}\n\nCase No. ${caseNo}\n\n${p.toUpperCase()}\nPetitioner\n\nVersus\n\n${r.toUpperCase()}\nRespondent`
      };
    }

    performStateSpecificValidation(d) {
      const errors = [];
      const warnings = [];
      if (!d.county && !d.city) errors.push(`District or city is required for ${config.stateName} affidavits.`);
      warnings.push(`Stamp paper: affidavits sworn for immediate filing in court are exempt from stamp duty (Indian Stamp Act, Sch. I, Art. 4, Exemption (b)); standalone affidavits use non-judicial stamp paper of ${config.stampPaperValue} (${config.stateName}).`);
      return { errors, warnings };
    }

    generateNotaryBlock(d) {
      const city = d.county || d.city || config.defaultCity;
      return `Verified at ${city} on this _____ day of _________________, _______.\n\nDeponent\n\nSworn before me:\n________________________________\nNotary Public / Oath Commissioner\n${city}, ${config.stateName}`;
    }
  }

  return IndiaAffidavitTemplate;
}

/**
 * Create an Indian state divorce petition template class.
 */
function createIndiaDivorcePetitionTemplate(config) {
  class IndiaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
    constructor() {
      super();
      this.state = config.stateCode;
      this.stateName = config.stateName;
      this.countryCode = 'IN';
      this.documentTitle = 'PETITION FOR DIVORCE';
      try { this.metadata = require(config.metadataPath); } catch (e) { this.metadata = null; }
      this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
      this.residencyRequirements = { stateMonths: 0, countyDays: 0, description: 'HMA s.19 / SMA s.31 jurisdiction rules.' };
      this.waitingPeriod = { days: 180, description: '6-month cooling-off between First and Second Motion for mutual consent (HMA s.13B(2) / SMA s.28(2)), waivable per Amardeep Singh v. Harveen Kaur (2017). Mutual-consent petitions require one year of living separately before filing (s.13B(1)), and no divorce petition lies within one year of marriage (HMA s.14 / SMA s.29). The Supreme Court may also grant divorce directly under Art. 142 on irretrievable breakdown (Shilpa Sailesh v. Varun Sreenivasan (2023)).' };
      this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
    }

    getCaseNumberLabel() { return 'Case No.'; }
    // Prefer the filer's own district/city over the hardcoded default court:
    // dd.court → FAMILY COURT, <location> → config.defaultCourt. A location
    // matching the default city keeps the court's official style (e.g.
    // West Bengal: Kolkata → "Family Court, Calcutta").
    getDefaultCourt(county) {
      const loc = county && String(county).trim();
      if (loc && loc.toUpperCase() !== config.defaultCity.toUpperCase()) return `FAMILY COURT, ${loc.toUpperCase()}`;
      return config.defaultCourt.toUpperCase();
    }

    generateCaseCaption(dd) {
      const cn = (dd.court || this.getDefaultCourt(dd.county || dd.city)).toUpperCase();
      const no = dd.caseNumber || '[CASE NUMBER]';
      const p = (dd.petitionerName || '[PETITIONER NAME]').toUpperCase();
      const r = (dd.respondentName || '[RESPONDENT NAME]').toUpperCase();
      // Mutual-consent petitions are presented jointly "by both the parties
      // together" (HMA s.13B(1) / SMA s.28(1)) — styled Petitioner No. 1 /
      // No. 2 with no opposing party, unlike contested grounds.
      const g = (dd.groundsForDivorce || 'mutual_consent').toLowerCase();
      const joint = g.includes('mutual') || g.includes('consent');
      const parties = joint
        ? [p, 'Petitioner No. 1', '', 'AND', '', r, 'Petitioner No. 2']
        : [p, 'Petitioner', '', 'VERSUS', '', r, 'Respondent'];
      return {
        courtName: cn,
        caseNumber: dd.caseNumber,
        petitioner: dd.petitionerName,
        respondent: dd.respondentName,
        formatted: [`IN THE ${cn}`, '', `${this.getCaseNumberLabel()} ${no}`, '', 'IN THE MATTER OF:', '', ...parties].join('\n')
      };
    }

    getJurisdictionStatement() {
      return `This Hon'ble Court has jurisdiction under HMA s.19 / SMA s.31.`;
    }

    getVenueReason(dd) {
      return `the Petitioner or Respondent resides at ${dd.county || config.defaultCity}`;
    }

    generateReliefSection(dd) {
      const items = [];
      items.push({ number: null, content: 'PRAYER: It is most respectfully prayed that this Hon\'ble Court may be pleased to:', type: 'relief_intro' });
      const r = ['Pass a decree of divorce;', 'Grant maintenance as deemed fit;'];
      if (dd.hasMinorChildren === true || dd.children?.length > 0) {
        r.push('Grant custody of the child(ren);');
        r.push('Direct child maintenance under HMA s.26 / BNSS s.144;');
      }
      if (dd.spousalSupportRequested) r.push('Grant maintenance pendente lite under HMA s.24;');
      r.push('Pass any other order(s) as deemed fit.');
      r.forEach((x, i) => items.push({ number: null, content: x, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + i) }));
      return { title: 'PRAYER', items, nextParagraphNumber: dd._paragraphNum || 15 };
    }

    getVerificationText(dd) {
      return `Verified at ${config.defaultCity} on this _____ day of __________, _______. I, ${dd.petitionerName || '[PETITIONER NAME]'}, verify that the contents are true and correct.`;
    }

    getGroundsText(g) {
      const s = (g || 'mutual_consent').toLowerCase();
      if (s.includes('mutual') || s.includes('consent')) return 'The parties have mutually consented to dissolve the marriage (HMA s.13B / SMA s.28).';
      if (s.includes('adultery')) return 'The Respondent has committed adultery (HMA s.13(1)(i)).';
      if (s.includes('cruelty')) return 'The Respondent has treated the Petitioner with cruelty (HMA s.13(1)(ia)).';
      if (s.includes('desertion')) return 'The Respondent has deserted the Petitioner for not less than two years (HMA s.13(1)(ib)).';
      if (s.includes('judicial')) return 'There has been no resumption of cohabitation as between the parties to the marriage for a period of one year or upwards after the passing of a decree for judicial separation in a proceeding to which they were parties (HMA s.13(1A)(i)).';
      if (s.includes('restitution')) return 'There has been no restitution of conjugal rights as between the parties to the marriage for a period of one year or upwards after the passing of a decree for restitution of conjugal rights in a proceeding to which they were parties (HMA s.13(1A)(ii)).';
      if (s.includes('bigamy')) return 'The Respondent husband had married again before the commencement of the Hindu Marriage Act 1955 (18 May 1955), or another wife of the husband married before such commencement was alive at the time of the solemnization of the marriage of the Petitioner, and that other wife was alive at the presentation of this petition (HMA s.13(2)(i); wife only).';
      if (s.includes('rape') || s.includes('sodomy') || s.includes('bestiality')) return 'The Respondent husband has, since the solemnization of the marriage, been guilty of rape, sodomy or bestiality (HMA s.13(2)(ii); wife only).';
      if (s.includes('maintenance') && s.includes('cohabitation')) return 'A decree or order awarding maintenance to the Petitioner wife notwithstanding that she was living apart has been passed against the Respondent husband (Hindu Adoptions and Maintenance Act 1956 s.18, or CrPC s.125 — now BNSS s.144), and cohabitation between the parties has not been resumed for one year or upwards since the passing of that decree or order (HMA s.13(2)(iii); wife only).';
      if (s.includes('puberty') || s.includes('repudiat')) return 'The marriage of the Petitioner (whether consummated or not) was solemnized before she attained the age of fifteen years, and she repudiated the marriage after attaining that age but before attaining the age of eighteen years (HMA s.13(2)(iv); wife only).';
      return 'The parties have mutually consented to dissolve the marriage (HMA s.13B / SMA s.28).';
    }
  }

  return IndiaDivorcePetitionTemplate;
}

/**
 * Create an Indian state divorce decree template class.
 */
function createIndiaDivorceDecreeTemplate(config) {
  class IndiaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
    constructor() {
      super();
      this.state = config.stateCode;
      this.stateName = config.stateName;
      this.countryCode = 'IN';
      this.documentTitle = 'DECREE OF DIVORCE';
      try { this.metadata = require(config.metadataPath); } catch (e) { this.metadata = null; }
      this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
      this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
    }

    getCaseNumberLabel() { return 'Case No.'; }
    // Prefer the filer's own district/city over the hardcoded default court
    // (dd.court → FAMILY COURT, <location> → config.defaultCourt).
    getDefaultCourt(county) {
      const loc = county && String(county).trim();
      if (loc && loc.toUpperCase() !== config.defaultCity.toUpperCase()) return `FAMILY COURT, ${loc.toUpperCase()}`;
      return config.defaultCourt.toUpperCase();
    }
    generateHeader(dd = {}) { return `IN THE ${(dd.court || this.getDefaultCourt(dd.county || dd.city)).toUpperCase()}`; }
    generateVenue(county) { return (county || config.defaultCity).toUpperCase(); }

    generateCaseCaption(dd) {
      const cn = (dd.court || this.getDefaultCourt(dd.county || dd.city)).toUpperCase();
      const no = dd.caseNumber || '[CASE NUMBER]';
      const p = (dd.petitionerName || '[PETITIONER NAME]').toUpperCase();
      const r = (dd.respondentName || '[RESPONDENT NAME]').toUpperCase();
      // Mutual-consent matters carry the joint style through to the decree
      const g = (dd.groundsForDivorce || 'mutual_consent').toLowerCase();
      const parties = (g.includes('mutual') || g.includes('consent'))
        ? `${p}\nPetitioner No. 1\n\nAND\n\n${r}\nPetitioner No. 2`
        : `${p}\nPetitioner\n\nVersus\n\n${r}\nRespondent`;
      return {
        courtName: cn,
        caseNumber: dd.caseNumber,
        petitioner: dd.petitionerName,
        respondent: dd.respondentName,
        formatted: `IN THE ${cn}\n\n${this.getCaseNumberLabel()} ${no}\n\nIN THE MATTER OF:\n\n${parties}`
      };
    }

    generatePropertyDivisionSection(dd) {
      const items = [];
      if (dd.hasProperty === false) items.push({ content: 'No matrimonial property to be divided.', type: 'finding' });
      else {
        items.push({ content: 'The Court has considered the settlement of property.', type: 'finding' });
        if (dd.petitionerProperty?.length > 0) { items.push({ content: `Property awarded to ${dd.petitionerName || 'Petitioner'}:`, type: 'order' }); dd.petitionerProperty.forEach(p => items.push({ content: `- ${p}`, type: 'property_item' })); }
        if (dd.respondentProperty?.length > 0) { items.push({ content: `Property awarded to ${dd.respondentName || 'Respondent'}:`, type: 'order' }); dd.respondentProperty.forEach(p => items.push({ content: `- ${p}`, type: 'property_item' })); }
        if (!dd.petitionerProperty && !dd.respondentProperty) items.push({ content: 'Each party retains property in their possession.', type: 'order' });
      }
      return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
    }

    // Custody safety (see templates/core/parenting.js): only positively
    // recognized custody values render a joint or sole order; anything
    // ambiguous (legacy free text, junk) renders neutral as-agreed language
    // with a placeholder — NEVER a sole order.
    generateChildCustodySection(dd) {
      if (dd.hasMinorChildren === false || !dd.children?.length) return null;
      const items = [{ content: 'Custody ordered in the best interest of the child(ren):', type: 'finding' }];
      dd.children.forEach((c, i) => {
        const info = typeof c === 'string' ? c : `${c.name || '[NAME]'}, born ${this.formatDate(c.birthDate) || '[DOB]'}`;
        items.push({ content: `${i + 1}. ${info}`, type: 'child_item' });
      });
      const custody = resolveCustodyArrangement(dd);
      const residenceName = resolvePrimaryResidenceName(dd);
      let soleCustodianName = null;
      if (custody.kind === 'joint') {
        items.push({ content: 'IT IS ORDERED that both parties have joint custody.', type: 'order' });
      } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
        soleCustodianName = custody.kind === 'sole_petitioner' ? (dd.petitionerName || 'Petitioner')
          : custody.kind === 'sole_respondent' ? (dd.respondentName || 'Respondent')
            : (dd.primaryCustodian || dd.petitionerName || 'Petitioner');
        const otherParentName = custody.kind === 'sole_respondent'
          ? (dd.petitionerName || 'Petitioner')
          : (dd.respondentName || 'Respondent');
        items.push({ content: `IT IS ORDERED that ${soleCustodianName} has sole custody.`, type: 'order' });
        items.push({ content: `${otherParentName} shall have visitation rights.`, type: 'order' });
      } else {
        items.push({ content: 'IT IS ORDERED that the parties shall exercise legal custody and decision-making responsibility for the child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].', type: 'order' });
      }
      if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
        items.push({ content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`, type: 'order' });
      }
      return { title: 'CUSTODY ORDER', items, type: 'custody' };
    }

    generateChildSupportSection(dd) {
      if (dd.hasMinorChildren === false || !dd.children?.length) return null;
      const items = [];
      if (dd.childSupportAmount) items.push({ content: `IT IS ORDERED: INR ${dd.childSupportAmount}/month child maintenance (HMA s.26 / BNSS s.144).`, type: 'order' });
      else items.push({ content: 'IT IS ORDERED: child maintenance as Court deems fit (HMA s.26 / BNSS s.144).', type: 'order' });
      return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
    }

    generateSpousalSupportSection(dd) {
      if (!dd.spousalSupportAwarded && !dd.spousalSupportWaived) return null;
      const items = [];
      if (dd.spousalSupportWaived) items.push({ content: 'Neither party shall claim maintenance from the other.', type: 'order' });
      else items.push({ content: `IT IS ORDERED under HMA s.25: ${dd.spousalSupportPayor || 'Respondent'} pays INR ${dd.spousalSupportAmount || '[AMOUNT]'}/month for ${dd.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
      return { title: 'PERMANENT ALIMONY / MAINTENANCE', items, type: 'spousal_support' };
    }

    generateFinalOrdersSection() {
      return { title: 'FINAL ORDERS', items: [
        { content: 'IT IS HEREBY ORDERED AND DECREED that the marriage stands dissolved.', type: 'order' },
        { content: 'All relief not expressly granted is dismissed.', type: 'order' },
        { content: this.getEffectiveDateText(), type: 'order' },
        { content: this.getCertificateNote(), type: 'order' }
      ], type: 'final_orders' };
    }

    getEffectiveDateText() { return 'This Decree takes effect from the date it is passed.'; }
    getCertificateNote() { return 'A certified copy may be obtained from the court registry.'; }
  }

  return IndiaDivorceDecreeTemplate;
}

/**
 * Create standard India divorce prompts for a given state.
 */
function createIndiaDivorcePrompts(config) {
  const SHARED_RULES = `\nEXTRACTION RULES:\n- Always call process_phase_data\n- Use FIRST PERSON for facts\n- Never repeat or fabricate\n- Ask ONE clarifying question if unclear\n- Be warm, professional, concise\n\nPHASE ADVANCEMENT:\n- Set phase_complete: true ONLY when all required fields collected\n`;

  const INTAKE = `You are a legal document assistant helping someone file for divorce in ${config.stateName}, India.\n\nCRITICAL — PERSONAL LAW TRIAGE:\nYou MUST determine the applicable personal law first.\n\nCOLLECT:\n1. Petitioner's full legal first and last name\n2. Respondent's full legal first and last name\n3. Personal law: Hindu/Buddhist/Jain/Sikh → HMA | Special Marriage Act → SMA | Christian → IDA | Muslim → DMMA (wife-only: the Dissolution of Muslim Marriages Act 1939 gives judicial divorce grounds to Muslim WIVES; a husband's divorce proceeds under Muslim personal law, not the DMMA)\n\nOPENING:\n"I'm here to help you prepare your divorce petition for filing in ${config.stateName}.\nLet's start — what is your full legal name?"\n\nKEY FACTS:\n- Court: ${config.defaultCourt}\n- Stamp paper: ${config.stampPaperValue}\n${SHARED_RULES}`;

  const RESIDENCY = `Legal document assistant for ${config.stateName} divorce.\nJurisdiction per HMA s.19 / SMA s.31: filed where marriage was solemnized, respondent resides, parties last resided together, or petitioner (wife) resides.\n\nCOLLECT:\n1. Where was marriage solemnized?\n2. Current residence → confirm ${config.stateName}\n3. Spouse's residence\n4. Preferred court location\n${SHARED_RULES}`;

  const GROUNDS = `Legal document assistant for ${config.stateName} divorce.\nHMA s.13 / mutual consent HMA s.13B / SMA s.28 / IDA s.10 / DMMA s.2\nAmardeep Singh (2017): 6-month cooling-off waivable\nShilpa Sailesh v. Varun Sreenivasan (2023): SC may grant divorce under Art. 142 on irretrievable breakdown\nDelhi HC Full Bench (Dec 2025): 1-year separation under s.13B(1) is directory, not mandatory (binding in Delhi, persuasive elsewhere)\n\nCOLLECT:\n1. Date of marriage (place)\n2. Date of separation\n3. Ground: mutual consent or specific?\nREQUIRED: grounds, marriage_date, marriage_city, separation_date\n${SHARED_RULES}`;

  const CHILDREN = `Legal document assistant for ${config.stateName} divorce.\nHMA s.26 / HMGA 1956 / GWA 1890 / BNSS s.144. Welfare of child paramount.\n\nCOLLECT:\n1. Minor/dependent children? → If NO: phase complete\n2. Each child: name, DOB, living arrangements\n3. Custody proposal\n4. Maintenance agreement\nREQUIRED: children_confirmed\n${SHARED_RULES}`;

  const PROPERTY = `Legal document assistant for ${config.stateName} divorce.\nNo specific matrimonial property statute. Hindu Succession Act 1956. Streedhan.\n\nCOLLECT:\n1. Immovable property\n2. Bank/investments/PF\n3. Vehicles, business, gold/jewellery\n4. Debts\n5. Settlement status\nREQUIRED: property_agreement\n${SHARED_RULES}`;

  const SUPPORT = `Legal document assistant for ${config.stateName} divorce.\nHMA s.24/25 / BNSS s.144. No fixed formula.\n\nCOLLECT:\n1. Requesting maintenance? → If NEITHER: done\n2. Amount/duration\n3. Basis\nREQUIRED: spousal_support_confirmed\n${SHARED_RULES}`;

  const SERVICE = `Legal document assistant for ${config.stateName} divorce.\nService: personal, substituted, registered post, mutual consent.\n\nCOLLECT:\n1. Mutual consent or contested?\n2. Respondent's address\n3. Cooperative?\nREQUIRED: service_method, respondent_address\n${SHARED_RULES}`;

  const REVIEW = `Legal document assistant for ${config.stateName} divorce. Final review.\nSummarize all information. Ask user to confirm. user_confirmed_review: true\n\nREMINDERS:\n- Stamp paper: ${config.stampPaperValue}\n- Filing fee: ~${config.filingFee || 'varies by court'}\n- Mutual consent: First Motion → 6-month cooling-off → Second Motion\n- Cooling-off waivable (Amardeep Singh (2017)); 1-year separation waivable (Delhi HC Full Bench, Dec 2025 — binding in Delhi, persuasive elsewhere)\n- Emergency: 181 or 112\n${SHARED_RULES}`;

  const PHASES = {
    INTAKE:    { name: 'INTAKE',    displayName: 'Getting Started',        order: 1, prompt: INTAKE,    requiredFields: ['petitionerFirstName', 'petitionerLastName', 'respondentFirstName', 'respondentLastName'], optional: false },
    RESIDENCY: { name: 'RESIDENCY', displayName: 'Jurisdiction & Filing',  order: 2, prompt: RESIDENCY, requiredFields: ['state', 'county'], optional: false },
    GROUNDS:   { name: 'GROUNDS',   displayName: 'Grounds & Marriage',     order: 3, prompt: GROUNDS,   requiredFields: ['groundsForDivorce', 'marriageDate', 'separationDate'], optional: false },
    CHILDREN:  { name: 'CHILDREN',  displayName: 'Children',               order: 4, prompt: CHILDREN,  requiredFields: ['childrenConfirmed'], optional: false },
    PROPERTY:  { name: 'PROPERTY',  displayName: 'Property Division',      order: 5, prompt: PROPERTY,  requiredFields: ['propertyAgreement'], optional: false },
    SUPPORT:   { name: 'SUPPORT',   displayName: 'Maintenance / Alimony',  order: 6, prompt: SUPPORT,   requiredFields: ['spousalSupportConfirmed'], optional: true },
    SERVICE:   { name: 'SERVICE',   displayName: 'Serving Your Spouse',    order: 7, prompt: SERVICE,   requiredFields: ['serviceMethod'], optional: false },
    REVIEW:    { name: 'REVIEW',    displayName: 'Review & Confirm',       order: 8, prompt: REVIEW,    requiredFields: ['userConfirmedReview'], optional: false },
  };

  const PHASE_ORDER = ['INTAKE', 'RESIDENCY', 'GROUNDS', 'CHILDREN', 'PROPERTY', 'SUPPORT', 'SERVICE', 'REVIEW'];

  return { PHASES, PHASE_ORDER };
}

module.exports = {
  createIndiaAffidavitTemplate,
  createIndiaDivorcePetitionTemplate,
  createIndiaDivorceDecreeTemplate,
  createIndiaDivorcePrompts
};
