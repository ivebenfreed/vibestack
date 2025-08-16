import { MetaProvider, Title } from "@solidjs/meta";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastContainer } from "./components/feedback/Toast";
import "./app.css";
import "./styles/globals.css";
import "./styles/debug.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>VibeStack</Title>
          <ThemeProvider>
            <Suspense>{props.children}</Suspense>
            <ToastContainer />
          </ThemeProvider>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}