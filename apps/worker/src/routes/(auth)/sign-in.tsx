import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import SignIn from '@/features/auth/sign-in'

// Search params schema for redirect handling
const signInSearchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/sign-in')({
  validateSearch: signInSearchSchema,
  component: SignIn,
})
