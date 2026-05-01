// services/processors/AffidavitToolProcessor.js - Affidavit tool call processing
const logger = require('../../utils/logger');

class AffidavitToolProcessor {
  constructor(courtNameService) {
    this.courtNameService = courtNameService;
  }

  /**
   * Process tool call with county & case caption
   */
  processToolCall(args, currentData) {
    const newData = { ...currentData };
    let hasNewData = false;

    // Extract first name
    if (args.extracted_first_name && args.extracted_first_name !== 'NONE') {
      newData.firstName = String(args.extracted_first_name).trim();
      hasNewData = true;
      // Also update affiantName for backward compatibility
      if (args.extracted_last_name && args.extracted_last_name !== 'NONE') {
        newData.affiantName = `${newData.firstName} ${String(args.extracted_last_name).trim()}`;
      } else {
        newData.affiantName = newData.firstName;
      }
    }

    // Extract last name
    if (args.extracted_last_name && args.extracted_last_name !== 'NONE') {
      newData.lastName = String(args.extracted_last_name).trim();
      hasNewData = true;
      // Also update affiantName for backward compatibility
      if (newData.firstName) {
        newData.affiantName = `${newData.firstName} ${newData.lastName}`;
      } else {
        newData.affiantName = newData.lastName;
      }
    }

    // Extract state
    if (args.extracted_state && args.extracted_state !== 'NONE') {
      if (args.extracted_state === 'UNSUPPORTED') {
        // Don't throw - instead, mark state as unsupported and let the response inform the user
        logger.warn('Unsupported state detected', {
          detectedState: args.detected_unsupported_state
        });
        // Set a flag for unsupported state (don't actually set the state field)
        newData.unsupportedState = args.detected_unsupported_state;
        hasNewData = true;
      } else {
        newData.state = args.extracted_state;
        hasNewData = true;
      }
    }

    // Extract county
    if (args.extracted_county) {
      newData.county = String(args.extracted_county).trim();
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

    // Extract case caption fields
    if (args.case_number) {
      newData.caseNumber = String(args.case_number).trim();
      hasNewData = true;
    }
    if (args.court_name) {
      newData.courtName = String(args.court_name).trim();
      hasNewData = true;
    }
    if (args.plaintiff) {
      newData.plaintiff = String(args.plaintiff).trim();
      hasNewData = true;
    }
    if (args.defendant) {
      newData.defendant = String(args.defendant).trim();
      hasNewData = true;
    }

    // Extract facts - preserve full fact objects with metadata (category, subcategory, etc.)
    const extractedFacts = Array.isArray(args.extracted_facts) ? args.extracted_facts : [];
    let processedFacts = []; // Declare outside if block so we can return it

    if (extractedFacts.length > 0) {
      const existingFacts = currentData.facts || [];
      const { v4: uuidv4 } = require('uuid');

      // Convert evidence facts to proper format
      processedFacts = extractedFacts.map(fact => {
        if (fact.is_evidence) {
          // Convert to evidence type with evidenceData
          const evidenceItem = {
            ...fact,
            id: uuidv4(), // Add unique ID for evidence tracking
            type: 'evidence',
            category: 'evidence',
            evidenceData: {
              exhibitLabel: '', // Will be calculated based on position
              description: fact.evidence_description || fact.evidence_mentioned_as || '',
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

          logger.info('Evidence item created:', {
            id: evidenceItem.id,
            description: evidenceItem.evidenceData.description,
            content: fact.content
          });

          return evidenceItem;
        }
        // Regular fact - ensure it has type: 'fact'
        return {
          ...fact,
          id: fact.id || uuidv4(),
          type: fact.type || 'fact'
        };
      });

      // Store full fact objects to preserve category, subcategory, severity, confidence, etc.
      newData.facts = [...existingFacts, ...processedFacts];
      hasNewData = true;
    }

    return {
      chatResponse: args.chat_response || "I understand. Please continue.",
      updatedAffidavitData: newData,
      extractedFacts: processedFacts,
      validationSummary: args.validation_summary || {},
      suggestions: args.suggestions || [],
      hasNewData
    };
  }
}

module.exports = AffidavitToolProcessor;
