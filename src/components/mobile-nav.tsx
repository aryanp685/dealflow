'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from './logo';

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="btn ghost sm mobile-nav-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        <span style={{
          width: '20px',
          height: '2px',
          background: 'var(--text)',
          transition: 'all 0.3s ease',
          transform: isOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none'
        }}></span>
        <span style={{
          width: '20px',
          height: '2px',
          background: 'var(--text)',
          transition: 'all 0.3s ease',
          opacity: isOpen ? 0 : 1
        }}></span>
        <span style={{
          width: '20px',
          height: '2px',
          background: 'var(--text)',
          transition: 'all 0.3s ease',
          transform: isOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none'
        }}></span>
      </button>

      {isOpen && (
        <div className="mobile-nav-overlay" onClick={() => setIsOpen(false)}>
          <nav className="mobile-nav" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-nav-header">
              <Logo size={24} />
              <span className="brand-name">DealFlow</span>
            </div>
            <div className="mobile-nav-links">
              <Link href="#problem" onClick={() => setIsOpen(false)}>The problem</Link>
              <Link href="#features" onClick={() => setIsOpen(false)}>Features</Link>
              <Link href="#tools" onClick={() => setIsOpen(false)}>Free tools</Link>
              <Link href="#pricing" onClick={() => setIsOpen(false)}>Pricing</Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}