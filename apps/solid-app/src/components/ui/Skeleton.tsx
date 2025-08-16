import { Component, JSX } from 'solid-js';
import { clsx } from 'clsx';

interface SkeletonProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: Component<SkeletonProps> = (props) => {
  const variant = props.variant || 'text';
  const animation = props.animation || 'pulse';
  
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };
  
  const style = {
    width: typeof props.width === 'number' ? `${props.width}px` : props.width,
    height: typeof props.height === 'number' ? `${props.height}px` : props.height || (variant === 'text' ? '1em' : undefined),
  };
  
  return (
    <div
      class={clsx(
        baseClasses,
        animationClasses[animation],
        variantClasses[variant],
        props.class
      )}
      style={style}
      {...props}
    />
  );
};

// Card skeleton for loading states
export const CardSkeleton: Component = () => {
  return (
    <div class="card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <Skeleton width="40%" height={24} />
        <Skeleton variant="circular" width={40} height={40} />
      </div>
      <Skeleton width="100%" height={16} />
      <Skeleton width="80%" height={16} />
      <div class="pt-4">
        <Skeleton width="60%" height={32} />
      </div>
    </div>
  );
};

// Table skeleton for loading states
export const TableSkeleton: Component<{ rows?: number }> = (props) => {
  const rows = props.rows || 5;
  
  return (
    <div class="space-y-2">
      {/* Header */}
      <div class="flex gap-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <Skeleton width="20%" height={20} />
        <Skeleton width="30%" height={20} />
        <Skeleton width="25%" height={20} />
        <Skeleton width="25%" height={20} />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map(() => (
        <div class="flex gap-4 py-2">
          <Skeleton width="20%" height={16} />
          <Skeleton width="30%" height={16} />
          <Skeleton width="25%" height={16} />
          <Skeleton width="25%" height={16} />
        </div>
      ))}
    </div>
  );
};