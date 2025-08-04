# Page snapshot

```yaml
- img
- heading "VibeStack" [level=1]
- text: Login Enter your email and password below to log into your account Email
- textbox "Email"
- text: Password
- textbox "Password"
- button:
  - img
- link "Forgot password?":
  - /url: /forgot-password
- button "Login"
- text: Or continue with
- button "Continue with Google":
  - img
  - text: Continue with Google
- paragraph:
  - text: Don't have an account?
  - link "Sign Up":
    - /url: /sign-up
- paragraph:
  - text: By clicking login, you agree to our
  - link "Terms of Service":
    - /url: /terms
  - text: and
  - link "Privacy Policy":
    - /url: /privacy
  - text: .
- region "Notifications alt+T"
- contentinfo:
  - button "Open TanStack Router Devtools":
    - img
    - img
    - text: "- TanStack Router"
```