// client/src/components/ErrorBoundary.js
/**
 * Error Boundary Component for React Application
 * Provides graceful error handling and recovery options
 * 
 * @version 1.0.0
 */

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
      lastErrorTime: null
    };
    
    this.resetTimeout = null;
  }
  
  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      lastErrorTime: new Date().toISOString()
    };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log error to error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Track error count
    this.setState(prevState => ({
      errorCount: prevState.errorCount + 1,
      errorInfo
    }));
    
    // Send to monitoring service if available
    if (window.logError) {
      window.logError({
        error: error.toString(),
        errorInfo: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    }
    
    // Auto-recover after 10 seconds for transient errors
    if (this.state.errorCount < 3) {
      this.resetTimeout = setTimeout(() => {
        this.resetErrorBoundary();
      }, 10000);
    }
  }
  
  componentWillUnmount() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
  }
  
  resetErrorBoundary = () => {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }
  
  render() {
    if (this.state.hasError) {
      // Determine error type and provide appropriate UI
      const isNetworkError = this.state.error?.message?.toLowerCase().includes('network') ||
                            this.state.error?.message?.toLowerCase().includes('fetch');
      const isChunkError = this.state.error?.message?.toLowerCase().includes('chunk') ||
                          this.state.error?.message?.toLowerCase().includes('loading');
      
      return (
        <div className="error-boundary-container" style={styles.container}>
          <div className="error-content" style={styles.content}>
            <div className="error-icon" style={styles.icon}>
              ⚠️
            </div>
            
            <h2 style={styles.title}>
              {isNetworkError ? 'Connection Problem' : 
               isChunkError ? 'Loading Error' : 
               'Something went wrong'}
            </h2>
            
            <p style={styles.message}>
              {isNetworkError ? 
                'Please check your internet connection and try again.' :
               isChunkError ? 
                'The application failed to load properly. Please refresh the page.' :
                'We encountered an unexpected error. Please try again.'}
            </p>
            
            {this.state.errorCount < 3 && (
              <p style={styles.autoRecover}>
                Attempting automatic recovery in a few seconds...
              </p>
            )}
            
            <div style={styles.actions}>
              <button 
                onClick={this.resetErrorBoundary}
                style={styles.primaryButton}
              >
                Try Again
              </button>
              
              <button 
                onClick={() => window.location.reload()}
                style={styles.secondaryButton}
              >
                Refresh Page
              </button>
            </div>
            
            {/* Show details in development */}
            {process.env.NODE_ENV === 'development' && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details (Development Only)</summary>
                <pre style={styles.errorDetails}>
                  {this.state.error && this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            {this.state.errorCount >= 3 && (
              <div style={styles.warning}>
                <p>Multiple errors detected. If problems persist, please contact support.</p>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f8fa',
    padding: '20px'
  },
  content: {
    maxWidth: '600px',
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '40px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    textAlign: 'center'
  },
  icon: {
    fontSize: '48px',
    marginBottom: '20px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '16px'
  },
  message: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  autoRecover: {
    fontSize: '14px',
    color: '#888',
    fontStyle: 'italic',
    marginBottom: '20px'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  primaryButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '500',
    color: 'white',
    backgroundColor: '#4A90E2',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  secondaryButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#4A90E2',
    backgroundColor: 'white',
    border: '2px solid #4A90E2',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  details: {
    marginTop: '32px',
    textAlign: 'left'
  },
  summary: {
    cursor: 'pointer',
    fontSize: '14px',
    color: '#666',
    marginBottom: '12px'
  },
  errorDetails: {
    backgroundColor: '#f5f5f5',
    padding: '16px',
    borderRadius: '4px',
    fontSize: '12px',
    overflow: 'auto',
    maxHeight: '200px',
    color: '#d32f2f'
  },
  warning: {
    marginTop: '24px',
    padding: '12px',
    backgroundColor: '#fff3cd',
    borderRadius: '4px',
    color: '#856404',
    fontSize: '14px'
  }
};

// NOTE: The withErrorBoundary HOC and useErrorHandler hook have been removed
// as they were not used anywhere in the codebase. If needed in the future,
// they can be re-added or used from a library like react-error-boundary.

export default ErrorBoundary;