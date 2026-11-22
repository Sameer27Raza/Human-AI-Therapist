/**
 * Haven - Notes & Hand Gesture Controlled Reader
 * Touchless, page-by-page study notes viewer controlled by camera hand gestures.
 * Works seamlessly offline, on file://, desktop Electron, and Android mobile.
 * High-definition pre-rendered pages with touchless gesture navigation.
 */

(function () {
    'use strict';

    // Study Document Catalog
    const DOCUMENTS = {
        stats: {
            id: 'stats',
            title: 'Statistics Notebook — Chapters 2–14',
            subtitle: 'Chapter-Ordered Study Document · 8 Pages · Touchless Gesture Page Scrolling',
            pdfPath: 'documents/Statistics_Notebook_Chapters_2_14.pdf',
            pagesDir: 'documents/notes-pages/stats',
            totalPages: 8,
            downloadName: 'Statistics_Notebook_Chapters_2_14.pdf',
            chapters: [
                { page: 1, label: 'Ch 2: Moments & Kurtosis (p.1)' },
                { page: 2, label: 'Ch 3: Probability & Bayes (p.2)' },
                { page: 3, label: 'Ch 4–5: Random Var & Expectation (p.3)' },
                { page: 4, label: 'Ch 6–8: Distributions & Fitting (p.4)' },
                { page: 5, label: 'Ch 9–10: Sampling & Chi-Square (p.5)' },
                { page: 6, label: 'Ch 11–12: Correlation & Regression (p.6)' },
                { page: 7, label: 'Ch 13: Large Samples / Z-Test (p.7)' },
                { page: 8, label: 'Ch 14: Small Samples / t & F Tests (p.8)' }
            ]
        },
        cpp: {
            id: 'cpp',
            title: 'C++ Programming Basics — Complete Study Edition',
            subtitle: 'Student Learning Notes · 7 Pages · Touchless Gesture Page Scrolling',
            pdfPath: 'documents/CPP_Programming_Basics_Notes.pdf',
            pagesDir: 'documents/notes-pages/cpp',
            totalPages: 7,
            downloadName: 'CPP_Programming_Basics_Notes.pdf',
            chapters: [
                { page: 1, label: 'Ch 1: Syntax & I/O (p.1)' },
                { page: 2, label: 'Ch 2: Variables & Operators (p.2)' },
                { page: 3, label: 'Ch 3: Relational & If-Else (p.3)' },
                { page: 4, label: 'Ch 4: Loops & Iteration (p.4)' },
                { page: 5, label: 'Ch 5: Nested Loops & Patterns (p.5)' },
                { page: 6, label: 'Ch 6: Functions & References (p.6)' },
                { page: 7, label: 'Ch 7: Pointers & Addresses (p.7)' }
            ]
        }
    };

    class NotesGestureReader {
        constructor() {
            this.activeDocId = 'stats';
            this.activeDoc = DOCUMENTS.stats;
            this.currentPage = 1;
            this.totalPages = this.activeDoc.totalPages;
            this.zoomScale = 1.0;
            this.viewMode = 'page'; // 'page' or 'scroll'

            // Gesture tracking state
            this.gestureActive = false;
            this.history = [];
            this.cooldownUntil = 0;
            this.cooldownDuration = 850; // ms
            this.lastPose = null;
            this.poseFrameCount = 0;
            this.poseRequiredFrames = 2;
            this.isPaused = false;
            this.audioCtx = null;

            // Reader instances on the page
            this.readers = [];
        }

        init() {
            this.preloadImages();
            this.initReaders();
            this.bindGlobalKeyboard();
            this.switchDocument(this.activeDocId, false);
        }

        preloadImages() {
            Object.values(DOCUMENTS).forEach(doc => {
                for (let i = 1; i <= doc.totalPages; i++) {
                    const img = new Image();
                    img.src = `${doc.pagesDir}/page-${i}.png`;
                }
            });
        }

        initReaders() {
            const containers = document.querySelectorAll('.notes-reader-container');
            this.readers = Array.from(containers).map(container => this.setupReader(container));
        }

        setupReader(container) {
            const r = {
                container,
                docTabs: container.querySelectorAll('.notes-doc-tab') || document.querySelectorAll('.notes-doc-tab'),
                titleEl: container.querySelector('.notes-reader-title'),
                subtitleEl: container.querySelector('.notes-reader-subtitle'),
                downloadBtn: container.querySelector('.notes-download-btn'),
                pageImg: container.querySelector('.notes-page-image'),
                pageWrapper: container.querySelector('.notes-page-wrapper'),
                canvasStage: container.querySelector('.notes-canvas-stage'),
                scrollStage: container.querySelector('.notes-scroll-stage'),
                viewport: container.querySelector('.notes-viewport'),
                toast: container.querySelector('.notes-gesture-toast'),
                prevBtn: container.querySelector('.notes-prev-page'),
                nextBtn: container.querySelector('.notes-next-page'),
                pageInput: container.querySelector('.notes-page-input'),
                pageTotal: container.querySelector('.notes-page-total'),
                modePageBtn: container.querySelector('.notes-mode-page'),
                modeScrollBtn: container.querySelector('.notes-mode-scroll'),
                zoomInBtn: container.querySelector('.notes-zoom-in'),
                zoomOutBtn: container.querySelector('.notes-zoom-out'),
                zoomFitBtn: container.querySelector('.notes-zoom-fit'),
                zoomDisplay: container.querySelector('.notes-zoom-display'),
                cancelScrollBtn: container.querySelector('.notes-cancel-scroll-btn'),
                floatingCancelBanner: container.querySelector('.notes-scroll-floating-banner'),
                floatCancelBtn: container.querySelector('.notes-float-cancel-btn'),
                gestureToggleBtn: container.querySelector('.notes-gesture-toggle-btn'),
                pipWrapper: container.querySelector('.gesture-pip-wrapper'),
                pipVideo: container.querySelector('.gesture-pip-video'),
                pipCanvas: container.querySelector('.gesture-pip-canvas'),
                statusBadge: container.querySelector('.hud-status-badge'),
                statusIcon: container.querySelector('.hud-status-icon'),
                statusText: container.querySelector('.hud-status-text'),
                cooldownFill: container.querySelector('.hud-cooldown-fill'),
                fullscreenBtn: container.querySelector('.notes-fullscreen-btn'),
                chapterTagsContainer: container.querySelector('.notes-chapter-tags')
            };

            // Ensure pageImg exists
            if (r.pageWrapper && !r.pageImg) {
                let img = r.pageWrapper.querySelector('img');
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'notes-page-image';
                    r.pageWrapper.innerHTML = '';
                    r.pageWrapper.appendChild(img);
                }
                r.pageImg = img;
            }

            // Bind reader events
            r.prevBtn?.addEventListener('click', () => this.prevPage('manual'));
            r.nextBtn?.addEventListener('click', () => this.nextPage('manual'));

            r.pageInput?.addEventListener('change', (e) => {
                let p = parseInt(e.target.value, 10);
                if (isNaN(p) || p < 1) p = 1;
                if (p > this.totalPages) p = this.totalPages;
                this.goToPage(p, true);
            });

            r.modePageBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                this.setViewMode('page');
            });
            r.modeScrollBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleScrollMode();
            });
            r.cancelScrollBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                this.cancelContinuousScroll();
            });
            r.floatCancelBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                this.cancelContinuousScroll();
            });

            r.zoomInBtn?.addEventListener('click', () => this.setZoom(this.zoomScale + 0.15));
            r.zoomOutBtn?.addEventListener('click', () => this.setZoom(Math.max(0.6, this.zoomScale - 0.15)));
            r.zoomFitBtn?.addEventListener('click', () => this.fitToWidth());

            r.gestureToggleBtn?.addEventListener('click', () => this.toggleGestureTracking());
            r.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen(r.container));

            return r;
        }

        switchDocument(docId, shouldAnimate = true) {
            const doc = DOCUMENTS[docId] || DOCUMENTS.stats;
            this.activeDocId = doc.id;
            this.activeDoc = doc;
            this.totalPages = doc.totalPages;
            this.currentPage = 1;

            // Highlight active document switcher tab
            document.querySelectorAll('.notes-doc-tab').forEach(tab => {
                tab.classList.toggle('is-active', tab.dataset.doc === doc.id);
            });

            // Update UI headers, download buttons, chapter tags
            this.readers.forEach(r => {
                if (r.titleEl) r.titleEl.textContent = doc.title;
                if (r.subtitleEl) r.subtitleEl.textContent = doc.subtitle;
                if (r.downloadBtn) {
                    r.downloadBtn.href = doc.pdfPath;
                    r.downloadBtn.setAttribute('download', doc.downloadName);
                }
                if (r.pageInput) {
                    r.pageInput.min = '1';
                    r.pageInput.max = String(doc.totalPages);
                    r.pageInput.value = '1';
                }
                if (r.pageTotal) {
                    r.pageTotal.textContent = String(doc.totalPages);
                }

                // Render document-specific chapter tags
                if (r.chapterTagsContainer) {
                    r.chapterTagsContainer.innerHTML = '<span class="chapter-label">Quick Jump:</span>';
                    doc.chapters.forEach((ch, idx) => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = `chapter-tag ${idx === 0 ? 'is-active' : ''}`;
                        btn.dataset.page = ch.page;
                        btn.textContent = ch.label;
                        btn.addEventListener('click', () => {
                            this.goToPage(ch.page, true);
                        });
                        r.chapterTagsContainer.appendChild(btn);
                    });
                }

                // Setup scroll stage for this document
                this.setupScrollStage(r);
            });

            this.updateAllReaders(1, shouldAnimate, 'next');
        }

        setupScrollStage(r) {
            if (!r.scrollStage) return;
            r.scrollStage.innerHTML = '';

            for (let i = 1; i <= this.totalPages; i++) {
                const item = document.createElement('div');
                item.className = 'notes-scroll-page-item';
                item.id = `scroll-page-${this.activeDocId}-${i}`;
                item.dataset.page = i;

                const badge = document.createElement('span');
                badge.className = 'scroll-page-badge';
                badge.textContent = `Page ${i} of ${this.totalPages}`;

                const img = document.createElement('img');
                img.src = `${this.activeDoc.pagesDir}/page-${i}.png`;
                img.alt = `${this.activeDoc.title} Page ${i}`;
                img.loading = 'lazy';

                item.appendChild(badge);
                item.appendChild(img);
                r.scrollStage.appendChild(item);
            }

            const observer = new IntersectionObserver((entries) => {
                if (this.viewMode !== 'scroll') return;
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.intersectionRatio > 0.45) {
                        const pageNum = parseInt(entry.target.dataset.page, 10);
                        if (pageNum && pageNum !== this.currentPage) {
                            this.currentPage = pageNum;
                            this.syncInputsAndButtons();
                        }
                    }
                });
            }, {
                root: r.viewport,
                threshold: [0.45]
            });

            r.scrollStage.querySelectorAll('.notes-scroll-page-item').forEach(item => observer.observe(item));
        }

        updateAllReaders(pageNum, isAnimated = false, direction = 'next') {
            const pageSrc = `${this.activeDoc.pagesDir}/page-${pageNum}.png`;

            this.readers.forEach(r => {
                if (r.pageImg) {
                    r.pageImg.src = pageSrc;
                    r.pageImg.alt = `${this.activeDoc.title} Page ${pageNum}`;
                }

                if (isAnimated && r.pageWrapper) {
                    const animClass = (direction === 'next') ? 'page-slide-left' : 'page-slide-right';
                    r.pageWrapper.classList.remove('page-slide-left', 'page-slide-right');
                    void r.pageWrapper.offsetWidth;
                    r.pageWrapper.classList.add(animClass);
                }

                if (r.pageInput) r.pageInput.value = pageNum;
                if (r.pageTotal) r.pageTotal.textContent = this.totalPages;
                if (r.prevBtn) r.prevBtn.disabled = (pageNum <= 1);
                if (r.nextBtn) r.nextBtn.disabled = (pageNum >= this.totalPages);

                const tags = r.chapterTagsContainer?.querySelectorAll('.chapter-tag');
                tags?.forEach(tag => {
                    const tagPage = parseInt(tag.dataset.page, 10);
                    tag.classList.toggle('is-active', tagPage === pageNum);
                });

                if (this.viewMode === 'scroll') {
                    const item = r.scrollStage?.querySelector(`[data-page="${pageNum}"]`);
                    if (item && r.viewport) {
                        r.viewport.scrollTo({
                            top: item.offsetTop - (r.scrollStage.offsetTop || 0),
                            behavior: isAnimated ? 'smooth' : 'auto'
                        });
                    }
                } else {
                    if (r.viewport) {
                        r.viewport.scrollTop = 0;
                    }
                }
            });
        }

        syncInputsAndButtons() {
            this.readers.forEach(r => {
                if (r.pageInput) r.pageInput.value = this.currentPage;
                if (r.prevBtn) r.prevBtn.disabled = (this.currentPage <= 1);
                if (r.nextBtn) r.nextBtn.disabled = (this.currentPage >= this.totalPages);
                const tags = r.chapterTagsContainer?.querySelectorAll('.chapter-tag');
                tags?.forEach(tag => {
                    const tagPage = parseInt(tag.dataset.page, 10);
                    tag.classList.toggle('is-active', tagPage === this.currentPage);
                });
            });
        }

        setViewMode(mode) {
            this.viewMode = mode;
            this.readers.forEach(r => {
                if (r.modePageBtn) {
                    r.modePageBtn.classList.toggle('is-active', mode === 'page');
                    r.modePageBtn.setAttribute('aria-checked', mode === 'page' ? 'true' : 'false');
                }
                if (r.modeScrollBtn) {
                    r.modeScrollBtn.classList.toggle('is-active', mode === 'scroll');
                    r.modeScrollBtn.setAttribute('aria-checked', mode === 'scroll' ? 'true' : 'false');
                    r.modeScrollBtn.title = (mode === 'scroll')
                        ? 'Continuous Scroll Mode Active · Click again to Cancel and return to Page View'
                        : 'Continuous Page-wise Scroll Mode';
                }

                if (r.cancelScrollBtn) {
                    r.cancelScrollBtn.classList.toggle('is-visible', mode === 'scroll');
                    r.cancelScrollBtn.style.display = (mode === 'scroll') ? 'inline-flex' : 'none';
                }

                if (r.floatingCancelBanner) {
                    r.floatingCancelBanner.classList.toggle('is-visible', mode === 'scroll');
                    r.floatingCancelBanner.style.display = (mode === 'scroll') ? 'flex' : 'none';
                }

                if (mode === 'page') {
                    if (r.scrollStage) {
                        r.scrollStage.style.display = 'none';
                    }
                    if (r.canvasStage) {
                        r.canvasStage.style.display = 'flex';
                    }
                    if (r.viewport) {
                        r.viewport.scrollTop = 0;
                    }
                } else {
                    if (r.canvasStage) {
                        r.canvasStage.style.display = 'none';
                    }
                    if (r.scrollStage) {
                        r.scrollStage.style.display = 'flex';
                    }
                    const item = r.scrollStage?.querySelector(`[data-page="${this.currentPage}"]`);
                    if (item && r.viewport) {
                        r.viewport.scrollTo({
                            top: item.offsetTop - (r.scrollStage.offsetTop || 0),
                            behavior: 'auto'
                        });
                    }
                }
            });

            if (mode === 'page') {
                this.updateAllReaders(this.currentPage, false, 'next');
                this.syncInputsAndButtons();
            }
        }

        toggleScrollMode() {
            const now = Date.now();
            if (this._lastToggleTime && (now - this._lastToggleTime < 300)) return;
            this._lastToggleTime = now;

            if (this.viewMode === 'scroll') {
                this.cancelContinuousScroll();
            } else {
                this.setViewMode('scroll');
                this.showToastAll('next', '📜', 'Continuous Scroll Mode Active');
            }
        }

        cancelContinuousScroll() {
            if (this.viewMode === 'page') return;
            this.setViewMode('page');
            this.showToastAll('prev', '📖', 'Continuous Scroll Cancelled · Page View Restored');
        }

        setZoom(scale) {
            this.zoomScale = Math.round(scale * 100) / 100;
            const pctText = `${Math.round(this.zoomScale * 100)}%`;
            this.readers.forEach(r => {
                if (r.zoomDisplay) r.zoomDisplay.textContent = pctText;
                if (r.pageImg) {
                    r.pageImg.style.transform = `scale(${this.zoomScale})`;
                    r.pageImg.style.transformOrigin = 'top center';
                }
            });
        }

        fitToWidth() {
            this.setZoom(1.0);
        }

        toggleFullscreen(container) {
            if (!container) return;
            const isFull = container.classList.toggle('is-fullscreen');
            const btn = container.querySelector('.notes-fullscreen-btn');
            if (btn) btn.title = isFull ? 'Exit Fullscreen' : 'Fullscreen';
        }

        bindGlobalKeyboard() {
            window.addEventListener('keydown', (e) => {
                if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                const pageSection = document.getElementById('notes');
                const rect = pageSection?.getBoundingClientRect();
                const isPageSectionVisible = rect && rect.top < window.innerHeight && rect.bottom > 0;

                if (!isPageSectionVisible) return;

                if (e.key === 'Escape') {
                    if (this.viewMode === 'scroll') {
                        e.preventDefault();
                        this.cancelContinuousScroll();
                        return;
                    }
                }

                if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
                    e.preventDefault();
                    this.nextPage('keyboard');
                } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                    e.preventDefault();
                    this.prevPage('keyboard');
                }
            });
        }

        goToPage(pageNum, isAnimated = true, direction = 'next') {
            if (pageNum < 1) pageNum = 1;
            if (pageNum > this.totalPages) pageNum = this.totalPages;
            this.currentPage = pageNum;
            this.updateAllReaders(this.currentPage, isAnimated, direction);
        }

        nextPage(source = 'gesture') {
            if (this.currentPage < this.totalPages) {
                this.goToPage(this.currentPage + 1, true, 'next');
                return true;
            }
            return false;
        }

        prevPage(source = 'gesture') {
            if (this.currentPage > 1) {
                this.goToPage(this.currentPage - 1, true, 'prev');
                return true;
            }
            return false;
        }

        // ============================================================
        // HAND GESTURE INTEGRATION & RECOGNITION
        // ============================================================

        toggleGestureTracking() {
            if (window.AntigravityCamera) {
                if (window.AntigravityCamera.isActive()) {
                    window.AntigravityCamera.stop();
                } else {
                    window.AntigravityCamera.start();
                }
            } else {
                console.warn('AntigravityCamera is not initialized.');
            }
        }

        onCameraStateChange(isActive, stream) {
            this.gestureActive = isActive;
            this.readers.forEach(r => {
                if (r.gestureToggleBtn) {
                    r.gestureToggleBtn.classList.toggle('is-active', isActive);
                    const label = r.gestureToggleBtn.querySelector('.gesture-btn-label');
                    if (label) label.textContent = isActive ? 'Turn Gestures Off' : 'Enable Hand Gestures';
                }

                if (r.pipWrapper) {
                    r.pipWrapper.classList.toggle('is-live', isActive);
                }

                if (isActive && stream && r.pipVideo) {
                    r.pipVideo.srcObject = stream;
                    r.pipVideo.play().catch(() => {});
                    this.setReaderHudStatus(r, 'detecting', '✋', 'Hand gestures active — Show hand to flip pages');
                } else {
                    if (r.pipVideo) r.pipVideo.srcObject = null;
                    this.clearPipCanvas(r);
                    this.setReaderHudStatus(r, 'default', '✋', 'Camera Off · Turn on camera to control pages with hand gestures');
                }
            });
        }

        setReaderHudStatus(r, state, icon, text) {
            if (!r.statusBadge) return;
            r.statusBadge.className = 'hud-status-badge';
            if (state === 'detecting') r.statusBadge.classList.add('is-detecting');
            if (state === 'action') r.statusBadge.classList.add('is-action');
            if (state === 'paused') r.statusBadge.classList.add('is-paused');

            if (r.statusIcon) r.statusIcon.textContent = icon;
            if (r.statusText) r.statusText.textContent = text;
        }

        showToastAll(type, icon, text) {
            this.readers.forEach(r => {
                const toast = r.toast;
                if (!toast) return;
                toast.className = 'notes-gesture-toast';
                if (type === 'next') toast.classList.add('toast-next');
                if (type === 'prev') toast.classList.add('toast-prev');
                if (type === 'pause') toast.classList.add('toast-pause');

                toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${text}</span>`;
                toast.classList.add('show');
            });

            clearTimeout(this.toastTimeout);
            this.toastTimeout = setTimeout(() => {
                this.readers.forEach(r => r.toast?.classList.remove('show'));
            }, 1400);
        }

        playChime(type) {
            try {
                if (!this.audioCtx) {
                    const AudioCtor = window.AudioContext || window.webkitAudioContext;
                    if (AudioCtor) this.audioCtx = new AudioCtor();
                }
                if (!this.audioCtx) return;
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

                const now = this.audioCtx.currentTime;
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();

                osc.type = 'sine';
                if (type === 'next') {
                    osc.frequency.setValueAtTime(523.25, now);
                    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08);
                } else if (type === 'prev') {
                    osc.frequency.setValueAtTime(659.25, now);
                    osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.08);
                } else {
                    osc.frequency.setValueAtTime(440, now);
                }

                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start(now);
                osc.stop(now + 0.12);
            } catch (e) {}
        }

        triggerCooldown(now) {
            this.cooldownUntil = now + this.cooldownDuration;
            this.history = [];
            this.lastPose = null;
            this.poseFrameCount = 0;

            this.readers.forEach(r => {
                const fill = r.cooldownFill;
                if (fill) {
                    fill.classList.remove('cooling');
                    fill.style.width = '0%';
                    void fill.offsetWidth;
                    fill.classList.add('cooling');
                    fill.style.width = '100%';
                    setTimeout(() => {
                        fill.classList.remove('cooling');
                        fill.style.width = '0%';
                    }, this.cooldownDuration);
                }
            });
        }

        drawPipLandmarks(landmarks) {
            this.readers.forEach(r => {
                const canvas = r.pipCanvas;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                const w = canvas.width = canvas.clientWidth || 86;
                const h = canvas.height = canvas.clientHeight || 64;

                ctx.clearRect(0, 0, w, h);

                const tip = landmarks[8];
                if (tip) {
                    ctx.fillStyle = '#10b981';
                    ctx.beginPath();
                    ctx.arc((1 - tip.x) * w, tip.y * h, 5, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc((1 - tip.x) * w, tip.y * h, 8, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
        }

        clearPipCanvas(r) {
            const canvas = r?.pipCanvas;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        onNoHand() {
            if (this.gestureActive) {
                this.readers.forEach(r => {
                    this.clearPipCanvas(r);
                    this.setReaderHudStatus(r, 'detecting', '✋', 'Waiting for hand in camera frame…');
                });
                this.history = [];
            }
        }

        processLandmarks(landmarks, now) {
            if (!landmarks || !landmarks.length) {
                this.onNoHand();
                return;
            }

            this.drawPipLandmarks(landmarks);

            if (now < this.cooldownUntil) return;

            const wrist = landmarks[0];
            const mirroredX = 1 - wrist.x;
            const y = wrist.y;

            // 1. Dynamic Swipe Tracking
            this.history.push({ mx: mirroredX, y: y, time: now });
            this.history = this.history.filter(pt => now - pt.time <= 280);

            if (this.history.length >= 4) {
                const oldest = this.history[0];
                const dt = (now - oldest.time) / 1000;
                if (dt >= 0.08) {
                    const dmx = mirroredX - oldest.mx;
                    const dy = y - oldest.y;
                    const vx = dmx / dt;
                    const vy = dy / dt;

                    // Horizontal swipe
                    if (Math.abs(dmx) > 0.12 && Math.abs(vx) > 0.40) {
                        if (dmx > 0.12) {
                            this.executeGestureAction('next', 'Swipe Right', '👉', now);
                            return;
                        } else if (dmx < -0.12) {
                            this.executeGestureAction('prev', 'Swipe Left', '👈', now);
                            return;
                        }
                    }

                    // Vertical swipe
                    if (Math.abs(dy) > 0.14 && Math.abs(vy) > 0.48) {
                        if (dy < -0.14) {
                            this.executeGestureAction('next', 'Swipe Up', '👆', now);
                            return;
                        } else if (dy > 0.14) {
                            this.executeGestureAction('prev', 'Swipe Down', '👇', now);
                            return;
                        }
                    }
                }
            }

            // 2. Static Pose Gesture Classification
            const detectedPose = this.classifyHandPose(landmarks);

            if (detectedPose && detectedPose !== 'neutral') {
                if (detectedPose === this.lastPose) {
                    this.poseFrameCount++;
                } else {
                    this.lastPose = detectedPose;
                    this.poseFrameCount = 1;
                }

                if (this.poseFrameCount >= this.poseRequiredFrames) {
                    if (detectedPose === 'peace') {
                        this.executeGestureAction('next', 'Two Fingers (✌️)', '✌️', now);
                    } else if (detectedPose === 'point-right') {
                        this.executeGestureAction('next', 'Point Right (👉)', '👉', now);
                    } else if (detectedPose === 'thumbs-up') {
                        this.executeGestureAction('prev', 'Thumbs Up (👍)', '👍', now);
                    } else if (detectedPose === 'point-left') {
                        this.executeGestureAction('prev', 'Point Left (👈)', '👈', now);
                    } else if (detectedPose === 'fist') {
                        this.executeGestureAction('pause', 'Closed Fist', '✊', now);
                    }
                }
            } else {
                this.lastPose = null;
                this.poseFrameCount = 0;
                this.readers.forEach(r => {
                    this.setReaderHudStatus(r, 'detecting', '✋', 'Hand detected — Ready to flip page');
                });
            }
        }

        classifyHandPose(landmarks) {
            const wrist = landmarks[0];

            const isExtended = (tipIdx, pipIdx, mcpIdx) => {
                const tip = landmarks[tipIdx];
                const pip = landmarks[pipIdx];
                const mcp = landmarks[mcpIdx];
                const dMcpTip = Math.hypot(tip.x - mcp.x, tip.y - mcp.y);
                const dWristTip = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
                const dWristMcp = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y);
                return (dMcpTip > 0.09) || (dWristTip > dWristMcp * 1.15) || (tip.y < pip.y);
            };

            const indexExt = isExtended(8, 6, 5);
            const middleExt = isExtended(12, 10, 9);
            const ringExt = isExtended(16, 14, 13);
            const pinkyExt = isExtended(20, 18, 17);

            const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

            // Thumbs Up
            const thumbUp = extendedCount === 0 && landmarks[4].y < landmarks[3].y - 0.05;
            if (thumbUp) return 'thumbs-up';

            // Closed Fist
            if (extendedCount === 0 && !thumbUp) return 'fist';

            // Two fingers / Peace (Index + Middle)
            if (indexExt && middleExt && !ringExt && !pinkyExt) return 'peace';

            // Pointing gesture with index finger
            if (indexExt && !middleExt && !ringExt && !pinkyExt) {
                const indexTip = landmarks[8];
                const indexMcp = landmarks[5];
                const mirroredTipX = 1 - indexTip.x;
                const mirroredMcpX = 1 - indexMcp.x;
                const dx = mirroredTipX - mirroredMcpX;

                if (dx > 0.06) return 'point-right';
                if (dx < -0.06) return 'point-left';
            }

            // Open palm
            if (extendedCount >= 4) return 'neutral';

            return null;
        }

        executeGestureAction(action, gestureName, icon, now) {
            if (action === 'pause') {
                this.isPaused = !this.isPaused;
                this.triggerCooldown(now);
                this.readers.forEach(r => {
                    this.setReaderHudStatus(r, 'paused', '✊', 'Gesture Scrolling Paused');
                });
                this.showToastAll('pause', '✊', 'Gesture Scrolling Paused');
                this.playChime('pause');
                return;
            }

            if (this.isPaused) return;

            let success = false;
            if (action === 'next') {
                success = this.nextPage('gesture');
                if (success) {
                    this.showToastAll('next', icon, `Next Page: Page ${this.currentPage} of ${this.totalPages}`);
                    this.readers.forEach(r => {
                        this.setReaderHudStatus(r, 'action', icon, `${gestureName} → Page ${this.currentPage} / ${this.totalPages}`);
                    });
                    this.playChime('next');
                } else {
                    this.showToastAll('next', '🏁', `End of Document (Page ${this.totalPages})`);
                }
            } else if (action === 'prev') {
                success = this.prevPage('gesture');
                if (success) {
                    this.showToastAll('prev', icon, `Previous Page: Page ${this.currentPage} of ${this.totalPages}`);
                    this.readers.forEach(r => {
                        this.setReaderHudStatus(r, 'action', icon, `${gestureName} → Page ${this.currentPage} / ${this.totalPages}`);
                    });
                    this.playChime('prev');
                } else {
                    this.showToastAll('prev', '🏁', 'Beginning of Document (Page 1)');
                }
            }

            this.triggerCooldown(now);
        }
    }

    // Export singleton on window
    window.NotesGestureReader = NotesGestureReader;

    document.addEventListener('DOMContentLoaded', () => {
        window.notesReader = new NotesGestureReader();
        window.notesReader.init();
        window.NotesGestureTracker = window.notesReader;

        // Bind document switcher buttons across the page
        document.querySelectorAll('.notes-doc-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const docId = tab.dataset.doc;
                if (docId && window.notesReader) {
                    window.notesReader.switchDocument(docId);
                }
            });
        });
    });

})();
