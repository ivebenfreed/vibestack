import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";

export default function About() {
  return (
    <>
      <Title>About - SolidStart Cloudflare</Title>
      <nav>
        <ul>
          <li><A href="/">Home</A></li>
          <li><A href="/about">About</A></li>
          <li><A href="/api-demo">API Demo</A></li>
        </ul>
      </nav>
      
      <div class="container">
        <div class="card">
          <h1>About This App</h1>
          <p>
            This is a SolidStart application configured for deployment on Cloudflare Workers.
            It demonstrates server-side rendering (SSR) capabilities running at the edge.
          </p>
        </div>
        
        <div class="card">
          <h2>Technology Stack</h2>
          <ul>
            <li><strong>SolidJS</strong> - Reactive UI library</li>
            <li><strong>SolidStart</strong> - Full-stack framework</li>
            <li><strong>Cloudflare Workers</strong> - Edge runtime</li>
            <li><strong>Vinxi</strong> - Build tool</li>
            <li><strong>TypeScript</strong> - Type safety</li>
          </ul>
        </div>
        
        <div class="card">
          <h2>Deployment</h2>
          <p>To deploy this app to Cloudflare Workers:</p>
          <ol>
            <li>Build the application: <code>pnpm build</code></li>
            <li>Deploy to Cloudflare: <code>pnpm deploy</code></li>
          </ol>
        </div>
      </div>
    </>
  );
}