// components/SaveStatus.js
import React from 'react';
import { Check, AlertCircle, Loader2, RefreshCw, Clock, Wifi, WifiOff } from 'lucide-react';
import { SAVE_STATUS } from '../hooks/useSaveDocument';

/**
 * SaveStatus Component
 * 
 * Displays comprehensive save status information with visual indicators,
 * error handling, and retry functionality. Supports multiple display modes
 * and accessibility features.
 * 
 * @param {Object} props - Component props
 * @param {string} props.status - Current save status (from SAVE_STATUS enum)
 * @param {Date} props.lastSaved - Timestamp of last successful save
 * @param {string} props.error - Error message if save failed
 * @param {Function} props.onRetry - Callback function for retry attempts
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.variant - Display variant ('full', 'compact', 'minimal')
 * @param {boolean} props.showTimestamp - Whether to show last saved timestamp
 * @param {boolean} props.autoHideSuccess - Whether to auto-hide success status
 * @returns {JSX.Element} Save status component
 */
const SaveStatus = ({
  status = SAVE_STATUS.IDLE,
  lastSaved = null,
  error = null,
  onRetry = null,
  className = '',
  variant = 'full',
  showTimestamp = true,
  autoHideSuccess = true
}) => {
  /**
   * Get appropriate icon for current status
   * 
   * @param {string} currentStatus - Save status
   * @returns {JSX.Element} Icon component
   */
  const getStatusIcon = (currentStatus) => {
    const iconProps = { className: "w-4 h-4" };
    
    switch (currentStatus) {
      case SAVE_STATUS.SAVING:
        return <Loader2 {...iconProps} className="w-4 h-4 animate-spin" />;
      case SAVE_STATUS.SAVED:
        return <Check {...iconProps} />;
      case SAVE_STATUS.ERROR:
        return <AlertCircle {...iconProps} />;
      case SAVE_STATUS.IDLE:
      default:
        return lastSaved ? <Clock {...iconProps} /> : <WifiOff {...iconProps} />;
    }
  };

  /**
   * Get status-specific styling classes
   * 
   * @param {string} currentStatus - Save status
   * @returns {string} CSS classes for styling
   */
  const getStatusClasses = (currentStatus) => {
    const baseClasses = "flex items-center transition-all duration-300";
    
    switch (currentStatus) {
      case SAVE_STATUS.SAVING:
        return `${baseClasses} text-blue-600`;
      case SAVE_STATUS.SAVED:
        return `${baseClasses} text-green-600`;
      case SAVE_STATUS.ERROR:
        return `${baseClasses} text-red-600`;
      case SAVE_STATUS.IDLE:
      default:
        return `${baseClasses} text-gray-500`;
    }
  };

  /**
   * Get status message text
   * 
   * @param {string} currentStatus - Save status
   * @returns {string} Status message
   */
  const getStatusMessage = (currentStatus) => {
    switch (currentStatus) {
      case SAVE_STATUS.SAVING:
        return variant === 'minimal' ? 'Saving...' : 'Saving document...';
      case SAVE_STATUS.SAVED:
        return variant === 'minimal' ? 'Saved' : 'Document saved successfully';
      case SAVE_STATUS.ERROR:
        return variant === 'minimal' ? 'Save failed' : 'Save operation failed';
      case SAVE_STATUS.IDLE:
      default:
        if (lastSaved && showTimestamp) {
          const timeString = lastSaved.toLocaleTimeString();
          return variant === 'minimal' ? timeString : `Last saved: ${timeString}`;
        }
        return variant === 'minimal' ? 'Not saved' : 'No recent saves';
    }
  };

  /**
   * Format relative time for last saved
   * 
   * @param {Date} timestamp - Timestamp to format
   * @returns {string} Relative time string
   */
  const getRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    return timestamp.toLocaleDateString();
  };

  /**
   * Render retry button for error states
   * 
   * @returns {JSX.Element|null} Retry button or null
   */
  const renderRetryButton = () => {
    if (status !== SAVE_STATUS.ERROR || !onRetry) {
      return null;
    }

    return (
      <button
        onClick={onRetry}
        className="ml-2 text-xs text-blue-600 hover:text-blue-800 flex items-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded px-1"
        title="Retry saving document"
        aria-label="Retry saving document"
      >
        <RefreshCw className="w-3 h-3 mr-1" />
        {variant !== 'minimal' && 'Retry'}
      </button>
    );
  };

  /**
   * Render error details if available
   * 
   * @returns {JSX.Element|null} Error details or null
   */
  const renderErrorDetails = () => {
    if (status !== SAVE_STATUS.ERROR || !error || variant === 'minimal') {
      return null;
    }

    return (
      <div className="mt-1 text-xs text-red-500 max-w-md">
        <details className="cursor-pointer">
          <summary className="hover:text-red-600">Error details</summary>
          <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        </details>
      </div>
    );
  };

  /**
   * Render compact variant
   * 
   * @returns {JSX.Element} Compact status display
   */
  const renderCompactVariant = () => (
    <div className={`${getStatusClasses(status)} ${className}`}>
      {getStatusIcon(status)}
      <span className="ml-2 text-sm">{getStatusMessage(status)}</span>
      {renderRetryButton()}
    </div>
  );

  /**
   * Render minimal variant
   * 
   * @returns {JSX.Element} Minimal status display
   */
  const renderMinimalVariant = () => (
    <div className={`${getStatusClasses(status)} ${className}`} title={getStatusMessage(status)}>
      {getStatusIcon(status)}
      {status === SAVE_STATUS.ERROR && renderRetryButton()}
    </div>
  );

  /**
   * Render full variant with all details
   * 
   * @returns {JSX.Element} Full status display
   */
  const renderFullVariant = () => (
    <div className={`${className}`}>
      <div className={getStatusClasses(status)}>
        {getStatusIcon(status)}
        <span className="ml-2 text-sm">{getStatusMessage(status)}</span>
        {renderRetryButton()}
      </div>
      
      {/* Additional timestamp info for full variant */}
      {variant === 'full' && lastSaved && status === SAVE_STATUS.IDLE && (
        <div className="text-xs text-gray-400 mt-1">
          {getRelativeTime(lastSaved)}
        </div>
      )}
      
      {renderErrorDetails()}
    </div>
  );

  // Don't render anything if status is idle and no last saved timestamp
  if (status === SAVE_STATUS.IDLE && !lastSaved && variant !== 'full') {
    return null;
  }

  // Render appropriate variant
  switch (variant) {
    case 'compact':
      return renderCompactVariant();
    case 'minimal':
      return renderMinimalVariant();
    case 'full':
    default:
      return renderFullVariant();
  }
};

/**
 * SaveStatusBadge - A badge variant for toolbar/status bar use
 * 
 * @param {Object} props - Component props (same as SaveStatus)
 * @returns {JSX.Element} Badge-style save status
 */
export const SaveStatusBadge = (props) => {
  const { status } = props;
  
  const getBadgeClasses = () => {
    const baseClasses = "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium";
    
    switch (status) {
      case SAVE_STATUS.SAVING:
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case SAVE_STATUS.SAVED:
        return `${baseClasses} bg-green-100 text-green-800`;
      case SAVE_STATUS.ERROR:
        return `${baseClasses} bg-red-100 text-red-800`;
      case SAVE_STATUS.IDLE:
      default:
        return `${baseClasses} bg-gray-100 text-gray-600`;
    }
  };

  return (
    <span className={getBadgeClasses()}>
      <SaveStatus {...props} variant="minimal" className="mr-1" />
      <span>{props.status === SAVE_STATUS.SAVED ? 'Saved' : props.status === SAVE_STATUS.SAVING ? 'Saving' : 'Draft'}</span>
    </span>
  );
};

/**
 * SaveStatusIndicator - A simple dot indicator for minimal UI space
 * 
 * @param {Object} props - Component props
 * @returns {JSX.Element} Dot indicator
 */
export const SaveStatusIndicator = ({ status, className = '' }) => {
  const getDotClasses = () => {
    const baseClasses = "w-2 h-2 rounded-full";
    
    switch (status) {
      case SAVE_STATUS.SAVING:
        return `${baseClasses} bg-blue-500 animate-pulse`;
      case SAVE_STATUS.SAVED:
        return `${baseClasses} bg-green-500`;
      case SAVE_STATUS.ERROR:
        return `${baseClasses} bg-red-500`;
      case SAVE_STATUS.IDLE:
      default:
        return `${baseClasses} bg-gray-300`;
    }
  };

  return <div className={`${getDotClasses()} ${className}`} title={status} />;
};

export default SaveStatus;