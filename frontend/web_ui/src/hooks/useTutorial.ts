import { useContext } from 'react';
import { TutorialContext } from '../contexts/TutorialContext';
import type { TutorialContextValue } from '../contexts/TutorialContext';

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial trebuie folosit în interiorul <TutorialProvider>');
  }
  return ctx;
}
