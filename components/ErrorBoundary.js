// components/ErrorBoundary.js
import React from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

/**
 * Professional Error Boundary Component
 * 
 * Provides elegant error handling with:
 * - User-friendly error messages
 * - Recovery options
 * - Error reporting capability
 * - Graceful degradation
 * 
 * @class ErrorBoundary
 * @extends {React.Component}
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  /**
   * Static method to update state when an error occurs
   * 
   * @param {Error} error - The error that occurred
   * @returns {Object} New state object
   */
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
  }

  /**
   * Component lifecycle method called after an error is caught
   * 
   * @param {Error} error - The error that occurred
   * @param {Object} errorInfo - Additional error information
   */
  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error for monitoring/debugging
    this.logError(error, errorInfo);
  }

  /**
   * Log error for monitoring and debugging
   * In production, this would send to your error reporting service
   * 
   * @param {Error} error - The error that occurred
   * @param {Object} errorInfo - Additional error information
   */
  logError = (error, errorInfo) => {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId
    };

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Application Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Error Report:', errorReport);
      console.groupEnd();
    }

    // In production, send to error reporting service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    /*
    if (process.env.NODE_ENV === 'production') {
      // Send to your error reporting service
      errorReportingService.captureException(error, {
        extra: errorReport
      });
    }
    */
  };

  /**
   * Attempt to recover from the error
   */
  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  /**
   * Navigate to a safe page (home/dashboard)
   */
  handleGoHome = () => {
    window.location.href = '/';
  };

  /**
   * Report the error to support
   */
  handleReportError = () => {
    const errorDetails = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      timestamp: new Date().toISOString()
    };

    // Create mailto link with error details
    const subject = encodeURIComponent(`Error Report - ${errorDetails.errorId}`);
    const body = encodeURIComponent(`
Error ID: ${errorDetails.errorId}
Time: ${errorDetails.timestamp}
Message: ${errorDetails.message}

Please describe what you were doing when this error occurred:


Additional context:
`);

    window.open(`mailto:support@affidavit-maker.com?subject=${subject}&body=${body}`);
  };

  /**
   * Get user-friendly error message based on error type
   * 
   * @returns {string} User-friendly error message
   */
  getUserFriendlyMessage = () => {
    const error = this.state.error;
    
    if (!error) {
      return 'An unexpected error occurred.';
    }

    // Check for common error types and provide helpful messages
    if (error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      return 'There was a problem loading the application. This usually happens after an app update.';
    }

    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'There was a network connectivity issue. Please check your internet connection.';
    }

    if (error.message.includes('auth') || error.message.includes('Auth')) {
      return 'There was an authentication issue. You may need to log in again.';
    }

    // Default message for unknown errors
    return 'Something went wrong with the application.';
  };

  /**
   * Get suggested recovery actions based on error type
   * 
   * @returns {Array} Array of recovery action objects
   */
  getRecoveryActions = () => {
    const error = this.state.error;
    const actions = [];

    // Always offer retry as first option
    actions.push({
      label: 'Try Again',
      icon: RefreshCw,
      action: this.handleRetry,
      primary: true
    });

    // Add specific actions based on error type
    if (error?.message.includes('ChunkLoadError') || error?.message.includes('Loading chunk')) {
      actions.push({
        label: 'Refresh Page',
        icon: RefreshCw,
        action: () => window.location.reload(),
        primary: false
      });
    }

    // Always offer home navigation as fallback
    actions.push({
      label: 'Go to Home',
      icon: Home,
      action: this.handleGoHome,
      primary: false
    });

    return actions;
  };

  render() {
    if (this.state.hasError) {
      const userMessage = this.getUserFriendlyMessage();
      const recoveryActions = this.getRecoveryActions();

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full">
            {/* Error Icon and Title */}
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-600">
                {userMessage}
              </p>
            </div>

            {/* Recovery Actions */}
            <div className="space-y-3 mb-6">
              {recoveryActions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.action}
                  className={`w-full flex items-center justify-center px-4 py-2 border rounded-md font-medium transition-colors ${
                    action.primary
                      ? 'border-transparent bg-blue-600 text-white hover:bg-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <action.icon className="w-4 h-4 mr-2" />
                  {action.label}
                </button>
              ))}
            </div>

            {/* Error Reporting */}
            <div className="border-t border-gray-200 pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">
                  Still having trouble? We'd like to help.
                </p>
                <button
                  onClick={this.handleReportError}
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                  <Bug className="w-4 h-4 mr-1" />
                  Report this error
                </button>
              </div>

              {/* Error ID for support */}
              {this.state.errorId && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-400">
                    Error ID: {this.state.errorId}
                  </p>
                </div>
              )}
            </div>

            {/* Development Error Details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 p-4 bg-gray-100 rounded-md">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                  Development Error Details
                </summary>
                <div className="text-xs text-gray-600 space-y-2">
                  <div>
                    <strong>Error:</strong>
                    <pre className="mt-1 whitespace-pre-wrap bg-red-50 p-2 rounded text-red-800">
                      {this.state.error.toString()}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap bg-red-50 p-2 rounded text-red-800">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;