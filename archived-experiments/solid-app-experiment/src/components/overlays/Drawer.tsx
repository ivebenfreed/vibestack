import { Component, JSXElement, Show, onMount, onCleanup, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: JSXElement;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
}

export const Drawer: Component<DrawerProps> = (props) => {
  const position = props.position || 'right';
  const size = props.size || 'md';
  const showCloseButton = props.showCloseButton !== false;
  const closeOnBackdrop = props.closeOnBackdrop !== false;
  const closeOnEsc = props.closeOnEsc !== false;
  const [isClient, setIsClient] = createSignal(false);
  
  const sizeClasses = {
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[32rem]',
  };
  
  onMount(() => {
    setIsClient(true);
    
    if (closeOnEsc) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && props.isOpen) {
          props.onClose();
        }
      };
      document.addEventListener('keydown', handleEsc);
      onCleanup(() => document.removeEventListener('keydown', handleEsc));
    }
  });
  
  return (
    <Show when={props.isOpen}>
      <Portal>
        <div class="fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            class="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => closeOnBackdrop && props.onClose()}
          />
          
          {/* Drawer */}
          <div 
            class={`fixed ${position === 'left' ? 'left-0' : 'right-0'} top-0 h-full bg-white dark:bg-gray-800 shadow-xl ${sizeClasses[size]} ${
              position === 'left' ? 'animate-slide-in' : 'animate-slide-in-right'
            }`}
          >
            {/* Header */}
            <Show when={props.title || showCloseButton}>
              <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-semibold">{props.title}</h3>
                <Show when={showCloseButton}>
                  <button
                    onClick={props.onClose}
                    class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </Show>
              </div>
            </Show>
            
            {/* Content */}
            <div class="p-4 h-full overflow-y-auto">
              {props.children}
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};