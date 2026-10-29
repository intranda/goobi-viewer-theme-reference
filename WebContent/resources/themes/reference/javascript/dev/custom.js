/*****************************************************************************************
 * Custom JavaScript for "reference"
 ****************************************************************************************/

/*
initSliders may be used to add new cms slider styles (swiper configuration objects) to the 
list of availabe slider styles, or alter existing ones. See the commented out examples below for each use case
This method MUST be called before document.ready for them to show up in the styles dropdown in the cms backend
*/
function initSliders() {
    //update swiper config with
    // var partialConfig = {
    // swiperConfig: {
    //        loop: true,
    //        slidesPerView: 2
    //    }
    // }
    // viewerJS.slideshows.update('styleName', partialConfig);
    // add new swiper config
    // var config = {
    //    swiperConfig: {
    //        slidesPerView: 3,
    //        spaceBetween: 50,
    //        loop: true
    //    }
    //}
    // viewerJS.slideshows.set('myNewStyleName', config);

    // SINGLE STORY SLIDER
    var headerSliderConfig = {
        maxSlides: 8,
        timeout: 10000,
        imageWidth: 1920,
        imageHeight: 700,
        swiperConfig: {
            slidesPerView: 1,
            loop: true,
            allowTouchMove: false,
            autoplay: {
                delay: 3000,
            },
            speed: 3500,
            effect: 'fade',
            fadeEffect: {
                crossFade: true,
            },
        },
    };

    viewerJS.slider.set('reference', headerSliderConfig);

    var showcaseSliderConfig = {
        maxSlides: 20,
        timeout: 10000,
        imageWidth: 600,
        imageHeight: 800,
        swiperConfig: {
            slidesPerView: 1.4,
            slidesPerGroup: 1,
            breakpointsBase: 'container',
            spaceBetween: 20,
            loop: false,
            watchOverflow: true,
            watchSlidesProgress: true,
            grabCursor: true,
            followFinger: true,
            speed: 560,
            navigation: {
                prevEl: null,
                nextEl: null,
            },
            on: {
                // record showcase controls
                beforeInit: cmsJS.recordShowcase.init,
            },
            breakpoints: {
                640: {
                    slidesPerView: 6,
                    slidesPerGroup: 6,
                    spaceBetween: 22,
                },
                960: {
                    slidesPerView: 7,
                    slidesPerGroup: 7,
                    spaceBetween: 22,
                },
                1280: {
                    slidesPerView: 8,
                    slidesPerGroup: 8,
                    spaceBetween: 24,
                },
                1600: {
                    slidesPerView: 9,
                    slidesPerGroup: 9,
                    spaceBetween: 28,
                },
            },
        },
    };

    viewerJS.slider.set('showcase', showcaseSliderConfig);
}
initSliders();

$(document).ready(function () {
    var viewerConfig = {
        currentPage: currentPage,
        theme: currentTheme,
        localStoragePossible: viewerJS.localStoragePossible,
        widgetNerSidebarRight: true,
    };

    viewerJS.init(viewerConfig);

    // search list toolbar
    viewerJS.searchToolbar.init();

    // Keep the visible fallback unless a pointer explicitly establishes focus origin.
    document.addEventListener(
        'pointerdown',
        () => {
            document.body.dataset.referenceFocus = 'pointer';
        },
        { capture: true, passive: true }
    );
    document.addEventListener(
        'keydown',
        (event) => {
            const navigationKeys = [
                'Tab',
                'Enter',
                'Escape',
                'ArrowUp',
                'ArrowDown',
                'ArrowLeft',
                'ArrowRight',
                'Home',
                'End',
                'PageUp',
                'PageDown',
            ];
            const editing =
                event.target instanceof Element &&
                event.target.closest('input, textarea, [contenteditable]:not([contenteditable="false"])');
            if (
                event.key === 'Tab' ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                (!editing && (navigationKeys.includes(event.key) || event.key === ' '))
            ) {
                delete document.body.dataset.referenceFocus;
            }
        },
        true
    );

    // Check if sidebar should be sticky, then activate sticky frontend functions
    // Initialize sticky elements for frontend sidebar
    if ($('[data-target="sticky-sidebar"]').length) {
        viewerJS.stickyElements.init({ initFrontend: true });
        // the core default (top: 100) leaves too little breathing room above the sidebar
        // once it re-sticks while scrolling back up; widen it for this theme without
        // touching the core module
        $('[data-target="sticky-sidebar"]').hcSticky('update', { top: 130 });
    }

    const $header = $('#header');
    const header = $header[0];
    const $menuToggle = $header.find('[data-open="menu"]');
    const menu = document.getElementById('headerMenu');
    const searchPanel = document.getElementById('headerSearchPanel');
    const $searchToggle = $header.find('[data-toggle="header-search"]');
    const compactHeader = window.matchMedia('(max-width: 768px)');
    const $searchInput = $header.find('.header__search input[type="text"]').first();
    const $accountToggle = $header.find('[data-toggle="user-dropdown"]');
    const $accountPanel = $header.find('.login-navigation__user-dropdown').first();
    const panels = Array.from($header.find('.header__panel'));

    // Toggles sit in the actions row and in the header navigation; a close button inside a panel is not one.
    const panelToggle = (panel) => $header.find(`[popovertarget="${panel.id}"]:not([popovertargetaction="hide"])`)[0];

    function positionPanel(panel, anchor) {
        if (!panel || !anchor) return;
        const bounds = anchor.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const width = Math.min(parseFloat(getComputedStyle(panel).width) || 320, viewportWidth - 32);
        const rtl = getComputedStyle(header).direction === 'rtl';
        // Panels under the navigation line up with the start edge of their toggle, the actions panels with its end edge.
        const alignStart = panel.dataset.align === 'start';
        const preferredLeft = alignStart !== rtl ? bounds.left : bounds.right - width;
        const left = Math.max(16, Math.min(preferredLeft, viewportWidth - width - 16));
        panel.style.setProperty('--_panel-left', `${left}px`);
        panel.style.setProperty('--_panel-top', `${bounds.bottom + 8}px`);
    }
    function positionPanels() {
        // TEST: the account dropdown is positioned by CSS (absolute below its toggle)
        // positionPanel($accountPanel[0], $accountToggle[0]);
        panels.forEach((panel) => positionPanel(panel, panelToggle(panel)));
    }
    if (header) {
        new ResizeObserver(positionPanels).observe(header);
        window.addEventListener('resize', positionPanels, { passive: true });
        window.addEventListener('scroll', positionPanels, { passive: true });
        positionPanels();
    }

    function closeAccount(restoreFocus) {
        const wasOpen = $accountToggle.attr('aria-expanded') === 'true';
        $accountPanel.css('display', '').removeClass('-open');
        $accountToggle.attr('aria-expanded', 'false');
        if (wasOpen && restoreFocus) $accountToggle.trigger('focus');
    }
    function closeSearch(restoreFocus) {
        if (!searchPanel) return;
        const wasOpen = !searchPanel.hidden;
        searchPanel.hidden = compactHeader.matches;
        $searchToggle.attr({
            'aria-expanded': 'false',
            'aria-label': $searchToggle.data('search-label'),
            title: $searchToggle.data('search-label'),
        });
        if (wasOpen && restoreFocus && compactHeader.matches) $searchToggle.trigger('focus');
    }
    function openSearch() {
        if (!searchPanel) return;
        closePanels();
        if (menu && menu.open) menu.close();
        searchPanel.hidden = false;
        $searchToggle.attr({
            'aria-expanded': 'true',
            'aria-label': $searchToggle.data('close-label'),
            title: $searchToggle.data('close-label'),
        });
        $searchInput.trigger('focus');
    }
    compactHeader.addEventListener('change', () => {
        const inputHadFocus = document.activeElement === $searchInput[0];
        const toggleHadFocus = document.activeElement === $searchToggle[0];
        closeSearch(inputHadFocus);
        if (!compactHeader.matches && toggleHadFocus) $searchInput.trigger('focus');
    });
    closeSearch();
    $searchToggle.on('click', function () {
        if (searchPanel.hidden) openSearch();
        else closeSearch(true);
    });

    function closePanels() {
        closeSearch();
        panels.forEach((panel) => {
            if (panel.matches(':popover-open')) panel.hidePopover();
        });
        closeAccount();
    }

    // Nonmodal panels use the browser's outside-click and Escape handling.
    panels.forEach((panel) => {
        const toggle = panelToggle(panel);
        panel.addEventListener('beforetoggle', (event) => {
            if (event.newState === 'open') {
                closeAccount();
                closeSearch();
                positionPanels();
                // Core may have hidden the session list on a previous outside click.
                $(panel).find('.bookmark-navigation__dropdown').stop(true, true).show();
            }
            if (toggle) toggle.setAttribute('aria-expanded', String(event.newState === 'open'));
        });
        panel.addEventListener('click', (event) => event.stopPropagation());
        $(panel)
            .find('[popovertargetaction="hide"]')
            .on('click', () => {
                if (toggle) toggle.focus();
            });
    });

    // Keep the configured Core account actions and bookmark submenu intact.
    if ($accountToggle.length && $accountPanel.length) {
        $accountPanel.attr('id', 'headerAccountMenu');
        const identity = document.getElementById('headerAccountIdentity');
        if (identity) $accountPanel[0].prepend(identity.content.cloneNode(true));
        $accountToggle
            .attr({ 'aria-controls': 'headerAccountMenu', 'aria-expanded': 'false' })
            .removeAttr('aria-haspopup')
            .off('click')
            .on('click', function (event) {
                event.stopPropagation();
                const open = $accountToggle.attr('aria-expanded') !== 'true';
                closePanels();
                positionPanels();
                $accountPanel.toggleClass('-open', open);
                $accountToggle.attr('aria-expanded', String(open));
            });
    }
    $(document).on('click', function (event) {
        if (!$(event.target).closest('.header__account').length) closeAccount();
        if (!$(event.target).closest('.header').length) closeSearch();
    });
    $header.find('.header__account').on('focusout', function (event) {
        if (event.relatedTarget && !this.contains(event.relatedTarget)) closeAccount();
    });
    $(document).on('show.bs.modal', function () {
        closePanels();
        if (menu && menu.open) menu.close();
    });

    // Guest bookmarks appear only while the session list contains items.
    if (window.bookmarksEnabled && viewerJS.bookmarks) {
        const updateCount = () => {
            const count = viewerJS.bookmarks.getBookmarksCount();
            const $toggle = $header.find('[data-header-bookmarks]');
            const panel = document.getElementById('headerBookmarksPanel');
            $header.find('[data-header-bookmark-count]').text(count > 99 ? '99+' : count || '');
            if (!$toggle.length) return;
            if (count === 0 && panel && panel.matches(':popover-open')) {
                const hadFocus = panel.contains(document.activeElement) || document.activeElement === $toggle[0];
                panel.hidePopover();
                if (hadFocus) $menuToggle.trigger('focus');
            }
            $toggle.prop('hidden', count === 0);
            $toggle.attr('aria-label', `${$toggle.data('bookmark-label')} (${count})`);
            positionPanels();
        };
        viewerJS.bookmarks.listsUpdated.subscribe(updateCount);
        updateCount();
    }

    // Drawer groups are disclosures; nested levels keep their configured hierarchy.
    $(menu)
        .find('.navigation [data-toggle="submenu"]')
        .off('click')
        .each(function (index) {
            const $trigger = $(this);
            const $submenu = $trigger.next('.navigation__submenu');
            const submenuId = `header-submenu-${index}`;
            $submenu.attr('id', submenuId);
            $trigger.attr({ 'aria-controls': submenuId, 'aria-expanded': 'false' }).removeAttr('aria-haspopup');
            $trigger.on('click', function () {
                $trigger.attr('aria-expanded', String($trigger.attr('aria-expanded') !== 'true'));
            });
        });
    if (menu) {
        $menuToggle.on('click', function () {
            closePanels();
            menu.showModal();
            menu.querySelector('.drawer__body').scrollTop = 0;
            $menuToggle.attr('aria-expanded', 'true');
        });
        $(menu).on('click', '[data-close="menu"]', () => menu.close());
        menu.addEventListener('click', (event) => {
            if (event.target === menu) menu.close();
        });
        menu.addEventListener('close', () => $menuToggle.attr('aria-expanded', 'false'));
        $(menu)
            .find('.navigation__submenu')
            .has('a[aria-current="page"]')
            .prev('[data-toggle="submenu"]')
            .attr('aria-expanded', 'true');
    }

    $(document).on('keydown', function (event) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && searchPanel) {
            event.preventDefault();
            openSearch();
        }
        if (event.key === 'Escape') {
            closeAccount(true);
            closeSearch(true);
        }
    });

    // toggle mobile sidebar
    // the sidebar is unmounted (display: none) at rest, not just moved off-screen, so a
    // fixed-position panel outside the viewport can never make the page pannable/draggable
    // on mobile browsers. ".-mounted" renders it off-screen, ".-opened" (added a frame later)
    // slides it in; closing reverses that and only unmounts once the transition has finished.
    var $mobileSidebar = $('#sidebar');

    function openMobileSidebar() {
        $('html').addClass('no-overflow');
        $('.mobile-overlay, [data-close="sidebar"]').fadeIn(300);
        $('[data-target="mobileSidebarTrigger"]').addClass('-opened');

        $mobileSidebar.addClass('-mounted');
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                $mobileSidebar.addClass('-opened');
            });
        });
    }

    function closeMobileSidebar() {
        $('html').removeClass('no-overflow');
        $('.mobile-overlay, [data-close="sidebar"]').fadeOut(300);
        $('[data-target="mobileSidebarTrigger"]').removeClass('-opened');

        $mobileSidebar.removeClass('-opened');
        $mobileSidebar.one('transitionend', function (event) {
            if (event.target === $mobileSidebar.get(0)) {
                $mobileSidebar.removeClass('-mounted');
            }
        });
    }

    $('body').on('click', '[data-open="sidebar"], .mobile-overlay', function () {
        if ($mobileSidebar.hasClass('-mounted')) {
            closeMobileSidebar();
        } else {
            openMobileSidebar();
        }
    });

    // do things on JSF AJAX event
    if (typeof jsf !== 'undefined') {
        jsf.ajax.addOnEvent(function (data) {
            switch (data.status) {
                case 'success':
                    // DO SOMETHING
                    break;
            }
        });
    }

    // Function to observe website height
    // so sticky sidebar container can dynamically adapt to changes

    // debounce function
    function debounce(f, delay) {
        let timer = 0;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => f.apply(this, args), delay);
        };
    }

    // check if bodyWrapper exists (frontend)
    if ($('#bodyWrapper').length) {
        // element to observe
        const mainArea = document.querySelector('#bodyWrapper');

        // set up observer
        const observeContent = new ResizeObserver(
            debounce((entries) => {
                const e = entries[0];
                // only trigger for desktop view
                if ($(window).width() > 768) {
                    // log contentRect height for debugging
                    // console.log(e.contentRect.height);
                    $('.-refreshHCsticky').hcSticky('refresh', {});
                }
            }, 100)
        );

        // listening for size changes
        observeContent.observe(mainArea);
    }

    // mobile view manipulations
    if (window.matchMedia('(max-width: 768px)').matches) {
    }
});
