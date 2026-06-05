"use client";

import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("Application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          fontFamily: "system-ui, sans-serif",
        }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>
            Oops! Something went wrong
          </h1>
          <p style={{ color: "#666", marginBottom: "2rem", maxWidth: "32rem", textAlign: "center" }}>
            The application hit an unexpected error. Fully quit Obscur and restart — a normal refresh
            may not clear a fatal render loop.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Reload page
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <details style={{ marginTop: "2rem", maxWidth: "600px" }}>
              <summary style={{ cursor: "pointer", marginBottom: "0.5rem" }}>
                Error Details
              </summary>
              <pre style={{
                backgroundColor: "#f5f5f5",
                padding: "1rem",
                borderRadius: "0.5rem",
                overflow: "auto",
                fontSize: "0.875rem",
              }}
              >
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
