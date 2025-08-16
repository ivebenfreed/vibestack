import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    const { email, password } = body;

    // For demo purposes - accept any credentials
    if (!email || !password) {
      return json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Simulate authentication logic
    const user = {
      id: "user_123",
      email: email,
      name: "Demo User",
      role: "user"
    };

    // Simulate JWT token (in real app, use proper JWT library)
    const token = btoa(JSON.stringify({
      userId: user.id,
      email: user.email,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }));

    return json({
      success: true,
      message: "Sign in successful",
      user,
      token
    });

  } catch (error) {
    return json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}