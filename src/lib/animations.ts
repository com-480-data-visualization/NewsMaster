import { parseConfigFileTextToJson } from "typescript";

// Basic animation utilities without scroll control
export interface AnimationSection {
  id: string;
  element: HTMLElement;
  hasAnimated: boolean;
}

export class BasicAnimationController {
  private topEntitySpan: HTMLElement | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // Setup intersection observer for simple animations
    this.setupIntersectionObserver();
  }

  public registerTopEntitySpan(spanId: string) {
    this.topEntitySpan = document.getElementById(spanId);
    if (this.topEntitySpan) {
      this.topEntitySpan.classList.add('top-entity-span');
    }
  }

  private setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !entry.target.classList.contains('animated')) {
            entry.target.classList.add('section-visible', 'animated');
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: '0px 0px -20% 0px'
      }
    );

    // Observe all sections that might want animations
    const sections = document.querySelectorAll('section[id*="section"]');
    sections.forEach(section => {
      section.classList.add('section-hidden');
      observer.observe(section);
    });
  }

  private animateTopEntity() {
    if (!this.topEntitySpan) return;
    
    this.topEntitySpan.classList.add('entity-reveal');
    
    // Add typing effect
    const text = this.topEntitySpan.textContent || '';
    this.topEntitySpan.textContent = '';
    
    let i = 0;
    const typeInterval = setInterval(() => {
      if (i < text.length) {
        this.topEntitySpan!.textContent += text[i];
        i++;
      } else {
        clearInterval(typeInterval);
        this.topEntitySpan!.classList.add('entity-complete');
      }
    }, 80);
  }

  public updateTopEntity(newEntity: string) {
    if (!this.topEntitySpan) return;
    
    // Don't fade if it's the initial load (empty content)
    const isInitialLoad = !this.topEntitySpan.textContent?.trim();
    
    if (!isInitialLoad) {
      this.topEntitySpan.style.opacity = '0';
    }
    
    setTimeout(() => {
      this.topEntitySpan!.textContent = newEntity.toUpperCase();
      this.topEntitySpan!.style.opacity = '1';
      
      if (!isInitialLoad) {
        this.topEntitySpan!.classList.add('entity-update');
        
        setTimeout(() => {
          this.topEntitySpan!.classList.remove('entity-update');
        }, 500);
      }
      
      // Trigger animation after setting text
      this.animateTopEntity();
    }, isInitialLoad ? 0 : 200);
  }

  public destroy() {
    // Clean up any remaining classes
    const sections = document.querySelectorAll('.section-hidden, .section-visible');
    sections.forEach(section => {
      section.classList.remove('section-hidden', 'section-visible', 'section-jump');
    });
  }
}

// Simplified CSS styles without scroll indicators or one-page scroll behavior
export const animationStyles = `
  /* Section Animation States */
  .section-hidden {
    opacity: 0;
    transform: translateY(30px);
    transition: none;
  }

  .section-visible {
    opacity: 1;
    transform: translateY(0);
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* Top Entity Span Animations */
  .top-entity-span {
    position: relative;
    display: inline-block;
    transition: all 0.4s ease;
  }

  .entity-reveal {
    animation: entityReveal 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes entityReveal {
    0% {
      transform: scale(0.8) rotateX(-90deg);
      opacity: 0;
    }
    50% {
      transform: scale(1.1) rotateX(0deg);
      opacity: 0.8;
    }
    100% {
      transform: scale(1) rotateX(0deg);
      opacity: 1;
    }
  }

  .entity-complete {
    position: relative;
  }

  .entity-complete::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #ef4444, #f97316, #eab308);
    border-radius: 2px;
    animation: underlineGlow 2s infinite;
  }

  @keyframes underlineGlow {
    0%, 100% {
      box-shadow: 0 0 5px rgba(239, 68, 68, 0.5);
    }
    50% {
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.8), 0 0 30px rgba(249, 115, 22, 0.6);
    }
  }

  .entity-update {
    animation: entityUpdate 0.5s ease;
  }

  @keyframes entityUpdate {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  /* Mobile responsive animations */
  @media (max-width: 768px) {
    .section-hidden {
      transform: translateY(20px);
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .section-visible,
    .entity-reveal,
    .entity-update {
      animation: none;
      transition: none;
    }

    .section-hidden {
      opacity: 1;
      transform: none;
    }
  }
`; 