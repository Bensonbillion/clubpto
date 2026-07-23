// Court Manager v2 — last line of defense against a blank white screen.
// The owner's #1 historical failure was "the iPad breaks mid-game and clears
// everything." If ANY render inside the manager throws, this boundary catches
// it and shows a calm recovery screen instead of an unrecoverable blank page —
// and because every result is written to localStorage the instant it's tapped,
// a reload restores the live session (schedule, results, check-ins) intact.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ManageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface it for debugging without taking the app down.
    console.error("[CourtManager] render error caught by boundary:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-dark text-cream flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <div className="space-y-2 max-w-md">
          <h1 className="font-display text-2xl text-accent">Something hiccuped</h1>
          <p className="text-muted-foreground">
            Tonight&apos;s session is saved on this device — nothing is lost. Reload to pick up
            right where you left off.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="min-h-[56px] px-8 rounded-lg bg-accent text-accent-foreground border-2 border-accent font-display text-lg inline-flex items-center gap-3 hover:bg-accent/90 active:scale-[0.98] transition-all touch-manipulation"
        >
          <RotateCcw className="w-5 h-5" />
          Reload
        </button>
      </div>
    );
  }
}

export default ManageErrorBoundary;
