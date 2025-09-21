/**
 * TextArea Field Type - Multi-line text with word/character limits
 */

import type { VibeGridFieldType, CellRenderer, CellEditor, EnhancedColumn } from '../../FieldTypeRegistry';

export class TextAreaRenderer implements CellRenderer {
  render(value: any, column: EnhancedColumn): HTMLElement {
    const container = document.createElement('div');
    container.className = 'vibegridx-cell-textarea';
    container.style.cssText = 'padding: 4px; max-height: 60px; overflow: hidden;';

    if (!value) {
      container.innerHTML = '<span style="opacity: 0.6; font-size: 12px;">Click to edit</span>';
      return container;
    }

    const text = String(value);
    const maxLength = column.display?.truncateAt || 100;
    const displayText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    container.textContent = displayText;
    container.title = text; // Full text on hover
    container.style.cssText += 'font-size: 12px; line-height: 1.3; white-space: pre-wrap;';

    return container;
  }

  update(element: HTMLElement, value: any): void {
    if (!value) {
      element.innerHTML = '<span style="opacity: 0.6; font-size: 12px;">Click to edit</span>';
    } else {
      element.textContent = String(value);
    }
  }

  canHandle(column: EnhancedColumn): boolean {
    return (column.cellType || column.type) === 'textarea';
  }
}

export class TextAreaEditor implements CellEditor {
  create(value: any, column: EnhancedColumn, onSave: (value: any) => void): HTMLElement {
    const textarea = document.createElement('textarea');
    textarea.value = value || '';
    textarea.rows = column.editor?.rows || 3;
    textarea.style.cssText = `
      width: 100%; height: 100%; border: none; outline: none; background: transparent;
      font-family: inherit; font-size: inherit; padding: 4px; margin: 0; resize: none;
    `;

    if (column.validation?.maxLength) {
      textarea.maxLength = column.validation.maxLength;
    }

    textarea.addEventListener('blur', () => onSave(textarea.value || null));
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); textarea.blur(); }
    });

    setTimeout(() => textarea.focus(), 0);
    return textarea;
  }

  getValue(element: HTMLElement): any {
    return (element as HTMLTextAreaElement).value || null;
  }

  setValue(element: HTMLElement, value: any): void {
    (element as HTMLTextAreaElement).value = value || '';
  }

  validate(value: any, column: EnhancedColumn): any {
    const errors: string[] = [];
    const text = String(value || '');

    if (column.validation?.required && !text.trim()) {
      errors.push(`${column.name} is required`);
    }

    if (column.validation?.maxLength && text.length > column.validation.maxLength) {
      errors.push(`${column.name} must be no more than ${column.validation.maxLength} characters`);
    }

    return { valid: errors.length === 0, errors, transformedValue: value };
  }

  destroy(): void {}
  supportsInlineEditing(): boolean { return true; }
  supportsModalEditing(): boolean { return true; }
}

export const TextAreaFieldType: VibeGridFieldType = {
  type: 'textarea',
  category: 'basic',
  renderer: new TextAreaRenderer(),
  editor: new TextAreaEditor(),
  formatter: new (class {
    format(value: any): string { return value || ''; }
    parse(text: string): any { return text.trim() || null; }
  })(),
  metadata: {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    requiresSpecialEditor: true,
    hasRichDisplay: true
  }
};

import { fieldTypeRegistry } from '../../FieldTypeRegistry';
fieldTypeRegistry.register('textarea', TextAreaFieldType);