/*****************************************************************************************
 * Custom JavaScript for "reference"
 ****************************************************************************************/
$( document ).ready( function() {
    var viewerConfig = {
        currentPage: currentPage,
        localStoragePossible: viewerJS.localStoragePossible,
        widgetNerSidebarRight: true,
    };
    
    viewerJS.init( viewerConfig );
} );
