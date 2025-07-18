import type { RelationshipOptionsProvider, RelationshipContext } from '../types';

/**
 * User Provider
 * 
 * Provides all users as options for assignment
 * Sorted by displayName/name
 */
export const userProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  const { atoms } = context;
  
  // Get users from atoms
  const users = atoms.users?.get() || {};
  
  // Get all users
  const allUsers = Object.values(users)
    .sort((a: any, b: any) => {
      const nameA = a.displayName || a.name || '';
      const nameB = b.displayName || b.name || '';
      return nameA.localeCompare(nameB);
    });
  
  // Convert to EnumOption format
  return allUsers.map((user: any) => ({
    value: user.id,
    label: user.displayName || user.name,
    description: user.email
  }));
};