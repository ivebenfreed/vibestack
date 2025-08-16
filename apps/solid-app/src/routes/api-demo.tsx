import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import { createResource, Show, Suspense } from "solid-js";
import { getRequestEvent } from "solid-js/web";

async function fetchData() {
  "use server";
  
  const event = getRequestEvent();
  const headers = event?.request.headers;
  
  // Simulating an API call that runs on the server
  return {
    message: "This data was fetched on the server!",
    timestamp: new Date().toISOString(),
    userAgent: headers?.get("user-agent") || "Unknown",
    cfRay: headers?.get("cf-ray") || "Local development",
    platform: "Cloudflare Workers",
  };
}

export default function ApiDemo() {
  const [data] = createResource(fetchData);
  
  return (
    <>
      <Title>API Demo - SolidStart Cloudflare</Title>
      <nav>
        <ul>
          <li><A href="/">Home</A></li>
          <li><A href="/about">About</A></li>
          <li><A href="/api-demo">API Demo</A></li>
        </ul>
      </nav>
      
      <div class="container">
        <div class="card">
          <h1>Server-Side Data Fetching Demo</h1>
          <p>
            This page demonstrates server-side data fetching in SolidStart.
            The data below is fetched on the Cloudflare Worker before sending the page to your browser.
          </p>
        </div>
        
        <Suspense fallback={<div class="card">Loading server data...</div>}>
          <Show when={data()}>
            {(serverData) => (
              <div class="card">
                <h2>Server Response</h2>
                <pre style="background: #f0f0f0; padding: 1rem; border-radius: 4px; overflow-x: auto;">
{JSON.stringify(serverData(), null, 2)}
                </pre>
              </div>
            )}
          </Show>
        </Suspense>
        
        <div class="card">
          <h2>How It Works</h2>
          <ol>
            <li>The <code>fetchData</code> function runs on the server (Cloudflare Worker)</li>
            <li>It accesses request headers and server-side APIs</li>
            <li>Data is serialized and sent with the initial HTML</li>
            <li>The page hydrates on the client with the pre-fetched data</li>
          </ol>
        </div>
      </div>
    </>
  );
}