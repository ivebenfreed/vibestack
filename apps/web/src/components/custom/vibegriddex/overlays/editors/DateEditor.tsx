import React from 'react';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { CellRef, Column } from '../../types';

interface DateEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: string | null;
  onCommit: (value: string | null) => void;
  onCancel: () => void;
  includeTime?: boolean;
}

export function DateEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel,
  includeTime = false
}: DateEditorProps) {
  const [value, setValue] = React.useState(initialValue || '');
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
  
  const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
      return parseISO(dateString);
    } catch {
      return null;
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    if (includeTime) {
      return format(date, "yyyy-MM-dd'T'HH:mm:ss");
    }
    return format(date, 'yyyy-MM-dd');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        onCommit(value || null);
        break;
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
      case 'Tab':
        e.preventDefault();
        onCommit(value || null);
        break;
    }
  };

  const handleBlur = () => {
    onCommit(value || null);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const formattedDate = formatDate(date);
      setValue(formattedDate);
      setIsCalendarOpen(false);
      onCommit(formattedDate);
    }
  };

  const currentDate = parseDate(value);

  if (includeTime) {
    // For datetime, use a simple input
    return (
      <Input 
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoFocus
        className="border-2 border-blue-500 shadow-lg"
      />
    );
  }

  // For date only, provide both input and calendar popup
  return (
    <div className="flex gap-1">
      <Input 
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoFocus
        className="border-2 border-blue-500 shadow-lg flex-1"
      />
      
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="icon"
            className="border-2 border-blue-500"
            type="button"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={currentDate || undefined}
            onSelect={handleDateSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}