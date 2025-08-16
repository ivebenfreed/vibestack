import { Component, createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const [toasts, setToasts] = createSignal<ToastMessage[]>([]);

export const useToast = () => {
  const showToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString();
    const newToast: ToastMessage = {
      ...toast,
      id,
      duration: toast.duration || 5000,
    };
    
    setToasts(prev => [...prev, newToast]);
    
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  };
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  return { showToast, removeToast };
};

export const ToastContainer: Component = () => {
  const { removeToast } = useToast();
  
  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return (
          <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'info':
        return (
          <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };
  
  const getBgColor = (type: ToastType) => {
    switch (type) {
      case 'success': return 'bg-green-50 dark:bg-green-900/20';
      case 'error': return 'bg-red-50 dark:bg-red-900/20';
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'info': return 'bg-blue-50 dark:bg-blue-900/20';
    }
  };
  
  return (
    <Portal>
      <div class="fixed top-4 right-4 z-50 space-y-2">
        <For each={toasts()}>
          {(toast) => (
            <div
              class={`flex items-start gap-3 p-4 rounded-lg shadow-lg bg-white dark:bg-gray-800 border ${getBgColor(toast.type)} animate-fade-in max-w-sm`}
            >
              <div class="flex-shrink-0">
                {getIcon(toast.type)}
              </div>
              <div class="flex-1">
                <h4 class="font-medium text-gray-900 dark:text-white">{toast.title}</h4>
                <Show when={toast.message}>
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{toast.message}</p>
                </Show>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                class="flex-shrink-0 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </For>
      </div>
    </Portal>
  );
};