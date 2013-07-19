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
 * @version 1.0
 */

// Global variables - sorry if this offends anyone. :)
var gDBRandomString = null;
var gDataTimestamp = null;
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
		jQuery('#logo').html(logoHTML);
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
	displayTitle( null );
}

function getSettingsAndLoadData() {
	// If we need the settings, retrieve them from LocalSettings, if
	// they're there.
	if ( gDataSchema == null ) {
		var allAppInfoJSON = localStorage.getItem('Miga ' + getURLPath() );
		if ( allAppInfoJSON != null ) {
			var allAppInfo = JSON.parse( allAppInfoJSON );
			gDBRandomString = allAppInfo['dbRandomString'];
			gDataTimestamp = allAppInfo['dataTimestamp'];
			gDataSchema = allAppInfo['dataSchema'];
			gAppSettings = allAppInfo['appSettings'];
			gPagesInfo = allAppInfo['pagesInfo'];
			setAllFromAppSettings();
		}
	}

	if ( gAppSettings == null ) {
		jQuery.get("SettingsReader.php?url=" + getURLPath(), function(json) {
			gAppSettings = jQuery.parseJSON(json);
			setAllFromAppSettings();
		}).done( function(data) {
			if ( gDBConn == null ) {
				return;
			}
			androidOnlyAlert("Calling DataLoader.getAndLoadDataIfNecessary()");
			DataLoader.getAndLoadDataIfNecessary( gAppSettings['Directory'], gAppSettings['Schema file'] );
			DataLoader.getPagesDataIfNecessary( gAppSettings['Directory'], gAppSettings['Pages file'] );
		});
	} else {
		DataLoader.getAndLoadDataIfNecessary( gAppSettings['Directory'], gAppSettings['Schema file'] );
		DataLoader.getPagesDataIfNecessary( gAppSettings['Directory'], gAppSettings['Pages file'] );
	}
}

/**
 * Sets both the header and the document title of the page.
 */
function displayTitle( mdvState ) {
	if ( gAppSettings == null ) {
		// Is this check necessary?
		getSettingsAndLoadData();
	} else {
		var titleText = gAppSettings['Name'];
		var documentTitleText = gAppSettings['Name'];
		if ( mdvState == null ) {
			// Do nothing
		} else if ( mdvState.categoryName != null ) {
			var mdvStateForCategory = new MDVState();
			mdvStateForCategory.categoryName = mdvState.categoryName;
			titleText += ': <strong><a href="' + mdvStateForCategory.getURLHash() + '">' + mdvStateForCategory.categoryName + '</a></strong>';
			//documentTitleText += ": " + mdvState.categoryName;
			if ( mdvState.itemName != null ) {
				documentTitleText += ": " + mdvState.itemName;
			}
		} else if ( mdvState.pageName != null ) {
			documentTitleText += ": " + mdvState.pageName;
		}
		jQuery('#title').html(titleText);
		document.title = documentTitleText;
	}
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

function displayCategorySelector() {
	displayTitle( null );
	jQuery('#selectedFilters').html("");
	jQuery('#furtherFiltersWrapper').html("");

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
	if (len == 1) {
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
			if ( curPage.hasOwnProperty('File') ) {
				//var fileName = curPage['File'];
				mdvState.pageName = pageName;
			} else if ( curPage.hasOwnProperty('Category') ) {
				mdvState.categoryName = curPage['Category'];
			}
			msg += listElementHTML( mdvState, pageName );
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
				msg += listElementHTML( mdvState, '&nbsp;&nbsp;&nbsp;&nbsp;View Current ' + mdvState.categoryName );
				gDBConn.possiblyShowCurrentEventsLink( mdvState );
				continue;
			}
			var mdvState = new MDVState( categoryName );
			msg += listElementHTML( mdvState, 'View ' + categoryName );
		}
	}
	msg += "</ul>\n";
	displayMainText( msg );
	makeRowsClickable();
}

function displaySelectedFiltersList( mdvState ) {
	var selectedFilters = mdvState.selectedFilters;
	var msg = '<ul id="selectedFilters">';
	if ( mdvState.currentEventsOnly ) {
		msg += "<li>Currently-occurring events only.</li>\n";
	}
	for ( var propName in selectedFilters ) {
		msg += "<li>";
		var propValueDisplay = selectedFilters[propName];
		if ( selectedFilters[propName] == '__null' ) {
			propValueDisplay = "<em>No value</em>";
		}
		msg += propName + " = <strong>" + propValueDisplay + "</strong> ";
		var newDBState = mdvState.clone();
		delete newDBState.selectedFilters[propName];
		//msg += '<a href="' + newDBState.getURLHash() + '"><strong>[</strong>&#10006;<strong>]</strong></a>';
		msg += '<a href="' + newDBState.getURLHash() + '">[&#10005;]</a>';
		msg += "</li>";
	}
	msg += "</ul>";
	jQuery('#selectedFilters').html( msg );
}

function displayAdditionalFilters( mdvState ) {
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

		if ( mdvState.selectedFilters[filterName] == null || DataLoader.isDateType(filterAttribs['fieldType']) || filterAttribs['fieldType'] == 'Number' ) {
			furtherFilters.push(filterName);
		}
	}

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
				if ( gDataSchema[categoryName]['fields'][fieldName]['connectorTable'] == mdvState.categoryName ) {
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
					msg += " " + filterName;
				}
			} else {
				if ( isCompoundFilter ) {
					msg += ' <a href="' + newDBState.getURLHash() + '" class="compoundFilterName">' + filterName.substring( filterColonsLoc + 2 ) + "</a>";
				} else {
					msg += ' <a href="' + newDBState.getURLHash() + '">' + filterName + "</a>";
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

function displayItem( itemID, itemName ) {
	jQuery('#selectedFilters').html("");
	jQuery('#furtherFiltersWrapper').html("");
	displayMainText('<ul id="itemValues"></ul>');
	// This displayItem() function will itself call displayItemValues().
	gDBConn.displayItem( itemID, itemName );
}

function listElementHTML( mdvState, internalHTML ) {
	msg = '<li ';
	if ( mdvState.currentEventsOnly ) {
		msg += 'id="view-current-' + mdvState.categoryName + '" ';
		msg += 'style="display: none;" ';
	}
	msg += 'class="clickable" real-href="' + mdvState.getURLHash() + '">';
	msg += '<table class="listElement"><tr>';
	msg += '<td>' + internalHTML + "</td>";
	msg += '<td style="text-align: right; font-weight: bold;">&gt;</td>';
	msg += '</tr></table>';
	msg += "</li>\n";
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

function displayFilterFormatTabs( mdvState ) {
	msg = '<ul id="displaySelector">';
	var filterType = mdvState.getDisplayFilterType();
	if ( DataLoader.isDateType(filterType) ) {
		if ( mdvState.filterDisplayFormat == null ) {
			mdvState.filterDisplayFormat = 'date';
		}
		var filterDisplayFormats = ['date', 'number'];
	} else {
		if ( mdvState.filterDisplayFormat == null ) {
			mdvState.filterDisplayFormat = 'number';
		}
		var filterDisplayFormats = ['number', 'alphabetical'];
	}
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

function displayPageNavigation( mdvState, numItems, itemsPerPage ) {
		msg = "<p>Go to page:</p>";
		msg += '<ul id="pageNumbers">';
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
		addToMainText( msg );
}

function displayItemsScreen( mdvState ) {
	displayTitle( mdvState );
	displaySelectedFiltersList( mdvState );
	displayAdditionalFilters( mdvState );

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
		if ( dateProperty == null && DataLoader.isDateType(propType) ) {
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
	displaySearchIcon( mdvState.categoryName );
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
		displayItem( itemValues['SubjectID'], itemValues['SubjectName'] );
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

	var itemsPerPage = 500;
	if ( numItems > itemsPerPage ) {
		displayPageNavigation( mdvState, numItems, itemsPerPage );
		var firstItemToShow = ( ( mdvState.pageNum - 1 ) * itemsPerPage ) + 1;
		var lastItemToShow = Math.min( itemsPerPage * mdvState.pageNum, numItems );
		msg = "<p>" + numItems + " results found; showing results <strong>" + firstItemToShow + " - " + lastItemToShow + "</strong>.</p>\n";
	} else {
		var firstItemToShow = 1;
		var lastItemToShow = numItems;
		msg = "<p>" + numItems + " results found:</p>\n";
	}
	addToMainText( msg );

	msg = "<ul id=\"itemsList\" class=\"rows\">\n";
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
		msg += listElementHTML( mdvState, internalHTML );
	}
	msg += "</ul>";
	addToMainText( msg );
	makeRowsClickable();
}

function displayItemTitle( itemName ) {
	jQuery('#furtherFiltersWrapper').html("<h1>" + itemName + "</h1>");
}

function linkToItemHTML( itemID, itemName ) {
	var mdvState = new MDVState();
	mdvState.itemID = itemID;
	return '<a href="' + mdvState.getURLHash() + '">' + itemName + '</a>';
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
		if ( itemValues[i].hasOwnProperty('ObjectID') && itemValues[i]['ObjectID'] != null ) {
			objectString = linkToItemHTML( itemValues[i]['ObjectID'], objectString );
		} else if ( propType == 'ID' ) {
			// Ignore this field.
			continue;
		} else if ( propType == 'Text' ) {
			// Some text-manipulation - maybe this should be done
			// for all types.
			objectString = objectString.replace("\n", '<br />');
		} else if ( propType == 'URL' ) {
			if ( objectString != '' ) {
				objectString = '<a href="' + encodeURI(objectString) + '">' + objectString + '</a>';
			}
		} else if ( propType == 'Image URL' ) {
			if ( objectString != '' ) {
				objectString = '<img src="' + objectString + '" />';
			}
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
	var curSubjectID = null, prevSubjectID = null;
	var curCategory = null, prevCategory = null;
	var msg = "";
	var len = allEntityValues.length, i;
	for (i = 0; i < len; i++) {
		curSubjectID = allEntityValues[i]['SubjectID'];
		curSubjectName = dataPerEntity[curSubjectID]['Name'];
		curCategory = dataPerEntity[curSubjectID]['Category'];
		curProperty = dataPerEntity[curSubjectID]['Property'];
		if ( curSubjectID != prevSubjectID ) {
			if ( curCategory == gCurCategory ) {
				if ( curCategory != prevCategory ) {
					msg += "<h3>" + curCategory + " that have " + itemName + " as " + curProperty + ":</h3>\n";
				}
				if ( curSubjectName != '' ) {
					msg += "<li>" + linkToItemHTML( curSubjectID, curSubjectName ) + "</li>\n";
				}
			} else {
				if ( prevSubjectID != null ) {
					msg += "</ul>\n";
				}
				if ( curCategory != prevCategory ) {
					msg += "<h3>" + curCategory + "</h3>\n";
				}
				msg += "<ul class=\"compoundEntityInfo\">\n";
				if ( curSubjectName != '' ) {
					msg += "<li>" + linkToItemHTML( curSubjectID, curSubjectName ) + "</li>\n";
				}
			}
		}
		prevSubjectID = curSubjectID;
		prevCategory = curCategory;
		if ( curCategory != gCurCategory ) {
			msg += '<span class="fieldName">' + allEntityValues[i]['Property'] + ":</span> " + allEntityValues[i]['Object'] + "<br />\n";
		}
	}
	msg += "</ul>\n";
	addToMainText( msg );
}

function displayCompoundItemValues( entityValues, itemName ) {
	var len = entityValues.length, i;
	var itemValues = [];
	var compoundEntityIDs = null;

	var dataPerEntity = {};
	for (i = 0; i < len; i++) {
		var entityID = entityValues[i]['SubjectID']
		if ( compoundEntityIDs == null ) {
			compoundEntityIDs = entityID;
		} else {
			compoundEntityIDs += ", " + entityID;
		}
		dataPerEntity[entityID] = {};
		dataPerEntity[entityID]['Category'] = entityValues[i]['Category'];
		dataPerEntity[entityID]['Name'] = entityValues[i]['Name']
		dataPerEntity[entityID]['Property'] = entityValues[i]['Property'];
	}
	if ( compoundEntityIDs != null ) {
		gDBConn.displayCompoundEntitiesForItem( compoundEntityIDs, dataPerEntity, itemName );
	}
}

function displayFilterValuesScreen( mdvState ) {
	displayTitle( mdvState );
	displaySelectedFiltersList( mdvState );
	displayAdditionalFilters( mdvState );
	gDBConn.displayFilterValues( mdvState );
}

function displayFilterValues( mdvState, filterValues ) {
	displayMainText('');
	var msg = "<p>Values for <strong>" + mdvState.displayFilter + "</strong>:</p>\n"
	addToMainText( msg );

	var filterType = mdvState.getDisplayFilterType();

	var len = filterValues.length;
	// Skip over all filter display format stuff if there's only one
	// filter value.
	if ( len <= 1 ) {
		msg = "<ul id=\"filterValuesList\" class=\"rows\">\n";
	} else {
		// Display this for all but 'Number' filters - it doesn't make
		// sense for that case.
		if ( filterType != 'Number' ) {
			displayFilterFormatTabs( mdvState );
		}
		if ( mdvState.filterDisplayFormat == 'number' ) {
			msg = "<ul id=\"filterValuesList\" class=\"numberDisplay rows\">\n";
		} else {
			msg = "<ul id=\"filterValuesList\" class=\"rows\">\n";
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
	}

	for (var i = 0; i < len; i++) {
		var newDBState = mdvState.clone();
		newDBState.displayFilter = null;
		var curFilter = filterValues[i];
		if ( curFilter['numValues'] == 0 ) continue;
		var filterName = curFilter['filterName'];
		if ( filterName == null ) {
			filterNameDisplay = "<em>No value</em>";
			filterHash = '__null';
		} else if ( filterType == 'Number' ) {
			var numberRange = NumberRange.fromString( filterName );
			filterNameDisplay = numberRange.toDisplayString();
			filterHash = filterName.toString();
		} else {
			filterNameDisplay = filterName.toString();
			filterHash = filterName.toString();
		}
		var rowDisplay = filterNameDisplay + " (" + curFilter['numValues'] + ")";
		if ( mdvState.filterDisplayFormat == 'number' ) {
			rowDisplay += ' ';
			var numPixels = Math.ceil( 200 * curFilter['numValues'] / highestNum );
			// If it's just one pixel, don't even bother - it
			// doesn't add any real info.
			if ( numPixels > 1 ) {
				rowDisplay += '<div class="numValuesBar" style="width: ' + numPixels + 'px;"></div>';
			}
		}
		newDBState.selectedFilters[mdvState.displayFilter] = filterHash;
		newDBState.filterDisplayFormat = null; // always reset this
		msg += listElementHTML( newDBState, rowDisplay );
	}
	msg += "</ul>\n";
	addToMainText( msg );
	makeRowsClickable();
}

function displaySearchIcon( categoryName ) {
	var newDBState = new MDVState();
	newDBState.categoryName = categoryName;
	newDBState.searchString = "";
	jQuery('#searchIcon').html(' <a href="' + newDBState.getURLHash() + '"><img src="images/miga-search.png" /></a>');
}

function displaySearchInput( mdvState ) {
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
	displayTitle( mdvState );
	jQuery('#selectedFilters').html();
	jQuery('#furtherFiltersWrapper').html();
	if ( mdvState.searchString == '' ) {
		displayMainText("<h2>Search</h2>");
	} else {
		displayMainText("<h2>Search results for '" + mdvState.searchString + "':</h2>");
		gDBConn.displayNameSearchResults( mdvState );
		gDBConn.displayValueSearchResults( mdvState );
	}
	displaySearchInput( mdvState );
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
		text += listElementHTML( newDBState, formattedItemName );
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
	displayTitle( mdvState );
	displayMainText( '<h1>' + mdvState.pageName + '</h1>' );

	var pageFile = gPagesInfo[mdvState.pageName]['File'];
	var appDirectory = gAppSettings['Directory'];
	jQuery.get("apps/" + appDirectory + "/" + pageFile, function(text) {
		addToMainText(text);
	});
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
	// Is there a way to do this without a reload?
	window.location.reload();
}

function setDisplayFromURL() {
	displayLoadingMessage("Displaying...");

	gURLHash = window.location.hash;
	mdvState = new MDVState();
	mdvState.setFromURLHash( gURLHash );

	if ( mdvState.itemID != null ) {
		window.scrollTo(0,0);
		displayItem( mdvState.itemID, null );
	} else if ( mdvState.pageName != null ) {
		window.scrollTo(0,0);
		displayPage( mdvState );
	} else if ( mdvState.categoryName == null ) {
		displayCategorySelector();
	} else if ( mdvState.searchString != null ) {
		window.scrollTo(0,0);
		displaySearchResultsScreen( mdvState );
	} else if ( mdvState.displayFilter == null ) {
		displayItemsScreen( mdvState );
	} else {
		displayFilterValuesScreen( mdvState );
	}

	// If we don't have the original timestamp, try getting it again.
	if ( gDataTimestamp == null ) {
		var allAppInfoJSON = localStorage.getItem('Miga ' + getURLPath() );
		if ( allAppInfoJSON != null ) {
			var allAppInfo = JSON.parse( allAppInfoJSON );
			gDataTimestamp = allAppInfo['dataTimestamp'];
		}
	}

	jQuery('#poweredBy').html('<a href="http://migadv.com"><img src="images/Powered-by-Miga.png" alt="Powered by Miga" /></a>');

	var refreshDataHTML = '<a href="' + window.location + '">Refresh data.</a>';
	if ( gDataTimestamp != null ) {
		var curDate = new Date();
		refreshDataHTML = 'Data was last updated ' + getTimeDifferenceString( gDataTimestamp, curDate.getTime() ) + ' ago. ' + refreshDataHTML;
	}
	jQuery('#refreshData').html(refreshDataHTML);

	jQuery("#refreshData a").click( function() {
		refreshData();
	});
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
