import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ALL_TUTORIALS } from '../utils/tutorials';
import type { Tutorial, TutorialStep } from '../utils/tutorials';

interface TutorialContextValue {
  /** Tutorialul activ (null dacă nu este activ niciunul) */
  activeTutorial: Tutorial | null;
  /** Pasul curent (0-based) */
  currentStepIndex: number;
  currentStep: TutorialStep | null;
  /** Panoul lateral cu lista de tutoriale */
  isDrawerOpen: boolean;
  /** Pornește un tutorial după ID */
  startTutorial: (tutorialId: string) => void;
  /** Închide tutorialul activ */
  closeTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  allTutorials: Tutorial[];
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const highlightRef = useRef<Element | null>(null);

  // ── Gestionare highlight element ─────────────────────────────────────────
  const clearHighlight = useCallback(() => {
    if (highlightRef.current) {
      highlightRef.current.classList.remove('wms-tutorial-highlight');
      highlightRef.current = null;
    }
  }, []);

  const applyHighlight = useCallback(
    (selector?: string) => {
      clearHighlight();
      if (!selector) return;
      // Mică întârziere pentru a permite navigarea paginii să se finalizeze
      setTimeout(() => {
        const el = document.querySelector(selector);
        if (el) {
          el.classList.add('wms-tutorial-highlight');
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          highlightRef.current = el;
        }
      }, 400);
    },
    [clearHighlight]
  );

  // ── Activare pas ─────────────────────────────────────────────────────────
  const activateStep = useCallback(
    (tutorial: Tutorial, stepIndex: number) => {
      const step = tutorial.steps[stepIndex];
      if (!step) return;
      if (step.navigateTo) {
        navigate(step.navigateTo);
      }
      applyHighlight(step.targetSelector);
    },
    [navigate, applyHighlight]
  );

  // ── API public ────────────────────────────────────────────────────────────
  const startTutorial = useCallback(
    (tutorialId: string) => {
      const tutorial = ALL_TUTORIALS.find((t) => t.id === tutorialId);
      if (!tutorial) return;
      setActiveTutorial(tutorial);
      setCurrentStepIndex(0);
      setIsDrawerOpen(false);
      activateStep(tutorial, 0);
    },
    [activateStep]
  );

  const closeTutorial = useCallback(() => {
    clearHighlight();
    setActiveTutorial(null);
    setCurrentStepIndex(0);
  }, [clearHighlight]);

  const nextStep = useCallback(() => {
    if (!activeTutorial) return;
    const next = currentStepIndex + 1;
    if (next >= activeTutorial.steps.length) {
      closeTutorial();
      return;
    }
    setCurrentStepIndex(next);
    activateStep(activeTutorial, next);
  }, [activeTutorial, currentStepIndex, activateStep, closeTutorial]);

  const prevStep = useCallback(() => {
    if (!activeTutorial || currentStepIndex === 0) return;
    const prev = currentStepIndex - 1;
    setCurrentStepIndex(prev);
    activateStep(activeTutorial, prev);
  }, [activeTutorial, currentStepIndex, activateStep]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

  // Curăță highlight la demontare
  useEffect(() => () => clearHighlight(), [clearHighlight]);

  const currentStep = activeTutorial
    ? activeTutorial.steps[currentStepIndex] ?? null
    : null;

  const value: TutorialContextValue = {
    activeTutorial,
    currentStepIndex,
    currentStep,
    isDrawerOpen,
    startTutorial,
    closeTutorial,
    nextStep,
    prevStep,
    openDrawer,
    closeDrawer,
    allTutorials: ALL_TUTORIALS,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export { TutorialContext };
export type { TutorialContextValue };
