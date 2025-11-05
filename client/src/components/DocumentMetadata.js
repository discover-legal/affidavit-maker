// client/src/components/DocumentMetadata.js
import React from 'react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';
import '../styles/DocumentMetadata.css';

/**
 * Component for collecting document metadata including case caption information
 */
const DocumentMetadata = () => {
  const { currentDocument } = useDocumentState();
  const { updateDocument } = useDocumentActions();

  const handleChange = (field, value) => {
    updateDocument({ [field]: value });
  };

  return (
    <div className="document-metadata">
      <div className="metadata-section">
        <h3 className="metadata-heading">Basic Information</h3>

        <div className="form-group">
          <label htmlFor="affiantName" className="form-label">
            Your Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="affiantName"
            className="form-input"
            value={currentDocument.affiantName || ''}
            onChange={(e) => handleChange('affiantName', e.target.value)}
            placeholder="Enter your full legal name"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="state" className="form-label">
              State <span className="required">*</span>
            </label>
            <select
              id="state"
              className="form-select"
              value={currentDocument.state || 'TX'}
              onChange={(e) => handleChange('state', e.target.value)}
            >
              <option value="TX">Texas</option>
              <option value="UT">Utah</option>
              <option value="AZ">Arizona</option>
              <option value="CA">California</option>
              <option value="NY">New York</option>
              <option value="FL">Florida</option>
            </select>
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
            placeholder="e.g., District Court of Travis County"
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
      </div>
    </div>
  );
};

export default DocumentMetadata;
