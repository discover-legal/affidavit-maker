// services/processors/DivorceToolProcessor.js - Divorce tool call processing
const logger = require('../../utils/logger');

class DivorceToolProcessor {
  constructor(courtNameService) {
    this.courtNameService = courtNameService;
  }

  /**
   * DIVORCE PACKAGE: Process divorce-specific tool call
   */
  processDivorceToolCall(args, currentData) {
    const newData = { ...currentData };
    let hasNewData = false;

    // Extract Petitioner Information
    if (args.petitioner_first_name) {
      newData.petitionerFirstName = String(args.petitioner_first_name).trim();
      // Also set affiantName for backward compatibility with preview/PDF generation
      newData.firstName = newData.petitionerFirstName;
      hasNewData = true;
    }
    if (args.petitioner_last_name) {
      newData.petitionerLastName = String(args.petitioner_last_name).trim();
      newData.lastName = newData.petitionerLastName;
      // Update affiantName for backward compatibility
      if (newData.petitionerFirstName) {
        newData.affiantName = `${newData.petitionerFirstName} ${newData.petitionerLastName}`;
      }
      hasNewData = true;
    }
    if (args.petitioner_address) {
      newData.petitionerAddress = String(args.petitioner_address).trim();
      hasNewData = true;
    }

    // Extract Respondent Information
    if (args.respondent_first_name) {
      newData.respondentFirstName = String(args.respondent_first_name).trim();
      hasNewData = true;
    }
    if (args.respondent_last_name) {
      newData.respondentLastName = String(args.respondent_last_name).trim();
      hasNewData = true;
    }
    if (args.respondent_address) {
      newData.respondentAddress = String(args.respondent_address).trim();
      hasNewData = true;
    }

    // Extract Jurisdiction (State & County)
    if (args.extracted_state && args.extracted_state !== 'NONE') {
      if (args.extracted_state === 'UNSUPPORTED') {
        logger.warn('Unsupported state detected for divorce', {
          detectedState: args.detected_unsupported_state
        });
        newData.unsupportedState = args.detected_unsupported_state;
        hasNewData = true;
      } else {
        newData.state = args.extracted_state;
        hasNewData = true;
      }
    }
    if (args.extracted_county) {
      newData.county = String(args.extracted_county).trim();
      hasNewData = true;
    }
    if (args.residency_duration) {
      newData.residencyDuration = String(args.residency_duration).trim();
      hasNewData = true;
    }

    // Auto-generate court name from county and state if not manually provided
    if (newData.county && newData.state && !args.court_name && !currentData.courtName) {
      const autoCourtName = this.courtNameService.getDefaultCourtName(
        newData.state,
        newData.county
      );
      if (autoCourtName) {
        newData.courtName = autoCourtName;
        hasNewData = true;
      }
    }

    // Extract Marriage Information
    if (args.marriage_date) {
      newData.marriageDate = String(args.marriage_date).trim();
      hasNewData = true;
    }
    if (args.marriage_place) {
      newData.marriagePlace = String(args.marriage_place).trim();
      hasNewData = true;
    }
    if (args.separation_date) {
      newData.separationDate = String(args.separation_date).trim();
      hasNewData = true;
    }

    // Extract Children Information
    if (args.has_minor_children !== null && args.has_minor_children !== undefined) {
      newData.hasMinorChildren = Boolean(args.has_minor_children);
      hasNewData = true;
    }
    if (args.number_of_children) {
      newData.numberOfChildren = Number(args.number_of_children);
      hasNewData = true;
    }
    if (args.children && Array.isArray(args.children) && args.children.length > 0) {
      // Merge with existing children or replace
      newData.children = args.children.map(child => ({
        name: child.name,
        dateOfBirth: child.date_of_birth,
        age: child.age,
        livesWith: child.lives_with
      }));
      hasNewData = true;
    }
    if (args.custody_preference) {
      newData.custodyPreference = String(args.custody_preference).trim();
      hasNewData = true;
    }
    if (args.custody_details) {
      newData.custodyDetails = String(args.custody_details).trim();
      hasNewData = true;
    }

    // Extract Property & Debts
    if (args.real_estate) {
      newData.realEstate = String(args.real_estate).trim();
      hasNewData = true;
    }
    if (args.vehicles) {
      newData.vehicles = String(args.vehicles).trim();
      hasNewData = true;
    }
    if (args.bank_accounts) {
      newData.bankAccounts = String(args.bank_accounts).trim();
      hasNewData = true;
    }
    if (args.retirement_accounts) {
      newData.retirementAccounts = String(args.retirement_accounts).trim();
      hasNewData = true;
    }
    if (args.other_assets) {
      newData.otherAssets = String(args.other_assets).trim();
      hasNewData = true;
    }
    if (args.has_debts !== null && args.has_debts !== undefined) {
      newData.hasDebts = Boolean(args.has_debts);
      hasNewData = true;
    }
    if (args.debts_description) {
      newData.debtsDescription = String(args.debts_description).trim();
      hasNewData = true;
    }
    if (args.property_division_preference) {
      newData.propertyDivisionPreference = String(args.property_division_preference).trim();
      hasNewData = true;
    }

    // Extract Spousal Support
    if (args.requesting_spousal_support !== null && args.requesting_spousal_support !== undefined) {
      newData.requestingSpousalSupport = Boolean(args.requesting_spousal_support);
      hasNewData = true;
    }
    if (args.spousal_support_details) {
      newData.spousalSupportDetails = String(args.spousal_support_details).trim();
      hasNewData = true;
    }

    // Extract Grounds for Divorce
    if (args.grounds_for_divorce) {
      newData.groundsForDivorce = String(args.grounds_for_divorce).trim();
      hasNewData = true;
    }
    if (args.grounds_details) {
      newData.groundsDetails = String(args.grounds_details).trim();
      hasNewData = true;
    }

    // Extract Case Info (if already filed)
    if (args.case_number) {
      newData.caseNumber = String(args.case_number).trim();
      hasNewData = true;
    }
    if (args.court_name) {
      newData.courtName = String(args.court_name).trim();
      hasNewData = true;
    }

    // Extract additional facts (same as affidavit)
    const extractedFacts = Array.isArray(args.extracted_facts) ? args.extracted_facts : [];
    let processedFacts = [];

    if (extractedFacts.length > 0) {
      const existingFacts = currentData.facts || [];
      const { v4: uuidv4 } = require('uuid');

      processedFacts = extractedFacts.map(fact => {
        if (fact.is_evidence) {
          const evidenceItem = {
            ...fact,
            id: uuidv4(),
            type: 'evidence',
            category: 'evidence',
            evidenceData: {
              exhibitLabel: '',
              description: fact.evidence_description || '',
              fileName: null,
              fileKey: null,
              fileType: null,
              fileSizeBytes: 0,
              filePages: 1,
              uploadedAt: null,
              thumbnailKey: null,
              requiresUpload: true
            }
          };

          logger.info('Divorce evidence item created:', {
            id: evidenceItem.id,
            description: evidenceItem.evidenceData.description
          });

          return evidenceItem;
        }
        return {
          ...fact,
          id: fact.id || uuidv4(),
          type: fact.type || 'fact'
        };
      });

      newData.facts = [...existingFacts, ...processedFacts];
      hasNewData = true;
    }

    return {
      chatResponse: args.chat_response || "I understand. Please continue sharing the details.",
      updatedAffidavitData: newData,
      extractedFacts: processedFacts,
      suggestions: args.suggestions || [],
      hasNewData
    };
  }
}

module.exports = DivorceToolProcessor;
