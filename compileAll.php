<?php

/**
 * compileAll.php - a script that reads in all the settings and data for a
 * Miga installation, and "compiles" it all into a single JavaScript file,
 * migaData.js, that is in turn read by Miga in order to populate the
 * data, page information and settings.
 *
 * @author Yaron Koren
 */

function printGeneralSettingsAsJS( $jsFile, $generalSettings ) {
	fwrite( $jsFile, "generalSettings = {};\n\n" );
	fwrite( $jsFile, "generalSettings['_general'] = {};\n\n" );
	foreach( $generalSettings as $key => $value ) {
		if ( !is_array( $value ) ) {
			fwrite( $jsFile, "generalSettings['_general']['$key'] = \"$value\";\n" );
		} else {
			fwrite( $jsFile, "\ngeneralSettings['$key'] = {};\n" );
			foreach ( $value as $appSetting => $appValue ) {
				if ( $appSetting == 'Start page' || $appSetting == 'Header file' || $appSetting == 'Footer file' ) {
					// Special handling - put in the
					// contents of this file,
					// instead of the file name.
					$appDirectory = $generalSettings[$key]['Directory'];
					$fileContents = file_get_contents( "apps/$appDirectory/$appValue" );
					$fileContents = str_replace( array( '"', "\n" ), array( '\"', '\n' ), $fileContents );
					fwrite( $jsFile, "generalSettings['$key']['$appSetting'] = \"$fileContents\";\n" );
				} else {
					fwrite( $jsFile, "generalSettings['$key']['$appSetting'] = \"$appValue\";\n" );
				}
			}
		}
	}
}

function printSchemaDataAsJS( $jsFile, $appName, $schemaData ) {
	fwrite( $jsFile, "schemas['$appName'] = {};\n\n");
	foreach( $schemaData as $category => $categorySchema ) {
		fwrite( $jsFile, "schemas['$appName']['$category'] = {};\n");
		fwrite( $jsFile, "schemas['$appName']['$category']['fields'] = {};\n");
		foreach ( $categorySchema as $field => $fieldInfo ) {
			if ( $field == '_file' ) continue;
			fwrite( $jsFile, "schemas['$appName']['$category']['fields']['$field'] = {};\n");
			foreach ( $fieldInfo as $key => $value ) {
				fwrite( $jsFile, "schemas['$appName']['$category']['fields']['$field']['$key'] = \"$value\";\n");
			}
		}
	}
}

function coordinatePartToNumber( $coordinatesString ) {
	$degreesSymbols = array( "0xB0", "\\xC2\\xB0", "d" );
	$minutesSymbols = array( "'", "\u2032", "\xB4" );
	$secondsSymbols = array( '"', "\u2033", "\xB4\xB4" );

	$numDegrees = null;
	$numMinutes = null;
	$numSeconds = null;

	for ( $i = 0; $i < count( $degreesSymbols ); $i++ ) {
		$matches = array();
		$foundMatch = preg_match( '/(\d+)' . $degreesSymbols[$i] . '/', $coordinatesString, $matches);
		if ( $foundMatch ) {
			$numDegrees = (float)str_replace( $degreesSymbols[$i], '', $matches[1]);
			break;
		}
	}
	if ( $numDegrees === null ) {
		print ( "Error: could not parse degrees in " . $coordinatesString . "\n" );
		return null;
	}

	for ( $i = 0; $i < count( $minutesSymbols ); $i++ ) {
		$matches = array();
		$foundMatch = preg_match( '/(\d+)' . $minutesSymbols[$i] . '/', $coordinatesString, $matches);
		if ( $foundMatch ) {
			$numMinutes = (float)str_replace( $minutesSymbols[$i], '', $matches[1]);
			break;
		}
	}
	if ( $numMinutes === null ) {
		// This might not be an error - the number of minutes
		// might just not have been set.
		$numMinutes = 0;
	}

	for ( $i = 0; $i < count( $secondsSymbols ); $i++ ) {
		$matches = array();
		$foundMatch = preg_match( '/(\d+)' . $secondsSymbols[$i] . '/', $coordinatesString, $matches);
		if ( $foundMatch ) {
			$numSeconds = (float)str_replace( $secondsSymbols[$i], '', $matches[1]);
			break;
		}
	}
	if ( $numSeconds === null ) {
		// This might not be an error - the number of seconds
		// might just not have been set.
		$numSeconds = 0;
	}

	return ( $numDegrees + ( $numMinutes / 60 ) + ( $numSeconds / 3600 ) );
}

function coordinatesToDBFormat( $coordinatesString ) {
	$coordinatesString = trim( $coordinatesString );
	if ( $coordinatesString == null ) {
		return;
	}

	// This is safe to do, right?
	$coordinatesString = str_replace( array( '[', ']' ), '', $coordinatesString );
	// See if they're separated by commas.
	if ( strpos( $coordinatesString, ',' ) !== false ) {
		$latAndLonStrings = split( ',', $coordinatesString );
	} else {
		// If there are no commas, the first half, for the latitude,
		// should end with either 'N' or 'S', so do a little hack
		// to split up the two halves.
		$coordinatesString = str_replace( array( 'N', 'S' ), array( 'N,', 'S,' ), $coordinatesString );
		$latAndLonStrings = split(',', $coordinatesString);
	}

	if ( count( $latAndLonStrings ) != 2 ) {
		print "Error parsing coordinates string: " . $coordinatesString . "\n";
		return null;
	}
	$latString = $latAndLonStrings[0];
	$lonString = $latAndLonStrings[1];

	// Handle strings one at a time.
	$latIsNegative = false;
	if ( strpos( $latString, 'S' ) !== false ) {
		$latIsNegative = true;
	}
	$latString = str_replace( array( 'N', 'S' ), '', $latString );
	if ( is_numeric( $latString ) ) {
		$latNum = (float)$latString;
	} else {
		$latNum = coordinatePartToNumber( $latString );
	}
	if ( $latIsNegative ) $latNum *= -1;

	$lonIsNegative = false;
	if ( strpos( $lonString, 'W' ) !== false ) {
		$lonIsNegative = true;
	}
	$lonString = str_replace( array( 'E', 'W'), '', $lonString );
	if ( is_numeric( $lonString ) ) {
		$lonNum = (float)$lonString;
	} else {
		$lonNum = coordinatePartToNumber( $lonString );
	}
	if ( $lonIsNegative ) $lonNum *= -1;
	return array( $latNum, $lonNum );
}

function printDBTableContentsAsJS( $jsFile, $appName, $tableName, $tableContents ) {
	fwrite( $jsFile, "tableContents['$appName']['$tableName'] = [\n");
	foreach ( $tableContents as $tableRow ) {
		foreach ( $tableRow as $i => $value ) {
			$tableRow[$i] = str_replace( array( '\\', '"', "\n" ), array( '\\\\', '\"', '\n' ), $value );
		}
		fwrite( $jsFile, '	["' . join('", "', $tableRow) . '"],' . "\n" );
	}
	fwrite( $jsFile, " ];\n\n" );
}

function printPagesDataAsJS( $jsFile, $appName, $pagesData, $appDirectory ) {
	fwrite( $jsFile, "pages['$appName'] = {};\n");
	foreach( $pagesData as $pageOrLinkName => $pageOrLinkInfo ) {
		foreach( $pageOrLinkInfo as $key => $value ) {
			if ( $key == 'File' ) {
				$fileContents = file_get_contents( "apps/$appDirectory/$value" );
				$fileContents = str_replace( array( "'", "\n" ), array( "\'", '\n' ), $fileContents );
				fwrite( $jsFile, "pages['$appName']['$pageOrLinkName'] = ['$key', '$fileContents'];\n");
			} else {
				fwrite( $jsFile, "pages['$appName']['$pageOrLinkName'] = ['$key','$value'];\n");
			}
		}
	}
	fwrite( $jsFile, "\n");
}

$jsFile = fopen( 'migaData.js', 'w' );
// Add BOM (byte-order mark) so that the file will have UTF-8 encoding.
fwrite($jsFile, "\xEF\xBB\xBF"); 
// Display timestamp as microseconds (what JS expects), instead of seconds.
fwrite($jsFile, "gDataTimestamp = " . time() * 1000 . ";\n\n");
fwrite($jsFile, "tableContents = {};\n\n");
fwrite( $jsFile, "schemas = {};\n\n");
fwrite( $jsFile, "pages = {};\n\n");

$iniFileName = "settings.ini";
$generalSettings = parse_ini_file( $iniFileName, true, INI_SCANNER_RAW );

printGeneralSettingsAsJS( $jsFile, $generalSettings );

foreach ($generalSettings as $appName => $appSettings) {
	print "Compiling data for app \"$appName\"...\n";
	if ( !is_array($appSettings) ) {
		// This is not an app setting.
		continue;
	}
	if (!array_key_exists( 'Directory', $appSettings)) {
		die ("Error: Missing \"Directory\" setting for the app \"$appName\".");
	}
	if (!array_key_exists( 'Schema file', $appSettings)) {
		die ("Error: Missing \"Schema file\" setting for the app \"$appName\".");
	}

	$gEntitiesDBTable = array();
	$gTextPropsDBTable = array();
	$gNumberPropsDBTable = array();
	$gDatePropsDBTable = array();
	$gCoordPropsDBTable = array();
	$gEntityPropsDBTable = array();

	// Used for creating the entity props table at the end.
	$gEntityValues = array();
	$gEntityProps = array();

	$gEntityNum = 0;

	if ( !array_key_exists( 'Schema file', $appSettings ) ) {
		die("Error: No schema file is set for the app \"$appName\".\n");
	}
	$schemaFilePath = "apps/" . $appSettings['Directory'] . '/' . $appSettings['Schema file'];
	$schemaData = parse_ini_file( $schemaFilePath, true, INI_SCANNER_RAW );

	if ( array_key_exists( 'Pages file', $appSettings ) ) {
		$pagesFilePath = "apps/" . $appSettings['Directory'] . '/' . $appSettings['Pages file'];
		$pagesData = parse_ini_file( $pagesFilePath, true, INI_SCANNER_RAW );
	} else {
		$pagesData = null;
	}


	// Modify $schemaData to hold structured metadata, not just the
	// contents of the schema .ini file.
	foreach ($schemaData as $category => $categorySchema) {
		print "Handling category \"$category\"...\n";

		$gEntityValues[$category] = array();
		$gEntityProps[$category] = array();

		if ( ! array_key_exists( '_file', $categorySchema ) ) {
			$categorySchema['_file'] = "apps/" . $appSettings['Directory'] . "/" . str_replace(' ', '_', $category) . ".csv";
		}

		foreach ($categorySchema as $schemaColumn => $typeDescription) {
			if ( $schemaColumn == '_file' ) {
				continue;
			}

			// Parse the description, which will hold a type and
			// possibly additional information.
			$categorySchema[$schemaColumn] = array();
			if ( strpos($typeDescription, 'List') === 0 ) {
				$matches = array();
				$foundMatch = preg_match( '/List \((.*)\) of (.*)/', $typeDescription, $matches);
				if (! $foundMatch) {
					die("Error: Bad syntax for field $schemaColumn (\"$typeDescription\")");
				}
				$categorySchema[$schemaColumn]['isList'] = true;
				$categorySchema[$schemaColumn]['delimiter'] = $matches[1];
				$typeDescription = $matches[2];
			} else {
				$categorySchema[$schemaColumn]['isList'] = false;
			}
			if ( strpos($typeDescription, 'Entity') === 0 ) {
				$matches = array();
				$foundMatch = preg_match( '/Entity \((.*)\/(.*)\)/', $typeDescription, $matches);
				if (! $foundMatch) {
					die("Error: Bad syntax for field $schemaColumn (\"$typeDescription\")");
				}
				$typeDescription = 'Entity';
				$connectedCategory = $matches[1];
				$connectedColumn = $matches[2];
				$categorySchema[$schemaColumn]['connectedCategory'] = $connectedCategory;
				$categorySchema[$schemaColumn]['connectedColumn'] = $connectedColumn;
				$gEntityProps[$category][$schemaColumn] = array();
			}
			$categorySchema[$schemaColumn]['fieldType'] = $typeDescription;
			// Set the data back in the main array.
			$schemaData[$category] = $categorySchema;
		}
	}

	// Record which fields are pointed to by "Entity" fields, for use
	// later in creating the entityProps table.
	foreach ( $schemaData as $category => $categorySchema ) {
		foreach ( $categorySchema as $schemaColumn => $typeDescription ) {
			if ( $schemaColumn == '_file' ) continue;
			if ( array_key_exists( 'connectedCategory', $typeDescription ) ) { 
				$connectedCategory = $typeDescription['connectedCategory'];
				$connectedColumn = $typeDescription['connectedColumn'];
				$schemaData[$connectedCategory][$connectedColumn]['pointedTo'] = true;
			}
		
		}
	}

	// Now, get the actual data from the CSV files.
	foreach ( $schemaData as $category => $categorySchema ) {
		$csvFilePath = $categorySchema['_file'];
		$csvFile = fopen( $csvFilePath, 'r' );

		if ( $csvFile === false ) {
			die("Error: Could not find CSV file at $csvFilePath\n");
		}

		$columnNames = fgetcsv($csvFile);

		foreach ($categorySchema as $schemaColumn => $columnInfo) {
			if ( $schemaColumn == '_file' ) continue;
			if ( !in_array( $schemaColumn, $columnNames ) ) {
print_r($categorySchema);
				die("Error: Field \"$schemaColumn\" is not included in CSV file \"$csvFilePath\".\n");
			}
		}

		while ( $row = fgetcsv( $csvFile ) ) {
			$hasNameField = 0;
			$hasEntityField = 0;

			// First, go through to set the main entity ID for
			// this row.
			for ($i = 0; $i < count($row); $i++) {
				$columnName = $columnNames[$i];
				// Skip this column if it's not in the schema.
				if ( ! array_key_exists( $columnName, $categorySchema ) ) {
					continue;
				}
				$columnType = $categorySchema[$columnName]['fieldType'];
				$curValue = $row[$i];
				if ( $columnType == "Name") {
					$hasNameField = 1;
					$gEntityNum++;
					$gEntitiesDBTable[] = array($gEntityNum, $curValue, $category);
				} elseif ( $columnType == "Entity") {
					$hasEntityField = 1;
				}

				// If this column is pointed to by some property
				// of type "Entity", store the value in the
				// $gEntityValues array.
				if ( array_key_exists( 'pointedTo', $categorySchema[$columnName] ) ) {
					$gEntityValues[$category][$columnName][$curValue] = $gEntityNum;
				}
			}

			if ( !$hasNameField ) {
				if ( $hasEntityField ) {
					$gEntitiesDBTable[] = array($gEntityNum, '', $category);
					$gEntityNum++;
				} else {
					continue;
				}
			}

			for ($i = 0; $i < count($row); $i++) {
				$columnName = $columnNames[$i];
				// Skip this column if it's not in the schema.
				if ( !array_key_exists( $columnName, $categorySchema ) ) {
					continue;
				}

				$columnType = $categorySchema[$columnName]['fieldType'];
				$curValue = $row[$i];
				//if ( $curValue == '' ) {
				//	continue;
				//}
				if ( $categorySchema[$columnName]['isList'] ) {
					$curValues = array_map( 'trim', split( $categorySchema[$columnName]['delimiter'], $curValue ) );
				} else {
					$curValues = array($curValue);
				}
				if ( $columnType == "Name" || $columnType == "ID" ) {
					// Do nothing.
				} elseif ( $columnType == "Entity") {
					$gEntityProps[$category][$columnName][$gEntityNum] = $curValues;
				} elseif ( $columnType == "Number") {
					foreach ( $curValues as $curValue ) {
						if ( $curValue == '' ) continue;
						$curValue = str_replace( ',', '', $curValue );
						if ( $curValue != '' && !is_numeric( $curValue ) ) {
							$itemName = $gEntitiesDBTable[$gEntityNum - 1][1];
							print "Could not parse numeric value \"$curValue\" for item \"$itemName\".\n";
							continue;
						}
						$gNumberPropsDBTable[] = array($gEntityNum, $columnName, $curValue);
					}
				} elseif ( $columnType == "Date" || $columnType == "Start time" || $columnType == "End time" ) {
					foreach ( $curValues as $curValue ) {
						if ( $curValue == '' ) continue;
						$dateValue = date_parse( $curValue );
						if ( $dateValue['error_count'] > 0 ) {
							$itemName = $gEntitiesDBTable[$gEntityNum - 1][1];
							print "Could not parse date value \"$curValue\" for item \"$itemName\".\n";
							continue;
						}

						if ( !$dateValue['year'] ) {
							if ( $dateValue['hour'] ) {
								// In some cases PHP thinks a
								// year string like "1919" is
								// a time, for some reason.
								$dateStr = sprintf("%02s", $dateValue['hour']) . sprintf("%02s", $dateValue['minute']) . '0000';
							} else {
								$itemName = $gEntitiesDBTable[$gEntityNum - 1][1];
								print "Invalid date value \"$curValue\" (no year found) for item \"$itemName\".\n";
								continue;
							}
						} elseif ( $dateValue['month'] === false ) {
							// year-only
							$dateStr = sprintf("%04s", $dateValue['year']) . '0000';
						} elseif ( $dateValue['hour'] === false ) {
							$dateStr = sprintf("%04s", $dateValue['year']) . sprintf("%02s", $dateValue['month']) . sprintf("%02s", $dateValue['day']);
						} else {
							// time, too
							$dateStr = sprintf("%04s", $dateValue['year']) . sprintf("%02s", $dateValue['month']) . sprintf("%02s", $dateValue['day']) . '.' . sprintf("%02s", $dateValue['hour']) . sprintf("%02s", $dateValue['minute']) . sprintf("%02s", $dateValue['second']);
						}
					
						$gDatePropsDBTable[] = array($gEntityNum, $columnName, $dateStr);
					}
				} elseif ( $columnType == "Coordinates") {
					foreach ( $curValues as $curValue ) {
						if ( $curValue == '' ) {
							// Null coordinate
							// values will cause
							// a DB error.
							continue;
						}
						list( $latNum, $lonNum ) = coordinatesToDBFormat( $curValue );
						$gCoordPropsDBTable[] = array($gEntityNum, $columnName, $latNum, $lonNum);
					}
				} else { // Everything else - Text, URL, etc.
					foreach ( $curValues as $curValue ) {
						$gTextPropsDBTable[] = array($gEntityNum, $columnName, $curValue);
					}
				}
			}
		}
	}

	// We're done now with all the DB tables except "entityProps".
	// Write all their contents to the file, and clear the variables, to
	// free up some memory before doing the most memory-intensive part -
	// creating "entityProps".
	fwrite( $jsFile, "\ntableContents['$appName'] = {};\n\n");
	printDBTableContentsAsJS( $jsFile, $appName, 'entities', $gEntitiesDBTable );
	$gEntitiesDBTable = null;
	printDBTableContentsAsJS( $jsFile, $appName, 'textProps', $gTextPropsDBTable );
	//$gTextPropsDBTable = null;
	printDBTableContentsAsJS( $jsFile, $appName, 'numberProps', $gNumberPropsDBTable );
	$gNumberPropsDBTable = null;
	printDBTableContentsAsJS( $jsFile, $appName, 'dateProps', $gDatePropsDBTable );
	$gDatePropsDBTable = null;
	printDBTableContentsAsJS( $jsFile, $appName, 'coordProps', $gCoordPropsDBTable );

	$gCoordPropsDBTable = null;

	// Now go through all the stored entity props in order to set values
	// for the entity props DB table.
	foreach ($gEntityProps as $category => $entityPropsForCategory) {
		foreach ($entityPropsForCategory as $column => $entityPropsForColumn) {
			$connectedCategory = $schemaData[$category][$column]['connectedCategory'];
			$connectedColumn = $schemaData[$category][$column]['connectedColumn'];
			foreach ($entityPropsForColumn as $id => $entityValues) {
				foreach ($entityValues as $entityValue) {
					if ( $entityValue == '' ) continue;
					if ( array_key_exists( $entityValue, $gEntityValues[$connectedCategory][$connectedColumn] ) ) {
						$entityID = $gEntityValues[$connectedCategory][$connectedColumn][$entityValue];
					} else {
						$entityID = null;
					}
					$gEntityPropsDBTable[] = array($id, $column, $entityID, $entityValue);
				}
			}
		}
	}

	printDBTableContentsAsJS( $jsFile, $appName, 'entityProps', $gEntityPropsDBTable );

	// We print the schema data last, even though it would be nice if it
	// were first, because to set it fully requires knowledge of the
	// "textProps" and "entityProps" tables.

	// Figure out which columns/fields should be filters.
	foreach ($schemaData as $category => $categorySchema) {
		foreach ($categorySchema as $schemaColumn => $columnInfo) {
			if ( $schemaColumn == '_file' ) {
				continue;
			}
			$fieldType = $columnInfo['fieldType'];
			if ($fieldType == 'URL' || $fieldType == 'Image URL' || $fieldType == 'Video URL' || $fieldType == 'Audio URL' || $fieldType == 'Coordinates' || $fieldType == 'End time' ) {
				// Not a filter.
			} elseif ($fieldType == 'Date' || $fieldType == 'Start time' || $fieldType == 'Number') {
				$schemaData[$category][$schemaColumn]['isFilter'] = true;
			} else {
				// Get total and unique number of values for this
				// field, and find the "diffusion" of the values -
				// if unique values are less than 50% of the total
				// number, make it a filter.
				$numTotalValues = 0;
				$uniqueValues = array();
				if ( $fieldType == 'Entity' ) {
					$tableToSearch = $gEntityPropsDBTable;
				} else {
					$tableToSearch = $gTextPropsDBTable;
				}
				foreach ( $tableToSearch as $curRow ) {
					if ( count( $curRow ) < 3 ) continue;
					$property = $curRow[1];
					$value = $curRow[2];
					if ( $property == $schemaColumn ) {
						$numTotalValues++;
						$uniqueValues[$value] = true;
					}
				}
				$numUniqueValues = count( $uniqueValues );
				if ( $numTotalValues > 0 && ( $numUniqueValues / $numTotalValues < .6 ) ) {
					$schemaData[$category][$schemaColumn]['isFilter'] = true;
				}
			}
		}
	}
	printSchemaDataAsJS( $jsFile, $appName, $schemaData );

	if ( !is_null( $pagesData ) ) {
		printPagesDataAsJS( $jsFile, $appName, $pagesData, $generalSettings[$appName]['Directory'] );
	}

}

fclose($jsFile);
