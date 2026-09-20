/**
 * Selection — which documents a case needs. Pure code over matter, role,
 * fields and confirmations; never a model call. Every selected kind carries
 * a plain-language reason.
 *
 * Rules (spec 03 §1.1 / §1.2, restated for the typed record):
 *   - no matter, or a matter other than divorce → the generic affidavit;
 *   - divorce, respondent → the answer only: a responsive packet never
 *     bundles proposed final orders;
 *   - divorce, petitioner → petition, decree, waiver of service, then the
 *     supporting affidavits the record calls for:
 *       · military status (US: Servicemembers Civil Relief Act) unless the
 *         user CONFIRMED the other party is not in service — a stated
 *         `otherPartyMilitary: false` is an opinion, not a confirmation;
 *       · certificate of last known address (US) when the other party's
 *         whereabouts are affirmed unknown, because a waiver cannot be
 *         obtained from someone who cannot be found;
 *       · indigency affidavit when the record says the fee cannot be paid.
 */

import type { DocumentKind, Selection, SelectionInput } from './types';
import { booleanField, confirmed } from './record';

const DIVORCE_MATTER = 'divorce';

export function select({ file, jurisdiction }: SelectionInput): Selection {
  const documents: DocumentKind[] = [];
  const reasons: Selection['reasons'] = {};
  const add = (kind: DocumentKind, reason: string) => {
    if (documents.includes(kind)) return;
    documents.push(kind);
    reasons[kind] = reason;
  };

  if (file.matter !== DIVORCE_MATTER || !jurisdiction.divorce) {
    add('affidavit', 'A sworn statement of the facts you told us, in the form your court uses for affidavits.');
    return { documents, reasons };
  }

  const { instrument } = jurisdiction.divorce;

  if (file.role === 'respondent') {
    add('divorce_answer', `Your ${instrument.answer}: the document that responds, paragraph by paragraph, to the ${instrument.petition} you were served with.`);
    return { documents, reasons };
  }

  add('divorce_petition', `The ${instrument.petition} that starts the case in ${jurisdiction.name}.`);
  add('divorce_decree', `A proposed ${instrument.decree} for the court to sign when the divorce is granted.`);
  add('waiver_of_service', 'A waiver the other party can sign instead of being formally served, if they are willing.');

  if (jurisdiction.country === 'US') {
    if (!confirmed(file, 'not_military')) {
      add('military_status_affidavit', 'US courts require a sworn statement about whether the other party is on active military duty before a default can be entered.');
    }
    if (file.parties.other.whereaboutsUnknown?.value === true) {
      add('cert_last_known_address', 'You said you do not know where the other party is; the court needs their last known address and the efforts made to find them.');
    }
  }

  if (booleanField(file, 'indigencyRequested') === true) {
    add('indigency_affidavit', 'You said you cannot afford the filing fee; this asks the court to waive it.');
  }

  return { documents, reasons };
}
