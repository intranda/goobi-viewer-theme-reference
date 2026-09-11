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

    // Check if sidebar should be sticky, then activate sticky frontend functions
    // Initialize sticky elements for frontend sidebar
    if ($('[data-target="sticky-sidebar"]').length) {
        viewerJS.stickyElements.init({ initFrontend: true });
    }

    const $header = $('#header');
    const $menu = $('#headerMenu');
    const $menuToggle = $header.find('[data-open="menu"]');
    const $languageToggle = $header.find('[data-toggle="local"]');

    // The header stays the same height on scroll. Measure its actual bottom
    // edge so the drawer also fits wrapped mobile rows and the admin toolbar.
    function positionHeaderMenu() {
        if ($header.length) {
            $header[0].style.setProperty('--_header-bottom', `${$header[0].getBoundingClientRect().bottom}px`);
        }
    }
    if ($header.length) {
        new ResizeObserver(positionHeaderMenu).observe($header[0]);
        $(window).on('resize', positionHeaderMenu);
        positionHeaderMenu();
    }

    function closeLanguages(restoreFocus = false) {
        $('#changeLocal').hide();
        $languageToggle.attr('aria-expanded', 'false');
        if (restoreFocus) $languageToggle.trigger('focus');
    }

    function setHeaderMenu(open, restoreFocus = true) {
        if (!$menu.length) return;
        positionHeaderMenu();
        $menu.prop('inert', !open).attr('aria-hidden', String(!open)).toggleClass('-mobileMenuOpen', open);
        $header.toggleClass('-mobileMenuOpen', open);
        $header.find('.header__navigation-mobile-background').toggleClass('-mobileMenuOpen', open);
        $menuToggle
            .attr('aria-expanded', String(open))
            .attr('aria-label', $menuToggle.attr(open ? 'data-label-close' : 'data-label-open'));
        $('html').toggleClass('header-menu-open', open);
        closeLanguages();
        if (open) {
            requestAnimationFrame(function () {
                $menu.find('[data-close="menu"]').trigger('focus');
            });
        } else if (restoreFocus) {
            $menuToggle.trigger('focus');
        }
    }

    $menuToggle.on('click', function () {
        setHeaderMenu($menu.attr('aria-hidden') !== 'false');
    });
    $header.find('[data-close="menu"], .header__navigation-mobile-background').on('click', function () {
        setHeaderMenu(false);
    });
    // Login and bookmark dialogs manage their own focus after leaving the drawer.
    $(document).on('show.bs.modal', function () {
        if ($menu.attr('aria-hidden') === 'false') setHeaderMenu(false, false);
    });

    $languageToggle.on('click', function () {
        const open = $(this).attr('aria-expanded') !== 'true';
        $('#changeLocal').toggle(open);
        $(this).attr('aria-expanded', String(open));
    });
    $(document).on('click', function (event) {
        if (!$(event.target).closest('#changeLocalWrapper').length) closeLanguages();
    });

    // Keep the configured hierarchy intact, including levels deeper than two.
    // Replace the core's flyout click handler for these two theme instances.
    $header
        .find('.navigation [data-toggle="submenu"]')
        .off('click')
        .each(function (index) {
            const $trigger = $(this);
            const $submenu = $trigger.next('.navigation__submenu');
            const submenuId = `header-submenu-${index}`;
            $submenu.attr('id', submenuId);
            $trigger.attr({ 'aria-controls': submenuId, 'aria-expanded': String($submenu.hasClass('in')) });
            new MutationObserver(function () {
                $trigger.attr('aria-expanded', String($submenu.hasClass('in')));
            }).observe($submenu[0], { attributes: true, attributeFilter: ['class'] });
            $trigger.on('click', function () {
                const open = !$submenu.hasClass('in');
                if (!$trigger.closest('#headerMenu').length) {
                    $trigger.parent().siblings().removeClass('active').find('.navigation__submenu').removeClass('in');
                    $submenu.removeClass('left');
                }
                $submenu.toggleClass('in', open);
                if (open && !$trigger.closest('#headerMenu').length) {
                    const bounds = $submenu[0].getBoundingClientRect();
                    if (bounds.right > document.documentElement.clientWidth || bounds.left < 0) {
                        $submenu.addClass('left');
                    }
                }
                $trigger.parent().toggleClass('active', open);
                if (!open) {
                    $submenu.find('.navigation__submenu').removeClass('in');
                    $submenu.find('.navigation__submenu-trigger').removeClass('active');
                }
            });
        });

    const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    $header.find('.header__search-shortcut').text(isMac ? '⌘ K' : 'Ctrl K');
    $header.find('.header__search-box input').attr('aria-keyshortcuts', 'Meta+K Control+K');
    $(document).on('keydown', function (event) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
            const $search = $header.find('.header__search-box input').first();
            if ($search.length) {
                event.preventDefault();
                if ($menu.attr('aria-hidden') === 'false') setHeaderMenu(false, false);
                $search.trigger('focus');
            }
        }
        if (event.key === 'Escape') {
            if ($languageToggle.attr('aria-expanded') === 'true') {
                closeLanguages(true);
            } else if ($menu.attr('aria-hidden') === 'false') {
                setHeaderMenu(false);
            } else {
                const $submenu = $(event.target).closest('.navigation__submenu');
                $submenu.removeClass('in').prev('button').trigger('focus');
                $header.find('.navigation__submenu').removeClass('in');
            }
        }
        if (event.key === 'Tab' && $menu.attr('aria-hidden') === 'false') {
            const $focusable = $header
                .find('a[href], button, input, select, textarea, [tabindex="0"]')
                .filter(':visible')
                .not(':disabled, [type="hidden"]');
            const first = $focusable[0];
            const last = $focusable[$focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    // toggle mobile sidebar
    $('body').on('click', '[data-open="sidebar"], .mobile-overlay', function () {
        // ACCESSBILITY FOCUS JUMP
        //		if (!$("#sidebar").hasClass("-opened")) {
        //			$('#sidebar a:visible:first').focus();
        //		} else {
        //			$('[data-open="sidebar"]').focus();
        //		}
        // DEACTIVATE SCROLL WHEN SIDEBAR OPEN
        $('html').toggleClass('no-overflow');
        // ADD DARKER OVERLAY ON BACKGROUND
        $('.mobile-overlay, [data-close="sidebar"]').fadeToggle(300);
        // TOGGLE SIDEBAR OPEN
        $('#sidebar').toggleClass('-opened');
        // TOGGLE SIDEBAR TRIGGER ICON
        $('[data-target="mobileSidebarTrigger"]').toggleClass('-opened');
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
