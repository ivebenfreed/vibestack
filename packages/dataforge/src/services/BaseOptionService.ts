import { Option, OptionSet } from '../entities/index.js';

/**
 * Base service for option management
 * Provides common functionality for all option types
 */
export abstract class BaseOptionService {
  protected abstract optionType: string;
  protected abstract isSystemType: boolean;

  /**
   * Validate option data before creation
   */
  protected validateOptionData(data: Partial<Option>): string[] {
    const errors: string[] = [];

    if (!data.value || data.value.trim() === '') {
      errors.push('Option value is required');
    }

    if (!data.label || data.label.trim() === '') {
      errors.push('Option label is required');
    }

    if (data.optionType !== this.optionType) {
      errors.push(`Option type must be ${this.optionType}`);
    }

    return errors;
  }

  /**
   * Validate option set data before creation
   */
  protected validateOptionSetData(data: Partial<OptionSet>): string[] {
    const errors: string[] = [];

    if (!data.name || data.name.trim() === '') {
      errors.push('Option set name is required');
    }

    if (data.optionSetType !== this.optionType) {
      errors.push(`Option set type must be ${this.optionType}`);
    }

    if (data.isSystemType !== this.isSystemType) {
      errors.push(`Option set isSystemType must be ${this.isSystemType}`);
    }

    return errors;
  }

  /**
   * Get default option properties for this type
   */
  protected getDefaultOptionProperties(): Partial<Option> {
    return {
      optionType: this.optionType,
      sortOrder: 0,
      isActive: true
    };
  }

  /**
   * Get default option set properties for this type
   */
  protected getDefaultOptionSetProperties(): Partial<OptionSet> {
    return {
      optionSetType: this.optionType,
      isSystemType: this.isSystemType,
      isActive: true
    };
  }
}