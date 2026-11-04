import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function useMobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  const closeMenu = useCallback(() => setIsOpen(false), []);
  const toggleMenu = useCallback(() => setIsOpen((open) => !open), []);

  useEffect(() => {
    closeMenu();
  }, [location.key, closeMenu]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 861px)');
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) closeMenu();
    };

    desktop.addEventListener('change', handleViewportChange);
    return () => desktop.removeEventListener('change', handleViewportChange);
  }, [closeMenu]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        closeMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeMenu]);

  return { isOpen, headerRef, toggleRef, closeMenu, toggleMenu };
}
