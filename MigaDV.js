/**
 * The main file for the Miga Data Viewer application.
 *
 * This file currently holds three types of functions: those that control
 * the flow of the application, those that display HTML for each screen, and
 * some random utility functions.
 * At some point, it would be good to move the last two into a separate file.
 *
 * @author Yaron Koren
 *
 * @version 2.0-alpha
 */

// Global variables - sorry if this offends anyone. :)
var gDBRandomString = null;
//var gDataTimestamp = null;
var gAppSettings = null;
var gDataSchema = null;
var gCurCategory = null;
var gPagesInfo = null;
var gDBConn = null;
var gMapScriptLoaded = false;
var gURLHash = window.location.hash;

// Various utility functions that could probably go somewhere else.

function getURLPath() {
	return window.location.host + window.location.pathname + window.location.search;
}

function HTMLEscapeString( str ) {
	// Bizarrely, JS does not contain an HTML-escaping function, and
	// jQuery can only do it via the DOM, so we'll just have one here.
	return str.replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;');
}

function androidOnlyAlert( msg ) {
	// For now, don't do anything - the Android-only alert may no
	// longer be useful.
/*
	var ua = navigator.userAgent.toLowerCase();
	var isAndroid = ua.indexOf("android") > -1; //&& ua.indexOf("mobile");
	if ( isAndroid ) {
		alert(msg + " (Android-only message)");
	}
*/
}

/**
 * Used to show the time since the last data refresh.
 */
function getTimeDifferenceString( earlierTime, laterTime ) {
	millisecondDifference = laterTime - earlierTime;
	secondDifference = millisecondDifference / 1000;
	if ( secondDifference < 2 ) {
		return "1 second";
	} else if ( secondDifference < 60 ) {
		return secondDifference.toFixed(0) + " seconds";
	}
	minuteDifference = secondDifference / 60;
	if ( minuteDifference < 2 ) {
		return "1 minute";
	} else if ( minuteDifference < 60 ) {
		return minuteDifference.toFixed(0) + " minutes";
	}
	hourDifference = minuteDifference / 60;
	if ( hourDifference < 2 ) {
		return "1 hour";
	} else if ( hourDifference < 24 ) {
		return hourDifference.toFixed(0) + " hours";
	}
	dayDifference = hourDifference / 24;
	if ( dayDifference < 2 ) {
		return "1 day";
	}
	return dayDifference.toFixed(0) + " days";
}

function categoryHasNameField( categoryName ) {
	for ( fieldName in gDataSchema[categoryName]['fields'] ) {
		if ( gDataSchema[categoryName]['fields'][fieldName]['fieldType'] == 'Name' ) {
			return true;
		}
	}
	return false;
}

function getCategoryStartTimeField( categoryName ) {
	for ( fieldName in gDataSchema[categoryName]['fields'] ) {
		if ( gDataSchema[categoryName]['fields'][fieldName]['fieldType'] == 'Start time' ) {
			return fieldName;
		}
	}
	return null;
}

function getCategoryEndTimeField( categoryName ) {
	for ( fieldName in gDataSchema[categoryName]['fields'] ) {
		if ( gDataSchema[categoryName]['fields'][fieldName]['fieldType'] == 'End time' ) {
			return fieldName;
		}
	}
	return null;
}

function categoryHasStartAndEndTimeFields( categoryName ) {
	var startTimeField = getCategoryStartTimeField( categoryName );
	var endTimeField = getCategoryEndTimeField( categoryName );
	return ( startTimeField != null && endTimeField != null );
}

// This is where the core functionality starts.

function saveDataToLocalStorage() {
        // Save all the settings data to LocalStorage!
        var allAppInfo = {};
        allAppInfo['dbRandomString'] = gDBRandomString;
        allAppInfo['dataSchema'] = gDataSchema;
        allAppInfo['appSettings'] = gAppSettings;
        allAppInfo['pagesInfo'] = gPagesInfo;
        allAppInfo['dataTimestamp'] = gDataTimestamp;

        localStorage.setItem( 'Miga ' + getURLPath(), JSON.stringify( allAppInfo ) );
}

function setAllFromAppSettings() {
	try {
		gDBConn = new WebSQLConnector( gAppSettings['Name'] );
	} catch (e) {
		if ( e.code == 18 ) {
			// An exception that shows up in the Android
			// browser - it seems to go away if you just refresh
			// a few times.
			// The setTimeout()/displayMainText() call doesn't
			// seem to work, unfortunately.
			// @TODO - get this exception to not happen at all.
			setTimeout( displayMainText('Encountered error connecting to database; reloading page...'), 2000 );
			window.location.reload();
		}
		displayMainText('<h1>Error!</h1><h2>' + e + '</h2>');
		return;
	}
	if ( gAppSettings.hasOwnProperty('Logo')) {
		if ( gAppSettings['Logo'].indexOf('://') > 0 ) {
			var logoHTML = '<img src="' + gAppSettings['Logo'] + "\" />\n";
		} else {
			var logoHTML = '<img src="apps/' + gAppSettings['Directory'] + "/" + gAppSettings['Logo'] + "\" />\n";
		}
		jQuery('#logo').html('<a href="#">' + logoHTML + '</a>');
	} else {
		jQuery('#logo').html("");
	}
	if ( gAppSettings.hasOwnProperty('Favicon') ) {
		// Copied from http://stackoverflow.com/questions/260857/changing-website-favicon-dynamically/260876#260876
		var link = document.createElement('link');
		link.type = 'image/x-icon';
		link.rel = 'icon';
		if ( gAppSettings['Favicon'].indexOf('://') > 0 ) {
			link.href = gAppSettings['Favicon'];
		} else {
			link.href = "apps/" + gAppSettings['Directory'] + "/" + gAppSettings['Favicon'];
		}
		document.getElementsByTagName('head')[0].appendChild(link);
	}
	if ( gAppSettings.hasOwnProperty('CSS file') ) {
		var link = document.createElement('link');
		link.type = 'text/css';
		link.rel = 'stylesheet';
		if ( gAppSettings['CSS file'].indexOf('://') > 0 ) {
			link.href = gAppSettings['CSS file'];
		} else {
			link.href = "apps/" + gAppSettings['Directory'] + "/" + gAppSettings['CSS file'];
		}
		document.getElementsByTagName('head')[0].appendChild(link);
	}
	if ( gAppSettings.hasOwnProperty('App icon') ) {
		var link = document.createElement('link');
		// Set whether or not it's 'precomposed' based on whether
		// or not it's an Android browser. For iOS, it shouldn't be
		// precomposed, because we want the nice "shiny" addition
		// to the icon. (Or do we?)
		var ua = navigator.userAgent.toLowerCase();
		var isAndroid = ua.indexOf("android") > -1; //&& ua.indexOf("mobile");
		if ( isAndroid ) {
			link.rel = 'apple-touch-icon-precomposed';
		} else {
			link.rel = 'apple-touch-icon';
		}
		if ( gAppSettings['App icon'].indexOf('://') > 0 ) {
			link.href = gAppSettings['App icon'];
		} else {
			link.href = "apps/" + gAppSettings['Directory'] + "/" + gAppSettings['App icon'];
		}
		document.getElementsByTagName('head')[0].appendChild(link);
	}

	// This <meta> tag removes the browser's URL bar at the top and
	// navigation bar at the bottom, making it look like a native app.
	// Unfortunately, it currently only works in iOS, not Android.
	// Also, the fact that it removes the navigation bar means that Miga
	// would at least need to add a "back" button (and ideally a "forward"
	// button as well) before it was activated.
	/*
	var meta = document.createElement('meta');
	meta.name = "apple-mobile-web-app-capable";
	meta.content = "yes";
	document.getElementsByTagName('head')[0].appendChild(meta);
	*/

	displayTitle( null );
}

function getSettingsAndLoadData() {
	// If we need the settings, retrieve them from LocalStorage, if
	// they're there.
	if ( gDataSchema == null ) {
		var allAppInfoJSON = localStorage.getItem('Miga ' + getURLPath() );
		if ( allAppInfoJSON != null ) {
			var allAppInfo = JSON.parse( allAppInfoJSON );
			gDBRandomString = allAppInfo['dbRandomString'];
			gDataSchema = allAppInfo['dataSchema'];
			gAppSettings = allAppInfo['appSettings'];
			gPagesInfo = allAppInfo['pagesInfo'];

			// gDataTimestamp, unlike the other global variables,
			// does not come from LocalStorage but rather from
			// the data JS file. timestampFromLocalStorage is the
			// value that comes from Local Storage.
			var timestampFromLocalStorage = allAppInfo['dataTimestamp'];
			if ( typeof gDataTimestamp !== 'undefined' && timestampFromLocalStorage < gDataTimestamp ) {
				refreshData();
			} else {
				setAllFromAppSettings();
			}
		}
	}

	if ( gAppSettings == null ) {
		// If there was no data in LocalStorage, get the data from
		// the data JS file.
		DataLoader.getAppSettingsAndSchema();
		if ( gAppSettings != null ) {
			setAllFromAppSettings();
			gDBConn.loadDataIfNecessary();
			saveDataToLocalStorage();
		}
	} else {
		gDBConn.loadDataIfNecessary();
	}
}

/**
 * Sets both the header and the document title of the page.
 */
function displayTitle( mdvState ) {
	var titleText = gAppSettings['Name'];
	jQuery('#title').html('<a href="#">' + titleText + '</a>');

	var documentTitleText = gAppSettings['Name'];
	if ( mdvState == null ) {
		// Do nothing
	} else if ( mdvState.useSearchForm ) {
		documentTitleText += ": Search";
	} else if ( mdvState.categoryName != null ) {
		//documentTitleText += ": " + mdvState.categoryName;
		if ( mdvState.itemName != null ) {
			documentTitleText += ": " + mdvState.itemName;
		}
	} else if ( mdvState.pageName == '_start' ) {
		// Start page - just show the site name.
	} else if ( mdvState.pageName != null ) {
		documentTitleText += ": " + mdvState.pageName;
	}
	document.title = documentTitleText;

	jQuery('#searchInputWrapper').html(null);
}

function displayMainText( msg ) {
	jQuery('#resultsMain').html(msg);
}

function addToMainText( msg ) {
	jQuery('#resultsMain').append(msg);
}

function displayLoadingMessage( msg ) {
	msg = "<div style=\"position: absolute; z-index; 5000; left: 50%; margin-left: -20px;\">";// + msg;
	msg += '<img src="images/Ajax-loader.gif" /></div>';
	jQuery('#resultsMain').prepend(msg);
	//displayMainText( msg );
}

function showCurrentEventsLink( categoryName ) {
	// It was already there - just un-hide it.
	jQuery('#view-current-' + categoryName).show();
}

function blankFiltersInfo() {
	jQuery('#furtherFiltersWrapper').html("");
	jQuery('#categoryAndSelectedFilters').hide();
}

function displayCategorySelector() {
	blankFiltersInfo();
	displayTitle( null );
	jQuery('#topSearchInput').html('');

	var categoryNames = [];
	for ( categoryName in gDataSchema ) {
		if ( categoryHasNameField( categoryName ) ) {
			categoryNames.push( categoryName );
			if ( categoryHasStartAndEndTimeFields( categoryName ) ) {
				// Just add on another value in to this array -
				// unfortunately, we can't get an answer back
				// from the database as to whether or not
				// there are any events in this category that
				// actually are current or upcoming by the
				// time we need to decide whether or not to
				// display a "category selector" page, so just
				// assume that there are some, and that we do
				// need to display the category selector.
				categoryNames.push( '_current' );
			}
		}
	}
	var numPages = 0;
	for ( pageName in gPagesInfo ) { numPages++; }
	if ( numPages > 0 ) {
		len = numPages;
	} else {
		len = categoryNames.length;
	}
	// If there's just one category or page, display it right away.
	if ( len == 1 ) {
		mdvState = new MDVState();
		mdvState.categoryName = categoryNames[0];
		displayItemsScreen( mdvState );
		return;
	} else if ( len == 0 ) {
		displayMainText( "<h2>No data found!</h2>" );
		return;
	}

	var msg = "<ul id=\"categoriesList\" class=\"rows\">\n";
	if ( numPages > 0 ) {
		for ( pageName in gPagesInfo ) {
			var mdvState = new MDVState();
			var curPage = gPagesInfo[pageName];
			if ( curPage[0] == 'File' ) {
				//var fileName = curPage['File'];
				mdvState.pageName = pageName;
			} else if ( curPage[0] == 'Category' ) {
				mdvState.categoryName = curPage[1];
			}
			msg += listElementHTML( mdvState, pageName, false );
		}
	} else {
		for ( var i = 0; i < categoryNames.length; i++ ) {
			var categoryName = categoryNames[i];
			if ( categoryName == '_current' ) {
				// mdvState still holds the previous category
				// name, which is good.
				// This will print out a hidden element - which
				// will get un-hidden if there are any
				// events currently happening.
				mdvState.currentEventsOnly = true;
				msg += listElementHTML( mdvState, '&nbsp;&nbsp;&nbsp;&nbsp;View Current ' + mdvState.categoryName, false );
				gDBConn.possiblyShowCurrentEventsLink( mdvState );
				continue;
			}
			var mdvState = new MDVState( categoryName );
			msg += listElementHTML( mdvState, 'View ' + categoryName, false );
		}
	}
	msg += "</ul>\n";
	displayMainText( msg );
	makeRowsClickable();
}

function displayCategoryAndSelectedFiltersList( mdvState ) {
	var mdvStateForCategory = new MDVState();
	mdvStateForCategory.categoryName = mdvState.categoryName;
	if ( mdvState.showSearchFormResults ) {
		var categoryDisplay = '<strong>' + mdvStateForCategory.categoryName + '</strong>';
	} else {
		var categoryDisplay = '<strong><a href="' + mdvStateForCategory.getURLHash() + '">' + mdvStateForCategory.categoryName + '</a></strong>';
	}

	var filtersDisplay = '<ul id="selectedFilters">';
	if ( mdvState.currentEventsOnly ) {
		filtersDisplay += "<li>Currently-occurring events only.</li>\n";
	}
	var filterNum = 0;
	var selectedFilters = mdvState.selectedFilters;
	for ( var propName in selectedFilters ) {
		filterNum++;
		filtersDisplay += "<li>";
		var propValueParts = selectedFilters[propName].split(decodeURI('%0C'));
		var propValueDisplay = '<strong>' + propValueParts.join('</strong> or <strong>') + '</strong>';

		if ( selectedFilters[propName] == '__null' ) {
			propValueDisplay = "<em>No value</em>";
		}
		if ( filterNum > 1 ) { filtersDisplay += '& '; }
		filtersDisplay += propName + " = " + propValueDisplay;
		if ( ! mdvState.showSearchFormResults ) {
			var newDBState = mdvState.clone();
			delete newDBState.selectedFilters[propName];
			filtersDisplay += ' <a href="' + newDBState.getURLHash() + '">[&#10005;]</a>';
		}
		filtersDisplay += "</li>";
	}
	filtersDisplay += "</ul>";

	// Re-show, in case it was hidden.
	jQuery('#categoryAndSelectedFilters').show();
	jQuery('#categoryAndSelectedFilters').html( categoryDisplay + filtersDisplay );
}

function getUnusedFilters( mdvState ) {
	var categoryHeaders = [];
	categoryFields = gDataSchema[mdvState.categoryName]['fields'];
	for ( fieldName in categoryFields ) {
		if ( categoryFields[fieldName]['isFilter'] ) {
			categoryHeaders.push(fieldName);
		}
	}

	var furtherFilters = [];
	for (i = 0; i < categoryHeaders.length; i++) {
		var filterName = categoryHeaders[i];
		var filterAttribs = gDataSchema[mdvState.categoryName]['fields'][filterName];
		if ( !filterAttribs.hasOwnProperty('isFilter') ) {
			continue;
		}

		if ( mdvState.useSearchForm || mdvState.selectedFilters[filterName] == null || DataLoader.isDateType(filterAttribs['fieldType']) || filterAttribs['fieldType'] == 'Number' ) {
			furtherFilters.push(filterName);
		}
	}
	return furtherFilters;
}

function displayAdditionalFilters( mdvState ) {
	var furtherFilters = getUnusedFilters( mdvState );

	// This code needs to be improved a lot!
	// We're looking for "connector" categories - categories other than
	// this one, that don't have a "Name" field, but do have a field
	// pointing back to this one (of type "Entity") - for any such
	// category, we want to filter on the first field we find, that's not
	// being filtered on already.
	var compoundItemFilters = [];
	for ( categoryName in gDataSchema ) {
		var foundMatch = false;
		var mainFilterField = null;
		if ( categoryName == mdvState.categoryName ) continue;
		if ( categoryHasNameField( categoryName ) ) continue;

		for ( fieldName in gDataSchema[categoryName]['fields'] ) {
			if ( gDataSchema[categoryName]['fields'][fieldName]['fieldType'] == 'Entity' ) {
				if ( gDataSchema[categoryName]['fields'][fieldName]['connectedCategory'] == mdvState.categoryName ) {
					foundMatch = true;
				}
			}
			var categoryFieldString = categoryName + "::" + fieldName;
			if ( mainFilterField == null && gDataSchema[categoryName]['fields'][fieldName]['fieldType'] == 'Text' && !mdvState.selectedFilters.hasOwnProperty( categoryFieldString ) ) {
				mainFilterField = fieldName;
			}
		}
		if ( foundMatch && mainFilterField != null ) {
			compoundItemFilters.push( categoryName + '::' + mainFilterField );
		}
	}
	furtherFilters = furtherFilters.concat(compoundItemFilters);

	var msg = '';
	if ( furtherFilters.length > 0 ) {
		if ( jQuery.isEmptyObject( mdvState.selectedFilters ) ) {
			msg += "Filter by:";
		} else {
			msg += "Filter further by:";
		}
		for ( var i = 0; i < furtherFilters.length; i++ ) {
			var filterName = furtherFilters[i];
			var isCompoundFilter = false;
			if ( ( filterColonsLoc = filterName.indexOf('::') ) > 0 ) {
				isCompoundFilter = true;
			}
			var newDBState = mdvState.clone();
			newDBState.displayFilter = filterName;

			// Remove page number, filter display from URL
			newDBState.pageNum = null;
			newDBState.filterDisplayFormat = null;

			if ( i > 0 ) {
				msg += " &middot;\n";
			}
			if ( filterName == mdvState.displayFilter ) {
				if ( isCompoundFilter ) {
					msg += ' <span class="compoundFilterName">' + filterName.substring( filterColonsLoc + 2 ) + '</span>';
				} else {
					msg += " <span>" + filterName + '</span>';
				}
			} else {
				if ( isCompoundFilter ) {
					msg += ' <span class="clickable compoundFilterName" real-href="' + newDBState.getURLHash() + '">' + filterName.substring( filterColonsLoc + 2 ) + '</span>';
				} else {
					msg += ' <span class="clickable" real-href="' + newDBState.getURLHash() + '">' + filterName + "</span>";
				}
			}
		}
	}

	if ( msg == '' ) {
		jQuery('#furtherFiltersWrapper').html('');
	} else {
		jQuery('#furtherFiltersWrapper').html('<div id="furtherFilters">' + msg + '</div>');
	}
}

function displayItem( mdvState, itemID, itemName ) {
	jQuery('#furtherFiltersWrapper').html("");
	displayMainText('<ul id="itemValues"></ul>');
	// This displayItem() function will itself call displayItemValues().
	gDBConn.displayItem( mdvState, itemID, itemName );
}

function listElementHTML( mdvState, internalHTML, isDiv ) {
	msg = ( isDiv ) ? '<div ' : '<li ';
	if ( mdvState.currentEventsOnly ) {
		msg += 'id="view-current-' + mdvState.categoryName + '" ';
		msg += 'style="display: none;" ';
	}
	msg += 'class="clickable" real-href="' + mdvState.getURLHash() + '">';
	msg += '<table class="listElement"><tr>';
	msg += '<td>' + internalHTML + "</td>";
	msg += '<td style="text-align: right; font-weight: bold;">&gt;</td>';
	msg += '</tr></table>';
	msg += ( isDiv ) ? '</div>' : '</li>';
	msg += "\n";
	return msg;
}

function displayFormatTabs( mdvState, allDisplayFormats ) {
	msg = '<ul id="displaySelector">';
	for ( i = 0; i < allDisplayFormats.length; i++ ) {
		var curFormat = allDisplayFormats[i];
		var curFormatDisplayName = curFormat;
		if ( curFormat == null ) {
			curFormatDisplayName = 'list';
		}
		if ( mdvState.displayFormat == curFormat ) {
			msg += '<li class="selectedDisplay">View ' + curFormatDisplayName + '</li>';
		} else {
			var newDBState = mdvState.clone();
			newDBState.displayFormat = curFormat;
			msg += '<li class="display clickable" real-href="' + newDBState.getURLHash() + '">View ' + curFormatDisplayName + '</li>';
		}
	}
	msg += '</ul>';
	displayMainText( msg );
}

// @TODO - remove duplicate code that's in both of the below functions.
function setTrueFilterDisplayFormat( mdvState, hasNumericalVariation ) {
	var filterType = mdvState.getDisplayFilterType();
	if ( DataLoader.isDateType(filterType) ) {
		if ( mdvState.filterDisplayFormat == null ) {
			mdvState.filterDisplayFormat = 'date';
		}
	} else {
		if ( mdvState.filterDisplayFormat == null ) {
			if ( hasNumericalVariation ) {
				if ( gAppSettings.hasOwnProperty('Hide quantity tab') && gAppSettings['Hide quantity tab'] == 'true' ) {
					mdvState.filterDisplayFormat = 'alphabetical';
				} else {
					mdvState.filterDisplayFormat = 'number';
				}
			} else {
				mdvState.filterDisplayFormat = 'alphabetical';
			}
		}
	}
}


function displayFilterFormatTabs( mdvState ) {
	// If we're supposed to hide the quantity/number tab, it means no
	// tabs will be shown - just exit. If the display ever had more than
	// two tabs, though, this would have to change.
	if ( gAppSettings.hasOwnProperty('Hide quantity tab') && gAppSettings['Hide quantity tab'] == 'true' ) {
		return;
	}

	var filterType = mdvState.getDisplayFilterType();

	if ( DataLoader.isDateType(filterType) ) {
		//if ( mdvState.filterDisplayFormat == null ) {
		//	mdvState.filterDisplayFormat = 'date';
		//}
		var filterDisplayFormats = ['date', 'number'];
	} else {
		//if ( mdvState.filterDisplayFormat == null ) {
		//	mdvState.filterDisplayFormat = 'number';
		//}
		var filterDisplayFormats = ['number', 'alphabetical'];
	}

	var msg = '<ul id="displaySelector">';
	for ( i = 0; i < filterDisplayFormats.length; i++ ) {
		var curFormat = filterDisplayFormats[i];
		if ( DataLoader.isDateType(filterType) ) {
			if ( curFormat == null ) {
				curFormat = 'date';
			}
		} else {
			if ( curFormat == null ) {
				curFormat = 'number';
			}
		}

		var curFormatDisplayName = curFormat;
		if ( curFormat == 'number' ) {
			curFormatDisplayName = 'By quantity';
		} else if ( curFormat == 'date' ) {
			curFormatDisplayName = 'Chronological';
		} else if ( curFormat == 'alphabetical' ) {
			curFormatDisplayName = 'Alphabetical';
		}
		if ( mdvState.filterDisplayFormat == curFormat ) {
			msg += '<li class="selectedDisplay">' + curFormatDisplayName + '</li>';
		} else {
			var newDBState = mdvState.clone();
			newDBState.filterDisplayFormat = curFormat;
			msg += '<li class="display clickable" real-href="' + newDBState.getURLHash() + '">' + curFormatDisplayName + '</li>';
		}
	}
	msg += '</ul>';
	addToMainText( msg );
}

function pageNavigationHTML( mdvState, numItems, itemsPerPage ) {
		msg = '<ul id="pageNumbers">';
		msg += '<li id="pageNumbersLabel">Go to page:</li>';
		numPages = Math.ceil( numItems / itemsPerPage );
		if ( mdvState.pageNum == null ) mdvState.pageNum = 1;
		for ( var curPage = 1; curPage <= numPages; curPage++ ) {
			if ( curPage == mdvState.pageNum ) {
				msg += '<li class="selected">' + curPage + '</li>';
			} else {
				var newDBState = mdvState.clone();
				newDBState.pageNum = curPage;
				msg += '<li class="clickable" real-href="' + newDBState.getURLHash() + '">' + curPage + '</li>';
			}
		}
		msg += "</ul>";
		return msg;
}

function displaySearchFormInput( mdvState, filterValues ) {
	var msg = '';
	var len = filterValues.length;
	for (var i = 0; i < len; i++) {
		var curFilter = filterValues[i];
		// 'numValues' is really the number of *items*, and 'filterName'
		// is really the filter *value*... oh well.
		var numValues = curFilter['numValues'];
		if ( numValues == 0 ) continue;
		var filterValue = curFilter['filterName'];
		if ( filterValue == null ) {
			continue;
		}
		var filterName = mdvState.displayFilter;
		var selectedValuesForCurFilter = [];
		if ( mdvState.selectedFilters.hasOwnProperty(filterName) ) {
			selectedValuesForCurFilter = mdvState.selectedFilters[filterName].split(decodeURI('%0C'));
		}
		msg += ' <span class="searchFormCheckbox"><label><input type="checkbox" class="searchFormCheckbox" filtername="' + filterName + '" filtervalue="' + filterValue + '"';
		var checked = ( jQuery.inArray( filterValue, selectedValuesForCurFilter ) > -1 );
		if ( checked ) { msg += ' checked'; }
		var escapedFilterValue = HTMLEscapeString( filterValue );
		msg += ' />' + escapedFilterValue + '</label></span>';
	}
	jQuery('#searchFormInput-' + mdvState.displayFilter.replace(' ', '-')).html(msg);
}

function displaySearchForm( mdvState ) {
	var categorySchema = gDataSchema[mdvState.categoryName]['fields'];
	displayTitle( mdvState );
	blankFiltersInfo();
	var msg = "<h1>Search</h1>\n";
	msg += "<form>\n";
	var allFilters = getUnusedFilters( mdvState );
	msg += '<div id="searchInputs">';
	for ( var i = 0; i < allFilters.length; i++ ) {
		var filterName = allFilters[i];

		// For now, we only search on fields of type Text or Entity.
		var filterType = categorySchema[filterName]['fieldType'];
		if ( filterType != 'Text' && filterType != 'Entity' ) {
			continue;
		}

		msg += '<div class="searchFormInput">';
		msg += '<h2>' + filterName + "</h2>\n";
		msg += '<div id="searchFormInput-' + filterName.replace(' ', '-') + '">';
		var newMDVState = mdvState.clone();
		newMDVState.displayFilter = filterName;
		gDBConn.displayFilterValues( newMDVState );
		msg += "</div>";
		msg += "</div>";
	}
	msg += "</div>";
	msg += '<input type="button" value="Search" onclick="handleSubmittedSearchForm(mdvState, this.form)">';
	msg += "</form>";
	displayMainText(msg);
}

function handleSubmittedSearchForm( mdvState, form ) {
	mdvState.selectedFilters = [];
	jQuery(".searchFormCheckbox").each( function() {
		if ( $(this).prop('checked') ) {
			var filterName = $(this).attr('filtername');
			var filterValue = $(this).attr('filtervalue');
			if ( mdvState.selectedFilters.hasOwnProperty(filterName) ) {
				// Use an obscure character to separate the
				// values - a "form feed".
				mdvState.selectedFilters[filterName] += decodeURI('%0C') + filterValue;
			} else {
				mdvState.selectedFilters[filterName] = filterValue;
			}
		}
	});
	window.location = mdvState.getURLHash();
	mdvState.useSearchForm = false;
	mdvState.showSearchFormResults = true;
	window.location = mdvState.getURLHash();
}

function displaySearchFormResults( mdvState ) {
	displayCategoryAndSelectedFiltersList( mdvState );
	getDisplayDetailsAndDisplayItems( mdvState );
	
}

function getDisplayDetailsAndDisplayItems( mdvState ) {
	var imageProperty = null;
	var firstTextField = null;
	var firstEntityField = null;
	var coordinatesProperty = null;
	var dateProperty = null;

	var categoryFields = gDataSchema[mdvState.categoryName]['fields'];
	for ( propName in categoryFields ) {
		var propType = categoryFields[propName]['fieldType'];
		if ( mdvState.displayFormat == 'map' && propType == 'Coordinates' ) {
			coordinatesProperty = propName;
		}
		// Restrict schedule to just 'Start time' type
		if ( dateProperty == null && propType == 'Start time' ) {
			dateProperty = propName;
		}
		if ( imageProperty == null && propType == 'Image URL' ) {
			imageProperty = propName;
		}
		if ( firstTextField == null && firstEntityField == null ) {
			if ( propType == 'Text' ) {
				firstTextField = propName;
			} else if ( propType == 'Entity' ) {
				firstEntityField = propName;
			}
		}
	}
	gDBConn.displayItems( mdvState, imageProperty, coordinatesProperty, dateProperty, firstTextField, firstEntityField );
}

function displayItemsScreen( mdvState ) {
	displayTitle( mdvState );
	displayTopSearchInput( mdvState );
	displayCategoryAndSelectedFiltersList( mdvState );
	displayAdditionalFilters( mdvState );
	getDisplayDetailsAndDisplayItems( mdvState );
}

function displayMap( allItemValues ) {
	addToMainText('<div id="mapCanvas"></div><div id="coordinates"></div>');

	// Calculate center, and bounds, of map
	var numItems = allItemValues.length;
	var totalLatitude = 0;
	var totalLongitude = 0;
	for ( i = 0; i < numItems; i++ ) {
		totalLatitude += allItemValues[i]['Latitude'];
		totalLongitude += allItemValues[i]['Longitude'];
	}
	var averageLatitude = totalLatitude / numItems;
	var averageLongitude = totalLongitude / numItems;

	var furthestDistanceEast = 0;
	var furthestDistanceWest = 0;
	var furthestDistanceNorth = 0;
	var furthestDistanceSouth = 0;
	for ( i = 0; i < numItems; i++ ) {
		var latitudeDiff = allItemValues[i]['Latitude'] - averageLatitude;
		var longitudeDiff = allItemValues[i]['Longitude'] - averageLongitude;
		if ( latitudeDiff > furthestDistanceNorth ) {
			furthestDistanceNorth = latitudeDiff;
		} else if ( latitudeDiff < furthestDistanceSouth ) {
			furthestDistanceSouth = latitudeDiff;
		}
		if ( longitudeDiff > furthestDistanceEast ) {
			furthestDistanceEast = longitudeDiff;
		} else if ( longitudeDiff < furthestDistanceWest ) {
			furthestDistanceWest = longitudeDiff;
		}
	}

	// In case there was only one point (or all points have the same
	// coordinates), add in some reasonable padding.
	if ( furthestDistanceNorth == 0 && furthestDistanceSouth == 0 && furthestDistanceEast == 0 && furthestDistanceWest == 0 ) {
		furthestDistanceNorth = 0.0015;
		furthestDistanceSouth = -0.0015;
		furthestDistanceEast = 0.0015;
		furthestDistanceWest = -0.0015;
	}
	var northLatitude = averageLatitude + furthestDistanceNorth;
	var southLatitude = averageLatitude + furthestDistanceSouth;
	var eastLongitude = averageLongitude + furthestDistanceEast;
	var westLongitude = averageLongitude + furthestDistanceWest;
	var centerOfMap = new MDVCoordinates( averageLatitude, averageLongitude );
	var northEastCorner = new MDVCoordinates( northLatitude, eastLongitude );
	var southWestCorner = new MDVCoordinates( southLatitude, westLongitude );
	if ( gAppSettings['Map service'] == 'OpenLayers' ) {
		if ( gMapScriptLoaded ) {
			displayOpenLayersMap( allItemValues, centerOfMap, northEastCorner, southWestCorner );
		} else {
			jQuery.getScript("http://www.openlayers.org/api/OpenLayers.js")
			.done( function( script, textStatus ) {
				gMapScriptLoaded = true;
				displayOpenLayersMap( allItemValues, centerOfMap, northEastCorner, southWestCorner );
			});
		}
	} else { // default is Google Maps
		if ( gMapScriptLoaded ) {
			displayGoogleMapsMap( allItemValues, centerOfMap, northEastCorner, southWestCorner );
		} else {
			// With Google Maps, you have to define a callback
			// function, and pass it in to their API.
			displayGoogleMapsWrapper = function() {
				gMapScriptLoaded = true;
				// Get the MarkerClusterer script, while
				// we're at it - not a big deal if it
				// doesn't get used.
				jQuery.getScript("libs/markerclusterer.js")
				.done( function( script, textStatus ) {
					displayGoogleMapsMap( allItemValues, centerOfMap, northEastCorner, southWestCorner );
				});
			}
			jQuery.getScript("https://maps.googleapis.com/maps/api/js?v=3.exp&sensor=false&callback=displayGoogleMapsWrapper");
		}
	}

	// Display coordinates below the map
	if ( numItems == 1 ) {
		var mdvCoords = new MDVCoordinates();
		mdvCoords.setFromDBItem( allItemValues[0] );
		jQuery('#coordinates').html('<span class="fieldName">Coordinates:</span> ' + mdvCoords.toString());
	}
}

function displayGoogleMapsMap( allItemValues, centerOfMap, northEastCorner, southWestCorner ) {
	var centerLatLng = centerOfMap.toGoogleMapsLatLng();
	var northEastLatLng = northEastCorner.toGoogleMapsLatLng();
	var southWestLatLng = southWestCorner.toGoogleMapsLatLng();
	var mapBounds = new google.maps.LatLngBounds( southWestLatLng, northEastLatLng );

	var mapOptions = {
		zoom: 4,
		center: centerLatLng,
		mapTypeId: google.maps.MapTypeId.ROADMAP
	}
	var map = new google.maps.Map(document.getElementById('mapCanvas'), mapOptions);
	map.fitBounds( mapBounds );

	var infoWindows = [];
	var numItems = allItemValues.length;
	for ( i = 0; i < numItems; i++ ) {
		var itemName = allItemValues[i]['SubjectName'];
		var mdvState = new MDVState();
		mdvState.itemID = allItemValues[i]['SubjectID'];
		infoWindows[i] = new google.maps.InfoWindow({
			content: '<a href="' + mdvState.getURLHash() + '">' + itemName + '</a>'
		});
	}

	var doMarkerClustering = false;
	if ( gAppSettings.hasOwnProperty('Marker clustering') && gAppSettings['Marker clustering'] == 'true' ) {
		doMarkerClustering = true;
	}
	if ( doMarkerClustering ) {
		var markers = [];
	}
	for ( i = 0; i < numItems; i++ ) {
		var curCoordinates = new MDVCoordinates();
		curCoordinates.setFromDBItem( allItemValues[i] );
		var curLatLng = curCoordinates.toGoogleMapsLatLng();
		var marker = new google.maps.Marker({
			position: curLatLng,
			map: map,
			title: allItemValues[i]['SubjectName'],
			itemNum: i // MDV-specific
		});
		if ( doMarkerClustering ) {
			markers.push( marker );
		}

		// If there's just one point on the map, don't make the
		// marker clickable.
		if ( numItems == 1 ) continue;

		google.maps.event.addListener(marker, 'click', function() {
			for ( i = 0; i < numItems; i++ ) {
				infoWindows[i].close();
			}
			infoWindows[this.itemNum].open(map,this);
		});
	}
	if ( doMarkerClustering ) {
		var mc = new MarkerClusterer( map, markers );
	}
	makeRowsClickable();
}

function displayOpenLayersMap( allItemValues, centerOfMap, northEastCorner, southWestCorner ) {
	var map = new OpenLayers.Map( 'mapCanvas' );
	map.addLayer( new OpenLayers.Layer.OSM() );

	var southWestLonLat = southWestCorner.toOpenLayersLonLat(map);
	var northEastLonLat = northEastCorner.toOpenLayersLonLat(map);
	var mapBounds = new OpenLayers.Bounds();
	mapBounds.extend( southWestLonLat );
	mapBounds.extend( northEastLonLat );
	map.zoomToExtent( mapBounds );

	var markers = new OpenLayers.Layer.Markers( "Markers" );
	map.addLayer( markers );

	var popupClass = OpenLayers.Class(OpenLayers.Popup.FramedCloud, {
		"autoSize": true,
		"minSize": new OpenLayers.Size(300, 50),
		"maxSize": new OpenLayers.Size(500, 300),
		"keepInMap": true
	});

	var numItems = allItemValues.length;
	for ( i = 0; i < numItems; i++ ) {
		var curItem = allItemValues[i];
		var curCoordinates = new MDVCoordinates();
		curCoordinates.setFromDBItem( curItem );
		var curLonLat = curCoordinates.toOpenLayersLonLat(map);
		var feature = new OpenLayers.Feature( markers, curLonLat );
		feature.closeBox = true;
		feature.popupClass = popupClass;

		var mdvState = new MDVState();
		mdvState.itemID = curItem['SubjectID'];
		feature.data.popupContentHTML = '<a href="' + mdvState.getURLHash() + '">' + curItem['SubjectName'] + '</a>';

		var marker = new OpenLayers.Marker( curLonLat );
		markers.addMarker( marker );

		// If there's just one point on the map, don't make the
		// marker clickable.
		if ( numItems == 1 ) continue;

		marker.events.register( 'mousedown', feature, function(evt) {
			if (this.popup == null ) {
				this.popup = this.createPopup( true );
				map.addPopup( this.popup );
				this.popup.show();
			} else {
				this.popup.toggle();
			}
			currentPopup = this.popup;
			OpenLayers.Event.stop( evt );
		});
	}
}

function displaySchedule( allItemValues ) {
	var distinctDates = {};
	for ( i = 0; i < allItemValues.length; i++ ) {
		if ( allItemValues[i].hasOwnProperty('Date') && allItemValues[i]['Date'] != null ) {
			distinctDates[allItemValues[i]['Date']] = true;
		}
	}
	var msg = '';
	var curDateOnly = null;
	for ( dateDBString in distinctDates ) {
		if ( Math.floor( dateDBString ) != curDateOnly ) {
			curDateOnly = Math.floor( dateDBString );
			msg += '<h2>' + Date.dbStringToDisplayString( curDateOnly ) + '</h2>';
		}
		date = new Date();
		date.setFromDBString( dateDBString );
		msg += '<h3>' + date.getTimeDisplayString() + '</h3>';
		msg += '<ul class="scheduleList">';
		for ( i = 0; i < allItemValues.length; i++ ) {
			if ( allItemValues[i]['Date'] == dateDBString ) {
				internalHTML = allItemValues[i]['SubjectName'];
				var additionalText = allItemValues[i]['AdditionalText'];
				if ( additionalText != undefined && additionalText != null ) {
					internalHTML += ' &middot; <span class="additionalItemText">' + additionalText + "</span>\n";
				}
				var mdvState = new MDVState();
				mdvState.itemID = allItemValues[i]['SubjectID'];
				msg += listElementHTML( mdvState, internalHTML );
			}
		}
		msg += '</ul>';
	}
	addToMainText(msg);
	makeRowsClickable();
}

function displayItems( mdvState, allItemValues ) {
	if ( mdvState.pageNum == null ) {
		window.scrollTo(0,0);
	}

	numItems = allItemValues.length;
	// If there are no items, exit.
	if (numItems == 0) {
		displayMainText("<h3>No results found.</h3>");
		return;
	}

	// If there's just one item, display it right away.
	if (numItems == 1) {
		itemValues = allItemValues[0];
		displayItem( mdvState, itemValues['SubjectID'], itemValues['SubjectName'] );
		return;
	}

	displayMainText("");

	// Figure out which display formats (other than the main one) should
	// exist for this set of items, so we know whether to display the
	// selector tabs.
	var displayFormatsToShow = [null];

	var fieldsForCategory = gDataSchema[mdvState.categoryName]['fields'];
	if (mdvState.displayFormat == 'map') {
		displayFormatsToShow.push('map');
	} else {
		for ( fieldName in fieldsForCategory ) {
			if ( fieldsForCategory[fieldName]['fieldType'] == 'Coordinates' ) {
				displayFormatsToShow.push('map');
				break;
			}
		}
	}

	if (mdvState.displayFormat == 'schedule') {
		displayFormatsToShow.push('schedule');
	} else {
		// Show a schedule option if there are more than four items in
		// this group that have a date *and* time set, and if they
		// together span a period of less than 14 days.
		var dateArray = [];
		for ( i = 0; i < allItemValues.length; i++ ) {
			if ( allItemValues[i].hasOwnProperty('Date') ) {
				var curDate = new Date();
				curDate.setFromDBString( allItemValues[i]['Date'] );
				if ( curDate != null && curDate.hasOwnProperty('includesTime') > 0 ) {
					dateArray.push( curDate );
				}
			}
		}

		if ( dateArray.length > 3 ) {
			dateArray.sort();
			var earliestDate = dateArray[0];
			var lastDate = dateArray[dateArray.length - 1];
			var daysDifference = ( ( lastDate.getFullYear() - earliestDate.getFullYear() ) * 365 ) + ( ( lastDate.getMonth() - earliestDate.getMonth() ) * 12 ) + ( lastDate.getDate() - earliestDate.getDate() );
			if ( daysDifference < 14 ) {
				// Finally!
				displayFormatsToShow.push('schedule');
			}
		}
	}

	if ( displayFormatsToShow.length > 1 ) {
		displayFormatTabs( mdvState, displayFormatsToShow );
	}

	if (mdvState.displayFormat == 'map') {
		displayMap( allItemValues );
		// For some reason, this has to be called after displayMap()
		// for it to work on the tabs.
		makeRowsClickable();
		return;
	} else if (mdvState.displayFormat == 'schedule') {
		displaySchedule( allItemValues );
		return;
	}

	var itemsPerPage = 250;
	var pageNumsHTML = '';
	if ( numItems > itemsPerPage ) {
		pageNumsHTML = pageNavigationHTML( mdvState, numItems, itemsPerPage );
		addToMainText( pageNumsHTML );
		var firstItemToShow = ( ( mdvState.pageNum - 1 ) * itemsPerPage ) + 1;
		var lastItemToShow = Math.min( itemsPerPage * mdvState.pageNum, numItems );
		msg = "<p>" + numItems + " results found; showing <strong>" + firstItemToShow + " - " + lastItemToShow + "</strong>.</p>\n";
	} else {
		var firstItemToShow = 1;
		var lastItemToShow = numItems;
		msg = "<p>" + numItems + " results found:</p>\n";
	}
	addToMainText( msg );

	msg = "<div id=\"itemsList\" class=\"cells\">\n";
	for (i = firstItemToShow - 1; i < lastItemToShow; i++) {
		var internalHTML = "";
		var imageURL = allItemValues[i]['ImageURL'];
		if ( imageURL != undefined && imageURL != '' ) {
			internalHTML += '<img src="' + imageURL + '" /> ';
		}
		internalHTML += allItemValues[i]['SubjectName'];
		var additionalText = allItemValues[i]['AdditionalText'];
		if ( additionalText != undefined && additionalText != null ) {
			internalHTML += '<div class="additionalItemText">' + additionalText + "</div>\n";
		}
		var mdvState = new MDVState();
		mdvState.itemID = allItemValues[i]['SubjectID'];
		msg += listElementHTML( mdvState, internalHTML, true );
	}
	msg += "</div>";
	addToMainText( msg );
	// Show page numbers at the bottom as well.
	addToMainText( pageNumsHTML );
	makeRowsClickable();
}

function displayItemHeader( mdvState ) {
	jQuery('#pageTitle').html("<h1>" + mdvState.itemName + "</h1>");
	displayCategoryAndSelectedFiltersList( mdvState );
}

function linkToItemHTML( itemID, itemName ) {
	var mdvState = new MDVState();
	mdvState.itemID = itemID;
	return '<a href="' + mdvState.getURLHash() + '">' + HTMLEscapeString( itemName ) + '</a>';
}

function addQueryLinkToString( value, mdvState ) {
	return '<a class="queryLink" href="' + mdvState.getURLHash() + '">' + value + '</a>';
}

function displayItemValues( itemValues ) {
	// Do the equivalent of an implode() or join() on these values,
	// joining them by comma.
	var itemValuesString = [];
	var len = itemValues.length, i;
	for (i = 0; i < len; i++ ) {
		var propName = itemValues[i]['Property'];
		var propType = gDataSchema[gCurCategory]['fields'][propName]['fieldType'];
		var objectString = itemValues[i]['Object'];
		if ( itemValues[i].hasOwnProperty('ObjectID') && itemValues[i]['ObjectID'] != null && itemValues[i]['ObjectID'] != '' ) {
			objectString = linkToItemHTML( itemValues[i]['ObjectID'], objectString );
		} else if ( propType == 'Entity' ) {
			// The type is 'Entity', but there's no page for this
			// specific entity, and it's considered a filter field,
			// add a link to query on this value.
			var isFilter = gDataSchema[gCurCategory]['fields'][propName]['isFilter'];
			if ( objectString != '' && isFilter ) {
				var selectedFilters = [];
				selectedFilters[propName] = objectString;
				var newMDVState = new MDVState(gCurCategory, selectedFilters);
				objectString = addQueryLinkToString( objectString, newMDVState );
			}
		} else if ( propType == 'ID' ) {
			// Ignore this field.
			continue;
		} else if ( propType == 'Text' ) {
			// Some text-manipulation - maybe this should be done
			// for all types.
			var origObjectString = objectString;
			objectString = objectString.replace("\n", '<br />');
			objectString = HTMLEscapeString( objectString );
			var isFilter = gDataSchema[gCurCategory]['fields'][propName]['isFilter'];
			if ( objectString != '' && isFilter ) {
				var selectedFilters = [];
				selectedFilters[propName] = origObjectString;
				var newMDVState = new MDVState( gCurCategory, selectedFilters );
				objectString = addQueryLinkToString( objectString, newMDVState );
			}
		} else if ( propType == 'URL' ) {
			if ( objectString != '' ) {
				objectString = '<a href="' + objectString + '">' + objectString + '</a>';
			}
		} else if ( propType == 'Image URL' ) {
			if ( objectString != '' ) {
				objectString = '<img src="' + objectString + '" />';
			}
		} else if ( propType == 'Video URL' ) {
			if ( objectString != '' ) {
				// HTML5 video
				objectString = '<div style="max-width: 90%"><video controls><source src="' + objectString + '" /><p>This browser does not support HTML5 videos.</p></video></div>';
			}
		} else if ( propType == 'Audio URL' ) {
			if ( objectString != '' ) {
				// HTML5 audio
				objectString = '<div style="max-width: 90%"><audio controls><source src="' + objectString + '" /><p>This browser does not support HTML5 audio.</p></audio></div>';
			}
		// Viewer.JS stuff temporarily commented out.
		/*
		} else if ( propType == 'Document path' ) {
			if ( objectString != '' ) {
				// Use Viewer.JS - for either PDF or ODF files
				objectString = '<p><iframe src="libs/Viewer.js/#../../apps/' + gAppSettings['Name'] + '/' + objectString + '" width="520" height="350" allowfullscreen webkitallowfullscreen></iframe></p>';
			}
		*/
		} else if ( DataLoader.isDateType(propType) ) {
			objectString = Date.dbStringToDisplayString( objectString );
		}
		if (itemValuesString[propName] == null) {
			itemValuesString[propName] = objectString;
		} else {
			itemValuesString[propName] += ", " + objectString;
		}
	}

	for ( var propName in itemValuesString) {
		var msg = '<li><span class="fieldName">' + propName + ':</span> ' + itemValuesString[propName] + "</li>\n";
		jQuery('ul#itemValues').append(msg);
	}
}

function displayCompoundEntitiesForItem( allEntityValues, dataPerEntity, itemName ) {
	// Go through the set of entity values multiple times - first, a
	// bunch of times to get the set of category/property pairs that we'll
	// be displaying, and then, for each such pair, to find the set of
	// matching items and display them as a list.
	// There's no doubt a more efficient way to do this, but this was the
	// easiest approach I could think of.

	// We go through the categories and properties in gDataSchema so that
	// they'll appear on the item page in the same order that they appear
	// in the schema.
	var len = allEntityValues.length, i;
	var categoryPropertyPairs = {};
	for ( categoryName in gDataSchema ) {
		for ( fieldName in gDataSchema[categoryName]['fields'] ) {
			var thisPairAlreadyFound = false;
			for (i = 0; i < len; i++) {
				var curSubjectID = allEntityValues[i]['SubjectID'];
				var curCategory = dataPerEntity[curSubjectID]['Category'];
				if ( curCategory != categoryName ) {
					continue;
				}
				var curProperties = dataPerEntity[curSubjectID]['Properties'];
				for ( var j = 0; j < curProperties.length; j++ ) {
					var curProperty = curProperties[j];
					if ( curProperty != fieldName ) {
						continue;
					}
					// We're still here - we have a match!
					if ( ! categoryPropertyPairs.hasOwnProperty( curCategory ) ) {
						categoryPropertyPairs[curCategory] = {};
					}
					categoryPropertyPairs[curCategory][curProperty] = true;
					// We could do this with a
					// "break <label>" call
					// instead - oh well.
					thisPairAlreadyFound = true;
				}
				if ( thisPairAlreadyFound ) {
					break;
				}
			}
		}
	}

	var msg = "";
	for ( var selectedCategory in categoryPropertyPairs ) {
		for ( var selectedProperty in categoryPropertyPairs[selectedCategory] ) {
			msg += "<h3>" + selectedCategory + " that have " + itemName + " as " + selectedProperty + ":</h3>\n";
			// We have a separate variable just for the HTML of
			// this list, so we can exit out, without displaying
			// any of it, if the list gets too long.
			var curListMsg = '';
			if ( gCurCategory == selectedCategory ) {
				curListMsg += "<div class=\"entitiesList\">";
			} else {
				curListMsg += "<ul>\n";
			}
			var curSubjectID = null, prevSubjectID = null;
			var sizeOfList = 0;
			var maxListSize = 500;
			// For nameless categories, we're assuming that each
			// field modifies the set of fields before it - the
			// same assumption that holds for the set of "further
			// flters" displayed at the top.
			// This is probably not a correct assumption in all
			// cases. @TODO - more work needs to be done here.
			var cumulativeQueryLinkFilters = [];
			for (i = 0; i < len; i++) {
				curSubjectID = allEntityValues[i]['SubjectID'];
				var curSubjectName = dataPerEntity[curSubjectID]['Name'];
				curCategory = dataPerEntity[curSubjectID]['Category'];
				if ( curCategory != selectedCategory ) {
					continue;
				}
				var curProperties = dataPerEntity[curSubjectID]['Properties'];
				var foundMatchingProperty = false;
				for ( var j = 0; j < curProperties.length; j++ ) {
					if ( curProperties[j] == selectedProperty ) {
						foundMatchingProperty = true;
					}
				}
				if ( !foundMatchingProperty ) {
					continue;
				}

				if ( curSubjectID != prevSubjectID ) {
					sizeOfList++;
					if ( sizeOfList > maxListSize ) {
						// Too big! Exit
						break;
					}
					if ( selectedCategory != gCurCategory ) {
						// Reset.
						cumulativeQueryLinkFilters = [];
						curListMsg += "</ul>\n";
						curListMsg += "<ul class=\"compoundEntityInfo\">\n";
						curListMsg += "<li class=\"entityName\">" + linkToItemHTML( curSubjectID, curSubjectName ) + "</li>\n";
					} else {
						if ( sizeOfList > 1 ) {
							curListMsg += ", ";
						}
						curListMsg += linkToItemHTML( curSubjectID, curSubjectName );
					}
				}
				if ( selectedCategory != gCurCategory ) {
					var propName = allEntityValues[i]['Property'];
					var objectString = allEntityValues[i]['Object'];
					var isFilter = gDataSchema[selectedCategory]['fields'][propName]['isFilter'];
					if ( objectString != '' && isFilter ) {
						cumulativeQueryLinkFilters[selectedCategory + '::' + propName] = objectString;
						var newMDVState = new MDVState( gCurCategory, cumulativeQueryLinkFilters );
						objectString = addQueryLinkToString( objectString, newMDVState );
					}
					curListMsg += '<span class="fieldName">' + propName + ":</span> " + objectString + "<br />\n";
				}
				prevSubjectID = curSubjectID;
			}
			if ( sizeOfList <= maxListSize ) {
				if ( gCurCategory == selectedCategory ) {
					curListMsg += "</div>\n";
				} else {
					curListMsg += "</ul>\n";
				}
			} else {
				// Show "error" message, plus a link to the
				// corresponding filter page for this set.
				var selectedFilters = [];
				selectedFilters[selectedProperty] = itemName;
				var newMDVState = new MDVState( selectedCategory, selectedFilters);
				curListMsg = "<p><em>Too many items to list; <a href=\"" + newMDVState.getURLHash() + "\">see here</a> for the complete list.</em></p>";
			}
			msg += curListMsg;
		}
	}

	addToMainText( msg );
}

function displayCompoundItemValues( entityValues, itemName ) {
	var len = entityValues.length, i;
	var itemValues = [];
	var compoundEntityIDs = null;

	var dataPerEntity = {};
	for (i = 0; i < len; i++) {
		var entityID = entityValues[i]['SubjectID']
		// We may or may not have gotten this entity before. If we have,
		// it means there's more than one property connecting it to
		// the current item - so just get the new property and add it
		// to the list.
		if ( dataPerEntity.hasOwnProperty(entityID) ) {
			dataPerEntity[entityID]['Properties'].push(entityValues[i]['Property']);
			continue;
		}

		if ( compoundEntityIDs == null ) {
			compoundEntityIDs = entityID;
		} else {
			compoundEntityIDs += ", " + entityID;
		}
		dataPerEntity[entityID] = {};
		dataPerEntity[entityID]['Category'] = entityValues[i]['Category'];
		dataPerEntity[entityID]['Name'] = entityValues[i]['Name']
		// This is an array, because there might be more than one
		// property pointing between the two entities.
		dataPerEntity[entityID]['Properties'] = [];
		dataPerEntity[entityID]['Properties'].push(entityValues[i]['Property']);
	}
	if ( compoundEntityIDs != null ) {
		gDBConn.displayCompoundEntitiesForItem( compoundEntityIDs, dataPerEntity, itemName );
	}
}

function displayFilterValuesScreen( mdvState ) {
	displayTitle( mdvState );
	displayTopSearchInput( mdvState );
	displayCategoryAndSelectedFiltersList( mdvState );
	displayAdditionalFilters( mdvState );
	gDBConn.displayFilterValues( mdvState );
}

function filterValuesHaveNumericalVariation( filterValues ) {
	var len = filterValues.length;
	if ( len < 2 ) { return false; }
	var firstValue = null;
	for (var i = 0; i < len; i++) {
		var curValue = filterValues[i]['numValues'];
		// Ignore '0' values
		if ( curValue == 0 ) {
			continue;
		}
		if ( firstValue == null ) {
			firstValue = curValue;
		} else if ( curValue != firstValue ) {
			return true;
		}
	}
	return false;
}

function displayFilterValues( mdvState, filterValues ) {
	// If we're in the search form, display something completely different
	if ( mdvState.useSearchForm ) {
		displaySearchFormInput( mdvState, filterValues );
		return;
	}

	displayMainText('');
	var msg = "<p>Values for <strong>" + mdvState.displayFilter + "</strong>:</p>\n"

	// This is the 'type' of the filter - String, Number, Date, etc.
	var filterType = mdvState.getDisplayFilterType();

	var len = filterValues.length;
	var hasNumericalVariation = filterValuesHaveNumericalVariation( filterValues );
	// Skip over all filter display format stuff if there's only one
	// filter value.
	if ( len <= 1 ) {
		msg += "<div id=\"filterValuesList\" class=\"cells\">\n";
	} else {
		if ( filterType != 'Number' ) {
			setTrueFilterDisplayFormat( mdvState, hasNumericalVariation );
		}
		// Display this for all but 'Number' filters - it doesn't make
		// sense for that case.
		if ( filterType != 'Number' && hasNumericalVariation ) {
			displayFilterFormatTabs( mdvState );
		}
		if ( mdvState.filterDisplayFormat == 'number' ) {
			// Sort by number of values, descending.
			filterValues.sort( function(a,b) { return b['numValues'] - a['numValues']; } );
			var highestNum = filterValues[0]['numValues'];
		// Restore this if there's a desire to add graphs for the
		// alphabetical listing as well.
		/*
		} else {
			var highestNum = 0;
			for ( i = 0; i < filterValues.length; i++ ) {
				highestNum = Math.max( highestNum, filterValues[i]['numValues'] );
			}
		*/
		}
		var mainClass = ( mdvState.filterDisplayFormat == 'alphabetical' || mdvState.filterDisplayFormat == 'date' ) ? 'cells' : 'rows';
		msg += "<div id=\"filterValuesList\" class=\"" + mdvState.filterDisplayFormat + "Display " + mainClass + "\">\n";

	}

	// We may show a listing at the end of all the values that were too
	// infrequent to be listed here, and their total instances.
	var numOtherValues = 0;
	var numOtherItems = 0;
	for (var i = 0; i < len; i++) {
		var newDBState = mdvState.clone();
		newDBState.displayFilter = null;
		var curFilter = filterValues[i];
		if ( curFilter['numValues'] == 0 ) {
			continue;
		}
		// If a value has less than .1% of the items of the most
		// "popular" value, don't show it; and if we've already reached
		// 600 values, don't show any more.
		if ( i >= 600 || curFilter['numValues'] < ( filterValues[0]['numValues'] * .001 ) ) {
			numOtherValues++;
			numOtherItems += curFilter['numValues'];
			continue;
		}
		var filterName = curFilter['filterName'];
		if ( filterName == null ) {
			filterNameDisplay = "<em>No value</em>";
			filterHash = '__null';
		} else if ( filterType == 'Number' ) {
			var numberRange = NumberRange.fromString( filterName );
			filterNameDisplay = numberRange.toDisplayString();
			filterHash = filterName.toString();
		} else {
			filterNameDisplay = HTMLEscapeString( filterName.toString() );
			filterHash = filterName.toString();
		}
		var rowDisplay = '<strong>' + filterNameDisplay + "</strong> (" + curFilter['numValues'] + ")";
		if ( mdvState.filterDisplayFormat == 'number' ) {
			rowDisplay += ' ';
			var numPixels = Math.ceil( 200 * curFilter['numValues'] / highestNum );
			//var percentWidth = Math.ceil( 75 * curFilter['numValues'] / highestNum );
			// If it's just one pixel, don't even bother - it
			// doesn't add any real info.
			if ( numPixels > 1 ) {
				rowDisplay += '<div class="numValuesBar" style="width: ' + numPixels + 'px;"></div>';
				//rowDisplay += '<div class="numValuesBar" style="width: ' + percentWidth + '%;"></div>';
			}
		}
		newDBState.selectedFilters[mdvState.displayFilter] = filterHash;
		newDBState.filterDisplayFormat = null; // always reset this
		msg += listElementHTML( newDBState, rowDisplay, true );
	}
	msg += "</div>\n";
	if ( numOtherValues > 0 ) {
		msg += "<p>There were <strong>" + numOtherValues + "</strong> other values for this field that are not listed here, with <strong>" + numOtherItems + "</strong> instances altogether.<p>";
	}
	addToMainText( msg );
	makeRowsClickable();
}

function displayTopSearchInput( mdvState ) {
	// Eventually, it would be great to also make use of the current set
	// of selected filters, i.e. use all of mdvState.
	var newMDVState = new MDVState();
	newMDVState.categoryName = mdvState.categoryName;
	if ( mdvState.searchString != undefined ) {
		newMDVState.searchString = mdvState.searchString;
	} else {
		newMDVState.searchString = "";
	}
	var text = '<input id="topSearchText" type="search" value="' + newMDVState.searchString + '" size="10" />' + "\n";
	jQuery('#topSearchInput').html(text);
	jQuery('#topSearchText').keypress( function(e) {
		if (e.which == 13) { // "enter" key
			newMDVState.searchString = jQuery('#topSearchText').val();
			window.location = newMDVState.getURLHash();
		}
	});
}

function displayBottomSearchInput( mdvState ) {
	var text = '<div id="searchInput"><input id="searchText" type="text" value="' + mdvState.searchString + '" />' + "\n" +
		'<input id="searchButton" type="button" value="Search all ' + mdvState.categoryName + '" /></div>' + "\n";
	jQuery('#searchInputWrapper').html(text);
	jQuery('#searchText').keypress( function(e) {
		if (e.which == 13) { // "enter" key
			mdvState.searchString = jQuery('#searchText').val();
			window.location = mdvState.getURLHash();
		}
	});
	jQuery('#searchButton').click( function() {
		mdvState.searchString = jQuery('#searchText').val();
		window.location = mdvState.getURLHash();
		return false;
	});
}

function formattedNameInSearchResults( searchText, itemName ) {
	var firstLocation = itemName.toLowerCase().indexOf(searchText.toLowerCase());
	var endOfSearchText = firstLocation + searchText.length;
	return itemName.substring(0, firstLocation) +
		'<span class="trueSearchText">' +
		itemName.substring(firstLocation, endOfSearchText) + '</span>' +
		itemName.substring(endOfSearchText, itemName.length);
}

function searchResultInContext( searchText, fullText ) {
	var firstLocation = fullText.toLowerCase().indexOf(searchText.toLowerCase());
	var endOfSearchText = firstLocation + searchText.length;
	var startIndex = Math.max(0, firstLocation - 20);
	var endIndex = Math.min(fullText.length, endOfSearchText + 20);
	// Move start and end indexes backwards and forwards, respectively,
	// to try to capture a whole word, if possible.
	var numCharactersBack = 0;
	while ( startIndex > 0 && fullText[startIndex - 1] != ' ' && numCharactersBack < 10 ) {
		startIndex--;
		numCharactersBack++;
	}

	var numCharactersForward = 0;
	while ( endIndex < fullText.length - 1 && fullText[endIndex] != ' ' && numCharactersForward < 10 ) {
		endIndex++;
		numCharactersForward++;
	}

	var text = fullText.substring(startIndex, firstLocation) +
		'<span class="trueSearchText">' +
		fullText.substring(firstLocation, endOfSearchText) +
		'</span>' + fullText.substring(endOfSearchText, endIndex);
	if ( startIndex > 0 ) {
		text = "..." + text;
	}
	if ( endIndex < fullText.length ) {
		text += "...";
	}
	return text;
}

function displaySearchResultsScreen( mdvState ) {
	blankFiltersInfo();
	displayTitle( mdvState );
	displayTopSearchInput( mdvState );
	// We just need the category name.
	displayCategoryAndSelectedFiltersList( mdvState );

	if ( mdvState.searchString == '' ) {
		displayMainText("<h2>Search</h2>");
	} else {
		displayMainText("<h2>Search results for '" + mdvState.searchString + "':</h2>");
		gDBConn.displayNameSearchResults( mdvState );
		gDBConn.displayValueSearchResults( mdvState );
	}
	displayBottomSearchInput( mdvState );
}

function displayNameSearchResults( mdvState, searchResults ) {
	var i, len = searchResults.length;
	if ( len == 0 ) {
		addToMainText("<p><em>No item names match this text.</em></p>");
		return;
	}

	text = "<p>Items whose name matches this text:</p>\n";
	text += "<ul id=\"nameSearchResults\" class=\"rows\">\n";
	for ( i = 0; i < len; i++ ) {
		var formattedItemName = formattedNameInSearchResults( mdvState.searchString, searchResults[i]['Name'] );
		var newDBState = new MDVState();
		newDBState.itemID = searchResults[i]['ID'];
		text += listElementHTML( newDBState, formattedItemName, false );
	}
	text += "</ul>\n";
	addToMainText( text );
	// For some reason, this call seems to do nothing.
	makeRowsClickable();
}

function displayValueSearchResults( mdvState, searchResults ) {
	var i, len = searchResults.length;
	if ( len == 0 ) {
		addToMainText("<p><em>No item contents match this text.</em></p>");
		// For some reason, this is necessary in order to make
		// the "name" search results clickable.
		makeRowsClickable();
		return;
	}

	// Aggregate into buckets.
	var searchResultsPerItem = {};
	var itemIDs = {};
	for ( i = 0; i < len; i++ ) {
		var itemName = searchResults[i]['Name'];
		itemIDs[itemName] = searchResults[i]['ID'];
		var propName = searchResults[i]['Property'];
		var value = searchResults[i]['Value'];
		if ( searchResultsPerItem.hasOwnProperty( itemName ) ) {
			searchResultsPerItem[itemName].push([propName, value]);
		} else {
			searchResultsPerItem[itemName] = [[propName, value]];
		}
	}

	var itemNames = Object.keys( searchResultsPerItem );
	itemNames.sort();

	text = "<p>Items whose contents match this text:";
	var numSearchResults = itemNames.length;
	var maxResults = 200;
	if ( numSearchResults > maxResults ) {
		text += "<br /><em>(" + numSearchResults + " total results; only first " + maxResults + " results are shown.)</em></p>\n";
		numSearchResults = maxResults;
	}
	text += "</p>";
	text += "<ul id=\"contentSearchResults\" class=\"rows\">\n";
	for ( itemNum = 0; itemNum < numSearchResults; itemNum++ ) {
		itemName = itemNames[itemNum];
		var itemID = itemIDs[itemName];
		text += '<li class="clickable" real-href="#_item=' + itemID + '">';
		text += '<table style="width: 100%;"><tr><td class="searchResultItemName">' + itemName + "</td>";
		text += '<td class="searchResultItemValues">';
		for ( i = 0; i < searchResultsPerItem[itemName].length; i++ ) {
			if ( i > 0 ) {
				text += "<hr />";
			}
			var propName = searchResultsPerItem[itemName][i][0];
			var value = searchResultsPerItem[itemName][i][1];
			var formattedSearchResult = searchResultInContext( mdvState.searchString, value );
			text += propName + " = " + formattedSearchResult;
		}
		text += "</td></tr></table></li>\n";
	}
	text += "</ul>\n";
	addToMainText( text );
	makeRowsClickable();
}

function displayPage( mdvState ) {
	var pageFile;

	// Set class for this page, to allow custom CSS.
	jQuery('body').attr( 'class', "page-" + mdvState.pageName );

	blankFiltersInfo();
	// Special handling for start page
	if ( mdvState.pageName == '_start' ) {
		jQuery('#header').hide();
		displayMainText('');
		pageContents = gAppSettings['Start page'];
	} else {
		displayMainText( '<h1>' + mdvState.pageName + '</h1>' );
		pageContents = gPagesInfo[mdvState.pageName][1];
	}
	displayTitle( mdvState );

	jQuery('#topSearchInput').html('');

	addToMainText( pageContents );
}

function makeRowsClickable() {
	jQuery('.clickable').click( function() {
		window.location = jQuery(this).attr('real-href');
		return false;
	});
}

function refreshData() {
	localStorage.removeItem('Miga ' + getURLPath());
	gAppSettings = null;
	gDataSchema = null;
	gDBRandomString = null;
	// Is there a way to do this without a reload?
	//window.location.reload();
}

function setDisplayFromURL() {
	displayLoadingMessage("Displaying...");

	gURLHash = window.location.hash;
	mdvState = new MDVState();
	mdvState.setFromURLHash( gURLHash );

	//var onStartPage = ( mdvState.pageName == '_start' &&
	//	gAppSettings.hasOwnProperty('Start page') );
	jQuery('body').removeAttr( 'class' );
	jQuery('#pageTitle').html('');

	// Re-show the header, if it might have been hidden for a custom
	// start page.
	if ( gAppSettings.hasOwnProperty('Start page') ) {
		jQuery('#header').show();
	}

	// Show the custom header and footer, if either exist.
	if ( gAppSettings.hasOwnProperty('Header file') ) {
		var headerFileContents = gAppSettings['Header file'];
		jQuery('#header').html( headerFileContents );
	}

	if ( gAppSettings.hasOwnProperty('Footer file') ) {
		var footerFileContents = gAppSettings['Footer file'];
		jQuery('#footer').html( footerFileContents );
	}

	if ( mdvState.itemID != null ) {
		window.scrollTo(0,0);
		displayItem( mdvState, mdvState.itemID, null );
	} else if ( mdvState.pageName != null ) {
		if ( mdvState.pageName != '_start' || gAppSettings.hasOwnProperty('Start page') ) {
			window.scrollTo(0,0);
			displayPage( mdvState );
		} else {
			displayCategorySelector();
		}
	} else if ( mdvState.useSearchForm ) {
		displaySearchForm( mdvState );
	} else if ( mdvState.showSearchFormResults ) {
		displaySearchFormResults( mdvState );
	} else if ( mdvState.categoryName == null ) {
		// Is this needed?
		displayCategorySelector();
	} else if ( mdvState.searchString != null ) {
		window.scrollTo(0,0);
		displaySearchResultsScreen( mdvState );
	} else if ( mdvState.displayFilter == null ) {
		displayItemsScreen( mdvState );
	} else {
		displayFilterValuesScreen( mdvState );
	}

	jQuery('#poweredBy').html('<a href="http://migadv.com"><img src="images/Powered-by-Miga.png" alt="Powered by Miga" /></a>');

	var curDate = new Date();
	var lastUpdatedHTML = 'Data was last updated ' + getTimeDifferenceString( gDataTimestamp, curDate.getTime() ) + ' ago.';
	jQuery('#lastUpdated').html(lastUpdatedHTML);
}

// Poll for URL changes - this is apparently the only way to get URL
// hash-based links to work!
setInterval(function(){
	if (window.location.hash != gURLHash) {
		setDisplayFromURL();
	}
}, 200);

window.onload = function(event) {
	getSettingsAndLoadData();
}
