import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[PhotoGenix] Unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-base flex items-center justify-center font-mono">
          <div className="max-w-md w-full bg-surface border border-line rounded-sm p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-red-950/30 border border-red-500/30 rounded-full flex items-center justify-center">
              <AlertTriangle size={28} className="text-red-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">ENGINE_FAULT</h2>
              <p className="text-zinc-500 text-xs leading-relaxed">
                An unexpected error occurred. Your work is saved automatically.
              </p>
              {this.state.error && (
                <p className="text-red-400/70 text-[10px] mt-3 bg-base p-2 rounded-sm border border-line overflow-auto max-h-20">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={this.handleDismiss}
                className="flex-1 py-3 text-xs uppercase tracking-widest font-bold bg-base border border-line text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors rounded-sm"
              >
                DISMISS
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 text-xs uppercase tracking-widest font-bold bg-signal text-white hover:bg-indigo-600 transition-colors rounded-sm flex items-center justify-center gap-2"
              >
                <RefreshCw size={12} /> RELOAD
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
