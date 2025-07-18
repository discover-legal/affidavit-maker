// client/src/components/ValidationSidebar.js - Integrated county validation
import React, { useState } from 'react';
import { 
  AlertTriangle, AlertCircle, CheckCircle, MapPin, Info, 
  ChevronDown, ChevronRight, Shield, FileCheck, Clock, User, MapIcon
} from 'lucide-react';

const ValidationSidebar = ({ validation, countyValidation, affidavitData }) => {
  const [expandedSections, setExpandedSections] = useState({
    requirements: true,
    errors: true,
    warnings: true
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Calculate overall progress including county validation
  const calculateProgress = () => {
    let completed = 0;
    let total = 0;
    
    // Basic requirements
    if (affidavitData.affiantName) completed++;
    total++;
    
    if (affidavitData.state) completed++;
    total++;
    
    if (affidavitData.facts && affidavitData.facts.length > 0) completed++;
    total++;
    
    // State-specific requirements (county)
    if (affidavitData.state === 'TX' || affidavitData.state === 'UT') {
      total++;
      // County is complete if it exists AND is valid (or validation hasn't run yet)
      if (affidavitData.county) {
        if (!countyValidation || countyValidation.isValid) {
          completed++;
        }
        // If county validation failed, don't count as completed
      }
    }
    
    return Math.round((completed / total) * 100);
  };

  const progress = calculateProgress();
  const hasErrors = validation?.errors && validation.errors.length > 0;
  const hasWarnings = validation?.warnings && validation.warnings.length > 0;
  const hasCountyIssues = countyValidation && !countyValidation.isValid;
  
  // Integrate county issues into overall validation status
  const overallStatus = hasErrors || hasCountyIssues ? 'error' : 
                      hasWarnings ? 'warning' : 
                      validation?.isValid && (!countyValidation || countyValidation.isValid) ? 'success' : 'incomplete';

  return (
    <div className="bg-white rounded-lg shadow-sm border h-full overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Document Status</h3>
          </div>
          <StatusBadge status={overallStatus} />
        </div>
        
        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Completion</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                progress === 100 ? 'bg-green-500' : 
                progress >= 75 ? 'bg-blue-500' : 
                progress >= 50 ? 'bg-yellow-500' : 'bg-gray-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content - Fixed height with scroll */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {/* Requirements Checklist */}
        <ValidationSection
          title="Requirements"
          icon={<FileCheck className="h-4 w-4" />}
          isExpanded={expandedSections.requirements}
          onToggle={() => toggleSection('requirements')}
          status={progress === 100 ? 'success' : 'incomplete'}
        >
          <RequirementsChecklist 
            affidavitData={affidavitData} 
            countyValidation={countyValidation}
          />
        </ValidationSection>

        {/* Errors (including county issues) */}
        {(hasErrors || hasCountyIssues) && (
          <ValidationSection
            title={`Issues (${(validation?.errors?.length || 0) + (hasCountyIssues ? 1 : 0)})`}
            icon={<AlertTriangle className="h-4 w-4" />}
            isExpanded={expandedSections.errors}
            onToggle={() => toggleSection('errors')}
            status="error"
          >
            <ErrorsList 
              errors={validation?.errors || []} 
              countyValidation={countyValidation}
            />
          </ValidationSection>
        )}

        {/* Warnings */}
        {hasWarnings && (
          <ValidationSection
            title={`Warnings (${validation.warnings.length})`}
            icon={<AlertCircle className="h-4 w-4" />}
            isExpanded={expandedSections.warnings}
            onToggle={() => toggleSection('warnings')}
            status="warning"
          >
            <WarningsList warnings={validation.warnings} />
          </ValidationSection>
        )}

        {/* Success State */}
        {overallStatus === 'success' && (
          <div className="p-4 m-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Ready to Generate!</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              All requirements are met. Your document is ready for download.
            </p>
          </div>
        )}

        {/* Tips */}
        {overallStatus !== 'success' && (
          <div className="p-4 m-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 text-blue-800 mb-2">
              <Info className="h-4 w-4" />
              <span className="font-medium text-sm">Next Steps</span>
            </div>
            <TipsList 
              affidavitData={affidavitData} 
              validation={validation} 
              countyValidation={countyValidation}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
          <div className="flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Real-time</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    success: { bg: 'bg-green-100', text: 'text-green-800', label: 'Complete' },
    warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Needs Attention' },
    error: { bg: 'bg-red-100', text: 'text-red-800', label: 'Issues Found' },
    incomplete: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'In Progress' }
  };
  
  const config = statusConfig[status] || statusConfig.incomplete;
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

const ValidationSection = ({ title, icon, isExpanded, onToggle, status, children }) => {
  const statusColors = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    incomplete: 'text-gray-600'
  };

  return (
    <div className="border-b border-gray-100">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <div className={statusColors[status] || statusColors.incomplete}>
            {icon}
          </div>
          <span className="font-medium text-sm text-gray-900">{title}</span>
        </div>
        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
};

const RequirementsChecklist = ({ affidavitData, countyValidation }) => {
  const requirements = [
    { 
      key: 'name', 
      label: 'Full Legal Name', 
      completed: !!affidavitData.affiantName,
      description: 'Your complete legal name as it appears on official documents',
      icon: <User className="h-3 w-3" />
    },
    { 
      key: 'state', 
      label: 'State Selection', 
      completed: !!affidavitData.state,
      description: 'Which state your legal matter is in (TX, UT, or AZ)',
      icon: <MapIcon className="h-3 w-3" />
    },
    { 
      key: 'facts', 
      label: 'Facts Provided', 
      completed: affidavitData.facts && affidavitData.facts.length > 0,
      description: 'At least one factual statement for your affidavit',
      icon: <FileCheck className="h-3 w-3" />
    }
  ];

  // Add county requirement for TX and UT with integrated validation
  if (affidavitData.state === 'TX' || affidavitData.state === 'UT') {
    const countyCompleted = !!affidavitData.county && (!countyValidation || countyValidation.isValid);
    
    requirements.push({
      key: 'county',
      label: 'County Information',
      completed: countyCompleted,
      description: `County required for ${affidavitData.state === 'TX' ? 'Texas' : 'Utah'} affidavits`,
      icon: <MapPin className="h-3 w-3" />,
      countyValidation: countyValidation,
      hasCountyValue: !!affidavitData.county
    });
  }

  return (
    <div className="space-y-3">
      {requirements.map((req) => (
        <div key={req.key} className="flex items-start space-x-3">
          <div className="mt-0.5">
            {req.completed ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />
            )}
          </div>
          <div className="flex-1">
            <div className={`text-sm font-medium flex items-center space-x-1 ${
              req.completed ? 'text-green-900' : 'text-gray-900'
            }`}>
              <span>{req.label}</span>
              {req.icon}
            </div>
            <div className="text-xs text-gray-600">
              {req.description}
            </div>
            
            {/* Show county validation details inline */}
            {req.key === 'county' && req.hasCountyValue && req.countyValidation && (
              <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                <div className={`font-medium ${
                  req.countyValidation.isValid ? 'text-green-700' : 'text-red-700'
                }`}>
                  {req.countyValidation.isValid ? '✓ County Verified' : '⚠ County Issue'}
                </div>
                <div className="text-gray-600 mt-1">
                  {req.countyValidation.reasoning}
                </div>
                {req.countyValidation.normalizedCounty && 
                 req.countyValidation.normalizedCounty !== affidavitData.county && (
                  <div className="text-blue-700 mt-1">
                    Suggested: {req.countyValidation.normalizedCounty}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const ErrorsList = ({ errors, countyValidation }) => {
  const allErrors = [...errors];
  
  // Add county validation error if present
  if (countyValidation && !countyValidation.isValid) {
    allErrors.push(`County validation: ${countyValidation.reasoning}`);
  }

  return (
    <div className="space-y-2">
      {allErrors.map((error, index) => (
        <div key={index} className="flex items-start space-x-2">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-800">{error}</span>
        </div>
      ))}
    </div>
  );
};

const WarningsList = ({ warnings }) => (
  <div className="space-y-2">
    {warnings.map((warning, index) => (
      <div key={index} className="flex items-start space-x-2">
        <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
        <span className="text-sm text-yellow-800">{warning}</span>
      </div>
    ))}
  </div>
);

const TipsList = ({ affidavitData, validation, countyValidation }) => {
  const tips = [];
  
  if (!affidavitData.affiantName) {
    tips.push("Start by providing your full legal name to the AI assistant");
  }
  
  if (!affidavitData.state) {
    tips.push("Tell the assistant which state your case is in (Texas, Utah, or Arizona)");
  }
  
  if (!affidavitData.facts || affidavitData.facts.length === 0) {
    tips.push("Describe the facts you need to include in your affidavit");
  }
  
  if (affidavitData.state && !affidavitData.county && (affidavitData.state === 'TX' || affidavitData.state === 'UT')) {
    tips.push(`County information is required for ${affidavitData.state === 'TX' ? 'Texas' : 'Utah'} affidavits`);
  }
  
  if (affidavitData.county && countyValidation && !countyValidation.isValid) {
    if (countyValidation.normalizedCounty) {
      tips.push(`Consider using "${countyValidation.normalizedCounty}" instead of "${affidavitData.county}"`);
    } else {
      tips.push("Please verify the county name - it may not be recognized");
    }
  }
  
  if (tips.length === 0) {
    tips.push("Your document looks good! Review the preview and finalize when ready.");
  }

  return (
    <div className="space-y-1">
      {tips.slice(0, 3).map((tip, index) => (
        <div key={index} className="text-xs text-blue-700">
          • {tip}
        </div>
      ))}
    </div>
  );
};

export default ValidationSidebar;