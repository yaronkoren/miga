/**
 * WebSQLConnector.js
 *
 * Defines the class WebSQLConnector, which creates and queries the
 * Web SQL Database database.
 * Because Web SQL queries are asynchronous, this class's querying
 * methods in turn call other functions to display the queried data.
 *
 * @author Yaron Koren
 */

var entitiesTableName = "entities";
var textPropsTableName = "textProps";
var numberPropsTableName = "numberProps";
var datePropsTableName = "dateProps";
var coordinatePropsTableName = "coordinateProps";
var entityPropsTableName = "entityProps";

function WebSQLConnector( dbName ) {
	if ( typeof openDatabase != 'function' ) {
		throw 'This browser does not seem to support <a href="http://en.wikipedia.org/wiki/Web_SQL_Database">Web SQL Database</a>, which is necessary to run this site. Please use an alternate browser, such as <a href="http://google.com/chrome">Google Chrome</a>, <a href="http://www.apple.com/safari/">Safari</a>, <a href="http://www.opera.com">Opera</a>, Android browser, <a href="http://caniuse.com/sql-storage">etc.</a>';
	}

	// We need this random string because Web SQL doesn't let you delete
	// a database - so if we have a new set of data, we just create a
	// new database, and hope the old one gets deleted by the browser
	// at some point.
	// @TODO - could the same effect be accomplished by just emptying
	// out all the tables on a data refresh? It would make the code a
	// little more complex, but it might be a nicer solution.
	if ( gDBRandomString == null ) {
		gDBRandomString = Math.floor((Math.random()*1000000)+1);
	}
	this.db = openDatabase(dbName + " " + gDBRandomString, "1.0", dbName + " " + gDBRandomString, 2 * 1024 * 1024);
}

WebSQLConnector.prototype.errorHandler = function( tx, error ) {
	// The error code for just about every SQL error seems to be 5.
	// Just refresh everything if that's the case - hopefully this won't
	// lead to infinite refreshes.
	if ( error.code == 5 ) {
		refreshData();
	} else {
		displayMainText("<h3>Database error! " + error.message + " (code = " + error.code + ")</h3>");
	}
}

WebSQLConnector.prototype.loadData = function( allData ) {
	androidOnlyAlert("loadData() called");
	if ( allData == null) return;

	var dbConn = this;
	// Dummy numbers to get progress bar displayed.
	dbConn.displayDBLoadingProgress( 0, 0, 10, 1, 1 );

	var entitiesCreationSQL = "CREATE TABLE IF NOT EXISTS " + entitiesTableName + " (ID integer, Name text, Category text)";
	var textCreationSQL = "CREATE TABLE IF NOT EXISTS " + textPropsTableName + " (SubjectID integer, Property text, Object text)";
	var numberCreationSQL = "CREATE TABLE IF NOT EXISTS " + numberPropsTableName + " (SubjectID integer, Property text, Object real)";
	var dateCreationSQL = "CREATE TABLE IF NOT EXISTS " + datePropsTableName + " (SubjectID integer, Property text, Date real)";
	var coordinateCreationSQL = "CREATE TABLE IF NOT EXISTS " + coordinatePropsTableName + " (SubjectID integer, Property text, Latitude real, Longitude real)";
	// The "entity props" table includes both the ID and name of the object
	// entity - the name is included both for performance reasons, and
	// because not every entity object actually is an entity in the system.
	var entityCreationSQL = "CREATE TABLE IF NOT EXISTS " + entityPropsTableName + " (SubjectID integer, Property text, ObjectID integer, ObjectName text)";

	this.db.transaction(function(tx) {
		tx.executeSql(entitiesCreationSQL, [],
			function (tx, results) {
				// Do nothing
			},
			function (tx, error) {
				displayMainText("<h3>Database error! " + error.message + " (code = " + error.code + ").</h3>");
				addToMainText('<p>Please make sure that this browser is not in a private browsing mode - that is the most likely cause of this error.<p> \
<p>If you are using an iPhone or iPad:</p> \
<ul> \
<li>For iOS 6 or below, go to Settings > Safari > Private Browsing.</li> \
<li>For iPhone with iOS 7 and above, click on the two-square icon at the bottom right of this screen, then click "Private" on the bottom left.</li> \
<li>For iPad with iOS 7 and above, click on "+" at the top of this screen, then click "Private" at the bottom of the new window.</li> \
</ul>');
			}
		);
		tx.executeSql(textCreationSQL);
		tx.executeSql(numberCreationSQL);
		tx.executeSql(dateCreationSQL);
		tx.executeSql(coordinateCreationSQL);
		tx.executeSql(entityCreationSQL);

		var entityNum = 1;
		var numEntries = 0;
		var numTextEntries = 0;
		var numEntityEntries = 0;
		for (var categoryName in allData) {
			var categoryData = allData[categoryName];
			var categoryHeaders = categoryData[0];

			// Create everything except the "entityProps" table -
			// that one has to be created afterwards, so that
			// each relevant entity will already have been
			// created.
			for (var i = 1; i < categoryData.length; i++) {
				var hasNameField = false;
				var hasEntityField = false;
				for (var j = 0; j < categoryData[i].length; j++) {
					var columnName = categoryHeaders[j];
					var columnDescription = gDataSchema[categoryName]['fields'][columnName];
					var cellValue = categoryData[i][j];
					if ( columnDescription == undefined ) {
						continue;
					}
					var columnType = columnDescription['fieldType'];
					if ( columnType != 'Image URL' && columnType != 'Video URL' && columnType != 'Audio URL' && columnType != 'Document path' && columnType != 'Text' && ( cellValue == null || cellValue == '' ) ) continue;
					if ( columnType == 'Name' ) {
						hasNameField = true;

						var escapedEntityName = cellValue.replace(/^\s+|\s+$/g,'').replace(/'/g, "''");
						//var escapedEntityName = cellValue.trim().replace(/'/g, "''");
						var entityInsertionSQL = "INSERT INTO " + entitiesTableName + " (ID, Name, Category) VALUES (" +
							entityNum + ", '" + escapedEntityName + "', '" + categoryName + "')";
						tx.executeSql(entityInsertionSQL);
						continue;
					} else if ( columnType == 'Entity' ) {
						hasEntityField = true;
						// Do nothing.
					} else if ( columnType == 'Number' ) {
						insertionSQLStart = "INSERT INTO " + numberPropsTableName + " (SubjectID, Property, Object) VALUES ("
					} else if ( DataLoader.isDateType(columnType) ) {
						insertionSQLStart = "INSERT INTO " + datePropsTableName + " (SubjectID, Property, Date) VALUES ("
					} else if ( columnType == 'Coordinates' ) {
						insertionSQLStart = "INSERT INTO " + coordinatePropsTableName + " (SubjectID, Property, Latitude, Longitude) VALUES ("
					} else { // 'Text', 'URL', 'ID', etc.
						insertionSQLStart = "INSERT INTO " + textPropsTableName + " (SubjectID, Property, Object) VALUES ("
					}
					if ( columnDescription['isList'] ) {
						if ( cellValue == null ) {
							var objectParts = [];
						} else {
							var objectParts = cellValue.split(columnDescription['listDelimiter']);
						}
					} else {
						var objectParts = new Array( cellValue );
					}
					objectPartsLength = objectParts.length;
					for ( var k = 0; k < objectPartsLength; k++ ) {
						numEntries++;
						var insertionSQL = insertionSQLStart;
						insertionSQL += entityNum + ", ";
						insertionSQL += "'" + columnName.replace(/^\s+|\s+$/g,'').replace(/'/g, "''") + "', ";
						if ( columnType == 'Entity' ) {
							// Do nothing.
						} else if ( DataLoader.isDateType(columnType) ) {
							var dateStringFromFile = objectParts[k].replace(/^\s+|\s+$/g,'');
							// If there are no spaces, slashes or dashes, treat
							// it like a year integer.
							if ( dateStringFromFile.indexOf( ' ' ) < 0 &&
							dateStringFromFile.indexOf( '/' ) < 0 &&
							dateStringFromFile.indexOf( '-' ) < 0 ) {
								var year = parseInt( dateStringFromFile );
								dateStr = yearToDBString( year );
							} else if ( objectParts[k].indexOf( '-' ) > 0 ) {
								// Safari's Date implementation
								// can't handle the YYYY-MM-DD
								// format, so we'll just handle
								// it ourselves.
								var dateParts = objectParts[k].split(/[^0-9]/);
								if ( dateParts.length >= 6 ) {
									date = new Date( dateParts[0], dateParts[1] - 1, dateParts[2], dateParts[3], dateParts[4], dateParts[5] );
								} else if ( dateParts.length >= 3 ) {
									date = new Date( dateParts[0], dateParts[1] - 1, dateParts[2] );
								}
								dateStr = date.getDBString();
							} else {
								date = new Date( objectParts[k].replace(/^\s+|\s+$/g,'') );
								// If only a month and day are specified,
								// the year is set to 2001, for some
								// reason - make sure that
								// didn't happen here.
								if ( date.getFullYear() != 2001 || objectParts[k].indexOf('2001') >= 0 ) {
									dateStr = date.getDBString();
								}
							}
						
							if ( dateStr != null ) {
								insertionSQL += "'" + dateStr + "')";
								tx.executeSql(insertionSQL);
							}
						} else if ( columnType == 'Coordinates' ) {
							var mdvCoords = new MDVCoordinates();
							mdvCoords.setFromString( objectParts[k] );
							if ( mdvCoords.latitude != null ) {
								insertionSQL += mdvCoords.latitude + ", " + mdvCoords.longitude + ")";

								tx.executeSql(insertionSQL);
							}
						} else if ( columnType == 'Number' ) {
							object = objectParts[k];
							// parseFloat() can't handle commas.
							object = object.replace(/,/g, '');
							// Copied from http://stackoverflow.com/questions/18082/validate-numbers-in-javascript-isnumeric
							if ( !isNaN( parseFloat( object ) ) && isFinite( object ) ) {
								insertionSQL += object + ")";
								tx.executeSql(insertionSQL);
							}
						} else { // "Text"
							if ( objectParts[k] != null ) {
								numTextEntries++;
								object = "'" + objectParts[k].replace(/^\s+|\s+$/g,'').replace(/'/g, "''") + "'";
								insertionSQL += object + ")";
								tx.categoryName = categoryName;
								tx.rowNum = i;
								tx.executeSql(insertionSQL, [], function( tx, results ) {
									// results.insertId is a lifesaver!
									// It's the only way we can know the
									// progress of the DB loading.
									if ( results.insertId % 100 == 0 ) {
										dbConn.displayDBLoadingProgress( results.insertId, 0, numEntries, numTextEntries, numEntityEntries );
									}
								});
							}
						}
					}
				}
				// If there was no name field, add it to the
				// 'entities' table without a name.
				// (If there was no name and no 'entity'
				// connection, though, we can just ignore it -
				// it'll never be accessed anyway.)
				if ( hasEntityField && !hasNameField ) {
					var entityInsertionSQL = "INSERT INTO " + entitiesTableName + " (ID, Name, Category)" +
						" VALUES (" + entityNum + ", '', '" + categoryName + "')";
					tx.executeSql(entityInsertionSQL);
				}

				// Store entityNum, i.e. the Subject ID, for
				// use in creating the entityProps table.
				// @HACK - we use the "-1" index for it.
				categoryData[i][-1] = entityNum;
				entityNum++;
			}
		} // end categoryName loop

		// Populate entityProps table.
		for (var categoryName in allData) {
			var categoryData = allData[categoryName];
			var categoryHeaders = categoryData[0];
			for (var i = 1; i < categoryData.length; i++) {
				for (var j = 0; j < categoryData[i].length; j++) {
					var columnName = categoryHeaders[j];
					var columnDescription = gDataSchema[categoryName]['fields'][columnName];
					var cellValue = categoryData[i][j];
					if ( columnDescription == undefined ) {
						continue;
					}
					var columnType = columnDescription['fieldType'];
					if ( columnType != 'Entity' ) {
						continue;
					}

					var insertionSQLStart = "INSERT INTO " + entityPropsTableName + " (SubjectID, Property, ObjectID, ObjectName) VALUES ("
					var insertionSQL = insertionSQLStart;
					insertionSQL += categoryData[i][-1] + ", ";
					insertionSQL += "'" + columnName.replace(/^\s+|\s+$/g,'').replace(/'/g, "''") + "', ";
					if ( columnDescription['isList'] ) {
						if ( cellValue == null ) {
							var objectParts = [];
						} else {
							var objectParts = cellValue.split(columnDescription['listDelimiter']);
						}
					} else {
						var objectParts = new Array( cellValue );
					}
					objectPartsLength = objectParts.length;
					for ( var k = 0; k < objectPartsLength; k++ ) {
						numEntityEntries++;
						// special handling - easier to just have this function do everything, since SQL calls
						// are asynchronous - a "getEntityID()" function would have been difficult to achieve.
						object = objectParts[k].replace(/^\s+|\s+$/g,'').replace(/'/g, "''");
						var parentCategory = columnDescription['connectorTable'];
						var parentCategoryField = columnDescription['connectorField'];
						var parentCategoryFieldType = gDataSchema[parentCategory]['fields'][parentCategoryField]['fieldType'];
						if ( parentCategoryFieldType == 'Name' ) {
							addEntityRowSQL = insertionSQL + '(SELECT ID FROM ' + entitiesTableName +
								" WHERE Name = '" + object + "' AND Category = '" + parentCategory + "'), '" + object + "')";
						} else {
							// We'll assume it's an ID or Text type, both
							// contained in textProps
							addEntityRowSQL = insertionSQL + '(SELECT SubjectID FROM ' + textPropsTableName +
								" WHERE Property = '" + parentCategoryField + "' AND Object = '" + object + "'), '" + object + "')";
						}
						tx.executeSql(addEntityRowSQL, [], function( tx, results ) {
							var rowNum = numTextEntries + results.insertId;
							if ( rowNum % 100 == 0 ) {
								dbConn.displayDBLoadingProgress( numTextEntries, results.insertId, numEntries, numTextEntries, numEntityEntries );
							}
						});

					}
				}
			}
		} // end categoryName loop

		// Why call loadDataIfNecessary()? So that the actual display
		// will only happen after the the database is loaded - i.e.,
		// after all the previous code in this function has been
		// executed.
		// Fun with asynchronousness.
		dbConn.loadDataIfNecessary();
	});
}

WebSQLConnector.prototype.loadDataIfNecessary = function( allData ) {
	var dbConn = this;
	this.db.transaction(function (tx) {
		var selectSQL = 'SELECT ID FROM ' + entitiesTableName + ' LIMIT 1';
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				// Do nothing - it's already loaded.
				setDisplayFromURL();
			},
			function (tx, error) {
				dbConn.loadData( allData );
			}
		);
	});
}

WebSQLConnector.prototype.displayItem = function( itemID, itemName ) {
	var itemName = null;
	var dbConn = this;
	this.db.transaction(function (tx) {
		// Now call a bunch of SQL queries to get the different values
		// for this item. This is a hack currently - each query
		// displays its results to the screen when it's finished.
		// Instead, the queries should be chained, and then the
		// results should be displayed at the very end, in a logically
		// sorted way.
		if ( itemName == null ) {
			var selectSQL = 'SELECT Name, Category FROM ' + entitiesTableName +
				' WHERE ID = ' + itemID;
			tx.executeSql(selectSQL, [],
				function (tx, results) {
					itemName = results.rows.item(0)['Name'];
					gCurCategory = results.rows.item(0)['Category'];
					var mdvState = new MDVState();
					mdvState.categoryName = gCurCategory;
					mdvState.itemName = itemName;
					displayTitle( mdvState );
					displayCategoryAndSelectedFiltersList( mdvState );

					displayItemTitle( itemName );
					displayTopSearchInput( mdvState );
				}
			);
		} else {
			displayItemTitle( itemName );
		}

		var selectSQL = 'SELECT Property, ObjectID, ObjectName AS Object' +
			' FROM ' + entityPropsTableName +
			' WHERE SubjectID = ' + itemID;
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				// Construct array holding query results
				var len = results.rows.length, i;
				var itemValues = [];
				for (i = 0; i < len; i++) {
					itemValues.push( results.rows.item(i) );
				}
				displayItemValues( itemValues );
			},
			dbConn.errorHandler
		);

		var selectSQL = 'SELECT Property, Object FROM ' + textPropsTableName +
			' WHERE SubjectID = ' + itemID;
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				// Construct array holding query results
				var len = results.rows.length, i;
				var itemValues = [];
				for (i = 0; i < len; i++) {
					itemValues.push( results.rows.item(i) );
				}
				displayItemValues( itemValues );
			},
			dbConn.errorHandler
		);

		var selectSQL = 'SELECT Property, Object FROM ' + numberPropsTableName +
			' WHERE SubjectID = ' + itemID;
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				// Construct array holding query results
				var len = results.rows.length, i;
				var itemValues = [];
				for (i = 0; i < len; i++) {
					// We need to create a new object,
					// because SQL results are immutable.
					var curRow = {};
					curRow['Property'] = results.rows.item(i)['Property'];
					curRow['Object'] = numberWithCommas(results.rows.item(i)['Object']);
					itemValues.push(curRow);
				}
				displayItemValues( itemValues );
			},
			dbConn.errorHandler
		);

		var selectSQL = 'SELECT Property, Date AS Object FROM ' + datePropsTableName +
			' WHERE SubjectID = ' + itemID;
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				// Construct array holding query results.
				var len = results.rows.length, i;
				var itemValues = [];
				for (i = 0; i < len; i++) {
					itemValues.push( results.rows.item(i) );
				}
				displayItemValues( itemValues );
			},
			dbConn.errorHandler
		);
		var selectSQL = 'SELECT p.SubjectID, p.Property, e.Name, e.Category' +
			' FROM ' + entityPropsTableName + ' p' +
			' JOIN ' + entitiesTableName + ' e ON p.SubjectID = e.ID' + 
			' WHERE p.ObjectID = ' + itemID;
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				// Construct array holding query results.
				var len = results.rows.length, i;
				var entityValues = [];
				for (i = 0; i < len; i++) {
					row = results.rows.item(i);
					entityValues.push( row );
				}
				displayCompoundItemValues( entityValues, itemName );
			},
			dbConn.errorHandler
		);

		var selectSQL = 'SELECT Latitude, Longitude' +
			' FROM ' + coordinatePropsTableName +
			' WHERE SubjectID = ' + itemID;
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				var len = results.rows.length;
				if ( len > 0 ) {
					// Construct array holding query results
					// - though hopefully there's only one.
					var len = results.rows.length, i;
					var itemValues = [];
					for (i = 0; i < len; i++) {
						itemValues.push( results.rows.item(i) );
					}
					addToMainText("<br />\n");
					displayMap( itemValues );
				}
			},
			dbConn.errorHandler
		);
	});
}

WebSQLConnector.prototype.displayDBLoadingProgress = function( textEntriesLoaded, entityEntriesLoaded, totalEntries, totalTextEntries, totalEntityEntries ) {
	// The math here is somewhat complex - we use the progress of
	// text entries as a proxy for overall progress of non-entity
	// entries, since it's simpler to keep track of just one DB table.
	// Hopefully there will never be a data set with no text fields.

	// The parseInt() call is needed for Opera, for some reason.
	var totalNonEntityEntries = parseInt( totalEntries - totalEntityEntries );
	var nonEntityEntriesLoaded = totalNonEntityEntries * ( textEntriesLoaded / totalTextEntries );

	// Adding an entity entry takes about 5-10 times as long as adding
	// a non-entity entry, sadly, due to the DB lookup time needed for
	// entity entries. We factor that in when calculating the current
	// progress.
	var currentProgress = nonEntityEntriesLoaded + (7 * entityEntriesLoaded);
	var totalProgressNeeded = totalNonEntityEntries + (7 * totalEntityEntries);
	var percentage = Math.ceil(100 * currentProgress / totalProgressNeeded);
	var msg = "<p>Loading data into local database... " + percentage + "% complete.</p>\n";
	msg += '<progress value="' + percentage + '" max="100">';
	displayMainText( msg );
}

/**
 * This function creates the SQL used to query for both items and filter
 * values, based in both cases on a set of previously-selected filters.
 *
 * Returned SQL should look something like:
 *
 * SELECT e.Name AS SubjectName
 * FROM entities e JOIN <tableName1> p1 ON e.ID = p1.SubjectID
 * JOIN <tableName2> p2 ON e.ID = p2.SubjectID
 * [JOIN <tableName3> pNext ON e.ID = pNext.SubjectID]
 * WHERE e.Category = <categoryName>
 * AND <objectField1> = <value1> AND p1.Property = <propName1>
 * AND <objectField2> = <value2> AND p2.Property = <propName2>
 * [AND pNext.Property = <propNameNext>
 *  GROUP BY <objectField3>]
 *
 *
 * ...although it's more complex if any of the fields are "entities", that
 * is values contained in another table.
 */
WebSQLConnector.prototype.getSQLQuery = function( mdvState, imageProperty, coordinatesProperty, dateProperty, firstTextField, firstEntityField ) {
	// If the global variables aren't set for some reason, re-get them now.
	if ( gDataSchema == undefined ) {
		getSettingsAndLoadData();
	}

	var selectClause = "SELECT e.ID AS SubjectID, e.Name AS SubjectName";
	var fromClause = entitiesTableName + " e";
	var whereClause = " WHERE e.Category = '" + mdvState.categoryName.replace(/'/g, "''") + "'";
	var groupByClause = "", orderByClause = "";
	var secondaryEntityClauseAdded = false;

	// Event-related filtering
	if ( mdvState.currentEventsOnly ) {
		var curTime = new Date();
		var curTimeDBString = curTime.getDBString();
		var startTimeField = getCategoryStartTimeField( mdvState.categoryName );
		var endTimeField = getCategoryEndTimeField( mdvState.categoryName );
		if ( startTimeField == null || endTimeField == null ) {
			alert( "This category does not have both a start and end time field, and thus cannot display current events." );
		} else {
			mdvState.selectedFilters[startTimeField] = '<' + curTimeDBString;
			mdvState.selectedFilters[endTimeField] = '>' + curTimeDBString;
		}
	}

	// Turn the "selectedFilters" object into an array - if there's a
	// "display filter", and one of the selected filters matches it,
	// put that one last in the array, to make querying simpler.
	var selectedFiltersArray = [];
	for ( var filterName in mdvState.selectedFilters ) {
		if ( filterName == mdvState.displayFilter ) continue;
		selectedFiltersArray.push( filterName );
	}
	if ( mdvState.selectedFilters.hasOwnProperty( mdvState.displayFilter ) ) {
		selectedFiltersArray.push( mdvState.displayFilter );
	}

	for ( var filterNum = 1; filterNum <= selectedFiltersArray.length; filterNum++ ) {
		filterName = selectedFiltersArray[filterNum - 1];
		var tableAlias = "p" + filterNum;
		var escapedPropValue = mdvState.selectedFilters[filterName].replace(/'/g, "''");
		if ( filterName.indexOf( '::' ) > 0 ) {
			var filterType = 'Compound';
			var filterNameParts = filterName.split( '::' );
			var secondaryCategory = filterNameParts[0];
			var secondaryProperty = filterNameParts[1];
			var connectorProperty = getConnectorPropertyBetweenCategories( mdvState.categoryName, secondaryCategory );
		} else {
			if ( !gDataSchema[mdvState.categoryName]['fields'].hasOwnProperty(filterName)) {
				alert("Error: field '" + filterName + "' not found.");
			}
			var filterType = gDataSchema[mdvState.categoryName]['fields'][filterName]['fieldType'];
		}
		if ( filterType == 'Compound' ) {
			dbTableName = entityPropsTableName;
			objectField = tableAlias + "b.Object";
		} else if ( filterType == 'Entity' ) {
			dbTableName = entityPropsTableName;
			objectField = tableAlias + ".ObjectName";
		} else if ( DataLoader.isDateType(filterType) ) {
			dbTableName = datePropsTableName;
			objectField = tableAlias + ".Date";
		} else if ( filterType == 'Number' ) {
			dbTableName = numberPropsTableName;
			objectField = tableAlias + ".Object";
		} else if ( filterType == 'Coordinates' ) {
			dbTableName = coordinatePropsTableName;
			objectField = tableAlias + ".Latitude, " + tableAlias + ".Longitude";
		} else { // 'Text', 'URL', 'Image URL', 'Video URL', 'Audio URL', 'Document path'
			dbTableName = textPropsTableName;
			objectField = tableAlias + ".Object";
		}

		fromClause += " JOIN " + dbTableName + " " + tableAlias;
		if ( filterType == 'Compound' ) {
			fromClause += " ON e.ID = " + tableAlias + ".ObjectID";
		} else {
			fromClause += " ON e.ID = " + tableAlias + ".SubjectID";
		}
		if ( DataLoader.isDateType(filterType) ) {
			propValueParts = parseDateFilter( escapedPropValue );
			if ( propValueParts[0] == '>' ) {
				// HACK
				whereClause += " AND " + objectField + " > " + propValueParts[1];
			} else if ( propValueParts[0] == '<' ) {
				// HACK
				whereClause += " AND " + objectField + " < " + propValueParts[1];
			} else if ( propValueParts[0].hasOwnProperty('includesTime') ) {
				dbString = propValueParts[0].getDBString();
				whereClause += " AND " + objectField + " = " + dbString;
			} else {
				if ( propValueParts[0] instanceof Date ) {
					lowerBoundDBString = propValueParts[0].getDBString();
					upperBoundDBString = propValueParts[1].getDBString();
				} else {
					lowerBoundDBString = propValueParts[0] + '' + '0000';
					upperBoundDBString = (propValueParts[1] + 1) + '' + '0000';
				}
				whereClause += " AND " + objectField + " >= " + lowerBoundDBString + " AND " + objectField + " < " + upperBoundDBString;
			}
		} else if ( filterType == 'Number' ) {
			var numberRange = NumberRange.fromString( escapedPropValue );
			var highNumber = numberRange.highNumber;
			if ( highNumber == null ) {
				highNumber = numberRange.lowNumber + .00001;
			}
			whereClause += " AND " + objectField + " >= " + numberRange.lowNumber + " AND " + objectField + " < " + highNumber;
		} else if ( mdvState.selectedFilters[filterName] == '__null' ) {
			whereClause += " AND (" + objectField + " IS NULL OR " + objectField + " = '')";
		} else if ( filterType == 'Compound' ) {
			var connectorPropertiesTableAlias = "p" + filterNum;
			//var secondaryEntitiesTableAlias = "e" + filterNum;
			var secondaryEntitiesTableAlias = "eSecondary";
			var secondaryPropertiesTableAlias = "p" + filterNum + "b";
			if ( !secondaryEntityClauseAdded ) {
				fromClause += " JOIN " + entitiesTableName + " " + secondaryEntitiesTableAlias + " ON " + connectorPropertiesTableAlias + ".SubjectID = " + secondaryEntitiesTableAlias + ".ID";
				whereClause += " AND " + secondaryEntitiesTableAlias + ".Category = '" + secondaryCategory + "'";
				secondaryEntityClauseAdded = true;
			}
			fromClause += " JOIN " + textPropsTableName + " " + secondaryPropertiesTableAlias + " ON " + secondaryEntitiesTableAlias + ".ID = " + secondaryPropertiesTableAlias + ".SubjectID";
			whereClause += " AND " + connectorPropertiesTableAlias + ".Property = '" + connectorProperty + "'";
			whereClause += " AND " + secondaryPropertiesTableAlias + ".Property = '" + secondaryProperty + "'";
			whereClause += " AND " + objectField + " = '" + escapedPropValue + "'";
		} else {
			// Regular text.
			// If this contains a "form feed" character, it's an
			// array - split it up into values, and do an OR on
			// each one.
			var obscureChar = decodeURI('%0C');
			if ( escapedPropValue.indexOf(obscureChar) > -1 ) {
				whereClause += " AND " + objectField + " IN ('";
				var propValuesArray = escapedPropValue.split(obscureChar);
				var numPropValueParts = propValuesArray.length;
				for ( propValuePartNum = 0; propValuePartNum < numPropValueParts; propValuePartNum++ ) {
					if ( propValuePartNum > 0 ) {
						whereClause += "', '";
					}
					whereClause += propValuesArray[propValuePartNum];
				}
				whereClause += "')";
			} else {
				whereClause += " AND " + objectField + " = '" + escapedPropValue + "'";
			}
		}
		if ( filterType != 'Compound' ) {
			whereClause += " AND " + tableAlias + ".Property = '" + filterName + "'";
		}
	}

//imageProperty = null;
//firstTextField = null;
//firstEntityField = null;
	if ( imageProperty != null ) {
		selectClause += ", pImage.Object as ImageURL";
		fromClause += " JOIN " + textPropsTableName + " pImage";
		fromClause += " ON e.ID = pImage.SubjectID";
		whereClause += " AND pImage.Property = '" + imageProperty + "'";
	} else if ( firstTextField != null ) {
		selectClause += ", pAdditionalText.Object as AdditionalText";
		fromClause += " JOIN " + textPropsTableName + " pAdditionalText";
		fromClause += " ON e.ID = pAdditionalText.SubjectID";
		whereClause += " AND pAdditionalText.Property = '" + firstTextField + "'";
	} else if ( firstEntityField != null ) {
		selectClause += ", pAdditionalText.ObjectName as AdditionalText";
		fromClause += " JOIN " + entityPropsTableName + " pAdditionalText";
		fromClause += " ON e.ID = pAdditionalText.SubjectID";
		whereClause += " AND pAdditionalText.Property = '" + firstEntityField + "'";
	}

	if ( coordinatesProperty != null ) {
		selectClause += ", pCoordinates.Latitude, pCoordinates.Longitude";
		fromClause += " JOIN " + coordinatePropsTableName + " pCoordinates";
		fromClause += " ON e.ID = pCoordinates.SubjectID";
		whereClause += " AND pCoordinates.Property = '" + coordinatesProperty + "'";
	}

	if ( dateProperty != null ) {
		selectClause += ", pDate.Date";
		fromClause += " JOIN " + datePropsTableName + " pDate";
		fromClause += " ON e.ID = pDate.SubjectID";
		whereClause += " AND pDate.Property = '" + dateProperty + "'";
	}

	var secondaryCategory = null;
	var secondaryProperty = null;
	var connectoryProperty = null;
	if ( mdvState.displayFilter != null ) {
		var propertyParts = mdvState.displayFilter.split( '::' );
		if ( propertyParts.length == 2 ) {
			secondaryCategory = propertyParts[0];
			secondaryProperty = propertyParts[1];
			connectorProperty = getConnectorPropertyBetweenCategories( mdvState.categoryName, secondaryCategory );
		}
	}

	if ( mdvState.displayFilter != null && secondaryProperty == null ) {
		// Handling for a normal (non-compound) display filter.

		// If this is a field we're already filtering on, we don't
		// need to join another table.
		if ( !mdvState.selectedFilters.hasOwnProperty( mdvState.displayFilter ) ) {
			tableAlias = "pNext";
		}
		var nextPropertyActualName = mdvState.displayFilter;
		var nextPropertyType = gDataSchema[mdvState.categoryName]['fields'][mdvState.displayFilter]['fieldType'];
		if ( nextPropertyType == 'Entity' ) {
			dbTableName = entityPropsTableName;
			objectField = tableAlias + ".ObjectName";
		} else if ( DataLoader.isDateType(nextPropertyType) ) {
			dbTableName = datePropsTableName;
			objectField = tableAlias + ".Date";
		} else if ( nextPropertyType == 'Coordinates' ) {
			dbTableName = coordinatePropsTableName;
			objectField = tableAlias + ".Latitude";
		} else if ( nextPropertyType == 'Number' ) {
			dbTableName = numberPropsTableName;
			objectField = tableAlias + ".Object";
		} else { // 'Text', 'URL', etc.
			dbTableName = textPropsTableName;
			objectField = tableAlias + ".Object";
		}
		if ( DataLoader.isDateType(nextPropertyType) || nextPropertyType == 'Number' ) {
			selectClause = "SELECT " + objectField;
		} else {
			selectClause = "SELECT " + objectField + " AS object, COUNT(*)";
		}
		if ( !mdvState.selectedFilters.hasOwnProperty( mdvState.displayFilter ) ) {
			fromClause += " JOIN " + dbTableName + " " + tableAlias;
			fromClause += " ON e.ID = " + tableAlias + ".SubjectID ";
			whereClause += " AND " + tableAlias + ".Property = '" + nextPropertyActualName + "'";
		}
		if ( DataLoader.isDateType(nextPropertyType) || nextPropertyType == 'Number' ) {
			orderByClause = " ORDER BY " + objectField + " ASC";
		} else {
			groupByClause = " GROUP BY " + objectField;
		}
	} else if ( secondaryProperty != null ) {
		objectField = "pSecondary.Object";
		selectClause = "SELECT " + objectField + " AS object, COUNT(*)";
		fromClause += " JOIN " + entityPropsTableName + " pConnector ON e.ID = pConnector.ObjectID";
		if ( !secondaryEntityClauseAdded ) {
			fromClause += " JOIN " + entitiesTableName + " eSecondary ON pConnector.SubjectID = eSecondary.ID";
			whereClause += " AND eSecondary.Category = '" + secondaryCategory + "'";
		}
		fromClause += " JOIN " + textPropsTableName + " pSecondary ON eSecondary.ID = pSecondary.SubjectID";

		whereClause += " AND pConnector.Property = '" + connectorProperty + "'";
		whereClause += " AND pSecondary.Property = '" + secondaryProperty + "'";
		groupByClause = " GROUP BY " + objectField;
	}
	var selectSQL = selectClause + " FROM " + fromClause + whereClause + groupByClause + orderByClause;
	//alert(selectSQL);
	return selectSQL;
}

WebSQLConnector.prototype.displayItems = function( mdvState, imageProperty, coordinatesProperty, dateProperty, firstTextField, firstEntityField ) {
	var dbConn = this;
	this.db.transaction(function (tx) {
		var selectSQL = dbConn.getSQLQuery(mdvState, imageProperty, coordinatesProperty, dateProperty, firstTextField, firstEntityField);
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				var allItemValues = [];
				var len = results.rows.length, i;
				// This checking is needed due to the
				// "AdditionalText" property
				var prevSubjectID = null;
				for ( i = 0; i < len; i++ ) {
					var itemValues = {};
					var curRow = results.rows.item(i);
					itemValues['SubjectID'] = curRow['SubjectID'];
					itemValues['SubjectName'] = curRow['SubjectName'];
					if ( curRow.hasOwnProperty('ImageURL')) {
						itemValues['ImageURL'] = curRow['ImageURL'];
					}
					if ( curRow.hasOwnProperty('Latitude')) {
						itemValues['Latitude'] = curRow['Latitude'];
					}
					if ( curRow.hasOwnProperty('Longitude')) {
						itemValues['Longitude'] = curRow['Longitude'];
					}
					if ( curRow.hasOwnProperty('Date')) {
						itemValues['Date'] = curRow['Date'];
					}
					if ( curRow.hasOwnProperty('AdditionalText')) {
						itemValues['AdditionalText'] = curRow['AdditionalText'];
					}
					if ( itemValues['SubjectID'] == prevSubjectID ) {
						var prevRow = allItemValues.pop();
						// The 2nd check here shouldn't
						// be necessary, but it is.
						if ( prevRow.hasOwnProperty('AdditionalText') && ( prevRow['AdditionalText'] != itemValues['AdditionalText'] ) ) {
							itemValues['AdditionalText'] = prevRow['AdditionalText'] + ", " + itemValues['AdditionalText'];
						}
					} else {
						//allItemValues.push( curRow );
					}
					allItemValues.push( itemValues );
					prevSubjectID = itemValues['SubjectID'];
				}
				displayItems( mdvState, allItemValues );
			},
			dbConn.errorHandler
		);
	});
}

WebSQLConnector.prototype.displayFilterValues = function( origMDVState ) {
	var dbConn = this;
	var mdvState = origMDVState.clone();
	if ( mdvState.useSearchForm ) {
		mdvState.selectedFilters = [];
	}
	this.db.transaction(function (tx) {
		var selectSQL = dbConn.getSQLQuery( mdvState );
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				if ( mdvState.displayFilter.indexOf( '::' ) > 0 ) {
					var filterType = 'Compound';
				} else {
					var filterType = gDataSchema[mdvState.categoryName]['fields'][mdvState.displayFilter]['fieldType'];
				}
				if ( DataLoader.isDateType(filterType) ) {
					var dateValues = [];
					var len = results.rows.length, i;
					if ( len == 0 ) {
						displayMainText("No values found.");
						return;
					}
					for (i = 0; i < len; i++) {
						var row = results.rows.item(i);
						var curDate = new Date();
						curDate.setFromDBString( row['Date'] );
						dateValues.push( curDate );
					}
					var filterValues = generateFilterValuesFromDates( dateValues );
				} else if ( filterType == 'Number' ) {
					var numberValues = [];
					var len = results.rows.length, i;
					for (i = 0; i < len; i++) {
						var row = results.rows.item(i);
						numberValues.push( row['Object'] );
					}
					var filterValues = generateFilterValuesFromNumbers( numberValues );
				} else {
					var filterValues = [];
					var len = results.rows.length, i;
					for (i = 0; i < len; i++) {
						var row = results.rows.item(i);
						var curFilter = {};
						if ( row['object'] == '' ) {
							curFilter['filterName'] = null;
						} else {
							curFilter['filterName'] = row['object'];
						}
						curFilter['numValues'] = row['COUNT(*)'];
						filterValues.push( curFilter );
					}
				}
				displayFilterValues( origMDVState, filterValues );
			},
			dbConn.errorHandler
		);
	});
}

WebSQLConnector.prototype.displayCompoundEntitiesForItem = function( compoundEntityIDs, dataPerEntity, itemName ) {
	var dbConn = this;
	this.db.transaction(function (tx) {
		var selectSQL = 'SELECT SubjectID, Property, Object FROM ' + textPropsTableName +
			' WHERE SubjectID IN (' + compoundEntityIDs + ')';
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				var entityValues = [];
				var len = results.rows.length, i;
				for (i = 0; i < len; i++) {
					row = results.rows.item(i);
					entityValues.push(row);
				}
				displayCompoundEntitiesForItem( entityValues, dataPerEntity, itemName );
			},
			dbConn.errorHandler
		);
	});
}

WebSQLConnector.prototype.displayNameSearchResults = function( mdvState ) {
	var dbConn = this;
	this.db.transaction(function (tx) {
		var selectSQL = 'SELECT ID, Name FROM ' + entitiesTableName +
			' WHERE Category = "' + mdvState.categoryName + '"' +
			' AND LOWER(Name) LIKE "%' + mdvState.searchString.toLowerCase() + '%"' +
			' LIMIT 500';
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				var searchResults = [];
				var len = results.rows.length, i;
				for (i = 0; i < len; i++) {
					row = results.rows.item(i);
					searchResults.push(row);
				}
				displayNameSearchResults( mdvState, searchResults );
			},
			dbConn.errorHandler
		);
	});
}

WebSQLConnector.prototype.displayValueSearchResults = function( mdvState ) {
	var dbConn = this;
	this.db.transaction(function (tx) {
		var selectSQL = 'SELECT e.ID, e.Name, p.Property, p.Object AS Value' +
			' FROM ' + entitiesTableName + " e" +
			' JOIN ' + textPropsTableName + " p ON e.ID = p.SubjectID" +
			' WHERE e.Category = "' + mdvState.categoryName + '"' +
			' AND LOWER(p.Object) LIKE "%' + mdvState.searchString.toLowerCase() + '%"';
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				var searchResults = [];
				var len = results.rows.length, i;
				for (i = 0; i < len; i++) {
					row = results.rows.item(i);
					searchResults.push(row);
				}
				//displayTextValueSearchResults( searchText, searchResults );
				dbConn.displayEntityValueSearchResults( mdvState, searchResults );
			},
			dbConn.errorHandler
		);
	});
}

WebSQLConnector.prototype.displayEntityValueSearchResults = function( mdvState, previousSearchResults ) {
	var dbConn = this;
	this.db.transaction(function (tx) {
		var selectSQL = 'SELECT e.ID, e.Name, p.Property, p.ObjectName as Value' +
			' FROM ' + entitiesTableName + " e" +
			' JOIN ' + entityPropsTableName + " p ON e.ID = p.SubjectID" +
			' WHERE e.Category = "' + mdvState.categoryName + '"' +
			' AND LOWER(p.ObjectName) LIKE "%' + mdvState.searchString.toLowerCase() + '%"' +
			' LIMIT 500';
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				var searchResults = previousSearchResults;
				var len = results.rows.length, i;
				for (i = 0; i < len; i++) {
					row = results.rows.item(i);
					searchResults.push(row);
				}
				displayValueSearchResults( mdvState, searchResults );
			},
			dbConn.errorHandler
		);
	});
}

WebSQLConnector.prototype.possiblyShowCurrentEventsLink = function( mdvState ) {
	mdvState.currentEventsOnly = true;
	var dbConn = this;
	this.db.transaction(function (tx) {
		var selectSQL = dbConn.getSQLQuery( mdvState );
		tx.executeSql(selectSQL, [],
			function (tx, results) {
				var len = results.rows.length;
				if ( len > 0 ) {
					showCurrentEventsLink( mdvState.categoryName );
				}
			},
			dbConn.errorHandler
		);
	});
}
