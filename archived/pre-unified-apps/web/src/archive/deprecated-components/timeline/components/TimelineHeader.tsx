import React from 'react'
import { Panel } from '@xyflow/react'
import { TimelineLayoutConfig } from '../utils/timelineLayout'
import { dateToX } from '../utils/timelineConstraints'

interface TimelineHeaderProps {
  config: TimelineLayoutConfig
}

export function TimelineHeader({ config }: TimelineHeaderProps) {
  // Generate time markers
  const generateTimeMarkers = () => {
    const markers: Array<{ date: Date; x: number; label: string; isToday: boolean }> = []
    const currentDate = new Date(config.startDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time for comparison
    
    while (currentDate <= config.endDate) {
      const x = dateToX(currentDate, config)
      const isToday = currentDate.getTime() === today.getTime()
      
      // Add weekly markers (Mondays)
      if (currentDate.getDay() === 1) {
        markers.push({
          date: new Date(currentDate),
          x,
          label: currentDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }),
          isToday
        })
      }
      
      // Always add today marker
      if (isToday) {
        markers.push({
          date: new Date(currentDate),
          x,
          label: 'Today',
          isToday: true
        })
      }
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return markers
  }

  const timeMarkers = generateTimeMarkers()

  return (
    <Panel position="top-center" className="w-full">
      <div className="relative h-12 bg-muted/80 backdrop-blur-sm border-b border-border">
        {/* Time scale container */}
        <div 
          className="relative h-full ml-48"
        >
          {/* Time markers */}
          {timeMarkers.map((marker, index) => (
            <div
              key={`${marker.date.toISOString()}-${index}`}
              className="absolute top-0 h-full flex flex-col items-center"
              style={{ left: marker.x }}
            >
              {/* Vertical line */}
              <div 
                className={`w-px h-full ${
                  marker.isToday 
                    ? 'bg-blue-500' 
                    : 'bg-border/40'
                }`}
              />
              
              {/* Date label */}
              <div 
                className={`absolute top-1 px-1.5 py-0.5 text-xs font-medium rounded ${
                  marker.isToday
                    ? 'bg-blue-500 text-white'
                    : 'bg-background/80 text-muted-foreground'
                } border shadow-sm`}
                style={{ transform: 'translateX(-50%)' }}
              >
                {marker.label}
              </div>
            </div>
          ))}
          
          {/* Current time indicator line (extends down into timeline) */}
          {(() => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const todayX = dateToX(today, config)
            
            return (
              <div
                className="absolute top-0 w-px bg-blue-500 opacity-30 pointer-events-none"
                style={{ 
                  left: todayX,
                  height: '200vh' // Extend down into timeline
                }}
              />
            )
          })()}
        </div>
        
        {/* Timeline scale info */}
        <div className="absolute top-1 left-4 text-xs text-muted-foreground font-medium">
          Timeline Scale: {config.pixelsPerDay}px/day
        </div>
        
        {/* Time range info */}
        <div className="absolute top-1 right-4 text-xs text-muted-foreground">
          {config.startDate.toLocaleDateString()} - {config.endDate.toLocaleDateString()}
        </div>
      </div>
    </Panel>
  )
}