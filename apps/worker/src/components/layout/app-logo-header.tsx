import React from 'react';

// SVG for "V" logo
const VLogo = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6"
  >
    <path
      d="M6 4L12 18L18 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface AppLogoHeaderProps {
  isCollapsed: boolean;
}

export function AppLogoHeader({ isCollapsed }: AppLogoHeaderProps) {
  // Removed excessive logging - uncomment below for debugging if needed
  // console.log('AppLogoHeader isCollapsed:', isCollapsed)
  
  return (
    <div className="flex items-center p-2" style={{ width: 'min-content' }}>
      <VLogo />
      {/* Multiple strategies to ensure the text is hidden when collapsed: */}
      {/* 1. Conditional rendering with React */}
      {/* 2. CSS display:none */}
      {/* 3. Zero width/height with overflow hidden */}
      {/* 4. Opacity 0 for transition effects */}
      <span
        className="font-semibold text-lg origin-left transition-all duration-200"
        style={{
          opacity: isCollapsed ? 0 : 1,
          maxWidth: isCollapsed ? 0 : '200px',
          overflow: 'hidden',
          marginLeft: isCollapsed ? 0 : '0.5rem',
          display: isCollapsed ? 'none' : 'inline',
          visibility: isCollapsed ? 'hidden' : 'visible'
        }}
      >
        Elevra
      </span>
    </div>
  );
}