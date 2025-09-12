// Stub file to satisfy imports during CI build
// This is a placeholder for the integrity manager functionality

export class IntegrityManager {
  constructor(context: any, webSocketHandler: any) {
    // Stub implementation
  }

  async validateClientIntegrity(options: any): Promise<any> {
    // Stub implementation - always return valid
    return { isValid: true, errors: [] };
  }

  // Add any other methods that might be called
  async performValidation(...args: any[]): Promise<any> {
    return { isValid: true, errors: [] };
  }
}

export default IntegrityManager;