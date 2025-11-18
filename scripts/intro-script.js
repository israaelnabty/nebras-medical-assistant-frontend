// =====================
// Initialization
// =====================
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    initializeAnimations();
});

// =====================
// Event Listeners
// =====================
function initializeEventListeners() {
    const getStartedBtn = document.getElementById('getStartedBtn');
    const launchChatBtn = document.getElementById('launchChatBtn');

    // Handle Get Started button
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', navigateToChatbot);
    }

    // Handle Launch Chat button
    if (launchChatBtn) {
        launchChatBtn.addEventListener('click', navigateToChatbot);
    }

    // Smooth scroll for any anchor links (if added later)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// =====================
// Navigation
// =====================
function navigateToChatbot() {
    // Add a fade-out animation before navigation
    document.body.style.transition = 'opacity 0.5s ease';
    document.body.style.opacity = '0';
    
    // Navigate to the main chatbot page after animation
    setTimeout(() => {
        window.location.href = 'chat.html';
    }, 500);
}

// =====================
// Animations
// =====================
function initializeAnimations() {
    // Intersection Observer for fade-in animations on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all feature cards
    document.querySelectorAll('.feature-card').forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `all 0.6s ease ${index * 0.1}s`;
        observer.observe(card);
    });

    // Observe steps
    document.querySelectorAll('.step').forEach((step, index) => {
        step.style.opacity = '0';
        step.style.transform = 'translateY(30px)';
        step.style.transition = `all 0.6s ease ${index * 0.2}s`;
        observer.observe(step);
    });

    // Observe disclaimer box
    const disclaimerBox = document.querySelector('.disclaimer-box');
    if (disclaimerBox) {
        disclaimerBox.style.opacity = '0';
        disclaimerBox.style.transform = 'scale(0.9)';
        disclaimerBox.style.transition = 'all 0.6s ease';
        observer.observe(disclaimerBox);
    }

    // Add visible class styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .visible {
            opacity: 1 !important;
            transform: translateY(0) scale(1) !important;
        }
    `;
    document.head.appendChild(style);
}

// =====================
// Particle Effect (Optional Enhancement)
// =====================
function createParticles() {
    const hero = document.querySelector('.hero');
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 4 + 2}px;
            height: ${Math.random() * 4 + 2}px;
            background: rgba(255, 255, 255, 0.5);
            border-radius: 50%;
            left: ${Math.random() * 100}%;
            top: ${Math.random() * 100}%;
            animation: float ${Math.random() * 10 + 10}s ease-in-out infinite;
            animation-delay: ${Math.random() * 5}s;
            pointer-events: none;
        `;
        hero.appendChild(particle);
    }
}

// Uncomment to enable particle effect
// createParticles();

// =====================
// Button Ripple Effect
// =====================
document.querySelectorAll('.cta-button').forEach(button => {
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            left: ${x}px;
            top: ${y}px;
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;

        // Add ripple animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ripple {
                0% {
                    transform: scale(0);
                    opacity: 1;
                }
                100% {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        if (!document.querySelector('#ripple-style')) {
            style.id = 'ripple-style';
            document.head.appendChild(style);
        }

        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);

        setTimeout(() => ripple.remove(), 600);
    });
});

// =====================
// Scroll Progress Indicator (Optional)
// =====================
function createScrollIndicator() {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 4px;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        z-index: 9999;
        transition: width 0.2s ease;
    `;
    document.body.appendChild(indicator);

    window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / windowHeight) * 100;
        indicator.style.width = scrolled + '%';
    });
}

// Uncomment to enable scroll progress indicator
createScrollIndicator();