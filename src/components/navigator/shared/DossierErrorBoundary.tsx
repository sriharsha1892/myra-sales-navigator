"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
}

export class DossierErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[DossierErrorBoundary] ${this.props.sectionName ?? "Unknown section"} crashed:`,
      error,
      info.componentStack
    );
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-xs text-text-secondary">
            Something went wrong loading this section
          </p>
          <button
            onClick={this.handleRetry}
            className="flex-shrink-0 rounded-input border border-surface-3 px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
