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
      <div class="scroll-progress"></div>
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

    this.updateScrollIndicator();
    
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

  private updateScrollIndicator() {
    if (!this.scrollIndicator) return;

    const sectionsContainer = this.scrollIndicator.querySelector('.scroll-sections');
    if (!sectionsContainer) return;

    sectionsContainer.innerHTML = '';
    
    this.sections.forEach((section, index) => {
      const dot = document.createElement('div');
      dot.className = `scroll-dot ${index === this.currentSectionIndex ? 'active' : ''}`;
      dot.addEventListener('click', () => this.scrollToSection(index));
      sectionsContainer.appendChild(dot);
    });

    // Update progress
    const progress = this.scrollIndicator.querySelector('.scroll-progress') as HTMLElement;
    if (progress) {
      const progressPercent = (this.currentSectionIndex / Math.max(this.sections.length - 1, 1)) * 100;
      progress.style.height = `${progressPercent}%`;
    }
  }

  private setupScrollListeners() {
    let scrollTimeout: NodeJS.Timeout;

    window.addEventListener('wheel', (e) => {
      if (this.isScrolling) {
        e.preventDefault();
        return;
      }

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (e.deltaY > 0) {
          this.nextSection();
        } else {
          this.previousSection();
        }
      }, 50);
    }, { passive: false });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (this.isScrolling) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          this.nextSection();
          break;
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          this.previousSection();
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
    const scrollPosition = elementTop - (this.headerHeight + 24); // 24px for some padding

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
    const isInitialLoad = !this.topEntitySpan.textContent.trim();
    
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
    gap: 10px;
  }

  .scroll-progress {
    width: 3px;
    height: 0%;
    background: linear-gradient(to bottom, #3b82f6, #8b5cf6);
    border-radius: 2px;
    transition: height 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
  }

  .scroll-progress::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 8px;
    height: 8px;
    background: #8b5cf6;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
  }

  .scroll-sections {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 20px;
  }

  .scroll-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    border: 2px solid rgba(255, 255, 255, 0.5);
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
  }

  .scroll-dot:hover {
    background: rgba(255, 255, 255, 0.6);
    transform: scale(1.2);
  }

  .scroll-dot.active {
    background: linear-gradient(45deg, #3b82f6, #8b5cf6);
    border-color: #8b5cf6;
    box-shadow: 0 0 15px rgba(139, 92, 246, 0.6);
    transform: scale(1.3);
  }

  /* Dark theme scroll indicator */
  .dark .scroll-dot {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .dark .scroll-dot:hover {
    background: rgba(255, 255, 255, 0.4);
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
      gap: 6px;
    }

    .scroll-progress {
      width: 2px;
    }

    .scroll-progress::before {
      width: 6px;
      height: 6px;
    }

    .scroll-dot {
      width: 6px;
      height: 6px;
    }

    .scroll-sections {
      gap: 6px;
      margin-top: 15px;
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

  /* Enhanced focus states for accessibility */
  .scroll-dot:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .section-visible,
    .section-jump,
    .entity-reveal,
    .entity-update,
    .scroll-progress,
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