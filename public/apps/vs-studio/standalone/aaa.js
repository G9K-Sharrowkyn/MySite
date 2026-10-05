document.addEventListener("DOMContentLoaded", () => {
    const SERVICES_DATA = [{
        src: "https://agiletech.pro/wp-content/uploads/2025/05/unDrawCards_1746767216215_gzqup8.webp",
        label: "Web Design",
        alt: "Architecture",
        description: "Custom websites that convert visitors into customers",
        features: ["Mobile-responsive design", "SEO optimization", "Fast loading speeds", "Content management", "Analytics integration"],
        premiumFeatures: ["Advanced parallax & scroll animations", "Custom CMS training & documentation"]
      },
      {
        src: "https://agiletech.pro/wp-content/uploads/2025/05/unDrawCards_1746764394864_j9xi27.webp",
        label: "Smart Home",
        alt: "Automation",
        description: "Intelligent automation for modern workspaces",
        features: ["Smart lighting systems", "Climate control", "Security integration", "Voice assistants", "Energy monitoring"],
        premiumFeatures: ["Automated routine programming", "Cross-platform device ecosystem"]
      },
      {
        src: "https://agiletech.pro/wp-content/uploads/2025/05/unDrawCards_1746767518443_0jaovr.webp",
        label: "IT Support",
        alt: "Infrastructure",
        description: "Reliable technology support when you need it most",
        features: ["24/7 remote support", "Proactive monitoring", "Help desk services", "System maintenance", "Backup solutions"],
        premiumFeatures: ["Priority 1-hour response SLA", "Dedicated technical account manager"]
      },
      {
        src: "https://agiletech.pro/wp-content/uploads/2025/05/unDrawCards_1746767504656_w9rbhj.webp",
        label: "Brand Identity",
        alt: "Identity",
        description: "Professional branding that makes you stand out",
        features: ["Logo design", "Brand guidelines", "Marketing materials", "Digital assets", "Brand strategy"],
        premiumFeatures: ["3D logo variations & mockups", "Animated brand motion graphics package"]
      },
      {
        src: "https://agiletech.pro/wp-content/uploads/2025/05/unDrawCards_1746764378514_shcthg-1.webp",
        label: "Cybersecurity",
        alt: "Defense",
        description: "Enterprise-grade security for small business budgets",
        features: ["Cloud security", "Data encryption", "Threat monitoring", "Compliance support", "Employee training"],
        premiumFeatures: ["Quarterly penetration testing", "24/7 SOC incident response team"]
      },
      {
        src: "https://agiletech.pro/wp-content/uploads/2025/05/image-1-1.webp",
        label: "Business Consulting",
        alt: "Consulting",
        description: "Strategic guidance for digital transformation",
        features: ["Technology planning", "Process optimization", "Digital strategy", "Cost analysis", "Growth planning"],
        premiumFeatures: ["Competitive market intelligence reports", "Custom ROI tracking dashboard"]
      },
      {
        src: "https://agiletech.pro/wp-content/uploads/2025/05/unDrawCards_1746833452707_6nkqdf.webp",
        label: "AI Solutions",
        alt: "Intelligence",
        description: "Smart automation to streamline your operations",
        features: ["Workflow automation", "AI chatbots", "Data analysis", "Process optimization", "Custom integrations"],
        premiumFeatures: ["Custom model training on your data", "Advanced predictive analytics engine"]
      },
      {
        src: "https://agiletech.pro/wp-content/uploads/2025/05/unDrawCards_1746833400232_of6avb.webp",
        label: "Custom Tools",
        alt: "Software",
        description: "Tailored solutions for unique business needs",
        features: ["Custom applications", "Database solutions", "API integrations", "Mobile apps", "System migrations"],
        premiumFeatures: ["Premium cloud hosting & CDN", "Ongoing maintenance & feature updates"]
      },
      {
        src: "https://agiletech.pro/wp-content/uploads/2025/05/unDrawCards_1746767343115_xe67z5.webp",
        label: "Digital Marketing",
        alt: "Growth",
        description: "Grow your audience and increase online visibility",
        features: ["SEO optimization", "Social media management", "Content marketing", "Email campaigns", "Analytics tracking"],
        premiumFeatures: ["Conversion rate optimization (CRO)", "Multi-platform retargeting campaigns"]
      }
    ];
    const CORE_SERVICES_DATA = [{
        title: 'IT Services',
        sub: 'Cut Costs by 70%',
        tagline: 'Strategic Engineering',
        head: 'Stop Overpaying',
        headStrong: 'For Technology',
        desc: 'Slash costs 70% while boosting performance and eliminating downtime headaches—all at a fraction of traditional costs. Our precision audit reveals hidden inefficiencies instantly.',
        cta: 'Learn More',
        link: '/it-services-technology-consulting',
        img: 'https://agiletech.pro/wp-content/uploads/2025/04/pzaat7ja5etl5mq0brlm.webp',
        visual: 'https://agiletech.pro/wp-content/uploads/2025/04/tech.webp'
      },
      {
        title: 'Branding',
        sub: 'Build Instant Trust',
        tagline: 'Identity Systems',
        head: 'Build Instant',
        headStrong: 'Market Trust',
        desc: 'Professional branding that builds instant trust and turns prospects into loyal customers. We craft visual identities that resonate with authority and precision.',
        cta: 'View Portfolio',
        link: '/branding-logo-design-services',
        img: 'https://agiletech.pro/wp-content/uploads/2025/04/jytro8ydec4534yy7bwj.webp',
        visual: 'https://agiletech.pro/wp-content/uploads/2025/02/undraw_choose-color_qtyu.svg'
      },
      {
        title: 'Web Development',
        sub: 'Convert Visitors',
        tagline: 'Digital Platforms',
        head: 'Turn Visitors',
        headStrong: 'Into Customers',
        desc: 'Websites that work as hard as you do. High-performance, SEO-optimized platforms built for growth, speed, and maximum conversion rates.',
        cta: 'Start Project',
        link: '/web-app-development-services',
        img: 'https://agiletech.pro/wp-content/uploads/2025/04/tmkru4jphap5wdmh1vwp.webp',
        visual: 'https://agiletech.pro/wp-content/uploads/2025/04/d5anxw8o4aqjkbg30dw7.webp'
      },
      {
        title: 'Smart Home',
        sub: 'Automate Everything',
        tagline: 'Automation Logic',
        head: 'Experience The',
        headStrong: 'Future Today',
        desc: 'Control everything from anywhere. Boost productivity and comfort while cutting energy costs with intelligent automation—all controlled at your fingertips.',
        cta: 'Explore Systems',
        link: '/smart-home-services',
        img: 'https://agiletech.pro/wp-content/uploads/2025/04/qrhjjrvxxrjtihsqzquy.webp',
        visual: 'https://agiletech.pro/wp-content/uploads/2025/04/de5ppwno0s1cex4jzdca.webp'
      },
      {
        title: 'AI Integration',
        sub: 'Automate & Accelerate',
        tagline: 'Neural Integration',
        head: 'Automate &',
        headStrong: 'Accelerate',
        desc: 'Let AI handle the repetitive work so you can focus on growth. Gain data-driven insights and stay ahead of competitors with tailored AI strategies.',
        cta: 'Initialize AI',
        link: '/ai-integration',
        img: 'https://agiletech.pro/wp-content/uploads/2025/04/esyjtfs3upjrxe50zvq7.webp',
        visual: 'https://agiletech.pro/wp-content/uploads/2025/04/undraw_two-factor-authentication_8tds-1.svg'
      }
    ];
    const TERMINAL_DATA = [{
        id: '01',
        type: 'cost-optimization',
        class: 'COST_OPTIMIZATION_ENGINE',
        label: 'COST_REDUCTION_COEFFICIENT',
        value: '70',
        unit: '%',
        title: 'Slash IT Costs',
        emp: 'by 70%',
        desc: 'Stop overpaying. Get enterprise-grade solutions at small business prices with guaranteed savings.',
        btn: {
          link: '#calculator-modal',
          class: 'btn btn-shiny-border calculator-trigger',
          text: 'Calculate Savings',
          icon: '<rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="16" y2="14"></line><line x1="8" y1="18" x2="12" y2="18"></line>'
        }
      },
      {
        id: '02',
        type: 'scalability-engine',
        class: 'SCALABILITY_ENGINE',
        label: 'GROWTH_ACCELERATION_INDEX',
        value: '∞',
        unit: '↑',
        title: 'Scale Without',
        emp: 'Headaches',
        desc: 'Focus on growing your business, not managing IT. We handle the complexity so you can grow.',
        progressClass: 'infinite-progress',
        btn: {
          link: '#gallery-section',
          class: 'btn btn-shiny-border',
          text: 'See Real Results',
          icon: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><path d="m21 15-5-5L5 21"></path>'
        }
      },
      {
        id: '03',
        type: 'reliability-matrix',
        class: 'RELIABILITY_MATRIX',
        label: 'UPTIME_GUARANTEE_INDEX',
        value: '99.9',
        unit: '%',
        title: 'Eliminate',
        emp: 'Downtime',
        desc: 'Sleep soundly knowing your systems are monitored 24/7. Our proactive approach prevents issues.',
        btn: {
          link: '#protection-section',
          class: 'btn btn-shiny-border',
          text: 'Ensure Reliability',
          icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'
        }
      }
    ];
    const STATS_DATA = [{
        value: 42000,
        suffix: "+",
        prefix: "$",
        label: "Average Annual Savings",
        context: "Stop overpaying for technology.",
        illustration: "https://agiletech.pro/wp-content/uploads/2025/05/undraw_transfer-money_h9s3.svg"
      },
      {
        value: "Zero",
        label: "Downtime Worries",
        context: "Sleep soundly with 24/7 monitoring.",
        illustration: "https://agiletech.pro/wp-content/uploads/2025/05/undraw_time-management_fedt.svg"
      },
      {
        value: 15,
        suffix: " min",
        label: "Response Guarantee",
        context: "Problems fixed fast, every time.",
        illustration: "https://agiletech.pro/wp-content/uploads/2025/05/undraw_fast-loading_ae60.svg"
      },
      {
        value: 99,
        suffix: "%",
        label: "Client Satisfaction",
        context: "Based on verified feedback.",
        illustration: "https://agiletech.pro/wp-content/uploads/2025/05/undraw_love-it_8pc0.svg"
      }
    ];
    const GALLERY_IMAGES = ["https://agiletech.pro/wp-content/uploads/2025/04/imageedit_37_5358811043.webp", "https://agiletech.pro/wp-content/uploads/2025/04/Tejas-Mobile-Veterinary-Services-1.webp", "https://agiletech.pro/wp-content/uploads/2025/04/imageedit_38_8322432003-1.webp", "https://agiletech.pro/wp-content/uploads/2025/04/imageedit_85_5545232879.webp", "https://agiletech.pro/wp-content/uploads/2025/04/Screensh1ot-2024-08-07-224039.jpg", "https://agiletech.pro/wp-content/uploads/2025/01/jherring2332_Flat_geometric_vector_graphic_logo_for_tech_compan_927548ad-4adc-4328-bbfa-893cb4988c10-e1745961845386.webp", "https://agiletech.pro/wp-content/uploads/2025/04/imageedit_78_9477860199.webp", "https://agiletech.pro/wp-content/uploads/2025/04/result-2.jpg", "https://agiletech.pro/wp-content/uploads/2025/02/new.png", "https://agiletech.pro/wp-content/uploads/2025/04/imageedit_65_6607528909.png", "https://agiletech.pro/wp-content/uploads/2025/04/original-a3f1b2fad2fc01bc2cef04b6a152c893-e1745371718270.webp", "https://agiletech.pro/wp-content/uploads/2025/04/rhr.webp"];
    const canvas = document.getElementById('fx-canvas');
    const ctx = canvas.getContext('2d', {
      alpha: true
    });
    const logoBtn = document.getElementById('logoContainer');
    const uiOverlay = document.getElementById('uiOverlay');
    const flashOverlay = document.getElementById('flashOverlay');
    const QUERY_PARAMS = new URLSearchParams(window.location.search);
    const EMBED_FIGHT_INTRO = QUERY_PARAMS.get('mode') === 'fight-intro';
    const INTRO_FLOW_MODE = QUERY_PARAMS.get('flow') === 'reverse' ? 'reverse' : 'forward';
    const REVERSE_EMBED_MODE = EMBED_FIGHT_INTRO && INTRO_FLOW_MODE === 'reverse';
    const PERF_BOOT_AT = performance.now();
    const PERF = {
      enabled: true,
      lastReportAt: PERF_BOOT_AT,
      frameCount: 0,
      frameTimeSum: 0,
      worstFrameMs: 0,
      slowFrames: 0,
      severeFrames: 0,
      marks: Object.create(null),
      holdPrimedLogged: false
    };
    window.__VSV_PERF = PERF;
    const perfLog = (event, payload = {}) => {
      if (!PERF.enabled) return;
      console.log('[VS-PERF]', event, payload);
    };
    const perfWarn = (event, payload = {}) => {
      if (!PERF.enabled) return;
      console.warn('[VS-PERF]', event, payload);
    };
    let relayMoveX = window.innerWidth * 0.5;
    let relayMoveY = window.innerHeight * 0.5;
    let disposePointerRelay = () => {};
    const postPointerRelay = (kind, x, y, down) => {
      if (!(window.parent && window.parent !== window)) return;
      window.parent.postMessage(
        {
          type: 'vvv-pointer-relay',
          source: 'intro',
          event: kind,
          x,
          y,
          down,
          timestamp: performance.now(),
        },
        window.location.origin,
      );
    };
    const bindPointerRelay = () => {
      if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        return () => {};
      }
      const root = document.documentElement;
      root.classList.add('vvv-parent-cursor');

      const onPointerMove = (event) => {
        relayMoveX = event.clientX;
        relayMoveY = event.clientY;
        postPointerRelay('move', relayMoveX, relayMoveY);
      };

      const onPointerDown = (event) => {
        relayMoveX = event.clientX;
        relayMoveY = event.clientY;
        postPointerRelay('down', relayMoveX, relayMoveY, true);
      };

      const onPointerUp = (event) => {
        relayMoveX = event.clientX;
        relayMoveY = event.clientY;
        postPointerRelay('up', relayMoveX, relayMoveY, false);
      };

      const onPointerLeave = () => {
        postPointerRelay('leave', relayMoveX, relayMoveY, false);
      };

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerdown', onPointerDown, { passive: true });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      window.addEventListener('pointercancel', onPointerUp, { passive: true });
      window.addEventListener('pointerleave', onPointerLeave, { passive: true });
      window.addEventListener('blur', onPointerLeave, { passive: true });

      return () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('pointerleave', onPointerLeave);
        window.removeEventListener('blur', onPointerLeave);
        root.classList.remove('vvv-parent-cursor');
      };
    };
    window.addEventListener('beforeunload', () => {
      disposePointerRelay();
    });
    const perfMarkStart = (label) => {
      if (!PERF.enabled) return;
      PERF.marks[label] = performance.now();
      perfLog(`mark-start:${label}`);
    };
    const perfMarkEnd = (label, payload = {}) => {
      if (!PERF.enabled) return;
      const startedAt = PERF.marks[label];
      if (!startedAt) return;
      const elapsedMs = performance.now() - startedAt;
      delete PERF.marks[label];
      perfLog(`mark-end:${label}`, { elapsedMs: Number(elapsedMs.toFixed(1)), ...payload });
    };
    perfLog('script-init', { embedFightIntro: EMBED_FIGHT_INTRO });
    window.addEventListener('load', () => {
      perfLog('window-load', { elapsedMs: Number((performance.now() - PERF_BOOT_AT).toFixed(1)) });
    });
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            perfWarn('long-task', {
              durationMs: Number(entry.duration.toFixed(1)),
              startTimeMs: Number(entry.startTime.toFixed(1))
            });
          }
        });
        longTaskObserver.observe({ type: 'longtask', buffered: true });
      } catch (_error) {}
    }
    if (EMBED_FIGHT_INTRO) {
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        Array.from(pageContainer.children).forEach((child) => {
          const element = child;
          const keep =
            element.classList?.contains('noise-overlay') ||
            element.classList?.contains('flash-overlay') ||
            element.id === 'fx-canvas' ||
            element.id === 'uiOverlay' ||
            element.id === 'logoContainer';
          if (!keep) {
            element.remove();
          }
        });
      }
      Array.from(document.body.children).forEach((child) => {
        const element = child;
        const keep =
          element.classList?.contains('svg-engine') ||
          element.classList?.contains('page-container') ||
          element.tagName === 'SCRIPT';
        if (!keep) {
          element.remove();
        }
      });
    }
    disposePointerRelay = bindPointerRelay();
    const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const notifyParentMessage = (message) => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, window.location.origin);
      }
    };
    const notifyParentIntroComplete = (messageType = 'vvv-aaa-complete') => {
      notifyParentMessage({ type: messageType });
    };
    const notifyParentIntroReady = () => {
      notifyParentMessage({ type: 'vvv-aaa-ready' });
    };
    const layerHolo = document.querySelector('.layer-holographic');
    const layerCyber = document.querySelector('.layer-cybernetic');
    const rings = document.querySelectorAll('.tech-ring');
    let width, height, cx, cy, dpr = 1;
    const ringRotation = [0, 0, 0, 0];
    function resize() {
      const maxDpr = EMBED_FIGHT_INTRO ? 1.75 : 2;
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const rect = document.body.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width / 2;
      cy = height / 2;
    }
    window.addEventListener('resize', resize);
    resize();
    let isHolding = false,
      holdStart = 0,
      sequenceActive = false,
      reverseSequenceActive = false,
      systemOnline = false;
    let manualPhysics = false,
      suctionMode = false,
      suctionStrength = 0;
    let warpFactor = 0.5,
      targetWarpFactor = 0.5,
      gravityActive = false;
    let lightningSpawnAccumulatorMs = 0;
    const HOLD_WARP_TARGET = 12;
    const HOLD_LIGHTNING_INTERVAL_MS = 120;
    const MAX_ACTIVE_LIGHTNING_BOLTS = 28;
    const STARS_COUNT = 800;
    const TAU = Math.PI * 2;
    const stars = [],
      debris = [],
      shockwaves = [],
      lightning = [];

    if (REVERSE_EMBED_MODE) {
      logoBtn.classList.remove('primed', 'calibrating', 'online');
      logoBtn.classList.add('locked');
      logoBtn.style.opacity = '0';
      uiOverlay.classList.remove('faded');
      flashOverlay.classList.remove('active');
      document.body.classList.remove('chromatic-impact');
    }

    const triggerReverseExplosionSequence = async () => {
      if (!EMBED_FIGHT_INTRO || sequenceActive || reverseSequenceActive || systemOnline) return;
      perfMarkStart('sequence-reverse');
      reverseSequenceActive = true;
      sequenceActive = true;
      manualPhysics = true;
      suctionMode = false;
      gravityActive = false;
      suctionStrength = 0;
      document.title = 'REVERSE: SINGULARITY RECOVERY';
      perfLog('sequence-reverse-start');
      const sequenceStartedAt = performance.now();
      const sequenceElapsed = () => Number((performance.now() - sequenceStartedAt).toFixed(1));

      logoBtn.classList.remove('calibrating', 'primed', 'online', 'vacuum-state', 'imploding', 'imploding-reverse');
      logoBtn.classList.add('locked');
      logoBtn.style.transition = 'none';
      logoBtn.style.opacity = '0';
      document.querySelectorAll('.tech-ring, .hint').forEach((el) => {
        el.style.opacity = '0';
      });
      uiOverlay.classList.add('faded');
      flashOverlay.classList.add('active');
      document.body.classList.add('chromatic-impact');
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * TAU;
        const dist = 600 * Math.random();
        createLightningBolt(cx, cy, dist, 8);
      }
      for (let s of stars) s.explode();
      for (let i = 0; i < 140; i++) {
        const angle = Math.random() * TAU,
          speed = Math.random() * 22 + 4;
        debris.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: Math.random() * 0.022 + 0.012,
          color: Math.random() > 0.35 ? "rgb(255,255,255)" : "rgb(0,255,255)",
          angle: Math.random() * TAU,
          spin: (Math.random() - 0.5) * 0.22
        });
      }
      shockwaves.push({
        size: 1,
        maxSize: Math.max(width, height) * 0.9,
        life: 1
      });
      await sleep(220);
      perfLog('sequence-reverse-phase', { phase: 'burst', elapsedMs: sequenceElapsed() });
      flashOverlay.classList.remove('active');
      document.body.classList.remove('chromatic-impact');

      logoBtn.classList.add('vacuum-state', 'imploding', 'imploding-reverse');
      logoBtn.style.transition = 'opacity 260ms ease-out';
      logoBtn.style.opacity = '1';
      await sleep(180);
      perfLog('sequence-reverse-phase', { phase: 'logo-return', elapsedMs: sequenceElapsed() });

      await sleep(200);
      perfLog('sequence-reverse-phase', { phase: 'implosion-rewind', elapsedMs: sequenceElapsed() });

      logoBtn.classList.remove('imploding', 'imploding-reverse');
      suctionMode = true;
      suctionStrength = 0.08;
      await sleep(1100);
      perfLog('sequence-reverse-phase', { phase: 'vacuum-release', elapsedMs: sequenceElapsed() });

      suctionMode = false;
      manualPhysics = false;
      warpFactor = 0.5;
      targetWarpFactor = 0.5;
      logoBtn.classList.remove('vacuum-state', 'locked');
      document.querySelectorAll('.tech-ring, .hint').forEach((el) => {
        el.style.opacity = '';
      });
      uiOverlay.classList.remove('faded');
      logoBtn.style.transition = 'opacity 400ms ease-out';
      logoBtn.style.opacity = EMBED_FIGHT_INTRO ? '0.85' : '1';
      await sleep(400);
      perfLog('sequence-reverse-phase', { phase: 'final-settle', elapsedMs: sequenceElapsed() });

      logoBtn.style.transition = '';
      if (REVERSE_EMBED_MODE) {
        logoBtn.style.removeProperty('opacity');
      }
      sequenceActive = false;
      reverseSequenceActive = false;
      perfMarkEnd('sequence-reverse', { mode: 'embed-intro', elapsedMs: sequenceElapsed() });
      notifyParentIntroComplete('vvv-aaa-reverse-explosion-done');
    };

    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || typeof payload !== 'object') return;
      if (payload.type !== 'vvv-aaa-play-reverse-explosion') return;
      if (!EMBED_FIGHT_INTRO || sequenceActive || systemOnline) return;
      void triggerReverseExplosionSequence();
    });
    if (EMBED_FIGHT_INTRO) {
      window.requestAnimationFrame(() => {
        notifyParentIntroReady();
      });
    }
    class Star {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.z = Math.random() * width;
        this.size = Math.random() * 1.5;
        this.px = 0;
        this.py = 0;
        this.alpha = 1;
        this.isExploding = false;
        this.vx = 0;
        this.vy = 0;
        this.wobblePhase = Math.random() * TAU;
        this.twinkleSpeed = 0.05 + Math.random() * 0.1;
        this.twinkleVal = Math.random() * TAU;
        this.color = Math.random() > 0.8 ? "200, 255, 255" : "255, 255, 255";
      }
      explode() {
        this.isExploding = true;
        const angle = Math.atan2(this.y - cy, this.x - cx);
        const speed = 15 + 30 * Math.random();
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        const zVal = (this.z > 1) ? this.z : 1;
        this.px = (this.x - cx) * (128.0 / zVal) + cx;
        this.py = (this.y - cy) * (128.0 / zVal) + cy;
        this.x = this.px;
        this.y = this.py;
      }
      update(dt) {
        this.twinkleVal += this.twinkleSpeed * dt;
        if (this.isExploding) {
          this.x += this.vx * dt;
          this.y += this.vy * dt;
          this.vx *= Math.pow(0.95, dt);
          this.vy *= Math.pow(0.95, dt);
          this.alpha *= Math.pow(0.94, dt);
          return;
        }
        if (suctionMode) {
          const dx = cx - this.x,
            dy = cy - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const pullFactor = ((suctionStrength * 50) / (dist + 10) + (suctionStrength * 0.05)) * dt;
          this.x += dx * pullFactor - (dy * 0.04 * dt);
          this.y += dy * pullFactor + (dx * 0.04 * dt);
          if (dist < 10) {
            const angle = Math.random() * TAU,
              r = Math.max(width, height) * 0.8;
            this.x = cx + Math.cos(angle) * r;
            this.y = cy + Math.sin(angle) * r;
            this.z = Math.random() * width;
          }
          const k = 128.0 / (this.z > 0 ? this.z : 1);
          this.px = (this.x - cx) * k + cx;
          this.py = (this.y - cy) * k + cy;
        } else {
          this.z -= warpFactor * dt;
          if (this.z <= 1 || this.z > width * 1.5) {
            this.z = (this.z <= 1) ? width : 2;
            this.x = Math.random() * width;
            this.y = Math.random() * height;
          }
          let wobbleX = 0,
            wobbleY = 0;
          if (isHolding && !sequenceActive) {
            const wobbleAmount = Math.min((performance.now() - holdStart) / 1000, 1) * 2;
            this.wobblePhase += 0.2 * dt;
            wobbleX = Math.sin(this.wobblePhase) * wobbleAmount;
            wobbleY = Math.cos(this.wobblePhase) * wobbleAmount;
          }
          const k = 128.0 / (this.z > 0 ? this.z : 1);
          this.px = ((this.x - cx) * k + cx) + wobbleX;
          this.py = ((this.y - cy) * k + cy) + wobbleY;
        }
      }
    }
    for (let i = 0; i < STARS_COUNT; i++) stars.push(new Star());
    function createLightningBolt(x, y, radius, segments) {
      let path = [{
        x: x,
        y: y
      }];
      const angle = Math.random() * TAU;
      const tx = x + Math.cos(angle) * radius;
      const ty = y + Math.sin(angle) * radius;
      const dist = Math.sqrt((tx - x) ** 2 + (ty - y) ** 2);
      for (let i = 0; i < segments; i++) {
        const progress = (i + 1) / segments;
        path.push({
          x: x + (tx - x) * progress + (Math.random() - 0.5) * (dist * 0.25),
          y: y + (ty - y) * progress + (Math.random() - 0.5) * (dist * 0.25)
        });
      }
      path.push({
        x: tx,
        y: ty
      });
      lightning.push({
        path,
        life: 1
      });
      if (lightning.length > MAX_ACTIVE_LIGHTNING_BOLTS) {
        lightning.shift();
      }
    }
    let lastTime = 0;
    function animate(time) {
      const dt = lastTime ? (time - lastTime) / 16.666 : 1;
      const frameMs = dt * 16.666;
      lastTime = time;
      ctx.clearRect(0, 0, width, height);
      const holdActive = isHolding && !sequenceActive && !systemOnline;
      if (holdActive) {
        lightningSpawnAccumulatorMs += frameMs;
        if (lightningSpawnAccumulatorMs >= HOLD_LIGHTNING_INTERVAL_MS) {
          lightningSpawnAccumulatorMs = Math.min(
            lightningSpawnAccumulatorMs - HOLD_LIGHTNING_INTERVAL_MS,
            HOLD_LIGHTNING_INTERVAL_MS,
          );
          createLightningBolt(cx, cy, 200, 5);
        }
      } else {
        lightningSpawnAccumulatorMs = 0;
      }
      if (!manualPhysics) warpFactor += (targetWarpFactor - warpFactor) * 0.08 * dt;
      if ((isHolding || sequenceActive) && !systemOnline) {
        const intensity = Math.min(100, Math.max(0, (warpFactor / 30) * 100));
        const fluctuateSpeed = 0.002 + (intensity * 0.0005);
        const mix = (Math.sin(time * fluctuateSpeed) + 1) / 2;
        layerHolo.style.setProperty('--holographic-intensity', intensity + (suctionMode ? Math.random() * 20 : 0));
        if (logoBtn.classList.contains('calibrating') || logoBtn.classList.contains('vacuum-state')) {
          layerHolo.style.opacity = mix;
          layerCyber.style.opacity = 1 - mix;
        }
      } else {
        layerHolo.style.opacity = '';
        layerCyber.style.opacity = '';
      }
      if (gravityActive && suctionMode) {
        suctionStrength *= Math.pow(1.06, dt);
      }
      if (!systemOnline) {
        const wave = Math.sin(time * 0.0015);
        const speedMult = isHolding ? 15 : (sequenceActive ? 40 : 1);
        ringRotation[0] += (0.2 + wave * 0.05) * speedMult * dt;
        ringRotation[1] -= (0.3 + wave * 0.02) * speedMult * dt;
        ringRotation[2] += (0.5 - wave * 0.04) * speedMult * dt;
        ringRotation[3] -= (0.1 + wave * 0.06) * speedMult * dt;
        ringRotation[0] %= 360;
        ringRotation[1] %= 360;
        ringRotation[2] %= 360;
        ringRotation[3] %= 360;
        for (let i = 0; i < 4; i++) rings[i].style.transform = `rotate(${ringRotation[i]}deg)`;
      }
      if (isHolding || sequenceActive) {
        const shake = isHolding ? Math.random() * 2 : 0;
        const gX = cx + shake,
          gY = cy + shake;
        const gradient = ctx.createRadialGradient(gX, gY, 10, gX, gY, 400);
        gradient.addColorStop(0, suctionMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 255, 255, 0.2)');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fillRect(gX - 400, gY - 400, 800, 800);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < STARS_COUNT; i++) {
        const s = stars[i];
        if (systemOnline && !s.isExploding) continue;
        s.update(dt);
        if (s.alpha <= 0.01 || s.px < -50 || s.px > width + 50 || s.py < -50 || s.py > height + 50) continue;
        const twinkleAlpha = 0.7 + 0.3 * Math.sin(s.twinkleVal);
        ctx.globalAlpha = s.alpha * twinkleAlpha;
        ctx.fillStyle = `rgb(${s.color})`;
        if (s.isExploding) {
          const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(Math.atan2(s.vy, s.vx));
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.min(speed * 3, 50), 1, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        } else if (suctionMode) {
          const dx = cx - s.px,
            dy = cy - s.py;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity = 1000 / (dist + 10);
          const stretch = Math.min(dist, suctionStrength * 50 * proximity);
          const angle = Math.atan2(dy, dx);
          ctx.strokeStyle = `rgba(${s.color}, ${Math.min(0.9, proximity/50)})`;
          ctx.lineWidth = Math.min(s.size, 2);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(s.px, s.py);
          ctx.quadraticCurveTo(s.px - Math.cos(angle) * stretch * 0.5 + (dy * 0.01), s.py - Math.sin(angle) * stretch * 0.5 - (dx * 0.01), s.px - Math.cos(angle) * stretch, s.py - Math.sin(angle) * stretch);
          ctx.stroke();
        } else {
          ctx.beginPath();
          if (s.size < 1.5) ctx.rect(s.px, s.py, s.size, s.size);
          else ctx.arc(s.px, s.py, s.size, 0, TAU);
          ctx.fill();
          const absWarp = Math.abs(warpFactor);
          const trailStride = holdActive ? (absWarp > 9 ? 3 : 2) : 1;
          if (absWarp > 5 && i % trailStride === 0) {
            ctx.beginPath();
            ctx.moveTo(s.px, s.py);
            const k2 = 128.0 / Math.max(1, s.z + (warpFactor * 2));
            ctx.lineTo((s.x - cx) * k2 + cx, (s.y - cy) * k2 + cy);
            ctx.strokeStyle = `rgba(${s.color}, ${s.alpha * 0.4})`;
            ctx.lineWidth = s.size;
            ctx.stroke();
          }
        }
      }
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= Math.pow(0.93, dt);
        d.vy *= Math.pow(0.93, dt);
        d.life -= d.decay * dt;
        d.angle += d.spin * dt;
        if (d.life <= 0) {
          debris.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = d.life;
        ctx.fillStyle = d.color;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.angle);
        ctx.beginPath();
        ctx.rect(-1.5, -1.5, 3, 3);
        ctx.fill();
        ctx.restore();
      }
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i];
        sw.size += (sw.maxSize - sw.size) * 0.15 * dt;
        sw.life -= 0.02 * dt;
        if (sw.life <= 0) {
          shockwaves.splice(i, 1);
          continue;
        }
        const drawRing = (offset, color) => {
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(0, sw.size + offset), 0, TAU);
          ctx.lineWidth = 40 * sw.life;
          ctx.strokeStyle = `rgba(${color}, ${sw.life * 0.8})`;
          ctx.stroke();
        };
        drawRing(10, '0, 255, 255');
        drawRing(-10, '255, 0, 0');
        drawRing(0, '255, 255, 255');
      }
      if (lightning.length > 0) {
        ctx.shadowBlur = holdActive ? 0 : 15;
        ctx.shadowColor = "#00ffff";
        ctx.lineWidth = 2;
        for (let i = lightning.length - 1; i >= 0; i--) {
          const bolt = lightning[i];
          bolt.life -= 0.1 * dt;
          if (bolt.life <= 0) {
            lightning.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = bolt.life;
          ctx.strokeStyle = `rgba(0, 255, 255, ${bolt.life})`;
          ctx.beginPath();
          ctx.moveTo(bolt.path[0].x, bolt.path[0].y);
          for (let p of bolt.path) ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
      if (isHolding && !sequenceActive && performance.now() - holdStart > 1200) {
        if (!logoBtn.classList.contains('primed')) {
          logoBtn.classList.add('primed');
          if (!PERF.holdPrimedLogged) {
            PERF.holdPrimedLogged = true;
            perfMarkEnd('hold', { result: 'primed' });
          }
        }
      }
      if (PERF.enabled) {
        PERF.frameCount += 1;
        PERF.frameTimeSum += frameMs;
        if (frameMs > PERF.worstFrameMs) PERF.worstFrameMs = frameMs;
        if (frameMs > 22) PERF.slowFrames += 1;
        if (frameMs > 40) PERF.severeFrames += 1;
        const reportWindowMs = time - PERF.lastReportAt;
        if (reportWindowMs >= 1000) {
          const fps = (PERF.frameCount * 1000) / reportWindowMs;
          const avgFrameMs = PERF.frameTimeSum / Math.max(1, PERF.frameCount);
          const usedHeapMb = typeof performance.memory !== 'undefined' ? Number((performance.memory.usedJSHeapSize / 1048576).toFixed(1)) : null;
          const totalHeapMb = typeof performance.memory !== 'undefined' ? Number((performance.memory.totalJSHeapSize / 1048576).toFixed(1)) : null;
          const report = {
            fps: Number(fps.toFixed(1)),
            avgFrameMs: Number(avgFrameMs.toFixed(2)),
            worstFrameMs: Number(PERF.worstFrameMs.toFixed(2)),
            slowFrames: PERF.slowFrames,
            severeFrames: PERF.severeFrames,
            warp: Number(warpFactor.toFixed(2)),
            holding: isHolding,
            sequenceActive,
            systemOnline,
            stars: STARS_COUNT,
            lightning: lightning.length,
            debris: debris.length,
            shockwaves: shockwaves.length,
            usedHeapMb,
            totalHeapMb
          };
          if (fps < 45 || PERF.severeFrames > 2) perfWarn('frame-report', report);
          else perfLog('frame-report', report);
          PERF.lastReportAt = time;
          PERF.frameCount = 0;
          PERF.frameTimeSum = 0;
          PERF.worstFrameMs = 0;
          PERF.slowFrames = 0;
          PERF.severeFrames = 0;
        }
      }
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
    const startHold = (e) => {
      if (REVERSE_EMBED_MODE) return;
      if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
      if (sequenceActive || systemOnline || isHolding) return;
      if (e && e.type !== 'keydown' && typeof e.preventDefault === 'function' && e.cancelable) {
        e.preventDefault();
      }
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) selection.removeAllRanges();
      }
      document.body.classList.add('vvv-no-select');
      isHolding = true;
      holdStart = performance.now();
      PERF.holdPrimedLogged = false;
      logoBtn.classList.add('calibrating');
      targetWarpFactor = HOLD_WARP_TARGET;
      document.title = "Initializing...";
      perfMarkStart('hold');
      perfLog('hold-start', { holdThresholdMs: 1200 });
      if (navigator.vibrate) navigator.vibrate(20);
    };
    const endHold = (e) => {
      if (REVERSE_EMBED_MODE) return;
      if (e.type === 'keyup' && e.key !== 'Enter' && e.key !== ' ') return;
      if (e && e.type !== 'keyup' && typeof e.preventDefault === 'function' && e.cancelable) {
        e.preventDefault();
      }
      document.body.classList.remove('vvv-no-select');
      if (!isHolding || sequenceActive || systemOnline) return;
      isHolding = false;
      logoBtn.classList.remove('calibrating');
      targetWarpFactor = 0.5;
      document.title = "System Initialization";
      const heldMs = performance.now() - holdStart;
      const shouldTrigger = heldMs > 1200;
      perfLog('hold-end', { heldMs: Number(heldMs.toFixed(1)), triggerSequence: shouldTrigger });
      if (shouldTrigger) triggerSequence();
      else {
        logoBtn.classList.remove('primed');
        perfMarkEnd('hold', { result: 'released' });
      }
    };
    ['mousedown', 'touchstart'].forEach(e => logoBtn.addEventListener(e, startHold, {
      passive: false
    }));
    ['mouseup', 'touchend'].forEach(e => window.addEventListener(e, endHold, {
      passive: true
    }));
    ['selectstart', 'dragstart'].forEach(e => logoBtn.addEventListener(e, (event) => {
      if (event.cancelable) event.preventDefault();
    }));
    logoBtn.addEventListener('keydown', startHold);
    logoBtn.addEventListener('keyup', endHold);
    async function triggerSequence() {
      perfMarkStart('sequence');
      document.body.classList.remove('vvv-no-select');
      sequenceActive = true;
      logoBtn.classList.remove('primed');
      logoBtn.classList.add('locked');
      manualPhysics = true;
      document.title = "WARNING: SINGULARITY";
      perfLog('sequence-start');
      const sequenceStartedAt = performance.now();
      const sequenceElapsed = () => Number((performance.now() - sequenceStartedAt).toFixed(1));
      const startT = performance.now();
      while (performance.now() - startT < 300) {
        warpFactor *= 0.85;
        if (Math.abs(warpFactor) < 0.1) warpFactor = 0;
        await new Promise(r => setTimeout(r, 16));
      }
      perfLog('sequence-phase', { phase: 'power-down', elapsedMs: sequenceElapsed() });
      warpFactor = 0;
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * TAU;
        const dist = 600 * Math.random();
        createLightningBolt(cx, cy, dist, 8);
      }
      await new Promise(r => setTimeout(r, 100));
      perfLog('sequence-phase', { phase: 'pre-vacuum-bolts', elapsedMs: sequenceElapsed() });
      logoBtn.classList.add('vacuum-state');
      suctionMode = true;
      suctionStrength = 0.1;
      gravityActive = true;
      await new Promise(r => setTimeout(r, 1100));
      perfLog('sequence-phase', { phase: 'vacuum', elapsedMs: sequenceElapsed() });
      gravityActive = false;
      logoBtn.classList.add('imploding');
      document.querySelectorAll('.tech-ring, .hint').forEach(el => el.style.opacity = '0');
      await new Promise(r => setTimeout(r, 200));
      perfLog('sequence-phase', { phase: 'implosion', elapsedMs: sequenceElapsed() });
      canvas.style.transform = `none`;
      flashOverlay.classList.add('active');
      document.body.classList.add('chromatic-impact');
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
      suctionMode = false;
      manualPhysics = false;
      warpFactor = 5;
      targetWarpFactor = 0.5;
      for (let s of stars) s.explode();
      for (let i = 0; i < 180; i++) {
        const angle = Math.random() * TAU,
          speed = Math.random() * 25 + 5;
        debris.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          decay: Math.random() * 0.02 + 0.01,
          color: Math.random() > 0.3 ? "rgb(255,255,255)" : "rgb(0,255,255)",
          angle: Math.random() * TAU,
          spin: (Math.random() - 0.5) * 0.2
        });
      }
      shockwaves.push({
        size: 1,
        maxSize: Math.max(width, height) * 0.9,
        life: 1
      });
      uiOverlay.classList.add('faded');
      logoBtn.style.opacity = '0';
      if (EMBED_FIGHT_INTRO) {
        await new Promise(r => setTimeout(r, 400));
        flashOverlay.classList.remove('active');
        document.body.classList.remove('chromatic-impact');
        perfMarkEnd('sequence', { mode: 'embed-intro', elapsedMs: sequenceElapsed() });
        notifyParentIntroComplete('vvv-aaa-complete');
        return;
      }
      await new Promise(r => setTimeout(r, 200));
      logoBtn.classList.remove('imploding', 'locked', 'vacuum-state');
      logoBtn.classList.add('online');
      document.title = "System Online";
      systemOnline = true;
      setTimeout(() => {
        flashOverlay.classList.remove('active');
        document.body.classList.remove('chromatic-impact');
      }, 300);
      await new Promise(r => setTimeout(r, 300));
      perfMarkEnd('sequence', { mode: 'full-page', elapsedMs: sequenceElapsed() });
      revealPageContent();
    }
    function revealPageContent() {
      logoBtn.style.transition = 'opacity 0.3s ease-out';
      logoBtn.style.opacity = '0';
      setTimeout(() => {
        document.body.classList.remove('pre-boot');
        const heroSection = document.querySelector('.hero');
        const trustBar = heroSection.querySelector('.trust-bar');
        if (heroSection && logoBtn && trustBar) {
          heroSection.insertBefore(logoBtn, trustBar);
          logoBtn.style.position = 'relative';
          logoBtn.style.top = 'auto';
          logoBtn.style.left = 'auto';
          logoBtn.style.margin = '0 auto 2rem';
          logoBtn.style.transform = 'none';
        }
        setTimeout(() => {
          logoBtn.style.transition = 'opacity 0.7s ease-in';
          logoBtn.style.opacity = '1';
          setTimeout(() => {
            logoBtn.style.transition = '';
          }, 600);
        }, 350);
        setTimeout(() => {
          document.querySelectorAll('.hero-heading, .carousel-wrapper, .hero-cta').forEach((el, i) => {
            if (el.style.opacity === "0" || el.style.opacity === "") {
              el.style.transition = `opacity 1s ease-out ${i * 0.1}s, transform 1s cubic-bezier(0.19, 1, 0.22, 1) ${i * 0.1}s`;
              el.style.opacity = "1";
              el.style.transform = "translateY(0)";
            }
          });
        }, 400);
      }, 300);
    }
    function rafThrottle(fn) {
      let id = null,
        lastArgs, lastThis;
      return function(...args) {
        lastArgs = args;
        lastThis = this;
        if (id) return;
        id = requestAnimationFrame(() => {
          id = null;
          fn.apply(lastThis, lastArgs);
        });
      };
    }
    class DashboardServices {
      constructor(selector) {
        this.root = document.querySelector(selector);
        if (!this.root) return;
        this.tabList = this.root.querySelector(".agile-services-tabs-list");
        this.panelContainer = this.root.querySelector(".agile-services-tabs-panels");
        this.init();
      }
      init() {
        this.render();
        this.setupTabs();
        this.setupEventListeners();
      }
      render() {
        this.tabList.innerHTML = CORE_SERVICES_DATA.map((s, i) => `
            <button class="agile-service-tab ${i === 0 ? 'active' : ''}" role="tab" aria-selected="${i === 0}" data-index="${i}">
              <div class="tab-depth-layer"></div>
              <div class="tab-content-layer">
                <div class="agile-service-icon"><img src="${s.img}" alt="${s.title}" loading="lazy" decoding="async"></div>
                <div class="agile-service-title-wrapper"><h3 class="agile-service-title">${s.title}</h3><p class="agile-service-preview">${s.sub}</p></div>
              </div>
            </button>`).join('');
        this.panelContainer.innerHTML = CORE_SERVICES_DATA.map((s, i) => `
            <div class="agile-service-panel ${i === 0 ? 'active' : ''}" role="tabpanel" data-index="${i}">
              <div class="panel-depth-layer"></div>
              <div class="agile-service-content">
                <div class="agile-service-info" data-index-display="0${i + 1}">
                  <h4 class="agile-service-tagline">${s.tagline}</h4>
                  <h3 class="heading-2 panel-title">${s.head}<strong>${s.headStrong}</strong></h3>
                  <p class="text-body">${s.desc}</p>
                  <a class="btn-inset" href="${s.link}"><div class="case-body layer"></div><div class="bezel layer"></div><div class="indices">${s.cta}</div><div class="sparks"></div></a>
                </div>
                <div class="agile-service-visual"><img src="${s.visual}" alt="${s.title}" loading="lazy" decoding="async"></div>
              </div>
            </div>`).join('');
      }
      setupTabs() {
        this.tabs = this.tabList.querySelectorAll(".agile-service-tab");
        this.panels = this.panelContainer.querySelectorAll(".agile-service-panel");
      }
      setupEventListeners() {
        this.tabs.forEach((tab, index) => {
          tab.addEventListener("click", () => this.switchTab(index));
          tab.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              this.switchTab(index);
            }
          });
        });
      }
      switchTab(index) {
        if (index < 0 || index >= this.tabs.length) return;
        this.tabs.forEach((tab, i) => {
          const isActive = i === index;
          tab.classList.toggle("active", isActive);
          tab.setAttribute("aria-selected", isActive);
        });
        this.panels.forEach((panel, i) => panel.classList.toggle("active", i === index));
        const activePanel = this.panels[index];
        if (activePanel) {
          activePanel.style.animation = "none";
          activePanel.offsetHeight;
          activePanel.style.animation = "";
        }
      }
    }
    class QuantumTerminalSystem {
      constructor() {
        this.container = document.getElementById("quantum-array");
        this.connectionField = document.getElementById("connection-field");
        if (this.container) this.init();
      }
      init() {
        this.render();
        this.terminals = this.container.querySelectorAll(".quantum-terminal-enhanced");
        this.initializeInteractions();
        this.initializeConnections();
      }
      render() {
        this.container.innerHTML = TERMINAL_DATA.map(t => `
            <article class="quantum-terminal-enhanced" data-terminal="${t.type}" data-quantum-id="${t.id}" tabindex="0">
              <div class="quantum-information-display">
                <header class="terminal-control-header">
                  <div class="terminal-identification"><span class="quantum-terminal-id">${t.id}</span>
                    <div class="system-diagnostics"><div class="diagnostic-indicator status-optimal"></div><span class="diagnostic-label">OPTIMAL</span></div>
                  </div>
                  <div class="terminal-classification"><span class="classification-label">${t.class}</span></div>
                </header>
                <div class="quantum-data-core">
                  <div class="primary-metric-display">
                    <div class="metric-context-label">${t.label}</div>
                    <div class="metric-visualization-container">
                      <div class="metric-hologram"><span class="metric-primary-value">${t.value}</span><span class="metric-unit-designation">${t.unit}</span></div>
                      <div class="metric-progress-architecture">
                        <div class="progress-substrate"></div><div class="progress-fill ${t.progressClass || ''}" style="${!t.progressClass ? '--progress-value:'+t.value+'%' : ''}"></div>
                      </div>
                    </div>
                  </div>
                  <div class="information-architecture">
                    <h3 class="quantum-terminal-title"><span class="title-primary">${t.title}</span><span class="title-emphasis">${t.emp}</span></h3>
                    <p class="quantum-information-description">${t.desc}</p>
                  </div>
                </div>
                <div class="quantum-interface-controls"><a class="${t.btn.class}" href="${t.btn.link}" role="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${t.btn.icon}</svg><span>${t.btn.text}</span></a></div>
              </div><span class="shine shine-top"></span><span class="shine shine-bottom"></span><span class="glow glow-top"></span><span class="glow glow-bottom"></span>
            </article>`).join('');
      }
      initializeInteractions() {
        const resetAllTerminals = () => {
          this.terminals.forEach(t => t.classList.remove("is-active"));
        };
        this.terminals.forEach(terminal => {
          terminal.addEventListener("click", e => {
            e.stopPropagation();
            const wasActive = terminal.classList.contains("is-active");
            resetAllTerminals();
            if (!wasActive) terminal.classList.add("is-active");
          });
        });
        document.addEventListener("click", () => {
          resetAllTerminals();
        });
      }
      initializeConnections() {
        if (!this.connectionField || this.terminals.length < 2) return;
        const calculateConnectionPath = (startEl, endEl) => {
          const startRect = startEl.getBoundingClientRect(),
            endRect = endEl.getBoundingClientRect(),
            fieldRect = this.connectionField.getBoundingClientRect();
          const startX = startRect.right - fieldRect.left,
            startY = startRect.top + startRect.height / 2 - fieldRect.top;
          const endX = endRect.left - fieldRect.left,
            endY = endRect.top + endRect.height / 2 - fieldRect.top;
          return `M ${startX} ${startY} C ${startX + (endX - startX) * .5} ${startY}, ${startX + (endX - startX) * .5} ${endY}, ${endX} ${endY}`;
        };
        const updateConnections = () => {
          this.connectionField.innerHTML = this.connectionField.querySelector("defs").outerHTML;
          if (window.innerWidth <= 768) return;
          for (let i = 0; i < this.terminals.length - 1; i++) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", calculateConnectionPath(this.terminals[i], this.terminals[i + 1]));
            path.setAttribute("stroke", `url(#${i % 2 === 0 ? "connection-primary" : "connection-secondary"})`);
            path.setAttribute("stroke-width", "2");
            path.setAttribute("fill", "none");
            path.setAttribute("filter", "url(#connection-glow)");
            const length = path.getTotalLength();
            path.style.strokeDasharray = length;
            path.style.strokeDashoffset = length;
            path.style.animation = `draw-line 2s ease-out ${i*.3}s forwards, flow-line 4s linear ${i*.3+2}s infinite`;
            this.connectionField.appendChild(path);
          }
        };
        if (!document.getElementById("svg-animations")) {
          const style = document.createElement("style");
          style.id = "svg-animations";
          style.innerHTML = `@keyframes draw-line { to { stroke-dashoffset: 0; } } @keyframes flow-line { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -200; } }`;
          document.head.appendChild(style);
        }
        updateConnections();
        window.addEventListener('resize', rafThrottle(updateConnections));
      }
    }
    class ExecutiveTechCarousel {
      constructor() {
        this.ring = document.querySelector(".ring");
        this.container = document.querySelector(".carousel-viewport");
        this.housing = document.querySelector(".carousel-housing");
        this.guide = document.querySelector(".interaction-guide");
        if (!this.ring || !this.container) return;
        this.numCards = SERVICES_DATA.length;
        this.angleStep = 360 / this.numCards;
        this.modalAnimation = null;
        this.currentIndex = 0;
        this.rotationY = 180;
        this.autoRotate = true;
        this.isDragging = false;
        this.init();
      }
      init() {
        this.createServiceCards();
        this.setupCarousel();
        this.setupEventListeners();
        this.setupModal();
      }
      createServiceCards() {
        const fragment = document.createDocumentFragment();
        const cardDims = this.getCardDimensions();
        SERVICES_DATA.forEach((service, index) => {
          const card = document.createElement("div");
          card.className = "service-card loading";
          card.dataset.serviceIndex = index;
          Object.assign(card.style, {
            width: `${cardDims.width}px`,
            height: `${cardDims.height}px`,
            marginLeft: `${-cardDims.width / 2}px`,
            marginTop: `${-cardDims.height / 2}px`
          });
          card.innerHTML = `<div class="card-loading"><div class="loading-indicator"></div></div><div class="card-content"><img class="card-image" src="${service.src}" alt="${service.alt}" loading="${index < 3 ? 'eager' : 'lazy'}" style="opacity: 0"/><div class="card-interface"><span class="service-label">${service.label}</span><span class="service-subtitle">${service.alt}</span></div></div>`;
          const img = card.querySelector(".card-image");
          const onImageReady = () => {
            card.classList.remove("loading");
            img.style.opacity = "1";
            const loader = card.querySelector(".card-loading");
            if (loader) loader.remove();
          };
          if (img.complete) {
            onImageReady();
          } else {
            img.onload = onImageReady;
            img.onerror = () => {
              card.classList.remove("loading");
              card.classList.add("fallback");
            };
          }
          card.addEventListener("click", () => {
            if (!this.isDragging) this.showModal(service);
          });
          fragment.appendChild(card);
        });
        this.ring.appendChild(fragment);
      }
      getCardDimensions() {
        const width = window.innerWidth;
        if (width < 500) return {
          width: 280,
          height: 380,
          translateZ: 400
        };
        if (width < 900) return {
          width: 300,
          height: 420,
          translateZ: 500
        };
        return {
          width: 340,
          height: 460,
          translateZ: 620
        };
      }
      setupCarousel() {
        const cardDims = this.getCardDimensions();
        this.container.style.perspective = `${cardDims.translateZ * 4}px`;
        if (typeof gsap !== "undefined") {
          gsap.set(this.ring, {
            rotationY: this.rotationY
          });
          Array.from(this.ring.children).forEach((card, i) => {
            gsap.set(card, {
              rotateY: i * -this.angleStep,
              transformOrigin: `50% 50% ${cardDims.translateZ}px`,
              z: -cardDims.translateZ
            });
          });
          gsap.to(this.ring.children, {
            opacity: 1,
            y: 0,
            duration: 1,
            stagger: 0.1,
            ease: "power2.out",
            delay: 0.5
          });
        }
        this.startAutoRotation();
      }
      setupEventListeners() {
        let startX = 0,
          lastX = 0;
        const onDragStart = (e) => {
          this.isDragging = true;
          this.stopAutoRotation();
          startX = (e.touches ? e.touches[0].clientX : e.clientX);
          lastX = startX;
        };
        const onDragMove = (e) => {
          if (!this.isDragging) return;
          const x = (e.touches ? e.touches[0].clientX : e.clientX);
          this.rotationY += (x - lastX) * 0.25;
          lastX = x;
          if (typeof gsap !== "undefined") gsap.set(this.ring, {
            rotationY: this.rotationY
          });
        };
        const onDragEnd = () => {
          this.isDragging = false;
          this.startAutoRotation();
        };
        this.container.addEventListener("pointerdown", onDragStart);
        window.addEventListener("pointermove", onDragMove);
        window.addEventListener("pointerup", onDragEnd);
      }
      startAutoRotation() {
        if (this.autoRotateFn) cancelAnimationFrame(this.autoRotateFn);
        const animate = () => {
          if (!this.isDragging && document.visibilityState === 'visible') {
            this.rotationY -= 0.04;
            if (typeof gsap !== "undefined") gsap.set(this.ring, {
              rotationY: this.rotationY
            });
          }
          this.autoRotateFn = requestAnimationFrame(animate);
        };
        this.autoRotateFn = requestAnimationFrame(animate);
      }
      stopAutoRotation() {
        cancelAnimationFrame(this.autoRotateFn);
      }
      setupModal() {
        this.modal = document.getElementById("servicePreview");
        if (!this.modal) return;
        const toggle = this.modal.querySelector(".switch__input");
        const toggleLabel = this.modal.querySelector(".premium-toggle-label");
        if (toggle && toggleLabel) {
          toggle.addEventListener("change", (e) => {
            const isChecked = e.target.checked;
            this.modal.classList.toggle("premium-active", isChecked);
            toggleLabel.textContent = isChecked ? "Premium" : "Standard";
            toggleLabel.classList.toggle("active", isChecked);
            this.togglePremiumFeatures(isChecked);
          });
        }
        this.modal.addEventListener("click", (e) => {
          if (e.target.closest(".btn-utility") || e.target.classList.contains("apple-modal-backdrop")) {
            this.modal.classList.remove("active");
            document.body.style.overflow = "";
          }
        });
      }
      togglePremiumFeatures(showPremium) {
        const standardItems = this.modal.querySelectorAll(".service-features .feature-item");
        const premiumPanel = this.modal.querySelector(".service-features-card.premium-panel");
        if (showPremium) {
          standardItems.forEach(item => item.classList.add("enhanced"));
          if (premiumPanel) premiumPanel.classList.add("visible");
        } else {
          standardItems.forEach(item => item.classList.remove("enhanced"));
          if (premiumPanel) premiumPanel.classList.remove("visible");
        }
      }
      addPremiumFeatures(modal, premiumFeatures) {
        const premiumPanel = modal.querySelector(".service-features-card.premium-panel");
        const premiumList = modal.querySelector("#premium-features-list");
        if (!premiumPanel || !premiumList) return;
        premiumList.innerHTML = premiumFeatures
          .map(feature => `
      <li class="feature-item feature-card-inset">
        <div class="check-icon"></div>
        <span>${feature}</span>
      </li>
    `)
          .join("");
        premiumPanel.classList.add("visible");
      }
      showModal(serviceData) {
        const modal = this.modal; // use consistent reference
        if (!modal) return;
        // Stop carousel rotation
        this.stopAutoRotation();
        // --- BASELINE RESET (Always Standard Mode) ---
        const toggle = modal.querySelector(".switch__input");
        const toggleLabel = modal.querySelector(".premium-toggle-label");
        const premiumPanel = modal.querySelector(".service-features-card.premium-panel");
        const premiumList = modal.querySelector("#premium-features-list");
        // Remove premium-active class
        modal.classList.remove("premium-active");
        // Reset toggle
        if (toggle) toggle.checked = false;
        // Reset toggle label
        if (toggleLabel) {
          toggleLabel.textContent = "Standard";
          toggleLabel.classList.remove("active");
        }
        // Reset premium panel
        if (premiumPanel) premiumPanel.classList.remove("visible");
        if (premiumList) premiumList.innerHTML = "";
        // Reset enhanced classes on standard items
        this.togglePremiumFeatures(false);
        // Hide separator
        const separator = modal.querySelector("#separator");
        if (separator) separator.classList.add("hidden");
        // --- POPULATE TEXT FIELDS ---
        modal.querySelector(".apple-service-title").textContent = serviceData.label;
        modal.querySelector(".apple-service-subtitle").textContent = serviceData.alt;
        modal.querySelector(".service-description").textContent = serviceData.description;
        // --- STANDARD FEATURES LIST ---
        const featuresContainer = modal.querySelector(".service-features");
        if (featuresContainer && serviceData.features) {
          featuresContainer.innerHTML = serviceData.features
            .map(feature => `
        <li class="feature-item feature-card-inset">
          <div class="check-icon"></div>
          <span>${feature}</span>
        </li>
      `)
            .join("");
        }
        // --- PREMIUM FEATURES ---
        if (serviceData.premiumFeatures?.length > 0) {
          this.addPremiumFeatures(modal, serviceData.premiumFeatures);
        }
        // --- ACTION BUTTON UPDATE ---
        const actionBtn = modal.querySelector(".apple-modal-actions .button");
        if (actionBtn) {
          const href = `#${serviceData.label.toLowerCase().replace(/\s+/g, "-")}-section`;
          actionBtn.setAttribute("href", href);
          const btnText = actionBtn.querySelector("span");
          if (btnText) btnText.textContent = "Explore Service";
        }
        // --- ACTIVATE MODAL ---
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        // --- ANIMATIONS ---
        if (typeof gsap !== "undefined") {
          gsap.fromTo(
            modal.querySelector(".apple-modal-backdrop"), {
              opacity: 0
            }, {
              opacity: 1,
              duration: 0.4
            }
          );
          gsap.fromTo(
            modal.querySelector(".apple-modal-container"), {
              opacity: 0,
              scale: 0.9,
              y: 50
            }, {
              opacity: 1,
              scale: 1,
              y: 0,
              duration: 0.6,
              ease: "elastic.out(1, 0.6)"
            }
          );
        }
      }
    }
    class StatisticsSliderTransplant {
      constructor(selector) {
        this.shell = document.querySelector(selector);
        if (!this.shell) return;
        this.slider = this.shell.querySelector(".slider");
        this.trail = this.shell.querySelector(".trail");
        this.progress = this.shell.querySelector("#progress");
        this.counter = this.shell.querySelector("#counter");
        this.init();
      }
      init() {
        this.slider.style.width = `${STATS_DATA.length * 100}%`;
        this.slider.innerHTML = STATS_DATA.map((s, i) => `
            <section class="box box${i + 1}" role="tabpanel">
              <div class="bg"></div>
              <div class="details">
                  <div class="stat-value">${s.prefix || ''}${s.value}${s.suffix || ''}</div>
                  <h1>${s.label}</h1>
                  <p>${s.context}</p>
                  <span><a href="#" class="btn btn-neon-glow calculator-trigger">Get Started</a></span>
              </div>
              <div class="illustration"><img src="${s.illustration}" alt="${s.label}" class="bubble" loading="lazy"></div>
            </section>
          `).join("");
        this.trail.innerHTML = STATS_DATA.map((_, i) => `<div role="tab" data-index="${i}">${i + 1}</div>`).join("");
        this.trail.style.gridTemplateColumns = `repeat(${STATS_DATA.length}, 1fr)`;
        this.ix = 0;
        this.moveToSlide(0);
        this.shell.querySelector("#next").addEventListener("click", () => this.moveToSlide(this.ix + 1));
        this.shell.querySelector("#prev").addEventListener("click", () => this.moveToSlide(this.ix - 1));
        setInterval(() => this.moveToSlide(this.ix + 1), 5000);
      }
      moveToSlide(newIndex) {
        this.ix = (newIndex + STATS_DATA.length) % STATS_DATA.length;
        this.slider.style.transform = `translateX(-${this.ix * (100 / STATS_DATA.length)}%)`;
        this.shell.querySelectorAll(".trail div").forEach((d, i) => d.classList.toggle("active", i === this.ix));
        this.shell.querySelectorAll(".box").forEach((box, i) => {
          box.classList.toggle("active-slide", i === this.ix);
        });
        this.counter.textContent = `${this.ix + 1} / ${STATS_DATA.length}`;
        this.progress.style.transition = 'none';
        this.progress.style.width = '0';
        setTimeout(() => {
          this.progress.style.transition = 'width 5s linear';
          this.progress.style.width = '100%';
        }, 50);
      }
    }
    class EnhancedTimeline {
      constructor(selector) {
        this.container = document.querySelector(selector);
        if (!this.container) return;
        this.steps = this.container.querySelectorAll(".timeline-step");
        this.panels = this.container.querySelectorAll(".timeline-panel");
        this.svg = this.container.querySelector(".timeline-svg-connector");
        this.tracePath = this.container.querySelector("#timeline-trace");
        this.traceGlowPath = this.container.querySelector("#timeline-trace-glow");
        this.currentStep = 0;
        this.chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
        this.init();
      }
      init() {
        window.addEventListener('resize', rafThrottle(() => this.drawLines()));
        this.steps.forEach((step, index) => {
          step.addEventListener('click', () => {
            this.activateStep(index);
          });
        });
        setTimeout(() => {
          this.drawLines();
          this.activateStep(0);
        }, 300);
      }
      drawLines() {
        if (!this.svg) return;
        this.svg.style.display = 'block';
        const svgRect = this.svg.getBoundingClientRect();
        const points = Array.from(this.steps).map(step => {
          const icon = step.querySelector('.module-icon-wrapper');
          const rect = icon.getBoundingClientRect();
          return {
            x: rect.left - svgRect.left + rect.width / 2,
            y: rect.top - svgRect.top + rect.height / 2
          };
        });
        if (points.length < 2) return;
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
        this.tracePath.setAttribute('d', d);
        this.traceGlowPath.setAttribute('d', d);
        this.pathTotalLength = this.traceGlowPath.getTotalLength();
        this.traceGlowPath.style.strokeDasharray = this.pathTotalLength;
        this.updateLineProgress(this.currentStep);
      }
      updateLineProgress(index) {
        if (!this.traceGlowPath || !this.pathTotalLength) return;
        const progress = index / (this.steps.length - 1);
        this.traceGlowPath.style.strokeDashoffset = this.pathTotalLength * (1 - progress);
      }
      scrambleText(element) {
        const finalText = element.getAttribute('data-final');
        if (!finalText) return;
        let iterations = 0;
        const interval = setInterval(() => {
          element.innerText = finalText.split("").map((letter, index) => {
            return index < iterations ? finalText[index] : this.chars[Math.floor(Math.random() * this.chars.length)];
          }).join("");
          if (iterations >= finalText.length) clearInterval(interval);
          iterations += 1 / 2;
        }, 30);
      }
      activateStep(index) {
        this.steps.forEach((step, i) => step.setAttribute('aria-selected', i === index));
        this.panels.forEach((panel, i) => {
          if (i === index) {
            panel.hidden = false;
            setTimeout(() => {
              panel.classList.add('active');
              const title = panel.querySelector('.panel-title');
              if (title) this.scrambleText(title);
            }, 50);
          } else {
            panel.classList.remove('active');
            setTimeout(() => panel.hidden = true, 600);
          }
        });
        this.updateLineProgress(index);
        this.currentStep = index;
      }
    }
    class AtmosphericGallery {
      constructor(selector, options = {}) {
        this.container = document.querySelector(selector);
        if (!this.container) return;
        this.columns = this.container.querySelectorAll(".gallery_line");
        this.activeCard = null;
        this.tapCooldown = false;
        this.imagesPerColumn = options.imagesPerColumn || 6;
        this.loopMultiplier = options.loopMultiplier || 2;
        this.sharedObserver = 'IntersectionObserver' in window ?
          new IntersectionObserver(this.onIntersect.bind(this), {
            rootMargin: '60px'
          }) :
          null;
        this.init();
      }
      init() {
        this.populate();
        document.addEventListener('click', (e) => {
          if (this.activeCard && !e.target.closest('.gallery-card-container')) {
            this.closeActiveCard();
          }
        });
        this.columns.forEach(column => {
          column.addEventListener('click', (e) => {
            if (this.tapCooldown) return;
            this.tapCooldown = true;
            setTimeout(() => (this.tapCooldown = false), 180);
            const card = e.target.closest('.gallery-card-container');
            if (!card) return;
            if (this.activeCard === card) {
              this.closeActiveCard();
              return;
            }
            if (this.activeCard) this.closeActiveCard();
            this.openCard(card, column);
          });
        });
      }
      openCard(card, column) {
        card.classList.add('is-active');
        this.activeCard = card;
        column.style.animationPlayState = "paused";
      }
      closeActiveCard() {
        if (!this.activeCard) return;
        const column = this.activeCard.closest('.gallery_line');
        if (column) column.style.animationPlayState = "running";
        this.activeCard.classList.remove('is-active');
        this.activeCard = null;
      }
      populate() {
        const imgs = GALLERY_IMAGES;
        const len = imgs.length;
        const colCount = this.columns.length;
        const total = this.imagesPerColumn * this.loopMultiplier;
        this.columns.forEach((column, colIndex) => {
          const fragment = document.createDocumentFragment();
          for (let i = 0; i < total; i++) {
            const src = imgs[(colIndex + i * colCount) % len];
            const card = document.createElement("div");
            card.className = "gallery-card-container";
            card.innerHTML = `
          <div class="holo-b-assembly">
            <div class="holo-content-b">
              <img src="${src}" alt="Portfolio showcase" loading="lazy" decoding="async">
            </div>
            <div class="info-plate">
              <div class="plate-title">Project Showcase</div>
              <div class="plate-meta">AgileTech Design</div>
            </div>
          </div>
        `;
            const img = card.firstElementChild.firstElementChild.firstElementChild;
            if (this.sharedObserver) {
              img.dataset.src = img.src;
              img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E';
              this.sharedObserver.observe(img);
            }
            fragment.appendChild(card);
          }
          column.innerHTML = "";
          column.appendChild(fragment);
        });
      }
      onIntersect(entries) {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          this.sharedObserver.unobserve(img);
        }
      }
    }
    class AppleCalculatorModalController {
      constructor() {
        this.modal = document.getElementById("calculator-modal");
        this.formData = {
          employees: 10,
          devices: 20,
          'current-cost': 50000,
          'support-cost': 10000
        };
        if (!this.modal) return;
        this.setupEventListeners();
        this.initSliders();
      }
      setupEventListeners() {
        this.modal.addEventListener("click", (e) => {
          if (e.target.closest(".btn-utility") || e.target.classList.contains("apple-modal-backdrop")) this.close();
        });
        document.querySelectorAll(".calculator-trigger").forEach(btn => btn.addEventListener("click", (e) => {
          e.preventDefault();
          this.open();
        }));
        this.modal.querySelector(".next-btn").addEventListener("click", () => this.nextStep());
        this.modal.querySelector(".back-btn").addEventListener("click", () => this.prevStep());
        this.modal.querySelector(".start-over-btn").addEventListener("click", () => this.reset());
      }
      initSliders() {
        this.modal.querySelectorAll(".slider-input").forEach(slider => {
          const update = () => {
            const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
            slider.style.setProperty("--progress-percent", `${pct}%`);
            const valDisplay = document.getElementById(`${slider.id}Value`);
            if (valDisplay) valDisplay.textContent = slider.id.includes("cost") ? `$${parseInt(slider.value).toLocaleString()}` : slider.value;
            this.formData[slider.id] = parseInt(slider.value);
          };
          slider.addEventListener("input", update);
          update();
        });
      }
      open() {
        this.modal.classList.add("active");
        document.body.style.overflow = "hidden";
        this.step = 1;
        this.updateUI();
      }
      close() {
        this.modal.classList.remove("active");
        document.body.style.overflow = "";
      }
      nextStep() {
        if (this.step < 3) {
          this.step++;
          this.updateUI();
          if (this.step === 3) this.calculate();
        }
      }
      prevStep() {
        if (this.step > 1) {
          this.step--;
          this.updateUI();
        }
      }
      reset() {
        this.step = 1;
        this.updateUI();
      }
      updateUI() {
        this.modal.querySelectorAll(".calc-step").forEach((el, i) => el.classList.toggle("active-step", i + 1 === this.step));
        this.modal.querySelector(".progress-indicators").style.setProperty("--active-step", this.step);
        this.modal.querySelectorAll(".progress-indicator").forEach((el, i) => el.classList.toggle("active", i + 1 === this.step));
        this.modal.querySelector(".back-btn").hidden = this.step === 1;
        this.modal.querySelector(".next-btn").hidden = this.step === 3;
        this.modal.querySelector(".start-over-btn").hidden = this.step !== 3;
      }
      calculate() {
        const totalCurrent = this.formData['current-cost'] + this.formData['support-cost'];
        const estimatedCost = (this.formData.employees * 120 * 12) + (this.formData.devices * 25 * 12) + 5000;
        const savings = Math.max(0, totalCurrent - estimatedCost);
        const savingsPercent = totalCurrent > 0 ? Math.round((savings / totalCurrent) * 100) : 0;
        document.getElementById("resultsGrid").innerHTML = `
                <div class="result-item"><div class="result-label">Current Cost</div><div class="result-value">$${totalCurrent.toLocaleString()}</div></div>
                <div class="result-item"><div class="result-label">Estimated Cost</div><div class="result-value">$${estimatedCost.toLocaleString()}</div></div>
                <div class="result-item savings"><div class="result-label">Potential Savings</div><div class="result-value">$${savings.toLocaleString()} <span style="font-size:0.8em">(${savingsPercent}%)</span></div></div>
            `;
      }
    }
    class FocusManager {
      constructor() {
        this.init();
      }
      init() {
        document.querySelectorAll('[role="dialog"]').forEach(modal => {
          modal.addEventListener("keydown", (e) => {
            if (e.key === "Tab") this.trapFocus(e, modal);
          });
        });
      }
      trapFocus(e, container) {
        const focusables = container.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    class ButtonTouchHandler {
      constructor() {
        this.pressTimers = new Map();
        document.querySelectorAll('.button, .btn-circuit-relay, .btn-utility, .btn-neon-edge, .btn-neon-glow, .btn-inset, .btn-shiny-border').forEach(btn => this.attachHandlers(btn));
      }
      attachHandlers(btn) {
        btn.addEventListener('pointerdown', (e) => this.onPointerDown(e, btn));
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => btn.addEventListener(evt, (e) => this.onPointerUp(e, btn)));
      }
      onPointerDown(e, btn) {
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('data-pressed', 'true');
        this.spawnSparks(btn);
      }
      onPointerUp(e, btn) {
        setTimeout(() => {
          btn.setAttribute('aria-pressed', 'false');
          btn.setAttribute('data-pressed', 'false');
        }, 120);
      }
      spawnSparks(btn) {
        const container = btn.querySelector('.sparks') || btn;
        for (let i = 0; i < 5; i++) {
          const spark = document.createElement('div');
          spark.className = 'spark';
          spark.style.cssText = `--dx:${Math.random()*100-50}px; --dy:${Math.random()*100-50}px; left:${Math.random()*100}%; top:${Math.random()*100}%; position:absolute; width:2px; height:2px; background:#0ff; pointer-events:none;`;
          container.appendChild(spark);
          if (typeof gsap !== 'undefined') {
            gsap.to(spark, {
              x: `random(-50, 50)`,
              y: `random(-50, 50)`,
              opacity: 0,
              duration: 0.5,
              onComplete: () => spark.remove()
            });
          } else {
            setTimeout(() => spark.remove(), 500);
          }
        }
      }
    }
    function initializeComponents() {
      new DashboardServices(".agile-services-tabs-layout");
      new QuantumTerminalSystem();
      new StatisticsSliderTransplant(".carousel-shell");
      new AtmosphericGallery(".gallery");
      new EnhancedTimeline(".process-timeline");
      new FocusManager();
      new ButtonTouchHandler();
      new AppleCalculatorModalController();
      const heroObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          new ExecutiveTechCarousel();
          heroObserver.disconnect();
        }
      });
      const hero = document.querySelector('.hero');
      if (hero) heroObserver.observe(hero);
    }
    if (!EMBED_FIGHT_INTRO) {
      initializeComponents();
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add("in-viewport");
        });
      }, {
        threshold: 0.1
      });
      document.querySelectorAll('.quantum-particle-system, .starry-background, .nebula-fog, .gallery_line').forEach(el => observer.observe(el));
    }
  });
