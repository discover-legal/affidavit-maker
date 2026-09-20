/**
 * Composition — turn a CaseFile plus a JurisdictionProfile into a document
 * tree. The tree is typed: a missing value is a `blank` block with a draft
 * note, never a placeholder string, so nothing downstream can render
 * "[PETITIONER NAME]" or "Case No. null" by accident.
 *
 * Legal substance comes from data (the jurisdiction profile) and from the
 * record (fields, facts, confirmations). Narrative paragraphs the model
 * drafts are verified paragraph by paragraph ("is this supported by the
 * record?") and unsupported ones become blanks. That replaces the
 * meta-commentary filters and the placeholder denylist.
 *
 * Dispositive statements (no property, support waived, no children) render
 * only from Confirmations. Silence renders a blank.
 */

import type { Intelligence } from '../intelligence/types';
import type { JurisdictionProfile } from '../jurisdictions/types';
import type { CaseFile, ConfirmationKey } from '../model/types';

export type DocumentKind =
  | 'affidavit'
  | 'divorce_petition'
  | 'divorce_decree'
  | 'divorce_answer'
  | 'waiver_of_service'
  | 'prove_up_affidavit'
  | 'military_status_affidavit'
  | 'indigency_affidavit'
  | 'cert_last_known_address'
  | 'lawyer_handoff_summary';

export type Block =
  | { kind: 'heading'; text: string; level: 1 | 2 | 3 }
  | { kind: 'paragraph'; text: string; numbered?: boolean; supportedBy: string[] /* fact / field ids or confirmation keys */ }
  | { kind: 'blank'; field: string; note: string; label?: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'signature'; party: 'self' | 'other'; label: string }
  | { kind: 'jurat'; text: string; officer: string; citations: string[] }
  | { kind: 'note'; text: string };

export interface Section {
  id: string;
  title?: string;
  blocks: Block[];
}

export interface Caption {
  courtLines: string[];
  fileNumberLabel: string;
  fileNumber?: string; // absent → rendered as a blank
  parties: { selfLabel: string; selfName?: string; otherLabel: string; otherName?: string; versus: string };
  title: string; // "ORIGINAL PETITION FOR DIVORCE", "APPLICATION (GENERAL)", …
}

export interface DocumentTree {
  kind: DocumentKind;
  jurisdiction: string;
  language: 'en' | 'es';
  paper: 'letter' | 'a4';
  caption: Caption;
  sections: Section[];
  /** "Draft — not for filing" style framing; official forms link when the jurisdiction has one. */
  framing: { draftNotice: string; officialForms?: { name: string; url: string } };
  /** Every blank in the document, for the review screen. */
  blanks: Array<{ field: string; note: string; section: string }>;
}

export interface SelectionInput {
  file: CaseFile;
  jurisdiction: JurisdictionProfile;
}

export interface Selection {
  documents: DocumentKind[];
  reasons: Partial<Record<DocumentKind, string>>;
}

export interface Composer {
  /** Which documents this case needs, by matter, role and record. Pure code. */
  select(input: SelectionInput): Selection;
  /** Build one document. May call the model for narrative paragraphs; always verifies them. */
  compose(input: SelectionInput & { kind: DocumentKind }): Promise<DocumentTree>;
  /** Judge every paragraph against the record; unsupported → blank. Idempotent. */
  verify(tree: DocumentTree, file: CaseFile): Promise<DocumentTree>;
}

export interface ComposerDeps {
  intelligence: Intelligence;
}


/** The confirmation each dispositive clause requires. */
export const DISPOSITIVE_CLAUSES: Record<string, ConfirmationKey> = {
  no_property_to_divide: 'no_property',
  no_debts_to_divide: 'no_debts',
  spousal_support_waived: 'support_waived',
  no_children_of_the_marriage: 'no_children',
};
