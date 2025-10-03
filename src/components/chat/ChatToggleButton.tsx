/**
 * Chat Toggle Button - Fixed position button to open chat panel
 * VS Code style, appears in bottom right corner
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatToggleButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function ChatToggleButton({ onClick, isOpen }: ChatToggleButtonProps) {
  if (isOpen) return null; // Hide when panel is open

  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        'fixed bottom-6 right-6 z-40',
        'rounded-full h-14 w-14 p-0',
        'shadow-lg hover:shadow-xl transition-shadow',
        'bg-primary hover:bg-primary/90'
      )}
      aria-label="Open AI Assistant"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
}
