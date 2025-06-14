import React, { createContext, useContext } from 'react';
// Adjust import paths as necessary
import { AppAbility, defineAbilityFor } from '../lib/ability';
import { useAuth } from '../state-machines/orchestrator-hooks';

const defaultAbility = defineAbilityFor(null);
export const AbilityContext = createContext<AppAbility>(defaultAbility);

export const AbilityProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  // The ability instance is re-calculated whenever the 'user' object from the store changes.
  const ability = defineAbilityFor(user);

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
};

// Optional: export a hook for easier consumption in components
export const useAppAbility = () => useContext(AbilityContext);