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
            } else return; // 什么也不返回
        }

        var permalinkEl = $( "<input>" ).val( page )
            .click( function () { this.select(); document.execCommand( "copy" ); } );
        permalinkEl.attr( "size", permalinkEl.val().length ); // resize to diff length
        if( suffix ) {
            $( "#bodyContent" ).prepend( permalinkEl )
                .prepend( "此差异的固定链接： " );
        } else {
            $( "#contentSub" ).after( permalinkEl ).after( "此修订版本的固定链接： " );
        }
    } );
} )();
// </nowiki>
