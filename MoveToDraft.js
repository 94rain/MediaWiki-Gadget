/***************************************************************************************************
 MoveToDraft
-------------
Version 2.4.3
-------------
A script to move unsourced articles to draft space, including cleanup and author notification.
- Moves page to draftspace
- Checks if any files used are non-free
- Checks if any redirects pointed to the page
- Comments out non-free files, turn categories into links, add afc draft template, add redirects
- Adds notification message on author talk page
- Updates talk page banners
- Logs draftification in user subpage

***************************************************************************************************/
// <nowiki>
$.when(
	// Resource loader modules
	mw.loader.using(['mediawiki.util', 'mediawiki.api', 'mediawiki.Title']),
	// Page ready
	$.ready
).then(function() {
/* ========== Config ============================================================================ */
var config = {	
	// Script info
	script: {
		advert:  ' ([[User:94rain/js/MoveToDraft|移动至草稿脚本]])', // For edit summaries
		version: '2.4.3'
	},
	// MediaWiki configuration values
	mw: mw.config.get( [
		'wgArticleId',
		'wgCurRevisionId',
		'wgPageName',
		'wgUserGroups',
		'wgUserName',
		'wgMonthNames',
		'wgNamespaceNumber',
		'wgTitle'
	] )
};

/* ========== API =============================================================================== */
var API = new mw.Api( {
	ajax: {
		headers: { 
			'Api-User-Agent': 'MoveToDraft/' + config.script.version + 
				' ( https://zh.wikipedia.org/wiki/User:94rain/js/MoveToDraft )'
		}
	}
} );
	
var moveToDraft = function moveToDraft() {

/* ========== Additional config ================================================================= */
// Wikitext strings
config.wikitext = {
	'rationale':	window.m2d_rationale || '无来源或内容短小，在草稿空间改善',
	'editsummary':	window.m2d_editsummary || window.m2d_rationale || '[[:WP:AFC|建立条目]]草稿',
	'notification_heading': '通知：[[:Draft:$1|$1]]移动至草稿空间',
	'notification':	window.m2d_notification || "您最近创建的条目[[:Draft:$1|$1]]没有足够的[[:WP:V|来源]]和[[:Help:脚注|脚注]]，或者还未完成。维基百科的条目需要[[WP:RS|可靠来源]]来彰显其有足够的关注度。因此，我已经将它移动到了草稿（在条目名前有一个\"<code>Draft:</code>\"前缀）)。您可以慢慢改善它，若您认为它满足[[:WP:GNG|通用关注度指引]]并且可以成为一篇维基百科的条目时，请点击页面顶部的\"提交草稿\"以待有经验的编者审核并将其移动到条目空间。--~~~~",
	'logMsg':		'#[[:$1]]移动至[[$2]]，于~~~~~'
};
config.doNotLog = window.m2d_doNotLog ? true : false;
// Page data -- to be retreived later from api
config.pagedata = {};

// Helper functions
// - prettify an encoded page title (or at least replace underscores with spaces)
var getPageText = function(p) {
	var t = mw.Title.newFromText( decodeURIComponent(p) );
	if (t) {
		return t.getPrefixedText();
	} else {
		return p.replace(/_/g, " ");
	}
};


/* ========== Tasks ============================================================================= */

// Grab page data - initial author, current wikitext, any redirects, if Draft: page already exists
var grabPageData = function() {
	
	var patt_isRedirect = /^\s*#redirect/i;
		
	// Function to check if all done
	var checkPageData = function() {
		if (
			config.pagedata.author != null &&
			config.pagedata.oldwikitext != null &&
			config.pagedata.redirects != null
		) {
			//all done - go to next screen
			screen1();
		}
	};

	/* ---------- Initial author ---------------------------------------------------------------- */
	
	/* Try making an api call for just the first revision - but if that is a redirect, then get 'max'
		number of revisions, and look for first non-redirect revision - use this as the initial author,
		not the creator of the redirect.
	*/
	var processMaxRvAuthorQuery = function (result) {
		var revisions = result.query.pages[config.mw.wgArticleId].revisions;
		for ( var i=1; i<revisions.length; i++ ) {
			if ( !patt_isRedirect.test(revisions[i]['*']) ) {
				config.pagedata.author = revisions[i].user;
				break;
			}
		}
		//Check that we actually found an author (i.e. not all revisions were redirects
		if ( config.pagedata.author == null ) {
			API.abort();
			var retry = confirm("无法获取页面创建者：\n"+extraJs.makeErrorMsg(c, r)+"\n\n重试？");
			if ( retry ) {
				screen0();
			} else {
				$("#M2D-modal").remove();
			}
		}
		
		checkPageData();
	};
	
	var processAuthorQuery = function (result) {
		// Check if page is currently a redirect
		if ( result.query.pages[config.mw.wgArticleId].redirect ) {
			API.abort();
			alert("错误：" + config.mw.wgPageName + "是一个重定向");
			return;
		}
		// Check if first revision is a redirect
		rvwikitext = result.query.pages[config.mw.wgArticleId].revisions[0]['*'];
		if ( patt_isRedirect.test(rvwikitext) ) {
			// query to look for first non-redirect revision
			API.get( {
				action: 'query',
				pageids: config.mw.wgArticleId,
				prop: 'revisions',
				rvprop: ['user', 'content'],
				rvlimit: 'max',
				rvdir: 'newer'
			} )
			.done( processMaxRvAuthorQuery )
			.fail( function(c,r) {
				if ( r.textStatus === 'abort' ) { return; }
				
				API.abort();
				var retry = confirm("无法获取页面创建者：\n"+extraJs.makeErrorMsg(c, r)+"\n\n重试？");
				if ( retry ) {
					screen0();
				} else {
					$("#M2D-modal").remove();
				}
			} );
			return;
		}
		
		config.pagedata.author = result.query.pages[config.mw.wgArticleId].revisions[0].user;
		checkPageData();
	};
	
	//Get author
	API.get( {
		action: 'query',
		pageids: config.mw.wgArticleId,
		prop: ['revisions', 'info'],
		rvprop: ['user', 'content'],
		rvlimit: 1,
		rvdir: 'newer'
	} )
	.done( processAuthorQuery )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		API.abort();
		var retry = confirm("无法获取页面创建者：\n"+extraJs.makeErrorMsg(c, r)+"\n\n重试？");
		if ( retry ) {
			screen0();
		} else {
			$("#M2D-modal").remove();
		}
	} );

	/* ---------- Current wikitext -------------------------------------------------------------- */

	API.get( {
		action: 'query',
		pageids: config.mw.wgArticleId,
		prop: 'revisions',
		rvprop: 'content'
	} )
	.done( function(result) {
		config.pagedata.oldwikitext = result.query.pages[config.mw.wgArticleId].revisions[0]['*'];
		checkPageData();
	} )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		API.abort();
		var retry = confirm("无法获取页面维基文本：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n重试？");
		if ( retry ) {
			screen0();
		} else {
			$("#M2D-modal").remove();
		}
	} );
	
	//TODO(?): also get proposed Draft: page (to check if it is empty or not)
	
	/* ---------- Redirects --------------------------------------------------------------------- */
	var redirectTitles = [];
	
	var processRedirectsQuery = function(result) {
		if ( !result.query || !result.query.pages ) {
			// No results
			config.pagedata.redirects = false;
			checkPageData();
			return;
		}
		// Gather redirect titles into array
		$.each(result.query.pages, function(_id, info) {
			redirectTitles.push(info.title);
		});
		// Continue query if needed
		if ( result.continue ) {
			doRedirectsQuery($.extend(redirectsQuery, result.continue));
			return;
		}
		
		// Check if redirects were found
		if ( redirectTitles.length === 0 ) {
			config.pagedata.redirects = false;
			checkPageData();
			return;
		}
		
		// Set redirects
		config.pagedata.redirects = ( redirectTitles.length === 0 ) ? false : redirectTitles;
		checkPageData();
	};
	
	var redirectsQuery = {
		action: 'query',
		pageids: config.mw.wgArticleId,
		generator: 'redirects',
		grdlimit: 500
	};
	var doRedirectsQuery = function(q) {
		API.get( q )
		.done( processRedirectsQuery )
		.fail( function(c,r) {
			if ( r.textStatus === 'abort' ) { return; }
			
			API.abort();
			var retry = confirm("无法获取重定向：\n" + extraJs.makeErrorMsg(c, r) +
				"\n\n重试？（或取消以跳过）");
			if ( retry ) {
				screen0();
			} else {
				config.pagedata.redirects = false;
				checkPageData();
			}
		} );
	};
	doRedirectsQuery(redirectsQuery);
	checkPageData();
};
	/* ---------- Review (Page Triage) status ----------------------------------------------------------------- */

//Move page
var movePage = function() {
	$("#M2D-task0").css({"color":"#00F", "font-weight":"bold"});
	$("#M2D-status0").html("...");
	
	API.postWithToken( 'csrf', {
		action: 'move',
		fromid: config.mw.wgArticleId,
		to: config.inputdata.newTitle,
		movetalk: 1,
		noredirect: 1,
		reason: config.inputdata.rationale + config.script.advert
	} )
	.done( function() {
		if (
			-1 === $.inArray('sysop', config.mw.wgUserGroups) &&
			-1 === $.inArray('rollbacker', config.mw.wgUserGroups)
			-1 === $.inArray('patroller', config.mw.wgUserGroups)
		) {
			// Newly created redirect to be tagged for speedy deletion
			tagRedrect();
			return;
		}
		$("#M2D-task0").css({"color":"#000", "font-weight":""});
		$("#M2D-status0").html("完成！");			
		getImageInfo();
	} )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		var retry = confirm("无法移动页面：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n重试？");
		if ( retry ) {
			movePage();
		} else {
			$("#M2D-modal").remove();
		}
	} );
};

var tagRedrect = function() {
	$("#M2D-status0").html("完成。<br/>标记重定向快速删除...");	
	API.postWithToken( 'csrf', {
		action: 'edit',
		title: config.mw.wgPageName,
		prependtext: '{{d|R2}}\n',
		summary: '请求快速删除（[[WP:R2|CSD R2]]）' + config.script.advert
	} )
	.done( function() {
		$("#M2D-task0").css({"color":"#000", "font-weight":""});
		$("#M2D-status0").append("完成！");			
		getImageInfo();
	} )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		var retry = confirm("无法将重定向标记快速删除：\n"+
			extraJs.makeErrorMsg(c, r) + "\n\n重试？");
		if ( retry ) {
			tagRedrect();
		} else {
			$("#M2D-task0").css({"color":"#F00", "font-weight":""});
			$("#M2D-status0").append("已跳过");
			getImageInfo();
		}
	} );
};
	
//Find which images are non-free
var getImageInfo = function() {
	$("#M2D-task1").css({"color":"#00F", "font-weight":"bold"});
	$("#M2D-status1").html("...");
	
	processImageInfo = function(result) {
		var nonfreefiles = [];
		if ( result && result.query ) {
			$.each(result.query.pages, function(id, page) {
				if ( id > 0 && page.categories ) {
					nonfreefiles.push(page.title);
				}
			});
		}
		editWikitext(nonfreefiles);
	};
	
	API.get( {
		action: 'query',
		pageids: config.mw.wgArticleId,
		generator: 'images',
		gimlimit: 'max',
		prop: 'categories',
		cllimit: 'max',
		clcategories: 'Category:非自由媒体',
	} )
	.done( function(result){
		$("#M2D-task1").css({"color":"#000", "font-weight":""});
		$("#M2D-status1").html("完成！");
		processImageInfo(result);
	} )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		var retry = confirm("无法编辑草稿页面：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n请选择[重试]或[跳过]");
		if ( retry ) {
			getImageInfo();
		} else {
			$("#M2D-task1").css({"color":"#F00", "font-weight":""});
			$("#M2D-status1").html("已跳过");
			editWikitext([]);
		}
	} );	

};


//Comment out non-free files, turn categories into links, add afc draft template, list any redirects
var editWikitext = function(nonfreefiles) {
	$("#M2D-task2").css({"color":"#00F", "font-weight":"bold"});
	$("#M2D-status2").html("...");

	var redirectsList = ( !config.pagedata.redirects ) ? '' : '\n'+
		'<!-- 注意：以下页面在草稿化前被重定向至[[' + config.mw.wgPageName +
		']]：\n' +
		'*[[' + config.pagedata.redirects.join(']]\n*[[') + ']]\n-->\n';
		
	var wikitext = "{{subst:AFC draft|" + config.inputdata.authorName + "}}\n" + redirectsList +
		config.pagedata.oldwikitext.replace(/\[\[\s*[Cc]ategory\s*:/g, "[[:Category:");

	// non-free files
	//  (derived from [[WP:XFDC]] - https://en.wikipedia.org/wiki/User:Evad37/XFDcloser.js )
	if ( nonfreefiles.length > 0 ) {
		// Start building regex strings
		normal_regex_str = "(";
		gallery_regex_str = "(";
		free_regex_str = "(";
		for ( var i=0; i<nonfreefiles.length; i++ ) {
			// Take off namespace prefix
			filename = nonfreefiles[i].replace(/^.*?:/, "");
			// For regex matching: first character can be either upper or lower case, special
			// characters need to be escaped, spaces can be either spaces or underscores
			filename_regex_str = "[" + mw.util.escapeRegExp(filename.slice(0, 1).toUpperCase()) +
			mw.util.escapeRegExp(filename.slice(0, 1).toLowerCase()) + "]" +
			mw.util.escapeRegExp(filename.slice(1)).replace(/ /g, "[ _]");
			// Add to regex strings
			normal_regex_str += "\\[\\[\\s*(?:[Ii]mage|[Ff]ile)\\s*:\\s*" + filename_regex_str +
			"\\s*\\|?.*?(?:(?:\\[\\[.*?\\]\\]).*?)*\\]\\]";
			gallery_regex_str += "^\\s*(?:[Ii]mage|[Ff]ile):\\s*" + filename_regex_str + ".*?$";
			free_regex_str += "\\|\\s*(?:[\\w\\s]+\\=)?\\s*(?:(?:[Ii]mage|[Ff]ile):\\s*)?" +
			filename_regex_str;
			
			if ( i+1 === nonfreefiles.length ) {
				normal_regex_str += ")(?![^<]*?-->)";
				gallery_regex_str += ")(?![^<]*?-->)";
				free_regex_str += ")(?![^<]*?-->)";
			} else {
				normal_regex_str += "|";
				gallery_regex_str += "|";
				free_regex_str += "|";				
			}
		}

		// Check for normal file usage, i.e. [[File:Foobar.png|...]]
		var normal_regex = new RegExp( normal_regex_str, "g");
		wikitext = wikitext.replace(normal_regex, "<!-- 注释： $1 -->");
		
		// Check for gallery usage, i.e. instances that must start on a new line, eventually
		// preceded with some space, and must include File: or Image: prefix
		var gallery_regex = new RegExp( gallery_regex_str, "mg" );
		wikitext = wikitext.replace(gallery_regex, "<!-- 注释： $1 -->");
		
		// Check for free usages, for example as template argument, might have the File: or Image:
		// prefix excluded, but must be preceeded by an |
		var free_regex = new RegExp( free_regex_str, "mg" );
		wikitext = wikitext.replace(free_regex, "<!-- 注释：$1 -->");
	}

	API.postWithToken( 'csrf', {
		action: 'edit',
		pageid: config.mw.wgArticleId,
		text: wikitext,
		summary: config.wikitext.editsummary + config.script.advert
	} )
	.done( function(){
		$("#M2D-task2").css({"color":"#000", "font-weight":""});
		$("#M2D-status2").html("完成！");
		notifyAuthor();
	} )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		var retry = confirm("无法编辑草稿页面：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n请选择[重试]或[跳过]");
		if ( retry ) {
			editWikitext(nonfreefiles);
		} else {
			$("#M2D-task2").css({"color":"#F00", "font-weight":""});
			$("#M2D-status2").html("已跳过");
			notifyAuthor();
		}
	} );
	
};

var notifyAuthor = function() {
	if ( !config.inputdata.notifyEnable ) {
		updateTalk();
		return;
	}
	$("#M2D-task3").css({"color":"#00F", "font-weight":"bold"});
	$("#M2D-status3").html("...");
	
	API.postWithToken( 'csrf', {
		action: 'edit',
		title: 'User talk:' + config.inputdata.authorName,
		section: 'new',
		sectiontitle: config.inputdata.notifyMsgHead,
		text: config.inputdata.notifyMsg,
	} )	
	.done( function(){
		$("#M2D-task3").css({"color":"#000", "font-weight":""});
		$("#M2D-status3").html("完成！");
		updateTalk();
	} )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		var retry = confirm("无法编辑页面创建者讨论页：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n请选择[重试]或[跳过]");
		if ( retry ) {
			notifyAuthor();
		} else {
			$("#M2D-task3").css({"color":"#F00", "font-weight":""});
			$("#M2D-status3").html("已跳过");
			updateTalk();
		}
	} );
};

var updateTalk = function() {
	$("#M2D-task4").css({"color":"#00F", "font-weight":"bold"});
	$("#M2D-status4").html("...");

	//if page exists, do a regex search/repace for class/importances parameters
	var processTalkWikitext = function(result) {
		var talk_id = result.query.pageids[0];
		if ( talk_id < 0 ) {
			$("#M2D-task4").css({"color":"#000", "font-weight":""});
			$("#M2D-status4").html("已完成（讨论页不存在）");
			draftifyLog();
			return;
		}
		var old_talk_wikitext = result.query.pages[talk_id].revisions[0]['*'];
		var new_talk_wikitext = old_talk_wikitext.replace(/(\|\s*(?:class|importance)\s*=\s*)[^\|}]*(?=[^}]*}})/g, "$1");
		if ( new_talk_wikitext === old_talk_wikitext ) {
			$("#M2D-task4").css({"color":"#000", "font-weight":""});
			$("#M2D-status4").html("已完成（无需更改）");
			draftifyLog();
			return;
		}

		API.postWithToken( 'csrf', {
			action: 'edit',
			pageid: talk_id,
			section: '0',
			text: new_talk_wikitext,
			summary: '在专题模板中移除质量和重要度评级' + config.script.advert
		} )
		.done( function(){
			$("#M2D-task4").css({"color":"#000", "font-weight":""});
			$("#M2D-status4").html("完成！");
			draftifyLog();
		} )
		.fail( function(c,r) {
			if ( r.textStatus === 'abort' ) { return; }
			
			var retry = confirm("无法编辑草稿的讨论页：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n请选择[重试]或[跳过]");
			if ( retry ) {
				updateTalk();
			} else {
				$("#M2D-task4").css({"color":"#F00", "font-weight":""});
				$("#M2D-status4").html("已跳过");
				draftifyLog();
			}
		} );		
		
	};	
	
	//get talk page wikitext (section 0)
	API.get( {
		action: 'query',
		titles: config.inputdata.newTitle.replace("Draft:", "Draft talk:"),
		prop: 'revisions',
		rvprop: 'content',
		rvsection: '0',
		indexpageids: 1
	} )
	.done( processTalkWikitext )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		var retry = confirm("无法找到草稿的讨论页：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n请选择[重试]或[跳过]");
		if ( retry ) {
			updateTalk();
		} else {
			$("#M2D-task4").css({"color":"#F00", "font-weight":""});
			$("#M2D-status4").html("已跳过");
			draftifyLog();
		}
	} );
	
};

var draftifyLog = function() {
	if (config.doNotLog) {
		$("#M2D-finished, #M2D-abort").toggle();
		return;
	}

	$("#M2D-task5").css({"color":"#00F", "font-weight":"bold"});
	$("#M2D-status5").html("...");
	
	var logpage = 'User:' + config.mw.wgUserName + '/Draftify_log';
	var monthNames = config.mw.wgMonthNames.slice(1);
	var now = new Date();
	var heading = '== ' + now.getUTCFullYear() + '年' + monthNames[now.getUTCMonth()] +  ' ==';
	var headingPatt = RegExp(heading);
	
	var processLogWikitext = function(result) {
		var logpage_wikitext = '';
		
		var id = result.query.pageids[0];
		if ( id < 0 ) {
			var createlog = confirm('是否要记录草稿化日志（于' +  logpage + '）？');
			if ( !createlog ) {
				$("#M2D-task5").css({"color":"#F00", "font-weight":""});
				$("#M2D-status5").empty().append("已跳过");
				$("#M2D-finished, #M2D-abort").toggle();
				return;
			}
			logpage_wikitext = '这是该用户使用[[User:94rain/js/MoveToDraft|草稿化脚本]]草稿化的页面列表。'; 
		} else {
			logpage_wikitext = result.query.pages[id].revisions[0]['*'].trim();
		}
		
		if ( !headingPatt.test(logpage_wikitext) ) {
			logpage_wikitext += '\n\n' + heading;
		}
		logpage_wikitext += '\n' + config.inputdata.logMsg;
		
		API.postWithToken( 'csrf', {
			action: 'edit',
			title: logpage,
			text: logpage_wikitext,
			summary: '记录对[['+config.inputdata.newTitle+']]的草稿化' + config.script.advert
		} )	
		.done( function(){
			$("#M2D-task5").css({"color":"#000", "font-weight":""});
			$("#M2D-status5").html("完成！");
			$("#M2D-finished, #M2D-abort").toggle();
		} )
		.fail( function(c,r) {
			if ( r.textStatus === 'abort' ) { return; }
			
			var retry = confirm("无法编辑日志页面：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n请选择[重试]或[跳过]");
			if ( retry ) {
				draftifyLog();
			} else {
				$("#M2D-task5").css({"color":"#F00", "font-weight":""});
				$("#M2D-status5").html("已跳过");
				$("#M2D-finished, #M2D-abort").toggle();
			}
		} );
	};
	
	//get log page wikitext
	API.get( {
		action: 'query',
		titles: logpage,
		prop: 'revisions',
		rvprop: 'content',
		indexpageids: 1
	} )
	.done( processLogWikitext )
	.fail( function(c,r) {
		if ( r.textStatus === 'abort' ) { return; }
		
		var retry = confirm("无法找到日志页面：\n"+ extraJs.makeErrorMsg(c, r)+"\n\n请选择[重试]或[跳过]");
		if ( retry ) {
			draftifyLog();
		} else {
			$("#M2D-task5").css({"color":"#F00", "font-weight":""});
			$("#M2D-status5").html("已跳过");
			$("#M2D-finished, #M2D-abort").toggle();
		}
	} );
};

// --- Interface screens ---
//0) Initial screen
var screen0 = function() {
	$("#M2D-interface-header, #M2D-interface-content, #M2D-interface-footer").empty();
	$("#M2D-interface-header").text("移动至草稿...");
	$("#M2D-interface-content").text("记录于日志...");
	grabPageData();
};

//1) User inputs
var screen1 = function() {
	$("#M2D-interface-header, #M2D-interface-content, #M2D-interface-footer").empty();
	$("#M2D-interface-header").text("移动至草稿：选项");
	
	$("#M2D-interface-content").append(
		$('<div>').css('margin-bottom','0.5em').append(
			$('<label>').attr('for','M2D-option-newtitle').append(
				'移动至',
				$('<b>').text('Draft:')
			),
			$('<input>').attr({'type':'text', 'name':'M2D-option-newtitle', 'id':'M2D-option-newtitle'})
		),

		$('<div>').css('margin-bottom','0.5em').append(
			$('<label>').attr({'for':'M2D-option-movelog', 'id':'M2D-option-movelog-label'})
				.css('display','block').text('移动原因：'),
			$('<textarea>').attr({'rows':'1', 'name':'M2D-option-movelog', 'id':'M2D-option-movelog'})
				.css('width','99%')
		),
		
		$('<div>').css('margin-bottom','0.5em').append(
			$('<label>').attr({'for':'M2D-option-author', 'id':'M2D-option-author-label'}).text('页面创建者：'),
			$('<input>').attr({'type':'text', 'name':'M2D-option-author', 'id':'M2D-option-author'})
		),
		
		$('<label>').attr({'for':'M2D-option-message-enable'}).append(
			$('<input>').attr({'type':'checkbox', 'id':'M2D-option-message-enable'})
				.prop('checked', true),
			'通知页面创建者'
		),
		$('<label>').attr({'for':'M2D-option-message-head', 'id':'M2D-option-message-head-label'})
			.css({'display':'block', 'margin-top':'0.5em'}).text('通知章节标题'),
		$('<textarea>').attr({'id':'M2D-option-message-head', 'rows':'1'})
			.css({'width':'99%', 'margin-bottom':'0.5em'}),
		$('<label>').attr({'for':'M2D-option-message', 'id':'M2D-option-message-label'})
			.css('display','block').text('通知消息：'),
		$('<textarea>').attr({'id':'M2D-option-message', 'rows':'6'})
			.css('width','99%')
	);
	
	$('#M2D-option-movelog').val(config.wikitext.rationale);
	$('#M2D-option-newtitle').val(getPageText(config.mw.wgPageName)).change(function() {
		$('#M2D-option-message-head').val(
			$('#M2D-option-message-head').val().trim()
			.replace(/\[\[Draft\:.*?\|/, "[[Draft:" + $('#M2D-option-newtitle').val().trim() + "|")
		);
		$('#M2D-option-message').val(
			$('#M2D-option-message').val().trim()
			.replace(/\[\[Draft\:.*?\|/, "[[Draft:" + $('#M2D-option-newtitle').val().trim() + "|")
		);
	});
	$('#M2D-option-author').val(config.pagedata.author);
	$('#M2D-option-message-enable').change(function() {
		$('#M2D-option-message-head').prop('已禁用', !this.checked);
		$('#M2D-option-message').prop('已禁用', !this.checked);
	});
	$('#M2D-option-message-head').val(config.wikitext.notification_heading.replace(/\$1/g, getPageText(config.mw.wgPageName)));
	$('#M2D-option-message').val(config.wikitext.notification.replace(/\$1/g, getPageText(config.mw.wgPageName)));
	
	$("#M2D-interface-footer").append(
		$('<button>').attr('id', 'M2D-next').text('继续'),
		$('<button>').attr('id', 'M2D-cancel').css('margin-left','3em').text('取消')
	);

	$("#M2D-cancel").click(function(){
		$("#M2D-modal").remove();
	});

		
	$("#M2D-next").click(function(){
		//Gather inputs
		config.inputdata = {
			rationale:		$('#M2D-option-movelog').val().trim(),
			newTitle: 		"Draft:" + $('#M2D-option-newtitle').val().trim(),
			authorName: 	$('#M2D-option-author').val().trim(),
			notifyEnable:		$('#M2D-option-message-enable').prop('checked'),
			notifyMsgHead:	$('#M2D-option-message-head').val().trim(),
			notifyMsg:		$('#M2D-option-message').val().trim()
		};
		config.inputdata.logMsg = config.wikitext.logMsg
			.replace(/\$1/g, getPageText(config.mw.wgPageName))
			.replace(/\$2/g, config.inputdata.newTitle);

		//Verify inputs
		var errors=[];
		if ( config.inputdata.newTitle.length === 0 ) {
			errors.push("目标草稿页无效");
		}
		if ( config.inputdata.authorName.length === 0 ) {
			errors.push("用户名无效");
		}
		if ( config.inputdata.rationale.length === 0 ) {
			errors.push("移动原因为空");
		}
		if ( config.inputdata.notifyEnable ) {
			if ( config.inputdata.notifyMsgHead.length === 0 ) {
				errors.push("通知章节标题为空");
			}
			if ( config.inputdata.notifyMsg.length === 0 ) {
				errors.push("通知消息为空");
			}
		}
		if ( errors.length >= 1 ) {
			alert("Error:\n\n" + errors.join(";\n"));
			return;
		}
		
		//start process off
		screen2();
	});

};

//2) Progress indicators	
var screen2 = function() {
	$("#M2D-interface-header, #M2D-interface-content, #M2D-interface-footer").empty();
	$("#M2D-interface-header").text("移动至草稿：处理中...");
	$("#M2D-interface-content").append(
		$('<ul>').attr('id', 'M2D-tasks').css("color", "#888").append(
			$('<li>').attr('id', 'M2D-task0').append(
				'移动页面... ',
				$('<span>').attr('id','M2D-status0').text('等待中')
			),
			$('<li>').attr('id', 'M2D-task1').append(
				'检查图片... ',
				$('<span>').attr('id','M2D-status1').text('等待中')
			),	
			$('<li>').attr('id', 'M2D-task2').append(
				'编辑页面维基文本... ',
				$('<span>').attr('id','M2D-status2').text('等待中')
			),
			config.inputdata.notifyEnable ?
				$('<li>').attr('id', 'M2D-task3').append(
					'通知页面创建者...',
					$('<span>').attr('id','M2D-status3').text('等待中')
				)
				: '',
			$('<li>').attr('id', 'M2D-task4').append(
				'更新讨论页专题评级模板... ',
				$('<span>').attr('id','M2D-status4').text('等待中')
			),
			
			$('<li>').attr('id', 'M2D-task5').append(
				'记录于日志... ',
				config.doNotLog
					? $('<span>').attr('font-size', '90%' ).text('已禁用')
					: $('<span>').attr('id','M2D-status5').text('等待中')
			)
		)
	);
	
	$("#M2D-interface-footer").append(
		$('<button>').attr('id', 'M2D-abort').text('中止未完成操作'),
		$('<span>').attr('id', 'M2D-finished').hide().append(
			'全部完成！',
			$('<button>').attr('id', 'M2D-close').text('关闭')
		)
	);

	$("#M2D-close").click( function(){
		$("#M2D-modal").remove();
		window.location.reload();
	} );
	$("M2D-abort").click( function(){
		API.abort();
		$("#M2D-modal").remove();
		window.location.reload();
	} );
		
	//Start task 0. The rest are done sequentially as each task is completed (or skipped).
	movePage();
};

// --- Add link to 'More' menu (or user-specified portlet) which starts everything ---
mw.util.addPortletLink( (window.m2d_portlet||'p-cactions'), '#', '移动至草稿', 'ca-m2d', null, null, "#ca-move");
$('#ca-m2d').on('click', function(e) {
	e.preventDefault();
	// Add interface shell
	$('body').prepend('<div id="M2D-modal">'+
		'<div id="M2D-interface">'+
			'<h4 id="M2D-interface-header"></h4>'+
			'<hr>'+
			'<div id="M2D-interface-content"></div>'+
			'<hr>'+
			'<div id="M2D-interface-footer"></div>'+
		'</div>'+
	'</div>');
	
	// Interface styling
	$("#M2D-modal").css({
		"position": "fixed",
		"z-index": "1",
		"left": "0",
		"top": "0",
		"width": "100%",
		"height": "100%",
		"overflow": "auto",
		"background-color": "rgba(0,0,0,0.4)"
	});
	$("#M2D-interface").css({
		"background-color": "#f0f0f0",
		"margin": "15% auto",
		"padding": "2px 20px",
		"border": "1px solid #888",
		"width": "80%",
		"max-width": "60em",
		"font-size": "90%"
	});
	$("#M2D-interface-content").css("min-height", "7em");
	$("#M2D-interface-footor").css("min-height", "3em");
		
	// Initial interface content
	screen0();
});


// End of function moveToDraft
};

/* ========== Log draftifications for a user ==================================================== */
function logDraftifications(username, fromDate) {
	var targetUser = username;
	if (!targetUser && targetUser!=="") {
		var pageNameParts = config.mw.wgPageName.split('/');
		targetUser = (pageNameParts.length > 1) ?  pageNameParts[1] : '';
	}
	$('#mw-content-text').empty();	
	// TODO: Form for setting user
	var today = new Date().toISOString().slice(0,10);
	var MoveToDraftEpoch = "2017-05-29"
	$('#mw-content-text').append(
		$(`<form id='draftifyLogForm' style='border: 1px solid #ccc; margin: 1em 0; padding: 0 0.5em;'>
			<div style="display:inline-block;padding:0.5em">
				<label for="draftifyUsername">用户:</label>
				<input type="text" name="username" id="draftifyUsername" />
			</div>
			<div style="display:inline-block;padding:0.5em">
				<label for="draftifyFromDate">最晚截至</label>
				<input type="date" id="draftifyFromDate" name="fromDate" value="${fromDate || today}" />
			</div>
			<div style="display:inline-block;padding:0.5em">
				<input type="submit" value="Show" />
			</div>
			</form>
		`)
	);
	$('#draftifyUsername').val(targetUser);
	$('#draftifyLogForm').on('submit', function(e) {
		e.preventDefault();
		$('#draftifyLog, #draftifyLogWikitext').show();
		logDraftifications($('#draftifyUsername').val(), $('#draftifyFromDate').val())
	})
	
	$('#mw-content-text').append(
		$(`<table id='draftifyLog' class='wikitable sortable' style='width:100%'>
		<thead><tr>
			<th scope='col'>从</th>
			<th scope='col'>至</th>
			<th scope='col'>时间</th>
			<th scope='col'>用户</th>
			<th scope='col'>原因</th>
		</tr></thead>
		<tbody></tbody>
		<tfoot><tr>
			<td colspan=5 id="draftifyStatus">加载中...</td>
		</tr></tfoot>
		</table>
		<textarea id="draftifyLogWikitext" disabled="disabled" rows="10">
		`)
	);

	$('#draftifyLogWikitext').val(`{|class="wikitable"
|-
!scope='col'|从
!scope='col'|至
!scope='col'|时间
!scope='col'|用户
!scope='col'|原因
|}`);

	var query = {
		action: "query",
		format: "json",
		list: "logevents",
		leprop: "title|timestamp|comment|details|user",
		letype: "move",
		lenamespace: "0",
		lelimit: "500",
		lestart: (fromDate || today) + "T23:59:59Z"
	};
	if (targetUser) {
		query.leuser = targetUser;
	}

	var continueInfo = {};

	function onLoadMoreClick(e) {
		e.preventDefault();
		$('#draftifyStatus').empty().text("加载中...");
		searchAndShowResults();
	}

	function parseLogTable(wikitext) {
		API.post({
			"action": "parse",
			"format": "json",
			"text": wikitext,
			"prop": "text",
			"contentmodel": "wikitext"
		}).then(function(response) {
			$parsedLogTable = $(response.parse.text['*']);
			$('#draftifyLog tbody').empty().append(
				$parsedLogTable.find('tr').slice(1)
			);
		});
	}

	function searchAndShowResults() {
		API.get( $.extend({}, query, continueInfo) )
			.then(function(response) {
				// Store continuing info, if any
				continueInfo = response.continue || {};
				// Reset status, add a "Load more" if there are more results
				$('#draftifyStatus').empty().append(
					response.continue
						? $('<a>').css("cursor", "pointer").text('加载更多').click(onLoadMoreClick)
						: null
				);
				// Filter to only MoveToDraft script moves
				var draftifyEvents = response.query && response.query.logevents && response.query.logevents.filter(function(logevent) {
					return logevent.params.target_ns === 118; // Moved to Draft namespace
				});
				var noDraftifyEvents = !draftifyEvents || !draftifyEvents.length;

				switch(true) {
					case noDraftifyEvents && !response.continue:
						$('#draftifyStatus').empty().text(
							$('#draftifyLog tbody tr').length == 0 ? "无结果" : "无更多结果"
						);
						break;
					case noDraftifyEvents:
						// Continue with next batch of results, otherwise table will initially have no results but a load more link,
						// or clicking "Load more" will appear to show "Loading..." but not actually add any results
						searchAndShowResults();
						break;
					case !response.continue:
						$('#draftifyStatus').empty().text("无更多结果");
						/* falls through */
					default:
						draftifyEvents.forEach(function(logevent) {
							var fromTitle = logevent.title;
							var toTitle = logevent.params.target_title;
							var timeOfMove = new Date(logevent.timestamp).toLocaleString().replace("GMT", "(UTC)");
							var user = logevent.user;
							var comment = logevent.comment;
							var wikitext = $('#draftifyLogWikitext').val().replace("|}", `|-
|[[${fromTitle}]]
|[[${toTitle}]]
|${timeOfMove}
|[[User:${user}|${user}]]
|${comment}
|}`);
							$('#draftifyLogWikitext').val(wikitext);
							parseLogTable(wikitext)
						});
				}
			})
	}

	// Run by default, unless page loaded without a /username suffix
	if (username || username==="") {
		searchAndShowResults();
	} else {
		$('#draftifyLog, #draftifyLogWikitext').hide();
	}

// End of function logDraftifications
}

/* ========== Setup ============================================================================= */
// Access draftifications using Special:Draftify_log/USER_NAME
var isDraftifyLogPage = config.mw.wgPageName.indexOf("Special:Draftify_log") === 0;
var isUserPage = config.mw.wgNamespaceNumber === 2 || config.mw.wgNamespaceNumber === 3;
if (isDraftifyLogPage) {
	document.title = "Draftify log - 维基百科"
	$('h1').text("Draftify log");
	$('#mw-content-text').empty()
	.text("Loading...")
	.before(
		$('<span>').append(
			'注意：此页面仅在安装',
			$('<a>').attr('href','/wiki/User:94rain/js/MoveToDraft').text('MoveToDraft'),
			'后可见。'
		),
		$('<hr>')
	);
	logDraftifications();
} else if (isUserPage) {
	var user = config.mw.wgTitle.split('/')[0];
	var url = mw.util.getUrl("Special:Draftify_log/" + user);
	mw.util.addPortletLink( (window.m2d_portlet||'p-cactions'), url, 'Draftity log', 'ca-m2dlog', null, null, "#ca-move");
}

// Only operate in article namespace
if( config.mw.wgNamespaceNumber !== 0 ) {
	return;
}

// Only operate for existing pages
if ( config.mw.wgCurRevisionId === 0 ) {
	return;
}

// Load extra.js if not already available
if ( window.extraJs == null ) {
	importScript('User:94rain/js/Draft-extra.js');
}
moveToDraft();


});
// </nowiki>