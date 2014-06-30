/**
 * Functions for loading the data, as well as loading the schema and pages
 * information.
 *
 * @author Yaron Koren
 */

function DataLoader() {
}

/**
 * This should probably go elsewhere.
 */
function getConnectorPropertyBetweenCategories( mainCategory, secondaryCategory ) {
	// Find the connector between these two categories - if there's more
	// than one, we'll just take the first one, though that shouldn't
	// ever happen.
	for ( var fieldName in gDataSchema[secondaryCategory]['fields']) {
		var field = gDataSchema[secondaryCategory]['fields'][fieldName];
		if ( field.hasOwnProperty('connectedCategory')) {
			if ( field['connectedCategory'] == mainCategory ) {
				return fieldName;
			}
		}
	}
	return null;
}

DataLoader.isDateType = function( typeName ) {
	return ( typeName == 'Date' || typeName == 'Start time' || typeName == 'End time' );
}

DataLoader.getAppSettingsAndSchema = function() {
	// Preliminary check that JS data file exists and is accesible.
	if ( typeof generalSettings === 'undefined' ) {
		displayMainText('<h1>Error!</h1><h2>Could not find data file migaData.js. Either you are offline, or this file has not been created yet.</h2>');
		return;
	}

	var curURL = getURLPath();
	for ( appName in generalSettings ) {
		if ( appName == '_general' ) {
			continue;
		}
		var appSettings = generalSettings[appName];
		if ( appSettings.hasOwnProperty('URL') && appSettings['URL'] == curURL ) {
			gAppSettings = appSettings;
			gAppSettings['Name'] = appName;
			gDataSchema = schemas[appName];
			gPagesInfo = pages[appName];
			break;
		}
	}

	// If there were no matches, use the first app
	if ( gAppSettings == null ) {
		for ( appName in generalSettings ) {
			if ( appName == '_general' ) continue;
			var appSettings = generalSettings[appName];
			gAppSettings = appSettings;
			gAppSettings['Name'] = appName;
			gDataSchema = schemas[appName];
			gPagesInfo = pages[appName];
			break;
		}
	}
}
