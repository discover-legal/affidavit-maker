// templates/states/texas/ProveUpAffidavitTemplate.js
// Texas Affidavit for Prove-Up of Agreed Divorce
// Allows uncontested divorce finalization without a court appearance
// Complies with Tex. Fam. Code § 6.701 and local court practices

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Texas Affidavit for Prove-Up of Agreed Divorce
 *
 * LEGAL COMPLIANCE NOTES:
 * - Used in AGREED (uncontested) divorces where both parties have signed the
 *   Final Decree of Divorce and all ancillary agreements
 * - Allows the court to grant the divorce without a live prove-up hearing;
 *   acceptance is at the judge's discretion and varies by county
 * - Must be SWORN before a notary — not an unsworn declaration
 * - Petitioner attests to: identity, residency (Tex. Fam. Code § 6.301),
 *   grounds (Tex. Fam. Code § 6.001), children, property agreement
 * - 60-day waiting period must have elapsed (Tex. Fam. Code § 6.702) unless
 *   a family violence exception applies (§ 6.702(b))
 * - For divorces WITH minor children, an additional SAPCR order is typically
 *   required; this affidavit covers the no-children and children scenarios
 * - References Dallas County Family District Court prove-up form (Sample-Prove-up-Affidavit-Agreed-Divorce-20211111.pdf)
 *   and Texas Law Help form FM-DivA-108
 *
 * Legal References:
 * - Tex. Fam. Code § 6.001 - Insupportability (no-fault grounds)
 * - Tex. Fam. Code § 6.301 - Residency requirements (6 months TX / 90 days county)
 * - Tex. Fam. Code § 6.702 - 60-day waiting period
 * - Tex. Fam. Code § 153 - Child custody and conservatorship
 * - Tex. Fam. Code § 154 - Child support
 * - Tex. R. Civ. P. 119a - Waiver of Service
 * - Tex. Civ. Prac. & Rem. Code § 18.002 - Statutory jurat
 *
 * @class TexasProveUpAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class TexasProveUpAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.state = 'TX';
    this.stateName = 'Texas';
    this.documentTitle = 'AFFIDAVIT FOR PROVE-UP OF AGREED DIVORCE';

    this.sections = {
      header: true,
      venue: true,
      caseCaption: true,
      title: true,
      introduction: true,
      competencyStatement: false,  // Covered by notarized oath
      facts: true,
      conclusion: true,
      perjuryStatement: false,     // Sworn affidavit — notary oath suffices
      signatureBlock: true,
      notaryBlock: true,           // REQUIRED — sworn before notary
      footer: true
    };

    this.requiredFields = ['affiantName', 'state', 'county'];

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in'
    };
  }

  /**
   * Texas state header line
   */
  generateHeader() {
    return 'THE STATE OF TEXAS';
  }

  /**
   * Texas venue block (county / state)
   *
   * @param {string} county
   */
  generateVenue(county) {
    const countyName = county
      ? county.toUpperCase().replace(/\s+COUNTY$/i, '')
      : '________';
    return `COUNTY OF ${countyName}`;
  }

  /**
   * Case caption with CAUSE NO. (Texas district court style)
   *
   * @param {Object} data
   */
  generateCaseCaption(data) {
    const causeNo = data.causeNumber || data.caseNumber || '________________';
    const court   = data.courtName  || `${data.county ? data.county.toUpperCase() : '________'} COUNTY, TEXAS`;

    const petitionerName = data.petitionerName
      || (data.affiantName || 'PETITIONER');
    const respondentName = data.respondentName || 'RESPONDENT';

    return [
      'IN THE MATTER OF THE MARRIAGE OF',
      '',
      petitionerName.toUpperCase(),
      'Petitioner,',
      '',
      'AND',
      '',
      respondentName.toUpperCase(),
      'Respondent.',
      '',
      `IN THE DISTRICT COURT OF`,
      court.toUpperCase(),
      `CAUSE NO. ${causeNo}`,
    ].join('\n');
  }

  /**
   * Opening paragraph — Petitioner's personal appearance under oath
   *
   * @param {Object} data
   */
  generateIntroduction(data) {
    const petitionerName = data.petitionerName || data.affiantName || '______________________';
    const county         = data.county ? data.county + ' County' : '____________ County';

    return (
      `BEFORE ME, the undersigned authority, personally appeared ${petitionerName} ` +
      `("Petitioner"), who, being duly sworn, deposes and states as follows:`
    );
  }

  /**
   * Build numbered facts from document data.
   * If AI-extracted facts are present they are used; otherwise we construct
   * standard prove-up paragraphs from the structured fields.
   *
   * @param {Object} data
   * @returns {Array<string>}
   */
  generateFacts(data) {
    // If the AI has already collected structured facts, use them
    if (data.facts && data.facts.length > 0) {
      return data.facts.map(f => (typeof f === 'string' ? f : f.content)).filter(Boolean);
    }

    const facts = [];
    const petitionerName = data.petitionerName || data.affiantName || '______________________';
    const respondentName = data.respondentName || '______________________';
    const county         = data.county || '____________';
    const marriageDate   = data.marriageDate || '______________________';
    const marriagePlace  = data.marriagePlace || '______________________';
    const hasChildren    = data.hasMinorChildren === true || data.children?.length > 0;

    // 1. Identity
    facts.push(
      `I am the Petitioner in the above-styled and numbered cause. ` +
      `I am personally acquainted with all of the facts stated herein.`
    );

    // 2. Residency — Tex. Fam. Code § 6.301
    facts.push(
      `I have been a domiciliary of the State of Texas for a period of at least six (6) months ` +
      `and a resident of ${county} County, Texas for at least ninety (90) days immediately ` +
      `preceding the filing of the Original Petition for Divorce in this cause, as required by ` +
      `Section 6.301 of the Texas Family Code.`
    );

    // 3. Marriage — date and place
    facts.push(
      `Petitioner and Respondent, ${respondentName}, were legally married on ` +
      `${marriageDate}, in ${marriagePlace}. ` +
      `At the time of this affidavit, Petitioner and Respondent remain legally married to each other ` +
      `and have not previously been divorced from each other in this proceeding.`
    );

    // 4. Grounds — Tex. Fam. Code § 6.001 insupportability
    const grounds = data.groundsForDivorce || 'insupportability';
    if (grounds.toLowerCase().includes('insupportab')) {
      facts.push(
        `The marriage has become insupportable because of discord or conflict of personalities ` +
        `that destroys the legitimate ends of the marital relationship and prevents any reasonable ` +
        `expectation of reconciliation, as provided by Section 6.001 of the Texas Family Code. ` +
        `There is no reasonable expectation that the parties will reconcile.`
      );
    } else {
      facts.push(
        `Grounds for divorce exist as set forth in the Original Petition for Divorce on file herein.`
      );
    }

    // 5. Waiting period — Tex. Fam. Code § 6.702
    facts.push(
      `More than sixty (60) days have elapsed since the Original Petition for Divorce ` +
      `was filed in this cause, satisfying the waiting period required by ` +
      `Section 6.702 of the Texas Family Code.`
    );

    // 6. Children
    if (hasChildren) {
      const children = data.children || [];
      const childList = children.length > 0
        ? children.map(c => {
            const name = c.name || c.firstName
              ? `${c.firstName || ''} ${c.lastName || ''}`.trim()
              : '______________________';
            const dob  = c.dateOfBirth || c.dob || '______________________';
            return `${name} (born ${dob})`;
          }).join('; ')
        : '______________________';

      facts.push(
        `The following children were born or adopted of this marriage who are currently ` +
        `under eighteen (18) years of age or otherwise subject to the jurisdiction of this Court: ` +
        `${childList}. ` +
        `The Final Decree of Divorce contains provisions for the conservatorship, possession and ` +
        `access, and support of said children in accordance with the Texas Family Code, ` +
        `Chapters 153 and 154, and the best interest of the children.`
      );
    } else {
      facts.push(
        `There are no children born or adopted of this marriage who are currently under ` +
        `eighteen (18) years of age or otherwise subject to the jurisdiction of this Court. ` +
        `No child is expected.`
      );
    }

    // 7. Property division agreement
    facts.push(
      `The parties have reached a full and complete agreement regarding the division of all ` +
      `community property, separate property, and debts of the marriage, which agreement is ` +
      `incorporated in the Final Decree of Divorce. The division of the marital estate is just ` +
      `and right, having due regard for the rights of each party.`
    );

    // 8. Respondent's appearance/waiver
    const respondentWaived = data.respondentWaivedService !== false;
    if (respondentWaived) {
      facts.push(
        `Respondent has signed the Final Decree of Divorce and has either filed a Waiver of ` +
        `Service or appeared in this cause, and both parties have agreed to all terms set forth ` +
        `in the Final Decree of Divorce.`
      );
    } else {
      facts.push(
        `Respondent has been duly cited or has appeared in this cause as required by law, ` +
        `and the Final Decree of Divorce accurately reflects the agreement of the parties ` +
        `on all matters.`
      );
    }

    // 9. Prayer / request to grant without hearing
    facts.push(
      `I respectfully request that the Court grant this divorce based upon this affidavit ` +
      `in lieu of a live prove-up hearing, and that the Court sign the Final Decree of Divorce ` +
      `as agreed to by the parties. I waive my right to appear in person for a prove-up hearing.`
    );

    return facts;
  }

  /**
   * Conclusion paragraph
   *
   * @param {Object} data
   */
  generateConclusion(data) {
    return (
      `Further affiant sayeth naught.\n\n` +
      `SWORN TO AND SUBSCRIBED before me on the date indicated below.`
    );
  }

  /**
   * Texas statutory jurat (notary block)
   *
   * @param {Object} data
   */
  generateNotaryBlock(data) {
    const petitionerName = data.petitionerName || data.affiantName || '______________________';

    return [
      '',
      '_'.repeat(40),
      petitionerName,
      'Petitioner',
      '',
      '',
      'STATE OF TEXAS',
      `COUNTY OF ${data.county ? data.county.toUpperCase() : '____________'}`,
      '',
      'SUBSCRIBED AND SWORN TO before me, the undersigned Notary Public, by ' +
        `${petitionerName}, on the ______ day of ____________________, 20____.`,
      '',
      '',
      '_'.repeat(40),
      'Notary Public, State of Texas',
      'My Commission Expires: ________________',
    ].join('\n');
  }

  /**
   * Generate the complete document structure
   *
   * @param {Object} data - Affidavit data
   * @returns {Object} Document structure for PDF rendering
   */
  generate(data) {
    const county = data.county || '';

    const facts   = this.generateFacts(data);
    const numbered = facts.map((f, i) => `${i + 1}. ${f}`).join('\n\n');

    const content = [
      this.generateHeader(),
      '',
      this.generateVenue(county),
      '',
      this.generateCaseCaption(data),
      '',
      this.documentTitle,
      '',
      this.generateIntroduction(data),
      '',
      numbered,
      '',
      this.generateConclusion(data),
      '',
      this.generateNotaryBlock(data),
    ].join('\n');

    return {
      title: this.documentTitle,
      state: this.state,
      county,
      content,
      sections: {
        header:        this.generateHeader(),
        venue:         this.generateVenue(county),
        caseCaption:   this.generateCaseCaption(data),
        title:         this.documentTitle,
        introduction:  this.generateIntroduction(data),
        facts:         facts,
        conclusion:    this.generateConclusion(data),
        notaryBlock:   this.generateNotaryBlock(data),
      },
      metadata: {
        documentType:      'prove_up_affidavit',
        state:             this.state,
        stateName:         this.stateName,
        legallyCompliant:  true,
        requiresNotary:    true,
        requiresOath:      true,
        governingLaw: [
          'Tex. Fam. Code § 6.001',
          'Tex. Fam. Code § 6.301',
          'Tex. Fam. Code § 6.702',
          'Tex. Civ. Prac. & Rem. Code § 18.002',
        ],
        usageNotes: [
          'For agreed (uncontested) divorces only',
          'Both parties must have signed the Final Decree before filing',
          'Judge acceptance varies by county — check with court coordinator',
          '60-day waiting period must have passed (Tex. Fam. Code § 6.702)',
        ],
      },
    };
  }
}

module.exports = TexasProveUpAffidavitTemplate;
