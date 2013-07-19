<?php

/**
 * MediaWikiImporter.php - a script that turns the infobox content of the
 * pages from a MediaWiki-baed wiki into a CSV file, based on the contents
 * of an "import settings" file.
 *
 * @author Yaron Koren
 */

$gImportPageList = array();
$gImportCustomHandlerFunctions = array();

if ( count( $argv ) != 2 ) {
	die( "Error: Script must be called in the form \"MediaWikiImporter.php settings-file\"\n" );
}

$fileName = $argv[1];

if ( ! file_exists( $fileName ) ) {
	die( "Error: File not found.\n" );
}

include_once( $fileName );

include_once('botclasses.php');

/**
 * Get all the calls to the specified template from within the specified page.
 */
function getInfoboxCalls( $pageName, $templateName ) {
	global $bot;

	$contents = $bot->getpage( $pageName );
	$infoboxCalls = array();
	$curInfoboxStartIndex = 0;
	$curInfoboxEndIndex = 0;

	while ( ( $curInfoboxStartIndex = strpos( $contents, $templateName, $curInfoboxEndIndex ) ) !== false ) {
		// Cycle through until we reach the end of the template
		$curIndex = $curInfoboxStartIndex + 1;
		$numCurlyBrackets = 2;
		while ( $numCurlyBrackets > 0 && $curIndex < strlen( $contents ) ) {
			$curChar = $contents[$curIndex++];
			if ( $curChar == '{' ) {
				$numCurlyBrackets++;
			} elseif ( $curChar == '}' ) {
				$numCurlyBrackets--;
			}
		}
		$curInfoboxEndIndex = $curIndex;
		$infoboxCalls[] = substr( $contents, $curInfoboxStartIndex, ( $curInfoboxEndIndex - $curInfoboxStartIndex ) );
	}

	return $infoboxCalls;
}

function parseValue( $value ) {
	$value = str_replace( '&nbsp;', ' ', $value );
	$value = preg_replace( '/\<ref[^>]*\>.*\<\/ref\>/', '', $value );
	$value = preg_replace( '/\<!--[^-]*.*--\>/', '', $value );
	$value = preg_replace( '/[^\[\|]*\|/', '', $value );
	$value = str_replace( array( '[[', ']]' ), '', $value );
	$value = str_replace( array( '<br>', '<br/>', '<br />', '</br>', '/', ';', ' and ' ), ', ', $value );
	$value = trim( $value );

	$forbiddenStrings = array( '=', '{', '}', /*'(', '),**/ "''" );
	foreach ( $forbiddenStrings as $forbiddenString ) {
		if ( strpos( $value, $forbiddenString ) ) {
			return '';
		}
	}
	return $value;
}

function parseCompoundValue( $value ) {
	// More lightweight.
	$value = str_replace( '&nbsp;', ' ', $value );
	$value = preg_replace( '/\<ref[^>]*\>.*\<\/ref\>/', '', $value );
	$value = preg_replace( '/\<!--[^-]*.*--\>/', '', $value );
	$value = str_replace( array( '[[', ']]' ), '', $value );
	$value = str_replace( array( '<br>', '<br/>', '<br />', '</br>', '/', ';', ' and ' ), ', ', $value );
	$value = trim( $value );
	return $value;
}

function convertToUnits( $curValue, $curUnit, $newUnit ) {
	$curValue = floatval( $curValue );
	if ( $curUnit == $newUnit ) {
		return $curValue;
	}

	if ( $curUnit == '-' ) {
		return;
	}

	// Length
	if ( $newUnit == 'mm' ) {
		if ( $curUnit == 'm' || $curUnit == 'meters' || $curUnit == 'metres' ) {
			return $curValue * 1000;
		} elseif ( $curUnit == 'cm' ) {
			return $curValue * 10;
		} elseif ( $curUnit == 'in' || $curUnit == 'inches' ) {
			return $curValue * 25.4;
		} elseif ( $curUnit == 'ft' || $curUnit == 'feet' ) {
			return $curValue * (12 * 25.4);
		}
	}

	// Area
	if ( $newUnit == 'acres' ) {
		if ( $curUnit == 'acre' ) {
			return $curValue;
		} elseif ( $curUnit == 'hectare' || $curUnit == 'hectares' || $curUnit == 'ha' ) {
			return $curValue * 2.47105;
		} elseif ( $curUnit == 'square miles' ) {
			return $curValue * 640;
		} elseif ( $curUnit == 'square kilometers' || $curUnit == 'square kilometres' || $curUnit == 'km2' ) {
			return $curValue * 247.105;
		} elseif ( $curUnit == 'square meters' || $curUnit == 'square metres' || $curUnit == 'm2' ) {
			return $curValue * 0.000247105;
		}
	}
	//die( "Unhandled unit: $curUnit\n");
	return null;
}

function getValueForTemplateField( $pageName, $infoboxContents, $fieldInfo ) {
	global $bot, $gImportWikiSubstring;

	if ( is_array( $fieldInfo ) ) {
		$fieldName = $fieldInfo[0];
		preg_match( '/\|[ ]*' . $fieldName . '[ ]*=[ ]*(.*)/', $infoboxContents, $matches );
		$fieldValue = $matches[1];

		foreach ( $fieldInfo as $specialHandling => $handlingInfo ) {
			if ( $specialHandling === 0 ) continue;

			if ( $specialHandling == 'forbidden' ) {
				$forbiddenValues = $handlingInfo;
				$fieldValue = parseValue( $fieldValue );
				if ( in_array( $fieldValue, $forbiddenValues ) ) {
					// We need an exception here so that
					// the calling code knows not to
					// create a line.
					throw new Exception('Forbidden value');
				}
			} elseif ( $specialHandling == 'lowercase' ) {
				$fieldValue = parseValue( $fieldValue );
				$fieldValue = strtolower( $fieldValue );
			} elseif ( $specialHandling == 'units' && $fieldValue != '' ) {
				$fieldValue = parseCompoundValue( $fieldValue );
				$searchString = '\{\{[Cc]onvert\|';
				preg_match_all( '/' . $searchString . '([^|]*)\|([^|}]*)/', $fieldValue, $matches2 );
				$fieldValue = $matches2[1][0];
				// Get rid of commas in numbers - PHP
				// can't handle them.
				$fieldValue = str_replace( ',', '', $fieldValue );
				$fieldValue = parseValue( $fieldValue );
				$curUnit = $matches2[2][0];

				// Maybe there's no "{{convert}}" template there
				if ( $curUnit == '' ) {
					// Get rid of anything in parentheses
					$fieldValue = preg_replace( '/\(.*\)/', '', $fieldValue );
					// Get rid of commas in numbers - PHP can't
					// handle them.
					$fieldValue = str_replace( ',', '', $fieldValue );
					$fieldValue = trim( $fieldValue );
					list( $fieldValue, $curUnit ) = explode( ' ', $fieldValue, 2 );
				}

				if ( $curUnit != '' ) {
					$newUnit = $handlingInfo;
					$fieldValue = convertToUnits( $fieldValue, $curUnit, $newUnit );
				}
			} elseif ( $specialHandling == 'birth date' && $fieldValue != '' ) {
				// Birth date
				preg_match( '/[Bb]irth.date( and age)?(\|mf=yes)?(\|df=y)?\|(\d*)\|(\d*)\|(\d*)/', $fieldValue, $matches );
				if ( $matches[4] != '' ) {
					$date = $matches[4] . '-' . $matches[5] . '-' . $matches[6];
				} else {
					preg_match( '/[Bb]irth-date\|(.*)\}\}/', $infoboxContents, $matches );
					if ( $matches[1] != '' ) {
						$date = $matches[1];
					} else {
						preg_match( '/\|\W*birth.date\W*=\W*(.*)/', $infoboxContents, $matches );
						$date = $matches[1];
					}
				}
				if ( strpos( $date, '=' ) || strpos( $date, '{' ) || strpos( $date, '}' ) ) {
					$date = '';
				}
				$fieldValue = $date;
			}
		}
		return $fieldValue;
	} else {
		if ( $fieldInfo == '_name' ) {
			return $pageName;
		} elseif ( $fieldInfo == '_url' ) {
			return $gImportWikiSubstring . str_replace( ' ', '_', $pageName );
		} elseif ( $fieldInfo == '_thumbnail' ) {
			$ret = $bot->query('?action=query&prop=pageimages&titles=' . urlencode( $pageName ) . '&format=php' );
			$thumbnailURL = '';
			foreach ( $ret['query']['pages'] as $pageInfo ) {
				return $pageInfo['thumbnail']['source'];
			}
		} elseif ( $fieldInfo == '_coordinates' ) {
			$ret = $bot->query('?action=query&prop=coordinates&titles=' . urlencode( $pageName ) . '&format=php' );
			$coordinatesString = '';
			foreach ( $ret['query']['pages'] as $pageInfo ) {
				if ( !array_key_exists( 'coordinates', $pageInfo ) ) {
					break;
				}
				$coordinatesArray = $pageInfo['coordinates'][0];
				return $coordinatesArray['lat'] . ", " . $coordinatesArray['lon'];
			}
		} else {
			preg_match( '/\|[ ]*' . $fieldInfo . '[ ]*=[ ]*(.*)/', $infoboxContents, $matches );
			$fieldValue = $matches[1];
			$fieldValue = parseValue( $fieldValue );
			return $fieldValue;
		}
	}
}

$bot = new wikipedia( $gImportAPIURL );

if ( count( $gImportPageList ) > 0 ) {
	$members = $gImportPageList;
} elseif ( $gImportCategoryName == '' ) {
	$members = $bot->whatusethetemplate( $gImportTemplateName );
} else {
	$members = $bot->categorymembers ( "Category:" . $gImportCategoryName, true);
}

$members = array_unique( $members );

foreach ( $members as $i => $member ) {
	// Get rid of pages not in the main namespace - categories,
	// templates, etc.
	if ( strpos( $member, ':' ) !== false ) {
		unset( $members[$i] );
	}
}

sort( $members );

$file_handle = fopen( $gImportFileName, "w" );
$headerRow = array_keys( $gImportFields );
fputcsv( $file_handle, $headerRow );

foreach( $members as $i => $page ) {
	//if ( $i < 200) continue;

	// There might be more than one such infobox in a single page.
	$infoboxCalls = getInfoboxCalls( $page, $gImportTemplateName );

	foreach ( $infoboxCalls as $infoboxContents ) {
		$noFieldsFound = true;
		$line = array();

		foreach ( $gImportFields as $header => $fieldInfo ) {
			try {
				$fieldValue = getValueForTemplateField( $page, $infoboxContents, $fieldInfo );
			} catch( Exception $e ) {
				continue 2;
			}

			if ( !empty( $fieldValue ) ) {
				$noFieldsFound = false;
			}
			if ( array_key_exists( $header, $gImportCustomHandlerFunctions ) ) {
				$customHandlerFunction = $gImportCustomHandlerFunctions[$header];
				$fieldValue = call_user_func( $customHandlerFunction, $fieldValue );
			}
			$line[] = $fieldValue;
		}

		if ( !$noFieldsFound ) {
			fputcsv( $file_handle, $line );
		}
	}
}


fclose($file_handle);
