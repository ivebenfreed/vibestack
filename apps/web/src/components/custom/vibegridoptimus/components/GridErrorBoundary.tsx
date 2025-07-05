/**
 * Error Boundary for VibeGridOptimus
 * Catches and handles errors within the grid components
 */

import React from 'react'
import { gridLogger } from '../utils/logger'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorId: string | null
}

interface GridErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{
    error: Error
    errorInfo: React.ErrorInfo
    retry: () => void
    errorId: string
  }>
  onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void
}

export class GridErrorBoundary extends React.Component<GridErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: GridErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `grid-error-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    gridLogger.error('grid', 'Error boundary caught error', error, {
      errorId,
      timestamp: new Date().toISOString()
    })

    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = this.state.errorId || `grid-error-${Date.now()}`
    
    gridLogger.error('grid', 'Component error details', error, {
      errorId,
      componentStack: errorInfo.componentStack,
      errorBoundary: 'GridErrorBoundary',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    })

    this.setState({
      errorInfo
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId)
    }
  }

  retry = () => {
    gridLogger.info('grid', 'Retrying after error boundary recovery')
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo && this.state.errorId) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            retry={this.retry}
            errorId={this.state.errorId}
          />
        )
      }

      // Default error UI
      return (
        <div className="grid-error-boundary p-6 border border-red-200 bg-red-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-lg">⚠️</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-red-800 mb-2">
                Grid Error Occurred
              </h3>
              <p className="text-red-700 mb-3">
                An error occurred while rendering the data grid. The error has been logged for investigation.
              </p>
              
              <details className="mb-4">
                <summary className="cursor-pointer text-red-600 hover:text-red-800 font-medium">
                  Error Details
                </summary>
                <div className="mt-2 p-3 bg-red-100 rounded border">
                  <p className="text-sm text-red-800 font-mono mb-2">
                    <strong>Error ID:</strong> {this.state.errorId}
                  </p>
                  <p className="text-sm text-red-800 font-mono mb-2">
                    <strong>Message:</strong> {this.state.error.message}
                  </p>
                  <p className="text-sm text-red-800 font-mono">
                    <strong>Stack:</strong>
                  </p>
                  <pre className="text-xs text-red-700 bg-red-50 p-2 rounded mt-1 overflow-auto max-h-32">
                    {this.state.error.stack}
                  </pre>
                </div>
              </details>

              <div className="flex space-x-3">
                <button
                  onClick={this.retry}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Retry
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Higher-order component for wrapping components with error boundary
export function withGridErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<GridErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <GridErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </GridErrorBoundary>
  )

  WrappedComponent.displayName = `withGridErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}

// Hook for reporting errors to the logger
export function useGridErrorReporting() {
  const reportError = React.useCallback((error: Error, context: string, additionalData?: any) => {
    const errorId = `manual-error-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    gridLogger.error('grid', `Manual error report: ${context}`, error, {
      errorId,
      context,
      additionalData,
      timestamp: new Date().toISOString()
    })

    return errorId
  }, [])

  return { reportError }
}