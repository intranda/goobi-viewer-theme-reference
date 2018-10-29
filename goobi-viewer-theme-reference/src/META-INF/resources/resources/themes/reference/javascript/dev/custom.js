/*****************************************************************************************
 * Custom JavaScript for "reference"
 ****************************************************************************************/
/**
 * Method to move DOM-Elements to another place.
 * 
 * @method manipulateDom
 */
function manipulateDom() {
    $( '.header-actions__search-advanced' ).detach().insertAfter( '#widgetSearchField' );
}

/**
 * Method to reset DOM-Elements.
 * 
 * @method resetDom
 */
function resetDom() {
    var advSearch = $( '.header-actions__search-advanced' ).detach();
    
    $( '.header-actions__search-link' ).append( advSearch );
}

/**
 * Method to set the content height to a min-height, equal to the viewport height.
 */
function setContentHeight() {
    var pageWrapper = $( '#pageContent' );
    var pageWrapperHeight = $( '#pageContent' ).outerHeight();
    var pageHeaderHeight = $( '#pageHeader' ).outerHeight();
    var pageNavigationHeight = $( '.main-navigation' ).outerHeight();
    var pageFooterHeight = $( '#pageFooter' ).outerHeight();
    var additionalHeight = pageHeaderHeight + pageNavigationHeight + pageFooterHeight + 15;
    var windowHeight = $( window ).outerHeight();
    
    if ( pageWrapperHeight < windowHeight ) {
        pageWrapper.css( 'min-height', ( windowHeight - additionalHeight ) + 'px' );
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
    
    // set content height to window height
    setContentHeight();
    
    // off canvas
    $( '[data-toggle="offcanvas"]' ).off().click( function() {
        $( this ).addClass( 'in' );
        $( '#sidebar' ).addClass( 'in' );
        $( '.offcanvas-fade' ).addClass( 'in' );
    } );
    $( '[data-toggle="close-sidebar"]' ).click( function() {
        $( '#sidebar' ).removeClass( 'in' );
        $( '[data-toggle="offcanvas"]' ).removeClass( 'in' );
        $( '.offcanvas-fade' ).removeClass( 'in' );
    } );
    
    // toggle search
    $( '[data-toggle="search"]' ).off().on( 'click', function() {
        $( '.btn-toggle.language' ).removeClass( 'in' );
        $( '#changeLocal' ).hide();
        $( this ).toggleClass( 'in' );
        $( '.header-actions__search' ).fadeToggle( 'fast' );
    } );
    
    // change position of search and language
    if ( window.matchMedia( '(max-width: 768px)' ).matches ) {
        manipulateDom();
    }
    $( window ).on( 'resize orientationchange', function() {
        setContentHeight();
        
        if ( window.matchMedia( '(max-width: 768px)' ).matches ) {
            setContentHeight();
            manipulateDom();
        }
        else {
            setContentHeight();
            resetDom();
        }
    } );
} );
