import { Hono } from "hono";
import { getAuth, AuthType } from "../lib/auth";

const authRouter = new Hono<AuthType>();

// Specific route for admin user creation
authRouter.post("/admin/users", async (c) => {
  console.log("[Auth Router] Admin attempting to create user.");
  // const authInstance = getAuth(c); // authInstance is not directly needed if using c.var
  
  // The authMiddleware should have populated c.var.user and c.var.session
  const user = c.var.user;
  const session = c.var.session;

  if (!user || !session) {
    console.log("[Auth Router] No active session or user found by middleware for admin user creation.");
    return c.json({ error: "Unauthorized: Admin access required. No active session." }, 401);
  }

  // TODO: Implement proper admin role check based on user.role
  // Cast user to 'any' or a more specific extended type to access custom 'role' property.
  // Ideally, extend the AuthType.Variables.user type globally or define an interface.
  const userWithRole = user as any; // Or `as UserWithRole` if defined

  // Example: if (userWithRole.role !== 'super_admin' && userWithRole.role !== 'admin') {
  //   console.log(`[Auth Router] User ${userWithRole.email} (role: ${userWithRole.role}) attempted admin action without sufficient privileges.`);
  //   return c.json({ error: "Forbidden: Insufficient privileges." }, 403);
  // }
  console.log(`[Auth Router] Authenticated user for admin action: ${userWithRole.email} (role: ${userWithRole.role})`);

  try {
    const body = await c.req.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name || !role) {
      return c.json({ error: "Missing required fields (email, password, name, role)." }, 400);
    }

    // TODO: Use better-auth's admin functionality to create the user
    // This might involve something like `authInstance.admin.createUser(...)`
    // or direct database interaction if better-auth doesn't expose this.
    // For now, returning a placeholder.
    console.log(`[Auth Router] Admin user creation logic for ${email} (role: ${role}) needs to be implemented.`);
    
    // Placeholder for actual user creation logic
    // const newUser = await authInstance.admin.createUser({ email, password, name, role, emailVerified: true });
    // return c.json({ message: "User created successfully by admin.", user: newUser }, 201);

    return c.json({ message: "Admin user creation endpoint hit, but not fully implemented.", received: body }, 200);

  } catch (error) {
    console.error("[Auth Router] Error in /admin/users:", error);
    return c.json({ error: "Failed to process admin user creation." }, 500);
  }
});

// Handle only POST and GET for other better-auth routes (sign-in, session, etc.)
// This should come AFTER specific routes like /admin/users
authRouter.on(["POST", "GET"], "/*", async (c) => {
  const origin = c.req.header('Origin');
  console.log(`[Auth Router] Handling path: ${c.req.path}, Method: ${c.req.method}, Origin: ${origin}`);

  const authInstance = getAuth(c);
  try {
    const request = c.req.raw;
    const url = new URL(request.url);
    url.pathname = c.req.path;
    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: request.redirect,
      signal: request.signal,
    });

    const response = await authInstance.handler(modifiedRequest);
    console.log("[Auth Router] Handler returned response");

    return response;

  } catch (error) {
    console.error("[Auth Router] Error in Better Auth handler:", error);
    // Return a simple error response
    const errorResponse = new Response(JSON.stringify({ error: "Internal Auth Error" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
    return errorResponse;
  }
});

export default authRouter; 