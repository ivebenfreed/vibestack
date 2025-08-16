import { createSignal } from "solid-js";

export default function Counter() {
  const [count, setCount] = createSignal(0);
  
  return (
    <div style="display: flex; align-items: center; gap: 1rem;">
      <button 
        class="button"
        onClick={() => setCount(count() - 1)}
      >
        -
      </button>
      <span style="font-size: 1.5rem; font-weight: bold; min-width: 3rem; text-align: center;">
        {count()}
      </span>
      <button 
        class="button"
        onClick={() => setCount(count() + 1)}
      >
        +
      </button>
      <button 
        class="button"
        onClick={() => setCount(0)}
        style="margin-left: 1rem;"
      >
        Reset
      </button>
    </div>
  );
}