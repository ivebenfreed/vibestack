import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
// Adjust the import path if your authStore is located differently relative to 'lib'
import { UserInfo } from '../stores/authStore';

// Define actions and subjects relevant to your application
type AppActions = 'access';
// 'debug_features' will be the subject representing access to the debug section.
// 'all' is a CASL keyword for defining rules that apply to all subjects.
type AppSubjects = 'debug_features' | 'all';

export type AppAbility = MongoAbility<[AppActions, AppSubjects]>;

export function defineAbilityFor(user: UserInfo | null): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user?.role === 'admin' || user?.role === 'super_admin') {
    can('access', 'debug_features');
  } else {
    // By default, if not admin/super admin, they cannot access debug_features.
    // No explicit 'cannot' is needed here if default is restrictive,
    // but it can be added for clarity if preferred.
    // cannot('access', 'debug_features');
  }

  // Example: If you want to allow everyone to 'read' 'all' by default:
  // can('read', 'all');
  // For now, we are only explicitly defining 'access' to 'debug_features'.

  return build();
}