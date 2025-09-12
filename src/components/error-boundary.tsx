import React, { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, retry: () => void, retryCount: number) => ReactNode
  maxRetries?: number
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      retryCount: 0,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    this.props.onError?.(error, errorInfo)

    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state

    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: retryCount + 1,
      })
    }
  }

  render() {
    const { hasError, error, retryCount } = this.state
    const { fallback, maxRetries = 3, children } = this.props

    if (hasError && error) {
      if (fallback) {
        return fallback(error, this.handleRetry, retryCount)
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Something went wrong</h1>
            <p className="text-lg mb-4">An unexpected error occurred while loading the application.</p>
            <p className="text-sm text-muted-foreground mb-6">
              Error: {error.message || 'Unknown error'}
            </p>
            
            {retryCount < maxRetries ? (
              <div className="space-y-2">
                <Button onClick={this.handleRetry} className="w-full">
                  Try Again ({retryCount + 1}/{maxRetries})
                </Button>
                <p className="text-xs text-muted-foreground">
                  Attempt {retryCount + 1} of {maxRetries}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Button onClick={() => window.location.reload()} className="w-full">
                  Reload Page
                </Button>
                <p className="text-xs text-muted-foreground">
                  Maximum retry attempts reached
                </p>
              </div>
            )}
          </div>
        </div>
      )
    }

    return children
  }
}

// Specialized error boundary for initialization errors
interface InitializationErrorBoundaryProps {
  children: ReactNode
  onError?: (error: Error) => void
}

export function InitializationErrorBoundary({ children, onError }: InitializationErrorBoundaryProps) {
  return (
    <ErrorBoundary
      maxRetries={2}
      onError={(error, errorInfo) => {
        console.error('Initialization error:', error, errorInfo)
        onError?.(error)
      }}
      fallback={(error, retry, retryCount) => (
        <div className="flex flex-col items-center justify-center h-screen p-4 text-center">
          <div className="max-w-md">
            <h1 className="text-2xl font-bold text-red-600 mb-2">Initialization Failed</h1>
            <p className="text-lg mb-4">The application failed to initialize properly.</p>
            <p className="text-sm text-muted-foreground mb-6">
              {error.message || 'Unknown initialization error'}
            </p>
            
            {retryCount < 2 ? (
              <div className="space-y-2">
                <Button onClick={retry} className="w-full">
                  Retry Initialization
                </Button>
                <p className="text-xs text-muted-foreground">
                  This will attempt to restart the initialization process
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Button onClick={() => window.location.reload()} className="w-full">
                  Reload Application
                </Button>
                <p className="text-xs text-muted-foreground">
                  A full page reload may resolve the issue
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
} 