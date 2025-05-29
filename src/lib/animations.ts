export interface AnimationSection {
  id: string;
  element: HTMLElement;
  hasAnimated: boolean;
}

export class ScrollAnimationController {
  private sections: AnimationSection[] = [];
  private currentSectionIndex = 0;
  private isScrolling = false;
  private scrollIndicator: HTMLElement | null = null;
  private topEntitySpan: HTMLElement | null = null;
  private headerHeight = 0;
  
  // Enhanced scroll detection properties
  private scrollAccumulator = 0;
  private scrollThreshold = 100;
  private lastScrollTime = 0;
  private scrollDirection = 0;
  private isTrackpad = false;
  private trackpadDetectionTimeout: NodeJS.Timeout | null = null;
  private momentumTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    // Calculate header height for proper offset
    this.calculateHeaderHeight();
    
    // Create scroll indicator
    this.createScrollIndicator();
    
    // Setup scroll event listeners
    this.setupScrollListeners();
    
    // Setup intersection observer for animations
    this.setupIntersectionObserver();
    
    // Detect trackpad vs mouse wheel
    this.detectInputDevice();
  }

  private detectInputDevice() {
    let wheelEventCount = 0;
    let wheelEventTime = 0;
    let consecutiveSmallDeltas = 0;
    
    const detectHandler = (e: WheelEvent) => {
      const now = Date.now();
      
      // Reset counter if too much time has passed
      if (now - wheelEventTime > 100) {
        wheelEventCount = 0;
        consecutiveSmallDeltas = 0;
      }
      
      wheelEventCount++;
      wheelEventTime = now;
      
      // Count small delta events (typical of trackpads)
      if (Math.abs(e.deltaY) < 30) {
        consecutiveSmallDeltas++;
      } else {
        consecutiveSmallDeltas = 0;
      }
      
      // Enhanced trackpad detection
      // Trackpads: many small events in quick succession with decimal values
      // Mouse wheels: fewer, larger events with integer values
      const hasDecimalDelta = e.deltaY % 1 !== 0;
      const isSmallDelta = Math.abs(e.deltaY) < 50;
      const isManyEvents = wheelEventCount > 3;
      const hasConsecutiveSmallDeltas = consecutiveSmallDeltas > 2;
      
      if ((hasDecimalDelta && isSmallDelta) || (isManyEvents && hasConsecutiveSmallDeltas)) {
        this.isTrackpad = true;
        this.scrollThreshold = 40; // Lower threshold for trackpads
      } else if (Math.abs(e.deltaY) > 80 && !hasDecimalDelta) {
        this.isTrackpad = false;
        this.scrollThreshold = 100; // Higher threshold for mouse wheels
      }
    };
    
    window.addEventListener('wheel', detectHandler, { passive: true });
    
    // Remove detection after 3 seconds
    setTimeout(() => {
      window.removeEventListener('wheel', detectHandler);
    }, 3000);
  }

  private calculateHeaderHeight() {
    const header = document.getElementById('top-header');
    
    if (header) {
      this.headerHeight = header.offsetHeight;
    }
    
    // Also account for main padding
    const main = document.querySelector('main');
    if (main) {
      const styles = window.getComputedStyle(main);
      const paddingTop = parseInt(styles.paddingTop) || 0;
      this.headerHeight += paddingTop;
    }
  }

  private createScrollIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'scroll-indicator';
    indicator.innerHTML = `
      <div class="scroll-sections"></div>
    `;
    document.body.appendChild(indicator);
    this.scrollIndicator = indicator;
  }

  public registerSections(sectionIds: string[]) {
    this.sections = sectionIds.map(id => {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`Section with id "${id}" not found`);
      }
      
      // Add initial hidden state
      element.classList.add('section-hidden');
      
      return {
        id,
        element,
        hasAnimated: false
      };
    });

    this.createScrollDots();
    
    // Trigger the first section animation with proper delay for layout
    setTimeout(() => {
      if (this.sections.length > 0) {
        // Scroll to first section properly first
        this.scrollToSection(0, false);
        // Then animate after a short delay
        setTimeout(() => {
          this.animateSection(this.sections[0]);
        }, 200);
      }
    }, 300);
  }

  public registerTopEntitySpan(spanId: string) {
    this.topEntitySpan = document.getElementById(spanId);
    if (this.topEntitySpan) {
      this.topEntitySpan.classList.add('top-entity-span');
    }
  }

  private createScrollDots() {
    if (!this.scrollIndicator) return;

    const sectionsContainer = this.scrollIndicator.querySelector('.scroll-sections');
    if (!sectionsContainer) return;

    // Clear existing dots
    sectionsContainer.innerHTML = '';
    
    // Create dots for each section
    this.sections.forEach((section, index) => {
      const dot = document.createElement('div');
      dot.className = 'scroll-dot';
      dot.setAttribute('data-section-index', index.toString());
      sectionsContainer.appendChild(dot);
    });

    // Set initial active state
    this.updateActiveScrollDot();
  }

  private updateActiveScrollDot() {
    if (!this.scrollIndicator) return;

    const dots = this.scrollIndicator.querySelectorAll('.scroll-dot');
    dots.forEach((dot, index) => {
      if (index === this.currentSectionIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  private updateScrollIndicator() {
    this.updateActiveScrollDot();
  }

  private setupScrollListeners() {
    let lastWheelEvent = 0;
    let scrollCooldown = false;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const now = Date.now();
      const timeDelta = now - lastWheelEvent;
      lastWheelEvent = now;
      
      // Skip if we're already scrolling to a section
      if (this.isScrolling) {
        return;
      }
      
      // Skip if we're in cooldown period
      if (scrollCooldown) {
        return;
      }
      
      // Determine scroll direction
      const direction = e.deltaY > 0 ? 1 : -1;
      
      // For trackpads, use accumulator approach with momentum detection
      if (this.isTrackpad) {
        // Reset accumulator if direction changed or too much time passed
        if (this.scrollDirection !== direction || timeDelta > 200) {
          this.scrollAccumulator = 0;
        }
        
        this.scrollDirection = direction;
        this.scrollAccumulator += Math.abs(e.deltaY);
        
        // Clear any existing momentum timeout
        if (this.momentumTimeout) {
          clearTimeout(this.momentumTimeout);
        }
        
        // Set momentum timeout to detect end of trackpad gesture
        this.momentumTimeout = setTimeout(() => {
          // If we have accumulated enough scroll, trigger section change
          if (this.scrollAccumulator >= this.scrollThreshold) {
            this.triggerSectionChange(direction);
            this.scrollAccumulator = 0;
            
            // Set cooldown to prevent rapid section changes
            scrollCooldown = true;
            setTimeout(() => {
              scrollCooldown = false;
            }, 700);
          } else {
            // Reset accumulator if threshold wasn't reached
            this.scrollAccumulator = 0;
          }
          this.momentumTimeout = null;
        }, 100); // Wait for momentum to settle
        
      } else {
        // For mouse wheels, use immediate response with debouncing
        if (timeDelta > 50) { // Debounce mouse wheel events
          this.triggerSectionChange(direction);
          
          // Set cooldown
          scrollCooldown = true;
          setTimeout(() => {
            scrollCooldown = false;
          }, 600);
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (this.isScrolling || scrollCooldown) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          this.triggerSectionChange(1);
          break;
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          this.triggerSectionChange(-1);
          break;
        case 'Home':
          e.preventDefault();
          this.scrollToSection(0);
          break;
        case 'End':
          e.preventDefault();
          this.scrollToSection(this.sections.length - 1);
          break;
      }
    });

    // Handle manual scrolling (when user scrolls normally)
    let manualScrollTimeout: NodeJS.Timeout;
    window.addEventListener('scroll', () => {
      // Clear any existing timeout
      clearTimeout(manualScrollTimeout);
      
      // Set a timeout to update current section after manual scrolling stops
      manualScrollTimeout = setTimeout(() => {
        if (!this.isScrolling) {
          this.updateCurrentSectionFromScroll();
        }
      }, 150);
    }, { passive: true });
  }

  private triggerSectionChange(direction: number) {
    if (direction > 0) {
      this.nextSection();
    } else {
      this.previousSection();
    }
  }

  private updateCurrentSectionFromScroll() {
    const scrollY = window.scrollY + this.headerHeight + 100; // Add some offset
    
    for (let i = 0; i < this.sections.length; i++) {
      const section = this.sections[i];
      const sectionTop = section.element.offsetTop;
      const sectionBottom = sectionTop + section.element.offsetHeight;
      
      if (scrollY >= sectionTop && scrollY < sectionBottom) {
        if (this.currentSectionIndex !== i) {
          this.currentSectionIndex = i;
          this.updateScrollIndicator();
        }
        break;
      }
    }
  }

  private setupIntersectionObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const section = this.sections.find(s => s.element === entry.target);
          if (section && entry.isIntersecting && !section.hasAnimated) {
            this.animateSection(section);
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: `-${this.headerHeight}px 0px -20% 0px`
      }
    );

    this.sections.forEach(section => {
      observer.observe(section.element);
    });
  }

  private animateSection(section: AnimationSection) {
    if (section.hasAnimated) return;

    section.hasAnimated = true;
    section.element.classList.remove('section-hidden');
    section.element.classList.add('section-visible', 'section-jump');

    // Trigger top entity animation if it exists, with delay for world map
    if (this.topEntitySpan && section.id === 'hero-section') {
      // Delay the entity animation to allow world map to load
      setTimeout(() => {
        this.animateTopEntity();
      }, 100);
    }

    // Remove jump class after animation
    setTimeout(() => {
      section.element.classList.remove('section-jump');
    }, 600);
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
    }, 80); // Slightly faster typing
  }

  public nextSection() {
    if (this.currentSectionIndex < this.sections.length - 1) {
      this.scrollToSection(this.currentSectionIndex + 1);
    }
  }

  public previousSection() {
    if (this.currentSectionIndex > 0) {
      this.scrollToSection(this.currentSectionIndex - 1);
    }
  }

  public scrollToSection(index: number, withAnimation = true) {
    if (index < 0 || index >= this.sections.length || this.isScrolling) return;

    this.isScrolling = true;
    this.currentSectionIndex = index;
    
    const targetSection = this.sections[index];
    const targetElement = targetSection.element;

    // Calculate proper scroll position accounting for header
    const elementTop = targetElement.offsetTop;
    const scrollPosition = elementTop - (this.headerHeight - 100); // 24px for some padding

    // Smooth scroll to section with proper offset
    window.scrollTo({
      top: scrollPosition,
      behavior: withAnimation ? 'smooth' : 'auto'
    });

    // Update indicator
    this.updateScrollIndicator();

    // Reset scrolling flag
    setTimeout(() => {
      this.isScrolling = false;
    }, 1000);

    // Trigger animation if not already animated
    if (!targetSection.hasAnimated && withAnimation) {
      setTimeout(() => {
        this.animateSection(targetSection);
      }, 300);
    }
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
    }, isInitialLoad ? 0 : 200);
  }

  public destroy() {
    if (this.scrollIndicator) {
      this.scrollIndicator.remove();
    }
    
    // Clear any pending timeouts
    if (this.trackpadDetectionTimeout) {
      clearTimeout(this.trackpadDetectionTimeout);
    }
    
    if (this.momentumTimeout) {
      clearTimeout(this.momentumTimeout);
    }
    
    this.sections.forEach(section => {
      section.element.classList.remove('section-hidden', 'section-visible', 'section-jump');
    });
  }
}

// CSS styles to be injected
export const animationStyles = `
  /* Scroll Indicator */
  .scroll-indicator {
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .scroll-sections {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 8px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .scroll-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(100, 116, 139, 0.4);
    border: 2px solid rgba(100, 116, 139, 0.6);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    pointer-events: none;
    cursor: pointer;
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.15),
      inset 0 1px 2px rgba(255, 255, 255, 0.2);
  }

  .scroll-dot::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(100, 116, 139, 0.3);
    transition: all 0.4s ease;
  }

  .scroll-dot:hover {
    transform: scale(1.1);
    background: rgba(100, 116, 139, 0.6);
    border-color: rgba(100, 116, 139, 0.8);
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.2),
      inset 0 1px 2px rgba(255, 255, 255, 0.3);
  }

  .scroll-dot.active {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-color: #6366f1;
    box-shadow: 
      0 0 20px rgba(99, 102, 241, 0.4),
      0 4px 16px rgba(59, 130, 246, 0.3),
      inset 0 1px 2px rgba(255, 255, 255, 0.4);
    transform: scale(1.2);
  }

  .scroll-dot.active::before {
    background: rgba(255, 255, 255, 0.9);
    width: 4px;
    height: 4px;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
  }

  /* Light mode specific styles */
  @media (prefers-color-scheme: light) {
    .scroll-sections {
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.1),
        0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .scroll-dot {
      background: rgba(71, 85, 105, 0.2);
      border: 2px solid rgba(71, 85, 105, 0.4);
      box-shadow: 
        0 2px 8px rgba(0, 0, 0, 0.1),
        inset 0 1px 2px rgba(255, 255, 255, 0.8);
    }

    .scroll-dot::before {
      background: rgba(71, 85, 105, 0.4);
    }

    .scroll-dot:hover {
      background: rgba(71, 85, 105, 0.3);
      border-color: rgba(71, 85, 105, 0.6);
      box-shadow: 
        0 4px 12px rgba(0, 0, 0, 0.15),
        inset 0 1px 2px rgba(255, 255, 255, 0.9);
    }

    .scroll-dot.active {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-color: #6366f1;
      box-shadow: 
        0 0 20px rgba(99, 102, 241, 0.3),
        0 4px 16px rgba(59, 130, 246, 0.2),
        inset 0 1px 2px rgba(255, 255, 255, 0.6);
    }
  }

  /* Dark theme scroll indicator */
  .dark .scroll-sections {
    background: rgba(15, 23, 42, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .dark .scroll-dot {
    background: rgba(148, 163, 184, 0.3);
    border: 2px solid rgba(148, 163, 184, 0.5);
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.3),
      inset 0 1px 2px rgba(255, 255, 255, 0.1);
  }

  .dark .scroll-dot::before {
    background: rgba(148, 163, 184, 0.4);
  }

  .dark .scroll-dot:hover {
    background: rgba(148, 163, 184, 0.5);
    border-color: rgba(148, 163, 184, 0.7);
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.4),
      inset 0 1px 2px rgba(255, 255, 255, 0.2);
  }

  .dark .scroll-dot.active {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-color: #a855f7;
    box-shadow: 
      0 0 25px rgba(168, 85, 247, 0.5),
      0 4px 20px rgba(59, 130, 246, 0.4),
      inset 0 1px 2px rgba(255, 255, 255, 0.3);
  }

  .dark .scroll-dot.active::before {
    background: rgba(255, 255, 255, 0.95);
    box-shadow: 0 0 10px rgba(255, 255, 255, 0.7);
  }

  /* Section Animation States */
  .section-hidden {
    opacity: 0;
    transform: translateY(60px);
    transition: none;
  }

  .section-visible {
    opacity: 1;
    transform: translateY(0);
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .section-jump {
    animation: sectionJump 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  @keyframes sectionJump {
    0% {
      transform: translateY(60px) scale(0.95);
      opacity: 0;
    }
    60% {
      transform: translateY(-10px) scale(1.02);
      opacity: 1;
    }
    100% {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
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

  /* Smooth scroll behavior */
  html {
    scroll-behavior: smooth;
  }

  /* Hide default scrollbar but keep functionality */
  body::-webkit-scrollbar {
    width: 0px;
    background: transparent;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .scroll-indicator {
      right: 10px;
    }

    .scroll-dot {
      width: 6px;
      height: 6px;
    }

    .scroll-sections {
      gap: 6px;
    }

    .section-jump {
      animation: sectionJumpMobile 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    @keyframes sectionJumpMobile {
      0% {
        transform: translateY(40px) scale(0.98);
        opacity: 0;
      }
      60% {
        transform: translateY(-5px) scale(1.01);
        opacity: 1;
      }
      100% {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .section-visible,
    .section-jump,
    .entity-reveal,
    .entity-update,
    .scroll-dot {
      animation: none;
      transition: none;
    }

    .section-hidden {
      opacity: 1;
      transform: none;
    }
  }
`; 