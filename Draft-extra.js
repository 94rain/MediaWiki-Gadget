/***************************************************************************************************
 extra.js --- by Evad37
 > Common helper functions, stored in the window.extraJs object.
 > Version 2.1.6
----------------------------------------------------------------------------------------------------
 Take care to load approriate resource loader modules, as specified for each function. Or just load
 all that may be required, like this:
 
 mw.loader.using( ['mediawiki.util', 'mediawiki.api', 'mediawiki.Title',
	'oojs-ui-core', 'oojs-ui-widgets', 'oojs-ui-windows'], function () {

 // ... your code goes here...

 });
 
***************************************************************************************************/
// <nowiki>

window.extraJs = { version: '2.1.6' };

/**
 * makeApiErrorMsg
 *
 * Makes an error message, suitable for displaying to a user, from the values
 * that the MediaWiki Api passes to the failure callback function, e.g.
 * `new mw.Api.get(queryObject}).done(successCallback).fail(failureCallback)`
 *
 * @param {string} code
 *  First paramater passed to failure callback function.
 * @param {jQuery.jqXHR} jqxhr
 *  Second paramater passed to failure callback function.
 * @return {string} Error message details, with in a format like
 *  "(API|HTTP) error: details"
 */
extraJs.makeErrorMsg = function(code, jqxhr) {
	var details = '';
	if ( code === 'http' && jqxhr.textStatus === 'error' ) {
		details = 'HTTP error ' + jqxhr.xhr.status;
	} else if ( code === 'http' ) {
		details = 'HTTP error: ' + jqxhr.textStatus;
	} else if ( code === 'ok-but-empty' ) {
		details = 'Error: Got an empty response from the server';
	} else {
		details = 'API error: ' + code;
	}
	return details;
};

/**
 * makeLink
 *
 * Makes a link to a en.Wikipedia page that opens in a new tab/window.
 * 
 * @requires {Module} mediawiki.util
 * @param {string} linktarget
 *  The target page.
 * @param {string} linktext
 *  Text to display in the link. Optional, if not provided the target will be used.
 * @return {jQuery} jQuery object containing the `<a>` element.
 */
extraJs.makeLink = function(linktarget, linktext) {
	if ( linktext == null ) {
		linktext = linktarget;
	}
	return $('<a>').attr({
		'href':'https://en.wikipedia.org/wiki/'+mw.util.wikiUrlencode(linktarget),
		'target':'_blank'
	}).text(linktext);
};

/**
 * makeTooltip
 *
 * Make a question mark in a circle that shows a 'tooltip' when hovered over
 *
 * @param {string} tipText
 *  The text for the tooltip.
 * @return {jQuery} jQuery object containing the tooltip element
 */
extraJs.makeTooltip = function(tipText) {
	// Add css rule, if not already added
	if ( !extraJs.tooltipStyle ) {
		var s = mw.loader.addStyleTag('.ejs-tooltip { border:1px solid #33a; border-radius:10px; '+
		'font-weight:bold; font-size:80%; color:#22a; padding:0px; cursor:help }');
		extraJs.tooltipStyle = s.sheet || s.styleSheet || s;
	}
	return $('<span>').attr({'title':tipText, 'class':'ejs-tooltip'}).html('&thinsp;?&thinsp;');
};

/**
 * multiButtonConfirm
 *
 * Uses OOjs UI to create a multi-button confirm dialogue.
 *
 * @requires {Modules} oojs-ui-core, oojs-ui-windows, mediawiki.util
 * @param {string} title
 *  Title for the dialogue.
 * @param {string} message
 *  Message for the dialogue. Certain HTML tags can be escaped, newline characters are ignored.
 * @param {object[]} buttons
 *  Array of objects which each represent a buttons to show at the bottom of the prompt.
 *  Each object can be of the form
 *  `{
 *    label: {string},
 *    action: {string|null},
 *    flags: {string|null},
 *   }`
 *  where `label` is the label to show on the button, `action` is the value passed to the callback
 *  function if that button is selected by the user, and `flags` is one of "safe", "primary",
 *  "progressive", or "destructive", per https://www.mediawiki.org/wiki/OOjs_UI/Elements/Flagged
 * @param {function} callback
 *  callback function executed after a button is selected (passed that button's `action` value)
 * @param {object} options
 *  Display options:
 *   @param {boolean} options.verbose
 *    Display verbose message formatting (left- instead of center-aligned)
 *   @param {boolean} options.unescape
 *    Unescape the following simple HTML tags (no attributes) in the message:
 *    <br>, <p>, <ul>, <li>, <pre> (and matching closing tags or self-closed tags).
 *    Tags within <pre> tags will not be unescaped.
 *   @param {boolean} options.wikilinks
 *    Convert [[wikilinks]] into actual links. If `options.unescape` is set to `true`, wikilinks
 *    within <pre> tags will not be converted.
 */
extraJs.multiButtonConfirm = function(title, message, buttons, callback, options) {
	// If needed, create array of deferreds
	if ( !extraJs.multiButtonConfirm.dfd ) {
		extraJs.multiButtonConfirm.dfd = [$.Deferred().resolve()];
	}
	
	// Add Deferred, to be resoved when previous window is done
	var dfdIndex = extraJs.multiButtonConfirm.dfd.push($.Deferred()) - 1;
	
	// Open window when previous window's Deferred is resolved
	extraJs.multiButtonConfirm.dfd[dfdIndex-1].done(function(){
		extraJs.multiButtonConfirm.windowManager = new OO.ui.WindowManager();
		var windowManager = extraJs.multiButtonConfirm.windowManager;
		var messageDialog = new OO.ui.MessageDialog();
		$('body').append( windowManager.$element );
		windowManager.addWindows( [ messageDialog ] );
		var instance = windowManager.openWindow( messageDialog, {
			title: title,
			message: message,
			verbose: options && options.verbose,
			actions: buttons
		} );
		instance.opened.then( function() {
			if ( options && ( options.unescape || options.wikilinks ) ) {
				// Escaped message text
				var msg = $('label.oo-ui-messageDialog-message')
					.filter(':visible')
					.text();
				
				// Unescape escaped html - pre tags			
				if ( options.unescape ) {
					// Process pre tags first (this way the only unescaped `<`s will be for pre tags)
					msg = msg.replace(/&lt;(\/?pre\s?\/?)&gt;/g,'<$1>');
				}
				
				// Make wikilinks into real links
				if ( options.wikilinks ) {
					var path = 'https:' + mw.config.get('wgServer') + '/wiki/';
					// First piped links, then simple links (unless inside <pre> tags)
					msg = msg.replace(
						/\[\[([^\|\]]*?)\|([^\|\]]*?)\]\](?![^<]*?<\/pre>)/g,
						'<a href="' + path + mw.util.wikiUrlencode('$1') + '" target="_blank">$2</a>'
					).replace(
						/\[\[([^\|\]]+?)]\](?![^<]*?<\/pre>)/g,
						'<a href="' + path + mw.util.wikiUrlencode('$1') + '" target="_blank">$1</a>'
					);
				}
				
				// Unescape escaped html - other tags			
				if ( options.unescape ) {
					// Process other tags, unless inside <pre> tags
					msg = msg.replace(/&lt;(\/?(?:br|p|ul|li)\s?\/?)&gt;(?![^<]*?<\/pre>)/g,'<$1>');
				}
				
				// Replace message
				$('label.oo-ui-messageDialog-message')
				.filter(':visible')
				.html(msg);
				
				// Resize dialogue to fit
				messageDialog.updateSize();
			}
		} );
		instance.closed.then( function ( data ) {
			if ( data && data.action ) {
				callback(data.action);
			} else {
				callback(null);
			}
			windowManager.destroy();
			// Resolve this window's Deferred
			extraJs.multiButtonConfirm.dfd[dfdIndex].resolve();
		} );
	});
};

/** Template
 *
 * @class
 * Represents the wikitext of template transclusion. Used by #parseTemplates.
 * @prop {String} name Name of the template
 * @prop {String} wikitext Full wikitext of the transclusion
 * @prop {Object[]} parameters Parameters used in the translcusion, in order, of form:
	{
		name: {String|Number} parameter name, or position for unnamed parameters,
		value: {String} Wikitext passed to the parameter (whitespace trimmed),
		wikitext: {String} Full wikitext (including leading pipe, parameter name/equals sign (if applicable), value, and any whitespace)
	}
 * @constructor
 * @param {String} wikitext Wikitext of a template transclusion, starting with '{{' and ending with '}}'.
 */
extraJs.Template = function(wikitext) {
	this.wikitext = wikitext;
	this.parameters = [];
};
extraJs.Template.constructor = extraJs.Template;
extraJs.Template.prototype.addParam = function(name, val, wikitext) {
	this.parameters.push({
		'name': name,
		'value': val, 
		'wikitext': '|' + wikitext
	});
};
/**
 * Get a parameter data by parameter name
 */ 
extraJs.Template.prototype.getParam = function(paramName) {
	return this.parameters.find(function(p) { return p.name == paramName; });
};
extraJs.Template.prototype.setName = function(name) {
	this.name = name.trim();
};

/**
 * parseTemplates
 *
 * Parses templates from wikitext.
 * Based on SD0001's version at <https://en.wikipedia.org/wiki/User:SD0001/parseAllTemplates.js>.
 * Returns an array containing the template details:
 *  var templates = parseTemplates("Hello {{foo |Bar|baz=qux |2=loremipsum|3=}} world");
 *  console.log(templates[0]); // --> object
	{
		name: "foo",
		wikitext:"{{foo |Bar|baz=qux | 2 = loremipsum  |3=}}",
		parameters: [
			{
				name: 1,
				value: 'Bar',
				wikitext: '|Bar'
			},
			{
				name: 'baz',
				value: 'qux',
				wikitext: '|baz=qux '
			},
			{
				name: '2',
				value: 'loremipsum',
				wikitext: '| 2 = loremipsum  '
			},
			{
				name: '3',
				value: '',
				wikitext: '|3='
			}
		],
		getParam: function(paramName) {
			return this.parameters.find(function(p) { return p.name == paramName; });
		}
	}
 *    
 * 
 * @param {String} wikitext
 * @param {Boolean} recursive Set to `true` to also parse templates that occur within other templates,
 *  rather than just top-level templates. 
 * @return object[]
*/
extraJs.parseTemplates = function(wikitext, recursive) {
	
 	var strReplaceAt = function(string, index, char) {
		return string.slice(0,index) + char + string.slice(index + 1);
	};

	var result = [];
	
	var processTemplateText = function (startIdx, endIdx) {
		var text = wikitext.slice(startIdx, endIdx);

		var template = new extraJs.Template('{{' + text.replace(/\1/g,'|') + '}}');
		
		// swap out pipe in links with \1 control character
		// [[File: ]] can have multiple pipes, so might need multiple passes
		while ( /(\[\[[^\]]*?)\|(.*?\]\])/g.test(text) ) {
			text = text.replace(/(\[\[[^\]]*?)\|(.*?\]\])/g, '$1\1$2');
		}

		var chunks = text.split('|').map(function(chunk) {
			// change '\1' control characters back to pipes
			return chunk.replace(/\1/g,'|'); 
		});

		template.setName(chunks[0]);
		
		var parameterChunks = chunks.slice(1);

		var unnamedIdx = 1;
		parameterChunks.forEach(function(chunk) {
			var indexOfEqualTo = chunk.indexOf('=');
			var indexOfOpenBraces = chunk.indexOf('{{');
			
			var isWithoutEquals = !chunk.includes('=');
			var hasBracesBeforeEquals = chunk.includes('{{') && indexOfOpenBraces < indexOfEqualTo;	
			var isUnnamedParam = ( isWithoutEquals || hasBracesBeforeEquals );
			
			var pName, pNum, pVal;
			if ( isUnnamedParam ) {
				// Get the next number not already used by either an unnamed parameter, or by a
				// named parameter like `|1=val`
				while ( template.getParam(unnamedIdx) ) {
					unnamedIdx++;
				}
				pNum = unnamedIdx;
				pVal = chunk.trim();
			} else {
				pName = chunk.slice(0, indexOfEqualTo).trim();
				pVal = chunk.slice(indexOfEqualTo + 1).trim();
			}
			template.addParam(pName || pNum, pVal, chunk);
		});
		
		result.push(template);
	};

	
	var n = wikitext.length;
	
	// number of unclosed braces
	var numUnclosed = 0;

	// are we inside a comment or between nowiki tags?
	var inComment = false;
	var inNowiki = false;

	var startIdx, endIdx;
	
	for (var i=0; i<n; i++) {
		
		if ( !inComment && !inNowiki ) {
			
			if (wikitext[i] === '{' && wikitext[i+1] === '{') {
				if (numUnclosed === 0) {
					startIdx = i+2;
				}
				numUnclosed += 2;
				i++;
			} else if (wikitext[i] === '}' && wikitext[i+1] === '}') {
				if (numUnclosed === 2) {
					endIdx = i;
					processTemplateText(startIdx, endIdx);
				}
				numUnclosed -= 2;
				i++;
			} else if (wikitext[i] === '|' && numUnclosed > 2) {
				// swap out pipes in nested templates with \1 character
				wikitext = strReplaceAt(wikitext, i,'\1');
			} else if ( /^<!--/.test(wikitext.slice(i, i + 4)) ) {
				inComment = true;
				i += 3;
			} else if ( /^<nowiki ?>/.test(wikitext.slice(i, i + 9)) ) {
				inNowiki = true;
				i += 7;
			} 

		} else { // we are in a comment or nowiki
			if (wikitext[i] === '|') {
				// swap out pipes with \1 character
				wikitext = strReplaceAt(wikitext, i,'\1');
			} else if (/^-->/.test(wikitext.slice(i, i + 3))) {
				inComment = false;
				i += 2;
			} else if (/^<\/nowiki ?>/.test(wikitext.slice(i, i + 10))) {
				inNowiki = false;
				i += 8;
			}
		}

	}
	
	if ( recursive ) {
		var subtemplates = result.map(function(template) {
			return template.wikitext.slice(2,-2);
		})
		.filter(function(templateWikitext) {
			return /\{\{.*\}\}/.test(templateWikitext);
		})
		.map(function(templateWikitext) {
			return extraJs.parseTemplates(templateWikitext, true);
		});
		
		return result.concat.apply(result, subtemplates);
	}

	return result;

};

 
/**
 * toSentenceCase
 *
 * Capitalises the first letter of a string.
 *
 * @param {String} input
 *  The string to be transformed.
 * @param {Boolean} lc
 *  Transform the characters following the first character to lowercase
 * @returns {String} Transformed string.
 */
extraJs.toSentenceCase = function(input, lc) {
	return input.slice(0,1).toUpperCase() +
		(( lc ) ? input.slice(1).toLowerCase() : input.slice(1));
};

/**
 * uniqueArray
 *
 * Filters out possible duplicate values from an array.
 *
 * @param {array} a
 *  Array to be filtered.
 * @return {array} Filtered array.
 */
extraJs.uniqueArray = function(a) {
	return a.filter(function(val, i, arr){ return arr.indexOf(val) === i; });
};

/**
 * unlink
 *
 * Function to unlink and/or remove links and file usages from a block of wikitext.
 * Derived from XFDcloser < https://en.wikipedia.org/wiki/User:Evad37/XFDcloser.js >
 *
 * @requires {Module} mediawiki.util, User:SD0001/parseTemplate.js
 * @param {string} wikitext
 *  Wikitext in which to search for links or file usages.
 * @param {string[]} unlinkThese
 *  Array of page titles to be unlinked.
 * @param {number} ns
 *  Number of the namespace which the wikitext is in.
 * @param {boolean} isDab
 *  Wikitext is of a disambiguation page.
 * @return {string} Updated wikitext. If no links or file usages were found, this will be
 *  the same as the input wikitext.
 */
extraJs.unlink = function(wikitext, unlinkThese, ns, isDab) {
	// Remove image/file usages, if any titles are files
	var unlinkFiles = unlinkThese.filter(function(t){ return /^File:/i.test(t); });
	if ( unlinkFiles.length > 0 ) {
		// Start building regex strings
		var normal_regex_str = "(";
		var gallery_regex_str = "(";
		var free_regex_str = "(";
		for ( var i=0; i<unlinkFiles.length; i++ ) {
			// Take off namespace prefix
			filename = unlinkFiles[i].replace(/^.*?:/, "");
			// For regex matching: first character can be either upper or lower case, special
			// characters need to be escaped, spaces/underscores can be either spaces or underscores
			filename_regex_str = "[" + mw.util.escapeRegExp(filename.slice(0, 1).toUpperCase()) +
			mw.util.escapeRegExp(filename.slice(0, 1).toLowerCase()) + "]" +
			mw.util.escapeRegExp(filename.slice(1)).replace(/(?: |_)/g, "[ _]");
			// Add to regex strings
			normal_regex_str += "\\[\\[\\s*(?:[Ii]mage|[Ff]ile)\\s*:\\s*" + filename_regex_str +
			"\\s*\\|?.*?(?:(?:\\[\\[.*?\\]\\]).*?)*\\]\\]";
			gallery_regex_str += "^\\s*(?:[Ii]mage|[Ff]ile):\\s*" + filename_regex_str + ".*?$";
			free_regex_str += "\\|\\s*(?:[\\w\\s]+\\=)?\\s*(?:(?:[Ii]mage|[Ff]ile):\\s*)?" +
			filename_regex_str;
			
			if ( i+1 !== unlinkFiles.length ) {
				normal_regex_str += "|";
				gallery_regex_str += "|";
				free_regex_str += "|";				
			}
		}
		// Close off regex strings
		normal_regex_str += ")(?![^<]*?-->)";
		gallery_regex_str += ")(?![^<]*?-->)";
		free_regex_str += ")(?![^<]*?-->)";

		// Check for normal file usage, i.e. [[File:Foobar.png|...]]
		var normal_regex = new RegExp( normal_regex_str, "g");
		wikitext = wikitext.replace(normal_regex, "");
		
		// Check for gallery usage, i.e. instances that must start on a new line, eventually
		// preceded with some space, and must include File: or Image: prefix
		var gallery_regex = new RegExp( gallery_regex_str, "mg" );
		wikitext = wikitext.replace(gallery_regex, "");
		
		// Check for free usages, for example as template argument, might have the File: or Image:
		// prefix excluded, but must be preceeded by an |
		var free_regex = new RegExp( free_regex_str, "mg" );
		wikitext = wikitext.replace(free_regex, "");
	}
	
	// Remove portal links/templates, if there are any	
	var unlinkPortals = unlinkThese.filter(function(t){ return /^Portal:/i.test(t); });
	if ( unlinkPortals.length > 0 ) {
		// Build regex string
		var portal_regex_str = "(" +
			unlinkPortals.map(function(portal) {
				// Take off namespace prefix
				portalname = portal.replace("Portal:", "");
				// For regex matching: first character can be either upper or lower case, special
				// characters need to be escaped, spaces/underscores can be either spaces or underscores
				return "[" + mw.util.escapeRegExp(portalname.slice(0, 1).toUpperCase()) +
					mw.util.escapeRegExp(portalname.slice(0, 1).toLowerCase()) + "]" +
					mw.util.escapeRegExp(portalname.slice(1)).replace(/(?: |_)/g, "[ _]");
			}).join('|') +
			")(?![^<]*?-->)"; // Close off regex string
		var portal_regex = new RegExp(portal_regex_str);

		// Find templates to remove parameters from, or remove entirely
		var templatesInWikitext = extraJs.parseTemplates(wikitext, true);
		
		// templates using numbered/unnamed parameters, e.g.{{Portal|Foo|Bar}}
		var numberedParameterTemplates = [
			// {{Portal}} and its redirects:
			'portal', 'portalpar', 'portal box', 'ports', 'portal-2',
			// {{Portal-inline}} and its redirects:
			'portal-inline', 'portal inline', 'portal frameless', 'portal-inline-template',
			// {{Portal bar}} and its redirects:
			'portal bar', 'portalbar'
		];
		// templates using named parameters, e.g. {{Subject bar |portal=Foo |portal2=Bar}}
		var namedParameterTemplates = ['subject bar'];
		
		// helper functions for filtering/mapping
		var isNumberedParameter = function(param) {
			return !isNaN(Number(param.name));
		};
		var isNamedPortalParameter = function(param) {
			return /portal\d*/.test(param.name);
		};

		/**
		 * @param {TemplateObject[]} existingTemplates Subset of TemplateObjects from extraJs.parseTemplates
		 * @param {Function(ParamObject)=>boolean} paramTypeFilter Function that returns `true` if
		 *  the passed in parameter might contain a portal, and `false` otherwise
		 * @param {Function(ParamObject[])=>boolean} keepFilter Function that returns `true` if the
		 *  template should be kept (and edited), or `false` if the template should just be removed
		 * @sideEffect modifies variable `wikitext`
		 */
		var editOrRemoveTemplates = function( existingTemplates, paramTypeFilter, keepFilter ) {
			existingTemplates.forEach(function(template) {
				var paramsToKeep = template.parameters.filter(function(param) {
					return !paramTypeFilter(param) || !portal_regex.test(param.value);
				});
				if ( paramsToKeep.length === template.parameters.length ) {
					// No changes needed
					return;
				}				
				if ( keepFilter(paramsToKeep) ) {
					var updatedTemplateWikitext = template.wikitext.replace(/\|(.|\n)*/, '') +
						paramsToKeep.map(function(p) { return p.wikitext; }).join('') +
						'}}';
					wikitext = wikitext.replace(template.wikitext, updatedTemplateWikitext);
				} else {
					// Remove template wikitext, including any preceding * or : characters:
					// - if on it's own line, remove a linebreak
					wikitext = wikitext.replace(
						new RegExp('\\n[\\*\\:]*[\\t ]*' + mw.util.escapeRegExp(template.wikitext) + '\\n'),
						'\n'
					)
					// - if something else is on the line, leave the linebreaks alone
					.replace(
						new RegExp('[\\*\\:]*[\\t ]*' + mw.util.escapeRegExp(template.wikitext)),
						''
					);
				}
			});
		};

		// Deal with numbered-parameter templates
		editOrRemoveTemplates(
			templatesInWikitext.filter(function(template) {
				var name = template.name.toLowerCase().replace(/_/g, ' ');
				return numberedParameterTemplates.includes(name);
			}),
			isNumberedParameter,
			function(params) { return params.some(isNumberedParameter); }
		);
		
		// Deal with named parameter templates
		editOrRemoveTemplates(
			templatesInWikitext.filter(function(template) {
				var name = template.name.toLowerCase().replace(/_/g, ' ');
				return namedParameterTemplates.includes(name);
			}),
			isNamedPortalParameter,
			function(params) { return params.length > 0; }
		);
		
		// Remove any "See also" sections that are now empty
		var seeAlsoSection = /(==+)\s*[Ss]ee [Aa]lso\s*==+([.\n]*?)(?:(==+)|$)/g.exec(wikitext);
		if ( seeAlsoSection ) {
			var hasSubsection = seeAlsoSection[1] && seeAlsoSection[3] && seeAlsoSection[3].length > seeAlsoSection[1].length;
			var isEmpty = seeAlsoSection[2].trim() === '';
			if ( isEmpty && !hasSubsection ) {
				wikitext = wikitext.replace(seeAlsoSection[0], seeAlsoSection[3]);
			}
		}
	}
	
	// Remove links
	// Start building regex strings
	var simple_regex_str = "\\[\\[\\s*:?\\s*(";
	var named_regex_str = "\\[\\[\\s*:?\\s*(?:";
	for ( var ii=0; ii<unlinkThese.length; ii++ ) {
		// For regex matching: first character can be either upper or lower case, special
		// characters need to be escaped, spaces/underscores can be either spaces or underscores
		var unlink_regex_str = "[" + mw.util.escapeRegExp(unlinkThese[ii].slice(0, 1).toUpperCase()) +
			mw.util.escapeRegExp(unlinkThese[ii].slice(0, 1).toLowerCase()) + "]" +
			mw.util.escapeRegExp(unlinkThese[ii].slice(1)).replace(/(?: |_)/g, "[ _]");
		// Add to regex strings
		simple_regex_str += unlink_regex_str;
		named_regex_str += unlink_regex_str;
		if ( ii+1 !== unlinkThese.length ) {
			simple_regex_str += "|";
			named_regex_str += "|";			
		}
	}
	// Close off regex strings
	simple_regex_str += ")(?:#[^\\|\\]]*?)?\\s*\\]\\](?![^<]*?-->)";
	named_regex_str += ")(?:#[^\\|\\]]*?)?\\s*\\|([^\\[\\]\\n\\r]+?)\\]\\](?![^<]*?-->)";
	var simple_regex = new RegExp( simple_regex_str, "g" );
	var named_regex = new RegExp( named_regex_str, "g" );
	
	// Set index articles for names, which should be treated like disambiguation pages, will contain
	// one of these templates
	var name_set_index_regex = /\{\{\s*(?:[Gg]iven[ _]name|[Ss]urnames?|[Nn]ickname|[Ff]irst[ _]name|[Ff]orename|[Dd]isambigN(?:ame|m)?)\s*(?:\|.*?)*?\}\}/g;
	if ( name_set_index_regex.test(wikitext) ) {
		isDab = true;
	}
	
	// List items removals:
	if ( ns === 10 ) {
		//Within navbox templates, remove links entirely, including the preceding *'s and the following newline
		var navbox_regex = new RegExp("\\{\\{[Nn]avbox(?: with collapsible groups| with columns)?\\s*\\|" +
			"(?:.|\\n)*?(?:(?:\\{\\{" +			// accounts for templates within the navbox
				"(?:.|\\n)*?(?:(?:\\{\\{" +		// accounts for templates within templates within the navbox
					"(?:.|\\n)*?" +
				"\\}\\})(?:.|\\n)*?)*?" +
			"\\}\\})(?:.|\\n)*?)*" +
		"\\}\\}", "g");
		var navbox_simple_regex = new RegExp( "\\*+\\s*" + simple_regex_str + "[\\r\\t\\f\\v ]*\\n", "g" );
		var navbox_named_regex = new RegExp( "\\*+\\s*" + named_regex_str + "[\\r\\t\\f\\v ]*\\n", "g" );
		//Find navbox templates
		var navboxes = wikitext.match(navbox_regex);
		if ( navboxes ) {
			// remove regex matches from wikitext
			for ( var jj=0; jj<navboxes.length; jj++ ) {
				replacement = navboxes[jj].replace(navbox_simple_regex, "").replace(navbox_named_regex, "");
				wikitext = wikitext.replace(navboxes[jj], replacement);
			}
		}
	} else if ( isDab ) {
		// For disambiguation pages, entirely remove list items containing a backlink, including the
		// preceding *'s and the following newline (but skiping list items with multiple links)
		var dab_simple_regex = new RegExp( "\\*+[^\\[\\]\\n\\r]*" + simple_regex_str + "[^\\[\\]\\n\\r]*\\n", "g" );
		var dab_named_regex = new RegExp( "\\*+[^\\[\\]\\n\\r]*" + named_regex_str + "[^\\[\\]\\n\\r]*\\n", "g" );	
		wikitext = wikitext.replace(dab_simple_regex, "").replace(dab_named_regex, "");
	} else {
		// For See also sections, entirely remove list items containing a backlink, including the
		// preceding *'s and the following newline (but skiping list items with multiple links)
		var seealso_regex = /==+\s*[Ss]ee [Aa]lso\s*==+\n+(?:^.*\n*)*?(?:(?===+)|$)/gm;
		var seealso_simple_regex = new RegExp( "\\*+[^\\[\\]\\n\\r]*" + simple_regex_str + "[^\\[\\]\\n\\r]*\\n", "g" );
		var seealso_named_regex = new RegExp( "\\*+[^\\[\\]\\n\\r]*" + named_regex_str + "[^\\[\\]\\n\\r]*\\n", "g" );
		var seealso = wikitext.match(seealso_regex);
		if ( seealso ) {
			// remove regex matches from wikitext
			for ( var kk=0; kk<seealso.length; kk++ ) {
				replacement = (seealso[kk]+"\n").replace(seealso_simple_regex, "").replace(seealso_named_regex, "");
				wikitext = wikitext.replace(seealso[kk].trim(), replacement.trim());
			}
		}
		// Other lists need manual review, in case the item should be retained unlinked (e.g. complete lists per [[WP:CSC]])
	}
	// Mark any other list items with backlinks for manual review, using {{subst:void}}
	var manual_review_regex = new RegExp( '^\\*+.*(?:' + simple_regex_str + '|' +
		named_regex_str + ').*$', 'gm' );
	wikitext = wikitext.replace(manual_review_regex, '{{subst:void}}$&');

	// For all other links, replace with unlinked text
	wikitext = wikitext.replace(simple_regex, "$1").replace(named_regex, "$1");

	return wikitext;
};

/**
 * val2key
 *
 * For an object `obj` with key:value pairs, return a value's corresponding key.
 *
 * @param {string|number} val
 *  Value to seach for.
 * @param {object} obj
 *  Object to search in.
 * @return {string|number} Key corresponding to the input value.
 */
extraJs.val2key = function(val, obj) {
    for ( var k in obj ) {
        if ( obj[k] === val ) {
            return k;
        }
    }
};

// </nowiki>
