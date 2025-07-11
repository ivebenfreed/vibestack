/**
 * Configuration for VibeGridX column generator script
 * Contains only generator processing options and defaults, not entity-specific data
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface VibeGridXGeneratorConfig {
  /** Column width configurations by cell type */
  columnWidths: {
    /** Default column widths */
    defaults: Record<string, number>;
    /** Minimum column widths */
    minimums: Record<string, number>;
    /** Maximum column widths */
    maximums: Record<string, number>;
    /** Text field width calculation thresholds */
    textLengthThresholds: {
      small: number;
      medium: number;
    };
  };

  /** Default formatting options */
  formatting: {
    /** Date format strings */
    dateFormats: {
      date: string;
      timestamp: string;
    };
    /** Placeholder text templates */
    placeholderTemplates: Record<string, string>;
  };

  /** Processing rules for the generator */
  processingRules: {
    /** Field names that are considered system fields */
    systemFieldNames: string[];
    /** Field names that should not be hideable */
    nonHideableFieldNames: string[];
    /** Default editability for fields */
    editableByDefault: boolean;
    /** Default sortability for fields */
    sortableByDefault: boolean;
    /** Default filterability for fields */
    filterableByDefault: boolean;
    /** Default resizability for columns */
    resizableByDefault: boolean;
    /** Default hideability for columns */
    hideableByDefault: boolean;
    /** Relationship types that are editable */
    relationshipEditableTypes: string[];
    /** Relationship types that allow creating new records */
    relationshipAllowCreateTypes: string[];
  };

  /** Type detection patterns */
  typeDetection: {
    /** Database type to cell type mapping */
    dbTypeMapping: Record<string, string>;
    /** Field name patterns for special handling */
    fieldNamePatterns: {
      email: RegExp;
      url: RegExp;
      password: RegExp;
    };
  };

  /** Validation patterns */
  validationPatterns: {
    email: string;
    url: string;
  };

  /** Generator output options */
  outputOptions: {
    /** Include utility functions in output */
    includeUtilityFunctions: boolean;
    /** Include type definitions in output */
    includeTypeDefinitions: boolean;
    /** Generate enum options objects */
    generateEnumOptions: boolean;
  };
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

export const VIBEGRIDX_GENERATOR_CONFIG: VibeGridXGeneratorConfig = {
  columnWidths: {
    defaults: {
      text: 200,
      number: 100,
      boolean: 80,
      date: 150,
      enum: 120,
      uuid: 120,
      json: 220,
      'relationship-single': 180,
      'relationship-multi': 220,
      'relationship-collection': 200,
    },
    minimums: {
      text: 120,
      number: 80,
      boolean: 70,
      date: 120,
      enum: 100,
      uuid: 100,
      json: 140,
      'relationship-single': 140,
      'relationship-multi': 160,
      'relationship-collection': 160,
    },
    maximums: {
      text: 600,
      number: 150,
      boolean: 100,
      date: 200,
      enum: 200,
      uuid: 150,
      json: 500,
      'relationship-single': 400,
      'relationship-multi': 400,
      'relationship-collection': 500,
    },
    textLengthThresholds: {
      small: 50,
      medium: 100,
    },
  },

  formatting: {
    dateFormats: {
      date: 'MMM dd, yyyy',
      timestamp: 'MMM dd, yyyy HH:mm',
    },
    placeholderTemplates: {
      date: 'Select date...',
      number: '0',
      enum: 'Select...',
      'relationship-single': 'Select...',
      'relationship-multi': 'Select...',
      text: 'Enter {fieldName}...',
    },
  },

  processingRules: {
    systemFieldNames: ['id', 'clientId', 'createdAt', 'updatedAt'],
    nonHideableFieldNames: ['id', 'name', 'title'],
    editableByDefault: true,
    sortableByDefault: true,
    filterableByDefault: true,
    resizableByDefault: true,
    hideableByDefault: true,
    relationshipEditableTypes: ['many-to-one', 'one-to-one'],
    relationshipAllowCreateTypes: ['many-to-one', 'one-to-one'],
  },

  typeDetection: {
    dbTypeMapping: {
      'int': 'number',
      'integer': 'number',
      'bigint': 'number',
      'number': 'number',
      'decimal': 'number',
      'float': 'number',
      'boolean': 'boolean',
      'date': 'date',
      'timestamp': 'date',
      'timestamptz': 'date',
      'uuid': 'uuid',
      'json': 'json',
      'jsonb': 'json',
    },
    fieldNamePatterns: {
      email: /email/i,
      url: /(url|link)/i,
      password: /password/i,
    },
  },

  validationPatterns: {
    email: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    url: '^https?://.*',
  },

  outputOptions: {
    includeUtilityFunctions: true,
    includeTypeDefinitions: true,
    generateEnumOptions: true,
  },
};

// ============================================================================
// CONFIGURATION HELPERS
// ============================================================================

/**
 * Get column width for a specific cell type
 */
export function getColumnWidth(
  cellType: string,
  config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG,
  maxLength?: number
): number {
  // Special handling for text fields based on length
  if (cellType === 'text' && maxLength) {
    const { small, medium } = config.columnWidths.textLengthThresholds;
    if (maxLength <= small) return 150;
    if (maxLength <= medium) return 200;
    return 250;
  }
  
  return config.columnWidths.defaults[cellType] || 150;
}

/**
 * Get minimum column width for a specific cell type
 */
export function getMinColumnWidth(
  cellType: string,
  config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG
): number {
  return config.columnWidths.minimums[cellType] || 100;
}

/**
 * Get maximum column width for a specific cell type
 */
export function getMaxColumnWidth(
  cellType: string,
  config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG
): number {
  return config.columnWidths.maximums[cellType] || 400;
}

/**
 * Get placeholder text for a field
 */
export function getPlaceholder(
  propertyName: string,
  cellType: string,
  config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG
): string {
  const template = config.formatting.placeholderTemplates[cellType];
  
  if (!template) {
    return `Enter ${formatFieldLabel(propertyName).toLowerCase()}...`;
  }
  
  if (template.includes('{fieldName}')) {
    return template.replace('{fieldName}', formatFieldLabel(propertyName).toLowerCase());
  }
  
  return template;
}

/**
 * Format field label from property name
 */
function formatFieldLabel(propertyName: string): string {
  return propertyName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Id$/, '')
    .replace(/_/g, ' ')
    .trim();
}

/**
 * Check if a field is a system field
 */
export function isSystemField(
  propertyName: string,
  config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG
): boolean {
  return config.processingRules.systemFieldNames.includes(propertyName);
}

/**
 * Check if a field should be hideable
 */
export function isHideable(
  propertyName: string,
  config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG
): boolean {
  // If field is in non-hideable list, it's not hideable
  if (config.processingRules.nonHideableFieldNames.includes(propertyName)) {
    return false;
  }
  
  // Otherwise, use the default hideability setting
  return config.processingRules.hideableByDefault;
}

/**
 * Map database type to cell type
 */
export function mapDbTypeToCellType(
  dbType: string,
  config: VibeGridXGeneratorConfig = VIBEGRIDX_GENERATOR_CONFIG
): string {
  return config.typeDetection.dbTypeMapping[dbType] || 'text';
}

/**
 * Create a custom configuration by merging with defaults
 */
export function createCustomConfig(
  overrides: Partial<VibeGridXGeneratorConfig>
): VibeGridXGeneratorConfig {
  return {
    ...VIBEGRIDX_GENERATOR_CONFIG,
    ...overrides,
    columnWidths: {
      ...VIBEGRIDX_GENERATOR_CONFIG.columnWidths,
      ...overrides.columnWidths,
    },
    formatting: {
      ...VIBEGRIDX_GENERATOR_CONFIG.formatting,
      ...overrides.formatting,
    },
    processingRules: {
      ...VIBEGRIDX_GENERATOR_CONFIG.processingRules,
      ...overrides.processingRules,
    },
    typeDetection: {
      ...VIBEGRIDX_GENERATOR_CONFIG.typeDetection,
      ...overrides.typeDetection,
    },
    outputOptions: {
      ...VIBEGRIDX_GENERATOR_CONFIG.outputOptions,
      ...overrides.outputOptions,
    },
  };
}