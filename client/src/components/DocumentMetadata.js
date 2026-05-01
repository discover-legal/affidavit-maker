// client/src/components/DocumentMetadata.js
import React from 'react';
import { useDocumentData, useDocumentActions } from '../contexts/DocumentContext';
import '../styles/DocumentMetadata.css';

import { SUPPORTED_JURISDICTIONS as SUPPORTED_STATES } from '../config/jurisdictions';

/**
 * Component for collecting document metadata including case caption information.
 * Adapts fields based on document type (affidavit vs divorce package).
 */
const DocumentMetadata = () => {
  const { currentDocument } = useDocumentData();
  const { updateDocumentData } = useDocumentActions();

  const isDivorce = currentDocument.documentType === 'divorce_package' ||
    currentDocument.documentType === 'divorce_petition' ||
    currentDocument.documentType === 'divorce_decree';

  const handleChange = (field, value) => {
    updateDocumentData({ [field]: value });
  };

  // When changing name fields for divorce, also keep affiantName in sync
  const handleNameChange = (field, value) => {
    const updates = { [field]: value };

    if (isDivorce) {
      // Map petitioner fields
      if (field === 'firstName') updates.petitionerFirstName = value;
      if (field === 'lastName') {
        updates.petitionerLastName = value;
        const first = field === 'firstName' ? value : (currentDocument.firstName || currentDocument.petitionerFirstName || '');
        const last = field === 'lastName' ? value : (currentDocument.lastName || currentDocument.petitionerLastName || '');
        if (first || last) updates.affiantName = [first, last].filter(Boolean).join(' ');
      }
      if (field === 'firstName') {
        const last = currentDocument.lastName || currentDocument.petitionerLastName || '';
        if (value || last) updates.affiantName = [value, last].filter(Boolean).join(' ');
      }
    } else {
      // Affidavit: keep affiantName in sync
      if (field === 'firstName' || field === 'lastName') {
        const first = field === 'firstName' ? value : (currentDocument.firstName || '');
        const last = field === 'lastName' ? value : (currentDocument.lastName || '');
        if (first || last) updates.affiantName = [first, last].filter(Boolean).join(' ');
      }
    }

    updateDocumentData(updates);
  };

  return (
    <div className="document-metadata">
      <div className="metadata-section">
        <h3 className="metadata-heading">Basic Information</h3>

        <div className="form-group">
          <label htmlFor="documentTitle" className="form-label">
            Document Title
          </label>
          <input
            type="text"
            id="documentTitle"
            className="form-input"
            value={currentDocument.documentTitle || ''}
            onChange={(e) => handleChange('documentTitle', e.target.value)}
            placeholder={isDivorce ? 'e.g., Smith Divorce Package' : 'e.g., Child Custody Affidavit'}
          />
          <p className="form-help">Custom name for easy identification on your dashboard</p>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="firstName" className="form-label">
              {isDivorce ? 'Petitioner First Name' : 'First Name'} <span className="required">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              className="form-input"
              value={currentDocument.firstName || currentDocument.petitionerFirstName || ''}
              onChange={(e) => handleNameChange('firstName', e.target.value)}
              placeholder={isDivorce ? "Petitioner's legal first name" : 'Your legal first name'}
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName" className="form-label">
              {isDivorce ? 'Petitioner Last Name' : 'Last Name'} <span className="required">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              className="form-input"
              value={currentDocument.lastName || currentDocument.petitionerLastName || ''}
              onChange={(e) => handleNameChange('lastName', e.target.value)}
              placeholder={isDivorce ? "Petitioner's legal last name" : 'Your legal last name'}
            />
          </div>
        </div>

        {/* Respondent name fields - only for divorce */}
        {isDivorce && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="respondentFirstName" className="form-label">
                Respondent First Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="respondentFirstName"
                className="form-input"
                value={currentDocument.respondentFirstName || ''}
                onChange={(e) => handleChange('respondentFirstName', e.target.value)}
                placeholder="Respondent's legal first name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="respondentLastName" className="form-label">
                Respondent Last Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="respondentLastName"
                className="form-input"
                value={currentDocument.respondentLastName || ''}
                onChange={(e) => handleChange('respondentLastName', e.target.value)}
                placeholder="Respondent's legal last name"
              />
            </div>
          </div>
        )}

        {/* State selector - grid buttons matching chat interface */}
        <div className="form-group">
          <label className="form-label">
            State <span className="required">*</span>
          </label>
          <div className="state-grid">
            {SUPPORTED_STATES.map((state) => (
              <button
                key={state.code}
                type="button"
                onClick={() => handleChange('state', state.code)}
                className={`state-button ${currentDocument.state === state.code ? 'state-button-active' : ''}`}
              >
                {state.code} - {state.name}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="county" className="form-label">
            County
          </label>
          <input
            type="text"
            id="county"
            className="form-input"
            value={currentDocument.county || ''}
            onChange={(e) => handleChange('county', e.target.value)}
            placeholder="County name"
          />
        </div>
      </div>

      <div className="metadata-section">
        <h3 className="metadata-heading">Case Information</h3>

        <div className="form-group">
          <label htmlFor="courtName" className="form-label">
            Court Name
          </label>
          <input
            type="text"
            id="courtName"
            className="form-input"
            value={currentDocument.courtName || ''}
            onChange={(e) => handleChange('courtName', e.target.value)}
            placeholder={isDivorce ? 'e.g., Family Court of Travis County' : 'e.g., District Court of Travis County'}
          />
          <p className="form-help">The full name of the court where this will be filed</p>
        </div>

        <div className="form-group">
          <label htmlFor="caseNumber" className="form-label">
            Case Number
          </label>
          <input
            type="text"
            id="caseNumber"
            className="form-input"
            value={currentDocument.caseNumber || ''}
            onChange={(e) => handleChange('caseNumber', e.target.value)}
            placeholder="e.g., 2024-CV-12345"
          />
        </div>

        {/* Divorce-specific fields */}
        {isDivorce && (
          <div className="form-group">
            <label htmlFor="marriageDate" className="form-label">
              Date of Marriage
            </label>
            <input
              type="date"
              id="marriageDate"
              className="form-input"
              value={currentDocument.marriageDate || ''}
              onChange={(e) => handleChange('marriageDate', e.target.value)}
            />
          </div>
        )}

        {/* Affidavit-specific: plaintiff/defendant */}
        {!isDivorce && (
          <>
            <div className="form-group">
              <label htmlFor="plaintiff" className="form-label">
                Plaintiff Name
              </label>
              <input
                type="text"
                id="plaintiff"
                className="form-input"
                value={currentDocument.plaintiff || ''}
                onChange={(e) => handleChange('plaintiff', e.target.value)}
                placeholder="Name of the plaintiff"
              />
            </div>

            <div className="form-group">
              <label htmlFor="defendant" className="form-label">
                Defendant Name
              </label>
              <input
                type="text"
                id="defendant"
                className="form-input"
                value={currentDocument.defendant || ''}
                onChange={(e) => handleChange('defendant', e.target.value)}
                placeholder="Name of the defendant"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DocumentMetadata;
