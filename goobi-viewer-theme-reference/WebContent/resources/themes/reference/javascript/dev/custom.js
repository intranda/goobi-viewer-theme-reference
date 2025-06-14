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
				crossFade: true
			},
		}
	}

	viewerJS.slider.set('reference', headerSliderConfig);

}
initSliders();

$(document).ready(function() {
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


	// hide sidebar toggle button if sidebar empty
	$(document).ready(function() {
		if ($('.content__sidebar .widget').length != 0) {
			$('[data-open="sidebar"]').fadeIn('fast');
		}
	});

	// shrink + expand header on scroll with a dead zone of 70 px to avoid jumps at the end of the page
	$(document).ready(function () {
	    const scrollDownThreshold = 250;
	    const scrollUpThreshold = 180;
	    let isScrolled = false;

	    const handleScroll = debounce(function () {
	        const scrollTop = $(document).scrollTop();

	        if (scrollTop >= scrollDownThreshold && !isScrolled) {
	            $(".header").addClass("-scrolled");
	            isScrolled = true;
	        } else if (scrollTop <= scrollUpThreshold && isScrolled) {
	            $(".header").removeClass("-scrolled");
	            isScrolled = false;
	        }
	    }, 20);

	    $(document).on("scroll", handleScroll);
	    handleScroll(); // initial call
	});
	

	// open search box
	$('body').on('click', '[data-open="search"], [data-close="search"]', function(e) {
		// hide button and show close button (X)
		$('.header__actions-search-wrapper').toggleClass('-searchOn');
		
		// hide other actions besides search close icon
		$('.header__inner').toggleClass('-searchOn');
		
		//
		// $('[data-close="search"]').addClass('-searchOn');
		
		// show search box
		$('[data-target="search-box"]').toggleClass('-searchOn');
		
		// fade in overlay
		$('[data-target="search-overlay"]').fadeToggle('fast');
		
		// set focus on search input field if search field shown
		if($(e.currentTarget).is('[data-open="search"]')) {
			$('.header__search-box .widget-searchfield input[type=text]').focus();
			console.log('was target');
		}

		$('[data-open="sidebar"]').toggle();
	});

	// close search box with escape on keyboard
	$('[data-target="search-box"] input').on('keydown', function(e) {
	    if (e.key === "Escape" || e.keyCode === 27) {
			$('.header__actions-search-wrapper').removeClass('-searchOn');
			$('[data-target="search-box"]').removeClass('-searchOn');
			$('.header__inner').removeClass('-searchOn');
			$('[data-target="search-overlay"]').fadeOut('fast');
			$('[data-open="sidebar"]').toggle();
			$('[data-open="search"]').focus();
	    }
	});
	
	
	// close search overlay on click
	$('body').on('click', '[data-target="search-overlay"]', function() {
		$('.header__actions-search-wrapper').removeClass('-searchOn');
		$('[data-target="search-box"]').removeClass('-searchOn');
		$('.header__inner').removeClass('-searchOn');
		$('[data-target="search-overlay"]').fadeOut('fast');
		$('[data-open="sidebar"]').toggle();
	});

	// toggle change local
	$('body').on('click', '[data-toggle="local"]', function() {
		$('#changeLocal').fadeToggle(200);
	});
	$('body').on('click', function(event) {
		if (event.target.id == 'changeLocalWrapper' || $(event.target).closest('#changeLocalWrapper').length) {
			return;
		}
		else {
			$('#changeLocal').hide();
		}
	});

	// toggle mobile menu
	$('body').on('click', '[data-open="menu"]', function() {
		// ACCESSBILITY FOCUS JUMP
		if (!$("page-navigation__mobile").hasClass("in")) {
			$('#sidebar a:visible:first').focus();
		} else {
			$('[data-open="sidebar"]').focus();
		}
		$('html').toggleClass('no-overflow');
		$('.page-navigation__mobile').toggleClass('-mobileMenuOpen');
		$('.header').toggleClass('-mobileMenuOpen');
		$('.header__navigation-mobile-background').toggleClass('-mobileMenuOpen');
		$('[data-open="sidebar"]').toggle();
		$('#pageNavigationMobile a:visible:first').focus();
		$(this).toggleClass('in');
	});

	// mobile submenu animation 
	$("#pageNavigationMobile .navigation__submenu-trigger").click(function() {
		// $('.navigation__submenu').removeAttr('style');
		$(this).find('.navigation__submenu:first').slideToggle('fast');
		event.stopPropagation();
		$("#pageNavigationMobile .navigation__submenu").not(".navigation__submenu.in").slideUp('fast');
	});

	// toggle language selection
	$('body').on('click', '[data-trigger="mobileToggleLanguages"]', function() {
		$('[data-target="mobileLanguageSelection"]').slideToggle('fast');
		$('.page-navigation__mobile-languages-toggle-indicator').toggleClass('fa-plus').toggleClass('fa-minus');
	});

	// toggle mobile sidebar
	$('body').on('click', '[data-open="sidebar"], .mobile-overlay', function() {
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
	
	// Hide open sidebar button if sidebar is completely empty
	if ($('#sidebar').length) {
		if ($.trim($('#sidebar').html()) == '') {
			$('[data-open="sidebar"]').hide()
		}
	}

	// do things on JSF AJAX event
	if (typeof jsf !== 'undefined') {
		jsf.ajax.addOnEvent(function(data) {
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
		return function(...args) {
			clearTimeout(timer);
			timer = setTimeout(() => f.apply(this, args), delay);
		}
	}
	
	
	// check if bodyWrapper exists (frontend)
	if ($('#bodyWrapper').length) {
		// element to observe 
		const mainArea = document.querySelector('#bodyWrapper');

		// set up observer
		const observeContent = new ResizeObserver(debounce((entries) => {
			const e = entries[0];
			// only trigger for desktop view
			if ($(window).width() > 768) {
				// log contentRect height for debugging
				// console.log(e.contentRect.height);
				$('.-refreshHCsticky').hcSticky('refresh', {});
			}
		}, 100));

		// listening for size changes
		observeContent.observe(mainArea);
	}



	// mobile view manipulations
	if (window.matchMedia('(max-width: 768px)').matches) {

	}

});