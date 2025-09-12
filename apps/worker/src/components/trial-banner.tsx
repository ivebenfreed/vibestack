import React, { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Clock, Crown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrialBannerProps {
  trialEndsAt: string | null
  organizationName?: string
  className?: string
  onUpgrade?: () => void
  onDismiss?: () => void
}

export function TrialBanner({ 
  trialEndsAt, 
  organizationName, 
  className, 
  onUpgrade,
  onDismiss 
}: TrialBannerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [daysLeft, setDaysLeft] = useState<number>(0)
  const [isDismissed, setIsDismissed] = useState(false)
  
  useEffect(() => {
    if (!trialEndsAt) return
    
    const updateTimeLeft = () => {
      const now = new Date()
      const endDate = new Date(trialEndsAt)
      const difference = endDate.getTime() - now.getTime()
      
      if (difference <= 0) {
        setTimeLeft('Trial expired')
        setDaysLeft(0)
        return
      }
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24))
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      
      setDaysLeft(days)
      
      if (days > 0) {
        setTimeLeft(`${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}`)
      } else if (hours > 0) {
        setTimeLeft(`${hours} hour${hours === 1 ? '' : 's'}, ${minutes} minute${minutes === 1 ? '' : 's'}`)
      } else {
        setTimeLeft(`${minutes} minute${minutes === 1 ? '' : 's'}`)
      }
    }
    
    updateTimeLeft()
    const interval = setInterval(updateTimeLeft, 60000) // Update every minute
    
    return () => clearInterval(interval)
  }, [trialEndsAt])
  
  if (!trialEndsAt || isDismissed) {
    return null
  }
  
  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }
  
  const getVariant = () => {
    if (daysLeft <= 0) return 'destructive'
    if (daysLeft <= 3) return 'destructive'
    if (daysLeft <= 7) return 'default'
    return 'default'
  }
  
  const getIcon = () => {
    if (daysLeft <= 3) return <Clock className="h-3.5 w-3.5" />
    return <Crown className="h-3.5 w-3.5" />
  }
  
  const getMessage = () => {
    if (daysLeft <= 0) {
      return `Your trial for ${organizationName || 'this organization'} has expired. Upgrade now to continue using Elevra.`
    }
    
    if (daysLeft <= 3) {
      return `Your trial for ${organizationName || 'this organization'} expires in ${timeLeft}. Upgrade now to avoid service interruption.`
    }
    
    return `Your trial for ${organizationName || 'this organization'} expires in ${timeLeft}. Upgrade anytime to unlock full features.`
  }
  
  return (
    <div 
      className={cn(
        "w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-50",
        className
      )}
    >
      <div className="container mx-auto px-6 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn(
              "flex items-center justify-center size-6 rounded-md",
              daysLeft <= 3 
                ? "bg-destructive/10 text-destructive"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}>
              {getIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {getMessage()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant={daysLeft <= 3 ? "destructive" : "default"}
              onClick={onUpgrade}
              className="h-7 px-3 text-xs shadow-xs"
            >
              <Crown className="h-3 w-3" />
              {daysLeft <= 0 ? 'Upgrade Now' : 'Upgrade'}
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-7 w-7 p-0"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}