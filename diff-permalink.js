// <nowiki>
( function () {
    $.when( $.ready, mw.loader.using( [ "mediawiki.util" ] ) ).then( function () {
        var suffix = mw.config.get( "wgDiffNewId" );
        var page;
        if( suffix ) {
            if( document.getElementsByClassName( "diff-multi" ).length ||
	    		mw.config.get("wgPageName") === "Special:ComparePages" )
                suffix = mw.config.get( "wgDiffOldId" ) + "/" + suffix;
            page = "Special:Diff/" + suffix;
        } else {
            var oldidMatch = mw.util.getParamValue( "oldid" );
            if( oldidMatch ) {
                page = "Special:Permalink/" + oldidMatch;
            } else return; // nothing to do here
        }

        var permalinkEl = $( "<input>" ).val( page )
            .click( function () { this.select(); document.execCommand( "copy" ); } );
        permalinkEl.attr( "size", permalinkEl.val().length ); // resize to diff length
        if( suffix ) {
            $( "#bodyContent" ).prepend( permalinkEl )
                .prepend( "Permalink to this diff: " );
        } else {
            $( "#contentSub" ).after( permalinkEl ).after( "Permalink to this oldid: " );
        }
    } );
} )();
// </nowiki>
