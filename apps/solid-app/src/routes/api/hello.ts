import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

export async function GET(event: APIEvent) {
  return json({
    message: "Hello from SolidStart API!",
    timestamp: new Date().toISOString(),
    method: "GET"
  });
}

export async function POST(event: APIEvent) {
  const body = await new Response(event.request.body).json();
  
  return json({
    message: "Data received!",
    data: body,
    timestamp: new Date().toISOString(),
    method: "POST"
  });
}