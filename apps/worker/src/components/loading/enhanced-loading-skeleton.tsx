import { Loader2 } from 'lucide-react'

interface LoadingSkeletonProps {
  message?: string;
}

export function EnhancedLoadingSkeleton({ message }: LoadingSkeletonProps) {
  return (
    <div className="h-svh w-full flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 max-w-md text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div>
          <h2 className="text-lg font-semibold mb-1">Loading</h2>
          <p className="text-sm text-muted-foreground">
            {message || 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Keep the simple version for backward compatibility
export function SimpleLoadingSkeleton({ message }: { message?: string }) {
  return <EnhancedLoadingSkeleton message={message} />;
} 