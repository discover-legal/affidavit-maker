// services/llm/ToolDefinitions.js - OpenAI tool/function definitions
const { LEGAL_CATEGORIES, DIVORCE_CATEGORIES } = require('./constants');

class ToolDefinitions {
  constructor(supportedStates) {
    this.supportedStates = supportedStates;
  }

  /**
   * Affidavit processing tool with county & case caption fields
   */
  createAffidavitProcessingTool() {
    return {
      type: "function",
      function: {
        name: "process_affidavit_message",
        description: "MANDATORY: Process every user message to extract legal data and provide conversational response. Always call this function.",
        parameters: {
          type: "object",
          properties: {
            chat_response: {
              type: "string",
              description: "REQUIRED: Conversational response to keep user engaged. Always provide this."
            },
            extracted_first_name: {
              type: "string",
              description: "First name mentioned or extracted. If user gives full name, split it. Use null if not mentioned."
            },
            extracted_last_name: {
              type: "string",
              description: "Last name mentioned or extracted. If user gives full name, split it. Use null if not mentioned."
            },
            extracted_state: {
              type: "string",
              enum: [...this.supportedStates.map(s => s.code), "UNSUPPORTED", "NONE"],
              description: `State mentioned: ${this.supportedStates.map(s => `${s.code}=${s.name}`).join(', ')}, UNSUPPORTED=other states, NONE=not mentioned`
            },
            detected_unsupported_state: {
              type: "string",
              description: "Name of unsupported state if extracted_state is UNSUPPORTED"
            },
            extracted_county: {
              type: "string",
              description: "County name if mentioned or inferred from address. Use null if not mentioned."
            },
            case_number: {
              type: "string",
              description: "Case number if mentioned (e.g., '2024-12345', 'No. 2024-01234'). Use null if not mentioned."
            },
            court_name: {
              type: "string",
              description: "Court name if mentioned (e.g., '250th District Court', 'Family Court'). Use null if not mentioned."
            },
            plaintiff: {
              type: "string",
              description: "Plaintiff/Petitioner name if mentioned. Use null if not mentioned."
            },
            defendant: {
              type: "string",
              description: "Defendant/Respondent name if mentioned. Use null if not mentioned."
            },
            extracted_facts: {
              type: "array",
              description: "ONLY NEW legal facts not in the existing facts list",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "Original fact as user stated it"
                  },
                  category: {
                    type: "string",
                    enum: Object.keys(LEGAL_CATEGORIES),
                    description: "Legal category that best fits this fact"
                  },
                  subcategory: {
                    type: "string",
                    description: "More specific subcategory"
                  },
                  validation_issues: {
                    type: "array",
                    items: { type: "string" },
                    description: "Potential issues (hearsay, vague, needs dates)"
                  },
                  severity: {
                    type: "string",
                    enum: ["success", "info", "warning", "critical"],
                    description: "Severity of any issues"
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence in extraction (0.0-1.0)"
                  },
                  is_evidence: {
                    type: "boolean",
                    description: "TRUE if this is evidence/document that user mentioned and needs to upload (e.g., bank statement, email, photo). Use null or false for regular facts."
                  },
                  evidence_description: {
                    type: "string",
                    description: "Brief description of the evidence if is_evidence=true (e.g., 'Bank statement from January 2025', 'Email from attorney'). Use null if not evidence."
                  },
                  evidence_mentioned_as: {
                    type: "string",
                    description: "How user referred to the evidence (e.g., 'bank statement', 'email', 'photo', 'receipt'). Use null if not evidence."
                  }
                },
                required: ["content", "category"]
              }
            },
            validation_summary: {
              type: "object",
              description: "Overall validation summary",
              properties: {
                has_critical_issues: { type: "boolean" },
                total_issues: { type: "number" },
                completeness_score: { type: "number" }
              }
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "Helpful suggestions for the user"
            }
          },
          required: ["chat_response"]
        }
      }
    };
  }

  /**
   * DIVORCE PACKAGE: Processing tool for divorce documents
   */
  createDivorceProcessingTool() {
    return {
      type: "function",
      function: {
        name: "process_divorce_message",
        description: "MANDATORY: Process every user message to extract divorce-related data and provide conversational response. Always call this function.",
        parameters: {
          type: "object",
          properties: {
            chat_response: {
              type: "string",
              description: "REQUIRED: Conversational response to guide user through divorce document creation."
            },
            // Petitioner (person filing)
            petitioner_first_name: {
              type: "string",
              description: "Petitioner's first name. Use null if not mentioned."
            },
            petitioner_last_name: {
              type: "string",
              description: "Petitioner's last name. Use null if not mentioned."
            },
            petitioner_address: {
              type: "string",
              description: "Petitioner's current address. Use null if not mentioned."
            },
            // Respondent (spouse)
            respondent_first_name: {
              type: "string",
              description: "Respondent's (spouse's) first name. Use null if not mentioned."
            },
            respondent_last_name: {
              type: "string",
              description: "Respondent's (spouse's) last name. Use null if not mentioned."
            },
            respondent_address: {
              type: "string",
              description: "Respondent's current address. Use null if not mentioned."
            },
            // Jurisdiction
            extracted_state: {
              type: "string",
              enum: [...this.supportedStates.map(s => s.code), "UNSUPPORTED", "NONE"],
              description: `State for filing: ${this.supportedStates.map(s => `${s.code}=${s.name}`).join(', ')}, UNSUPPORTED=other states, NONE=not mentioned`
            },
            detected_unsupported_state: {
              type: "string",
              description: "Name of unsupported state if extracted_state is UNSUPPORTED"
            },
            extracted_county: {
              type: "string",
              description: "County name if mentioned. Use null if not mentioned."
            },
            residency_duration: {
              type: "string",
              description: "How long petitioner has lived in the state (e.g., '2 years', '6 months'). Use null if not mentioned."
            },
            // Marriage Information
            marriage_date: {
              type: "string",
              description: "Date of marriage (format: YYYY-MM-DD or as provided). Use null if not mentioned."
            },
            marriage_place: {
              type: "string",
              description: "City/State/Country where marriage took place. Use null if not mentioned."
            },
            separation_date: {
              type: "string",
              description: "Date of separation (format: YYYY-MM-DD or as provided). Use null if not mentioned."
            },
            // Children
            has_minor_children: {
              type: "boolean",
              description: "True if there are minor children from the marriage, false if none, null if not discussed."
            },
            number_of_children: {
              type: "number",
              description: "Number of minor children. Use null if not mentioned."
            },
            children: {
              type: "array",
              description: "Details of minor children",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Child's full name" },
                  date_of_birth: { type: "string", description: "Child's date of birth" },
                  age: { type: "number", description: "Child's current age" },
                  lives_with: { type: "string", description: "Who the child currently lives with" }
                }
              }
            },
            custody_preference: {
              type: "string",
              enum: ["joint_legal_physical", "joint_legal_sole_physical", "sole", "other", null],
              description: "Preferred custody arrangement. Use null if not mentioned."
            },
            custody_details: {
              type: "string",
              description: "Additional custody arrangement details. Use null if not mentioned."
            },
            // Property & Debts
            real_estate: {
              type: "string",
              description: "Description of real estate owned (address, estimated value). Use null if not mentioned."
            },
            vehicles: {
              type: "string",
              description: "Description of vehicles owned. Use null if not mentioned."
            },
            bank_accounts: {
              type: "string",
              description: "Description of bank accounts. Use null if not mentioned."
            },
            retirement_accounts: {
              type: "string",
              description: "Description of retirement/pension accounts. Use null if not mentioned."
            },
            other_assets: {
              type: "string",
              description: "Description of other significant assets. Use null if not mentioned."
            },
            has_debts: {
              type: "boolean",
              description: "True if there are marital debts, false if none, null if not discussed."
            },
            debts_description: {
              type: "string",
              description: "Description of debts (mortgage, loans, credit cards). Use null if not mentioned."
            },
            property_division_preference: {
              type: "string",
              description: "How petitioner wants to divide property. Use null if not mentioned."
            },
            // Spousal Support
            requesting_spousal_support: {
              type: "boolean",
              description: "True if requesting spousal support, false if not, null if not discussed."
            },
            spousal_support_details: {
              type: "string",
              description: "Details about spousal support request (amount, duration). Use null if not mentioned."
            },
            // Grounds
            grounds_for_divorce: {
              type: "string",
              enum: ["irreconcilable_differences", "incompatibility", "living_separate", "other", null],
              description: "Legal grounds for divorce. Use null if not mentioned."
            },
            grounds_details: {
              type: "string",
              description: "Additional details about grounds. Use null if not mentioned."
            },
            // Case Info (if already filed)
            case_number: {
              type: "string",
              description: "Case number if case has been filed. Use null if not mentioned."
            },
            court_name: {
              type: "string",
              description: "Name of the court. Use null if not mentioned."
            },
            // Additional facts (same structure as affidavit)
            extracted_facts: {
              type: "array",
              description: "Additional legal facts not covered by specific fields above. MUST use full names or roles (Petitioner/Respondent) instead of pronouns. Each fact must be self-contained.",
              items: {
                type: "object",
                properties: {
                  content: {
                    type: "string",
                    description: "The fact in formal legal language using full names, not pronouns. Must be understandable in isolation."
                  },
                  category: {
                    type: "string",
                    enum: [...Object.keys(DIVORCE_CATEGORIES), ...Object.keys(LEGAL_CATEGORIES)],
                    description: "Category that best fits this fact"
                  },
                  subcategory: {
                    type: "string",
                    description: "More specific subcategory"
                  },
                  is_evidence: {
                    type: "boolean",
                    description: "TRUE if this is evidence/document that needs to be uploaded"
                  },
                  evidence_description: {
                    type: "string",
                    description: "Description of evidence if is_evidence=true"
                  }
                },
                required: ["content", "category"]
              }
            },
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "Helpful suggestions for completing the divorce documents"
            }
          },
          required: ["chat_response"]
        }
      }
    };
  }
}

module.exports = ToolDefinitions;
