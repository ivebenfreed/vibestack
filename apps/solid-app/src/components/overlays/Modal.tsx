import { Component, JSXElement, Show, onMount, onCleanup, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: JSXElement;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
}

export const Modal: Component<ModalProps> = (props) => {
  const size = props.size || 'md';
  const showCloseButton = props.showCloseButton !== false;
  const closeOnBackdrop = props.closeOnBackdrop !== false;
  const closeOnEsc = props.closeOnEsc !== false;
  const [isClient, setIsClient] = createSignal(false);
  
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
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
        <div class="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            class="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => closeOnBackdrop && props.onClose()}
          />
          
          {/* Modal */}
          <div class="flex min-h-full items-center justify-center p-4">
            <div class={`relative bg-white dark:bg-gray-800 rounded-lg shadow-xl ${sizeClasses[size]} w-full animate-fade-in`}>
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
              <div class="p-4">
                {props.children}
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};