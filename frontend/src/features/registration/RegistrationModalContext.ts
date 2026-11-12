import { createContext, useContext } from 'react';

export const RegistrationModalContext = createContext<(() => void) | null>(null);

export function useRegistrationModal() {
  const openRegistration = useContext(RegistrationModalContext);
  if (!openRegistration) {
    throw new Error('RegistrationModalContext is not available.');
  }
  return openRegistration;
}
