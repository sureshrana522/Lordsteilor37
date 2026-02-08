
import React, { ReactNode, ErrorInfo, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // FORCE REMOVE LOADER SO ERROR IS VISIBLE
    const shell = document.getElementById('app-shell');
    if (shell) {
       shell.style.display = 'none';
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#ff4444', backgroundColor: '#000', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', zIndex: 100000, position: 'relative' }}>
          <h2 style={{ fontFamily: 'serif', marginBottom: '10px', fontSize: '24px', color: '#b38728' }}>SYSTEM RECOVERY</h2>
          <p style={{ color: '#888', maxWidth: '300px', fontSize: '12px', marginBottom: '20px' }}>
            Connection interrupted or data error.
          </p>
          <pre style={{ padding: '15px', backgroundColor: '#111', borderRadius: '8px', fontSize: '10px', overflow: 'auto', maxWidth: '90vw', color: '#f87171', border: '1px solid #333' }}>
            {this.state.error?.toString() || "Unknown Error"}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '30px', padding: '12px 30px', backgroundColor: '#b38728', border: 'none', borderRadius: '8px', color: '#000', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            Reconnect System
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Loader component for the very first render cycle
const RootLoader = () => (
  <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid #333', borderTop: '3px solid #b38728', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<RootLoader />}>
         <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>
);
