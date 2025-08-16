import { json } from "@solidjs/router";
import type { APIEvent } from "@solidjs/start/server";

export async function POST(event: APIEvent) {
  try {
    const body = await new Response(event.request.body).json();
    const { firstName, lastName, email, password, organization } = body;

    // For demo purposes - accept any input
    if (!email) {
      return json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Simulate user creation
    const user = {
      id: "user_" + Math.random().toString(36).substr(2, 9),
      email: email,
      firstName: firstName || "Demo",
      lastName: lastName || "User",
      organization: organization || "Demo Org",
      role: "user",
      createdAt: new Date().toISOString()
    };

    // Simulate JWT token
    const token = btoa(JSON.stringify({
      userId: user.id,
      email: user.email,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }));

    return json({
      success: true,
      message: "Account created successfully",
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