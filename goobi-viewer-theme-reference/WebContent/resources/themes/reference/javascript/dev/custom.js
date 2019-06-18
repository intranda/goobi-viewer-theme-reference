/*****************************************************************************************
 * Custom JavaScript for "reference"
 ****************************************************************************************/
/**
 * Method to set the content height to a min-height, equal to the viewport height.
 */
function setContentHeight() {
    var pageHeaderTopHeight = $( '#pageHeaderTop' ).outerHeight();
    var pageHeaderBottomHeight = $( '#pageHeaderBottom' ).outerHeight();
    var pageNavigationHeight = $( '#pageNavigation' ).outerHeight();
    var pageWrapperHeight = $( '#pageContent' ).outerHeight();
    var pageFooterHeight = $( '#pageFooter' ).outerHeight();
    var pageWrapper = $( '#pageContent' );
    var additionalHeight = pageHeaderTopHeight + pageHeaderBottomHeight + pageNavigationHeight + pageWrapperHeight + pageFooterHeight;
    var windowHeight = $( window ).outerHeight();
    var diff = windowHeight - additionalHeight;
    
    if ( additionalHeight < windowHeight ) {
        pageWrapper.css( 'min-height', ( pageWrapperHeight + diff ) + 'px' );
    }
}

$( document ).ready( function() {
    var viewerConfig = {
        currentPage: currentPage,
        theme: currentTheme,
        localStoragePossible: viewerJS.localStoragePossible,
        widgetNerSidebarRight: true,
    };
    
    viewerJS.init( viewerConfig );
    
    // init bookshelves if enabled
    if ( bookshelvesEnabled ) {
        if ( userLoggedIn ) {
            viewerJS.bookshelvesUser.init( watchlistConfig );
        }
        else {
            viewerJS.bookshelvesSession.init( watchlistConfig );
        }
    }
    
    // toggle change local
    $( 'body' ).on( 'click', '[data-toggle="local"]', function() {
    	$( '#changeLocal' ).fadeToggle( 200 );
    } );
    $( 'body' ).on( 'click', function( event ) {
    	if ( event.target.id == 'changeLocalWrapper' || $( event.target ).closest( '#changeLocalWrapper' ).length ) {
    		return;
    	}
    	else {
    		$( '#changeLocal' ).hide();
    	}
    } );
    
    // toggle mobile menu
    $( 'body' ).on( 'click', '[data-open="menu"]', function() {
    	$( 'html' ).addClass( 'no-overflow' );
    	$( '.mobile-overlay, [data-close="menu"]' ).fadeIn( 300 );
    	$( '#navigation' ).addClass( 'in' );
    } );
    $( 'body' ).on( 'click', '[data-close="menu"]', function() {
    	$( 'html' ).removeClass( 'no-overflow' );
    	$( this ).hide();
    	$( '.mobile-overlay' ).fadeOut( 300 );
    	$( '#navigation' ).removeClass( 'in' );
    } );

    // toggle mobile sidebar
    $( 'body' ).on( 'click', '[data-open="sidebar"]', function() {
    	$( 'html' ).addClass( 'no-overflow' );
    	$( '.mobile-overlay, [data-close="sidebar"]' ).fadeIn( 300 );
    	$( '#sidebar' ).addClass( 'in' );
    } );
    $( 'body' ).on( 'click', '[data-close="sidebar"]', function() {
    	$( 'html' ).removeClass( 'no-overflow' );
    	$( this ).hide();
    	$( '.mobile-overlay' ).fadeOut( 300 );
    	$( '#sidebar' ).removeClass( 'in' );
    } );
    
    // set content height to window height
    setContentHeight();
    
    // mobile view manipulations
    if ( window.matchMedia( '(max-width: 768px)' ).matches ) {}
    $( window ).on( 'resize orientationchange', function() {} );
} );
