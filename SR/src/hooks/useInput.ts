import { useRef, useEffect } from 'react';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export function useInput(): React.MutableRefObject<InputState> {
  const input = useRef<InputState>({ left: false, right: false, jump: false });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA') input.current.left  = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') input.current.right = true;
      if (e.code === 'Space')                            input.current.jump  = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA') input.current.left  = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') input.current.right = false;
      if (e.code === 'Space')                            input.current.jump  = false;
    };
    const clear = () => {
      input.current.left = false;
      input.current.right = false;
      input.current.jump = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup',   up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup',   up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  return input;
}
