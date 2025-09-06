/**
 * Centralized entity name transformation utilities
 * Handles all entity name formats consistently across the application
 */

export class EntityNameUtils {
  // Standard plural to singular mappings
  private static readonly PLURAL_MAPPINGS: Record<string, string> = {
    // Simple plurals
    'clients': 'Client',
    'tasks': 'Task',
    'projects': 'Project',
    'meetings': 'Meeting',
    'contracts': 'Contract',
    'invoices': 'Invoice',
    'expenses': 'Expense',
    'files': 'File',
    'discussions': 'Discussion',
    'timesheets': 'TimeSheet',
    // Multi-word variants
    'time sheets': 'TimeSheet',
    'time-sheets': 'TimeSheet',
    'time_sheets': 'TimeSheet',
    'timecards': 'TimeCard',
    'time cards': 'TimeCard',
    'time-cards': 'TimeCard',
    'time_cards': 'TimeCard',
    'skillsets': 'SkillSet',
    'skill sets': 'SkillSet',
    'skill-sets': 'SkillSet',
    'skill_sets': 'SkillSet',
  };

  /**
   * Normalize any input format to a consistent internal format
   * Handles: kebab-case, snake_case, camelCase, PascalCase, space separated
   */
  private static normalizeInput(input: string): string {
    return input
      // Convert kebab and snake to spaces
      .replace(/[-_]/g, ' ')
      // Add space before uppercase letters in camelCase/PascalCase
      // But avoid breaking acronyms like "API" or "URL"
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      // Normalize whitespace
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  /**
   * Convert entity name to storage format: {orgId}_{PascalCaseEntityName}
   * @param entityName - Entity name in any format
   * @param orgId - Optional organization ID
   * @returns Storage format string
   */
  static toStorageFormat(entityName: string, orgId?: string): string {
    const pascalName = this.toPascalCase(entityName);
    return orgId ? `${orgId}_${pascalName}` : pascalName;
  }

  /**
   * Extract display name from storage format
   * @param storageFormat - Storage format entity name
   * @returns Human-readable display name
   */
  static toDisplayFormat(storageFormat: string): string {
    const { entityName } = this.extractOrgPrefix(storageFormat);
    
    // Convert PascalCase to space-separated title case
    // This works even if the PascalCase has been flattened (like "Dataanalyticsreport")
    let displayName = entityName;
    
    // If the string appears to be flattened PascalCase (first letter capital, rest lowercase)
    // we need to try to restore word boundaries
    if (/^[A-Z][a-z]+$/.test(displayName)) {
      // Insert spaces before likely word boundaries based on common patterns
      // This is a heuristic approach since we've lost the original casing
      displayName = displayName
        // Common word endings that likely indicate a new word starts after them
        .replace(/([a-z])(data|time|user|access|control|emergency|security|capitol|schema|permission)/gi, 
                '$1 $2')
        // Common standalone words in entity names
        .replace(/(test|entity|analytics|report|list|contact|badge|building|sheet|group)([a-z])/gi,
                '$1 $2');
    }
    
    // Now convert to proper display format with spaces
    // This handles both properly cased PascalCase and our restored version
    return displayName
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // Add space between lowercase and uppercase
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // Handle consecutive capitals
      .trim()
      // Capitalize first letter of each word for consistent display
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convert entity name to URL-safe kebab-case format
   * @param entityName - Entity name in any format
   * @returns URL-safe kebab-case string for clean URLs
   */
  static toUrlSafeFormat(entityName: string): string {
    // Convert to kebab-case for clean, user-friendly URLs
    const kebabCase = entityName
      .replace(/([a-z])([A-Z])/g, '$1-$2')  // camelCase to kebab-case
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')  // Consecutive capitals
      .replace(/[\s_]+/g, '-')  // Spaces and underscores to hyphens
      .toLowerCase()
      .replace(/-+/g, '-')  // Remove duplicate hyphens
      .replace(/^-|-$/g, '');  // Trim hyphens from start/end
    
    return kebabCase;
  }

  /**
   * Convert URL format back to PascalCase entity name
   * @param urlName - URL format entity name (kebab-case or with org prefix)
   * @returns PascalCase entity name
   */
  static fromUrlFormat(urlName: string): string {
    // First check if this already has an org prefix (UUID pattern)
    const { orgId, entityName } = this.extractOrgPrefix(urlName);
    
    if (orgId) {
      // If it has an org prefix, just return the entity name part as-is
      // since it's already in the correct format
      return entityName;
    }
    
    // Convert kebab-case to PascalCase
    // e.g., "schema-test-entity" -> "SchemaTestEntity"
    // Also handle snake_case for backwards compatibility
    const separator = urlName.includes('_') ? '_' : '-';
    return urlName
      .split(separator)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Convert any format to PascalCase
   * @param name - Entity name in any format
   * @returns PascalCase string
   */
  static toPascalCase(name: string): string {
    // Check if already in PascalCase format (starts with uppercase, may have internal capitals)
    // Examples: CustomerOrder, ProductCatalog, User, APIKey
    if (/^[A-Z][a-zA-Z]*$/.test(name) && !name.includes('_') && !name.includes('-') && !name.includes(' ')) {
      // Check if it has mixed case (not all uppercase, not all lowercase after first char)
      const hasInternalCapitals = /[a-z][A-Z]/.test(name);
      const isNotAllUppercase = /[a-z]/.test(name.substring(1));
      
      if (hasInternalCapitals || (name.length <= 4 && isNotAllUppercase)) {
        // It's likely already in PascalCase, preserve it
        // But still check for pluralization
        const lowerName = name.toLowerCase();
        
        // Check if it's plural and needs singularization
        for (const [plural, singular] of Object.entries(this.PLURAL_MAPPINGS)) {
          if (lowerName === plural || lowerName.endsWith(plural)) {
            // It's plural, singularize while preserving case pattern
            const singularLower = singular.toLowerCase();
            // Reconstruct with original casing pattern
            return name.substring(0, name.length - plural.length) + 
                   singular.substring(singular.length - (name.length - (name.length - plural.length)));
          }
        }
        
        // Not plural or not in our mappings, return as-is
        return name;
      }
    }
    
    const normalized = this.normalizeInput(name);
    const singular = this.toSingular(normalized);
    
    // Convert to PascalCase
    return singular
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Convert singular to plural form
   * @param singular - Singular entity name
   * @returns Plural form
   */
  static toPlural(singular: string): string {
    const normalized = this.normalizeInput(singular);
    
    // Check if we have a reverse mapping
    for (const [plural, sing] of Object.entries(this.PLURAL_MAPPINGS)) {
      if (this.normalizeInput(sing) === normalized) {
        return plural;
      }
    }
    
    // Simple pluralization rules
    if (normalized.endsWith('y') && !normalized.endsWith('ay') && !normalized.endsWith('ey')) {
      return normalized.slice(0, -1) + 'ies';
    } else if (normalized.endsWith('s') || normalized.endsWith('x') || 
               normalized.endsWith('ch') || normalized.endsWith('sh')) {
      return normalized + 'es';
    } else {
      return normalized + 's';
    }
  }

  /**
   * Convert plural to singular form
   * @param plural - Plural entity name
   * @returns Singular form
   */
  static toSingular(plural: string): string {
    const normalized = this.normalizeInput(plural);
    
    // Check explicit mappings first
    if (this.PLURAL_MAPPINGS[normalized]) {
      return this.PLURAL_MAPPINGS[normalized];
    }
    
    // If it's already singular (not in our plural mappings), return as PascalCase
    return plural
      .split(/[\s-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  /**
   * Normalize entity name for database/schema lookups
   * @param name - Entity name in any format
   * @returns Normalized entity name for lookups
   */
  static normalizeForLookup(name: string): string {
    return this.toPascalCase(name);
  }

  /**
   * Extract organization prefix from full entity name
   * @param fullName - Full entity name with possible org prefix
   * @returns Object with orgId and clean entity name
   */
  static extractOrgPrefix(fullName: string): { orgId: string | null; entityName: string } {
    if (!fullName.includes('_')) {
      return { orgId: null, entityName: fullName };
    }
    
    const parts = fullName.split('_');
    const firstPart = parts[0];
    
    // Check if first part looks like a UUID (36 chars with dashes)
    if (firstPart.length === 36 && firstPart.includes('-')) {
      return {
        orgId: firstPart,
        entityName: parts.slice(1).join('_')
      };
    }
    
    // Check if first part looks like a UUID with underscores instead of dashes
    if (firstPart.length === 32 || (firstPart.match(/[0-9a-f]/gi) || []).length > 20) {
      return {
        orgId: firstPart,
        entityName: parts.slice(1).join('_')
      };
    }
    
    return { orgId: null, entityName: fullName };
  }

  /**
   * Check if entity name already has an organization prefix
   * @param entityName - Entity name to check
   * @param orgId - Organization ID to check against
   * @returns True if entity name already has the specified org prefix
   */
  static hasOrgPrefix(entityName: string, orgId: string): boolean {
    return entityName.startsWith(`${orgId}_`);
  }

  /**
   * Ensure entity name has organization prefix (prevents double-prefixing)
   * @param entityName - Entity name in any format
   * @param orgId - Organization ID
   * @returns Entity name with org prefix
   */
  static ensureOrgPrefix(entityName: string, orgId: string): string {
    if (!orgId || orgId === 'universe') {
      return this.toPascalCase(entityName);
    }
    
    if (this.hasOrgPrefix(entityName, orgId)) {
      return entityName;
    }
    
    return this.toStorageFormat(entityName, orgId);
  }

  /**
   * Validate if a string is a valid entity name
   * @param name - Name to validate
   * @returns True if valid entity name
   */
  static isValidEntityName(name: string): boolean {
    if (!name || typeof name !== 'string') return false;
    
    // Remove org prefix if present
    const { entityName } = this.extractOrgPrefix(name);
    
    // Check for valid characters (letters, numbers, spaces, hyphens, underscores)
    const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
    return validPattern.test(entityName) && entityName.length > 0 && entityName.length <= 100;
  }
}

// Export convenience functions for common operations
export const {
  toStorageFormat,
  toDisplayFormat,
  toUrlSafeFormat,
  fromUrlFormat,
  toPascalCase,
  toPlural,
  toSingular,
  normalizeForLookup,
  extractOrgPrefix,
  hasOrgPrefix,
  ensureOrgPrefix,
  isValidEntityName
} = EntityNameUtils;