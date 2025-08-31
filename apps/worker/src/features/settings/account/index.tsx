import ContentSection from '../components/content-section'
import { AccountForm } from './account-form'
import { EmailVerificationStatus } from '@/features/auth/components/EmailVerificationStatus'

export default function SettingsAccount() {
  return (
    <ContentSection
      title='Account'
      desc='Update your account settings. Set your preferred language and
          timezone.'
    >
      <div className="space-y-6">
        <EmailVerificationStatus />
        <AccountForm />
      </div>
    </ContentSection>
  )
}
