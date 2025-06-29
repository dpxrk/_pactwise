"use client";

import React, { useEffect, useRef } from "react";

const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorInnerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  
  const cursorPosition = useRef({ x: 0, y: 0 });
  const cursorVelocity = useRef({ x: 0, y: 0 });
  const currentPosition = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Hide default cursor on desktop
    if (window.matchMedia('(pointer: fine)').matches) {
      document.body.style.cursor = 'none';
    }

    const updateCursorPosition = (e: MouseEvent) => {
      cursorPosition.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseEnter = () => {
      if (cursorRef.current && cursorInnerRef.current) {
        cursorRef.current.style.opacity = '1';
        cursorInnerRef.current.style.opacity = '1';
      }
    };

    const handleMouseLeave = () => {
      if (cursorRef.current && cursorInnerRef.current) {
        cursorRef.current.style.opacity = '0';
        cursorInnerRef.current.style.opacity = '0';
      }
    };

    // Add hover effect for interactive elements
    const addHoverEffect = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive = target.matches('a, button, input, textarea, select, [role="button"], [onclick]');
      
      if (cursorRef.current && cursorInnerRef.current) {
        if (isInteractive) {
          cursorRef.current.style.transform = `translate(${cursorPosition.current.x}px, ${cursorPosition.current.y}px) scale(1.5)`;
          cursorInnerRef.current.style.transform = 'scale(0.5)';
        } else {
          cursorRef.current.style.transform = `translate(${cursorPosition.current.x}px, ${cursorPosition.current.y}px) scale(1)`;
          cursorInnerRef.current.style.transform = 'scale(1)';
        }
      }
    };

    // Smooth animation loop
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        
        // Smooth following with easing
        const ease = 0.125;
        currentPosition.current.x += (cursorPosition.current.x - currentPosition.current.x) * ease;
        currentPosition.current.y += (cursorPosition.current.y - currentPosition.current.y) * ease;
        
        // Update cursor position
        if (cursorRef.current) {
          cursorRef.current.style.transform = `translate(${currentPosition.current.x}px, ${currentPosition.current.y}px)`;
        }
        
        if (cursorInnerRef.current) {
          cursorInnerRef.current.style.transform = `translate(${cursorPosition.current.x}px, ${cursorPosition.current.y}px)`;
        }
      }
      
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    // Event listeners
    window.addEventListener('mousemove', updateCursorPosition);
    window.addEventListener('mousemove', addHoverEffect);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);
    
    // Start animation
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', updateCursorPosition);
      window.removeEventListener('mousemove', addHoverEffect);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
      
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      
      // Restore default cursor
      document.body.style.cursor = 'auto';
    };
  }, []);

  // Don't render on mobile/touch devices
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return null;
  }

  return (
    <>
      {/* Outer cursor - follows with delay */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 w-8 h-8 pointer-events-none z-[9999] opacity-0 transition-opacity duration-300"
        style={{
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="absolute inset-0 rounded-full border border-purple-500/50 animate-pulse" />
      </div>
      
      {/* Inner cursor - follows immediately */}
      <div
        ref={cursorInnerRef}
        className="fixed top-0 left-0 w-2 h-2 pointer-events-none z-[10000] opacity-0 transition-all duration-150"
        style={{
          transform: 'translate(-50%, -50%)',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
      </div>
    </>
  );
};

export default CustomCursor;