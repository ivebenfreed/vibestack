import { HTMLAttributes, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'

type OtpFormProps = HTMLAttributes<HTMLFormElement> & {
  email: string
  type: 'email-verification' | 'sign-in' | 'forget-password'
  onSuccess?: () => void
}

const formSchema = z.object({
  otp: z.string().min(6, { message: 'Please enter the 6-digit code.' }).max(6, { message: 'Code must be 6 digits.' }),
})

export function OtpForm({ className, email, type, onSuccess, ...props }: OtpFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    
    try {
      let result;
      
      switch (type) {
        case 'email-verification':
          // Use Better Auth emailOtp verification endpoint
          result = await authClient.emailOtp.verifyEmail({
            email: email,
            otp: data.otp
          })
          break;
          
        case 'sign-in':
          // Use Better Auth emailOtp sign in endpoint
          result = await authClient.signIn.emailOtp({
            email: email,
            otp: data.otp
          })
          break;
          
        case 'forget-password':
          // Use Better Auth emailOtp password reset endpoint
          result = await authClient.emailOtp.resetPassword({
            email: email,
            otp: data.otp,
            password: 'temp-password' // This should be handled by a separate form
          })
          break;
          
        default:
          throw new Error('Invalid OTP type')
      }

      if (result.error) {
        throw new Error(result.error.message)
      }

      toast.success('Verification successful!')
      
      // Refresh the user session to get updated emailVerified status
      try {
        await authClient.getSession()
      } catch (sessionError) {
        console.warn('Failed to refresh session after verification:', sessionError)
      }
      
      if (onSuccess) {
        onSuccess()
      } else {
        navigate({ to: '/' })
      }
      
    } catch (error: any) {
      console.error('OTP verification failed:', error)
      toast.error(error?.message || 'Invalid or expired code. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-2', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='otp'
          render={({ field }) => (
            <FormItem>
              <FormLabel className='sr-only'>One-Time Password</FormLabel>
              <FormControl>
                <InputOTP
                  maxLength={6}
                  {...field}
                  containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-12'
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={otp.length < 6 || isLoading}>
          Verify
        </Button>
      </form>
    </Form>
  )
}
