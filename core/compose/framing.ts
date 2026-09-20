/**
 * Framing — the draft notice every document carries and the official forms
 * link when the jurisdiction publishes one. The product is a PREP tool:
 * drafts are source material for the official forms, never "court-ready".
 */

import type { JurisdictionProfile } from '../jurisdictions/types';
import type { CaseFile } from '../model/types';
import type { DocumentKind, DocumentTree } from './types';

const PETITIONER_INSTRUMENTS = new Set<DocumentKind>(['divorce_petition', 'divorce_decree']);

export function framingFor(file: CaseFile, jurisdiction: JurisdictionProfile, kind: DocumentKind): DocumentTree['framing'] {
  const lines = [
    'DRAFT — prepared from your own statements. Not legal advice and not for filing as-is: review every blank and every draft note before use.',
  ];
  // A respondent composing the initiating or final instrument gets it for reference only (spec 03 §1.2).
  if (file.role === 'respondent' && PETITIONER_INSTRUMENTS.has(kind)) lines.push('REFERENCE COPY — NOT FOR FILING by the responding party.');
  const forms = jurisdiction.divorce;
  if (forms?.officialFormsUrl && forms.officialFormsName) {
    lines.push(`Where ${jurisdiction.name} publishes official court forms, file on those and use this draft as your source material.`);
    return { draftNotice: lines.join(' '), officialForms: { name: forms.officialFormsName, url: forms.officialFormsUrl } };
  }
  return { draftNotice: lines.join(' ') };
}
