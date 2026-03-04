import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          className="flex flex-col items-center justify-center min-h-screen px-6"
          style={{ background: "#F7F6FF" }}
        >
          <p style={{ fontSize: "16px", color: "#374151", marginBottom: "12px", textAlign: "center" }}>
            Something went wrong. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl font-semibold"
            style={{ background: "#22C55E", color: "white" }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
