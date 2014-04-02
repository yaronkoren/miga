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
	// Find the connector between these two tables - if there's more
	// than one, we'll just take the first one, though that shouldn't
	// ever happen.
	for ( var fieldName in gDataSchema[secondaryCategory]['fields']) {
		var field = gDataSchema[secondaryCategory]['fields'][fieldName];
		if ( field.hasOwnProperty('connectorTable')) {
			if ( field['connectorTable'] == mainCategory ) {
				return fieldName;
			}
		}
	}
	return null;
}

DataLoader.isDateType = function( typeName ) {
	return ( typeName == 'Date' || typeName == 'Start time' || typeName == 'End time' );
}

/**
 * Decide whether each field in each category should be filterable. For
 * non-Text fields, that just depends on the type. For Text fields, count
 * the number of distinct values the field has; if it's less than a
 * certain percentage of the number of total values for the field, make
 * the field filterable.
 */
function analyzeDataForCategory(categoryName, itemsArray) {
	var fieldNum, numFields = itemsArray[0].length;
	var itemNum, numItems = itemsArray.length;

	for (fieldNum = 0; fieldNum < numFields; fieldNum++) {
		var fieldName = itemsArray[0][fieldNum];
		var fieldAttributes = gDataSchema[categoryName]['fields'][fieldName];
		if (fieldAttributes == undefined ) {
			continue;
		}
		var fieldType = fieldAttributes['fieldType'];
		if (fieldType == 'URL' || fieldType == 'Image URL' || fieldType == 'Video URL' || fieldType == 'Audio URL' || fieldType == 'Coordinates' || fieldType == 'End time' ) {
			continue;
		}
		if (DataLoader.isDateType(fieldType) || fieldType == 'Number') {
			fieldAttributes['isFilter'] = true;
			continue;
		}

		var totalNumValues = 0;
		var allFieldValues = {};
		for (itemNum = 1; itemNum < numItems; itemNum++) {
			var curValue = itemsArray[itemNum][fieldNum];
			if ( curValue != undefined && curValue != null && curValue != "" ) {
				if ( fieldAttributes['isList']) {
					var listDelimiter = fieldAttributes['listDelimiter'];
					var realValues = curValue.split(listDelimiter);
					for ( valueNum = 0; valueNum < realValues.length; valueNum++ ) {
						totalNumValues++
						var realValue = realValues[valueNum];
						allFieldValues[realValue] = true;
					}
				} else {
					totalNumValues++
					allFieldValues[curValue] = true;
				}
			}
		}
		var numDistinctFieldValues = 0;
		for ( curValue in allFieldValues ) {
			numDistinctFieldValues++;
		}

		var diffusionOfValues = numDistinctFieldValues / totalNumValues;
		if ( diffusionOfValues <= .67 ) {
			fieldAttributes['isFilter'] = true;
		}
	}
}

/**
 * Recursive function - at the end, it calls the next step in the process,
 * of possibly loading the data into the database.
 */
DataLoader.getAndLoadDataForOneCategory = function( allData, appDirectory, remainingCategories ) {
	var args = {};
	var categoryName = remainingCategories.shift();
	var fileName = gDataSchema[categoryName]['file'];
	if ( fileName == null || fileName == undefined ) {
		fileName = categoryName.replace(' ', '_') + ".csv";
	}
	if ( fileName.indexOf( '://' ) < 0 ) {
		// Get around caching of files
		var randomString = Math.floor((Math.random()*10000)+1);
		args['randomString'] = randomString;
		fileName = appDirectory + "/" + fileName;
	}
	args['file'] = fileName;
	jQuery.get( "DataFileReader.php", args, function(json) {
		var itemsArray = jQuery.parseJSON( json );
		if ( itemsArray.length == 0 ) {
			displayMainText( "<strong>Error: could not get data from file '" + fileName + "'</strong>" );
			return;
		}
		allData[categoryName] = itemsArray;
		analyzeDataForCategory(categoryName, itemsArray);
	}).done(function(data) {
		if ( remainingCategories.length > 0 ) {
			DataLoader.getAndLoadDataForOneCategory( allData, appDirectory, remainingCategories );
		} else {
			displayLoadingMessage( "Data read; loading into database..." );
			gDBConn.loadDataIfNecessary( allData );

			// Save all the settings data to LocalStorage!
			var allAppInfo = {};
			allAppInfo['dbRandomString'] = gDBRandomString;
			allAppInfo['dataSchema'] = gDataSchema;
			allAppInfo['appSettings'] = gAppSettings;
			allAppInfo['pagesInfo'] = gPagesInfo;
			var curDate = new Date();
			allAppInfo['dataTimestamp'] = curDate.getTime();

			localStorage.setItem( 'Miga ' + getURLPath(), JSON.stringify( allAppInfo ) );
		}
	}).fail(function(data) {
		displayMainText( "<strong>Error: could not load file '" + fileName + "'</strong>" );
	});
}

DataLoader.getAndLoadDataIfNecessary = function( appDirectory, schemaFileName ) {
	displayLoadingMessage( "Loading data; please wait..." );

	if ( gDataSchema != null && schemaFileName != undefined ) {
		// Fix this - we need to test whether the DB is populated
		// in order to figure out what to do next.
		//gDBConn.loadDataIfNecessary( allData );
		setDisplayFromURL();
		return;
	}

	jQuery.get("DataSchemaReader.php?file=" + appDirectory + "/" + schemaFileName, function(json) {
		// @TODO - gDataSchema should be an array of objects, instead
		// of just a big array.
		gDataSchema = jQuery.parseJSON(json);
	}).done( function(data) {
		categoryNames = [];
		for ( var categoryName in gDataSchema ) {
			categoryNames.push(categoryName);
		}
		DataLoader.getAndLoadDataForOneCategory( {}, appDirectory, categoryNames );
	} );
}

/**
 * Get the contents about the additional, non-data pages, if we don't have
 * it already.
 */
DataLoader.getPagesDataIfNecessary = function( appDirectory, pagesFileName ) {
	if ( gPagesInfo == null && pagesFileName != undefined ) {
		jQuery.get("INIFileReader.php?file=" + appDirectory + "/" + pagesFileName, function(json) {
			gPagesInfo = jQuery.parseJSON(json);
		});
	}
}
