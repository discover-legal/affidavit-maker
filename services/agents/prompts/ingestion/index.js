'use strict';

/**
 * Document Ingestion Orchestrator — Phase prompts, field map, and tool definition.
 *
 * This orchestrator handles the respondent path: a user uploads a legal document
 * they were served with, and the system helps them review the extraction, fill
 * gaps, select response documents, and confirm before generating.
 */

const SHARED_RULES = `
EXTRACTION RULES:
- Always call process_matter_data
- Use FIRST PERSON for all facts ("I was served on...")
- Ask ONE clarifying question at a time
- The user is the RESPONDENT — they received this document, they did NOT file it

PHASE ADVANCEMENT:
- Set phase_complete: true ONLY when the user has confirmed or all required info is collected
`;

const REVIEW_EXTRACTION = `You are a document preparation assistant helping someone who has been served with legal papers.

The system has automatically extracted the following information from their uploaded document. Your job is to present this summary clearly and ask the user to verify it.

PRESENT the extracted data in a clear, organized format:
1. "Here's what I found in the document you uploaded:"
2. Show: Document type, Court, Case number, Filing date
3. Show: Who filed it (petitioner/plaintiff) and who it's against (respondent/defendant)
4. Show: State, County
5. Show: Claims/grounds listed
6. Show: Relief requested
7. Show: Any children mentioned
8. Show: Any monetary amounts
9. Show: Response deadline (if calculated)

THEN ASK:
- "Does this look correct? Is there anything I should change?"
- "Were you personally served? What date were you served with these papers?"

IMPORTANT:
- If the user corrects anything, update the fields
- If service_date was not extracted, you MUST ask for it — it's critical for deadline calculation
- Be empathetic — receiving legal papers is stressful

REQUIRED FIELDS: user_confirmed_extraction

${SHARED_RULES}`;

const FILL_GAPS = `You are a document preparation assistant helping someone respond to legal papers they were served with.

The document has been reviewed and confirmed. Now collect any missing information needed for their response documents.

COLLECT (only what's missing — skip items already provided):
1. Your full legal name (as you want it on your response documents)
2. Your current address
3. The date you were served with these papers (if not already confirmed)
4. Do you have an attorney, or are you representing yourself?

FOR DIVORCE/FAMILY MATTERS, also ask:
5. Do you agree or disagree with what the petitioner is requesting?
6. Are there any facts in the petition that are wrong?
7. Do you want to make any counter-requests (e.g., custody, support, property)?

FOR CIVIL/DEBT MATTERS, also ask:
5. Do you dispute the amount claimed?
6. Do you have any defenses? (statute of limitations, wrong person, already paid, etc.)
7. Have you been contacted about this before?

REQUIRED FIELDS: respondent_first_name, respondent_last_name

${SHARED_RULES}`;

const RESPONSE_SELECTION = `You are a document preparation assistant helping someone respond to legal papers.

Based on the document they received and the information collected, the system has suggested response documents. Present them and confirm.

PRESENT:
1. "Based on what you were served with, here are the response documents I'll prepare for you:"
2. List each document with its purpose (the system provides reasons)
3. "Would you like me to add or remove any documents from this list?"

ALSO:
- Remind them of the response deadline
- Mention that filing fees may apply
- Ask if they want to request a fee waiver (indigency affidavit)

REQUIRED FIELDS: user_confirmed_documents

${SHARED_RULES}`;

const REVIEW = `You are a document preparation assistant helping someone respond to legal papers.
Final review before document generation.

1. Summarize: Who served them, the case, their response, the documents being generated
2. DEADLINE REMINDER: "Your response is due by [deadline]. File your documents at the [court name] clerk's office."
3. Ask: "Does everything look correct? Ready to generate your response documents?"
4. Once confirmed: "Your response package is ready to generate."

REQUIRED FIELDS: user_confirmed_review
${SHARED_RULES}`;

// ─── Phase definitions ───────────────────────────────────────────────────────

const PHASES = {
  REVIEW_EXTRACTION: {
    name: 'REVIEW_EXTRACTION',
    displayName: 'Review Extracted Data',
    order: 1,
    prompt: REVIEW_EXTRACTION,
    requiredFields: ['userConfirmedExtraction'],
    optional: false
  },
  FILL_GAPS: {
    name: 'FILL_GAPS',
    displayName: 'Your Information',
    order: 2,
    prompt: FILL_GAPS,
    requiredFields: ['respondentFirstName', 'respondentLastName'],
    optional: false
  },
  RESPONSE_SELECTION: {
    name: 'RESPONSE_SELECTION',
    displayName: 'Response Documents',
    order: 3,
    prompt: RESPONSE_SELECTION,
    requiredFields: ['userConfirmedDocuments'],
    optional: false
  },
  REVIEW: {
    name: 'REVIEW',
    displayName: 'Review & Confirm',
    order: 4,
    prompt: REVIEW,
    requiredFields: ['userConfirmedReview'],
    optional: false
  }
};

const PHASE_ORDER = ['REVIEW_EXTRACTION', 'FILL_GAPS', 'RESPONSE_SELECTION', 'REVIEW'];

// ─── Field map (snake_case LLM output → camelCase app data) ─────────────────

const FIELD_MAP = {
  respondent_first_name:       'respondentFirstName',
  respondent_last_name:        'respondentLastName',
  respondent_address:          'respondentAddress',
  petitioner_name:             'petitionerName',
  state:                       'state',
  county:                      'county',
  court_name:                  'courtName',
  case_number:                 'caseNumber',
  service_date:                'serviceDate',
  response_deadline:           'responseDeadline',
  has_attorney:                'hasAttorney',
  agrees_with_petition:        'agreesWithPetition',
  disputed_facts:              'disputedFacts',
  counter_requests:            'counterRequests',
  amount_disputed:             'amountDisputed',
  defenses:                    'defenses',
  indigency_requested:         'indigencyRequested',
  user_confirmed_extraction:   'userConfirmedExtraction',
  user_confirmed_documents:    'userConfirmedDocuments',
  user_confirmed_review:       'userConfirmedReview'
};

// ─── Tool definition ─────────────────────────────────────────────────────────

function buildTool() {
  return {
    type: 'function',
    function: {
      name: 'process_matter_data',
      description: 'Extract respondent interview data for document ingestion response flow.',
      parameters: {
        type: 'object',
        required: ['response', 'phase_complete'],
        properties: {
          response:                    { type: 'string' },
          phase_complete:              { type: 'boolean' },
          respondent_first_name:       { type: 'string' },
          respondent_last_name:        { type: 'string' },
          respondent_address:          { type: 'string' },
          petitioner_name:             { type: 'string' },
          state:                       { type: 'string' },
          county:                      { type: 'string' },
          court_name:                  { type: 'string' },
          case_number:                 { type: 'string' },
          service_date:                { type: 'string', description: 'Date user was served (ISO format)' },
          response_deadline:           { type: 'string', description: 'Calculated response deadline' },
          has_attorney:                { type: 'boolean' },
          agrees_with_petition:        { type: 'boolean' },
          disputed_facts:              { type: 'array', items: { type: 'string' } },
          counter_requests:            { type: 'array', items: { type: 'string' } },
          amount_disputed:             { type: 'boolean' },
          defenses:                    { type: 'array', items: { type: 'string' } },
          indigency_requested:         { type: 'boolean' },
          user_confirmed_extraction:   { type: 'boolean' },
          user_confirmed_documents:    { type: 'boolean' },
          user_confirmed_review:       { type: 'boolean' },
          extracted_facts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content:     { type: 'string' },
                category:    { type: 'string' },
                subcategory: { type: 'string' }
              },
              required: ['content', 'category']
            }
          }
        }
      }
    }
  };
}

module.exports = { PHASES, PHASE_ORDER, FIELD_MAP, buildTool };
