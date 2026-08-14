'use strict';
/** Ogun State (Nigeria) Divorce Phase Prompts — High Court of Ogun State, Abeokuta. */
const SHARED_RULES = `\nEXTRACTION RULES:\n- Always call process_phase_data to extract any new information\n- Use FIRST PERSON for all facts\n- Never repeat facts already documented\n- Never make up information\n- If unclear, ask ONE clarifying question\n- Be warm, professional, and concise\n\nPHASE ADVANCEMENT:\n- Set phase_complete: true ONLY when all required fields are collected\n`;
const INTAKE = `You are a legal document assistant helping someone petition for divorce in Ogun State, Nigeria.\n\nCRITICAL FIRST QUESTION:\n"Was your marriage registered under the Marriage Act?"\nIF YES: Proceed. IF NO: Explain customary/Islamic courts.\n\nCOLLECT: Petitioner\'s name, Respondent\'s name, confirm Ogun State.\nSAFETY: DV helpline: 0800 72 73 2255. Emergency: 112.\n${SHARED_RULES}`;
const RESIDENCY = `Residency for Ogun State. MCA s.2. Filing allowed in any state's High Court (MCA s.2(3)); Ogun High Court is the usual venue if either party resides in the state.\nCOLLECT: domicile, residence, judicial division (e.g., Abeokuta, Sagamu, Ijebu-Ode).\n${SHARED_RULES}`;
const GROUNDS = `Grounds — MCA s.15: 8 facts (s.15(2)(a)-(h)). 2-year bar (s.30; does not apply to petitions based on refusal to consummate or adultery, s.30(2)).\n${SHARED_RULES}`;
const CHILDREN = `Children — MCA s.71, Child Rights Law of Ogun State 2006.\n${SHARED_RULES}`;
const PROPERTY = `Property — MCA s.72.\n${SHARED_RULES}`;
const SUPPORT = `Spousal maintenance — MCA s.70.\n${SHARED_RULES}`;
const SERVICE = `Service of process.\n${SHARED_RULES}`;
const REVIEW = `Final review. A4.\n${SHARED_RULES}`;
const PHASES = {
  INTAKE: { name: 'INTAKE', displayName: 'Getting Started', order: 1, prompt: INTAKE, requiredFields: ['marriageType', 'petitionerFirstName', 'petitionerLastName', 'respondentFirstName', 'respondentLastName'], optional: false },
  RESIDENCY: { name: 'RESIDENCY', displayName: 'Domicile & Jurisdiction', order: 2, prompt: RESIDENCY, requiredFields: ['state', 'county', 'domicileConfirmed'], optional: false },
  GROUNDS: { name: 'GROUNDS', displayName: 'Grounds & Marriage', order: 3, prompt: GROUNDS, requiredFields: ['groundsForDivorce', 'marriageDate'], optional: false },
  CHILDREN: { name: 'CHILDREN', displayName: 'Children', order: 4, prompt: CHILDREN, requiredFields: ['childrenConfirmed'], optional: false },
  PROPERTY: { name: 'PROPERTY', displayName: 'Property & Ancillary', order: 5, prompt: PROPERTY, requiredFields: ['propertyAgreement'], optional: false },
  SUPPORT: { name: 'SUPPORT', displayName: 'Spousal Maintenance', order: 6, prompt: SUPPORT, requiredFields: ['spousalSupportConfirmed'], optional: true },
  SERVICE: { name: 'SERVICE', displayName: 'Service of Process', order: 7, prompt: SERVICE, requiredFields: ['serviceMethod'], optional: false },
  REVIEW: { name: 'REVIEW', displayName: 'Review & Confirm', order: 8, prompt: REVIEW, requiredFields: ['userConfirmedReview'], optional: false },
};
const PHASE_ORDER = ['INTAKE', 'RESIDENCY', 'GROUNDS', 'CHILDREN', 'PROPERTY', 'SUPPORT', 'SERVICE', 'REVIEW'];
module.exports = { PHASES, PHASE_ORDER };
