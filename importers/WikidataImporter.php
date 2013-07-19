<?php

/**
 * WikidataImporter.php
 *
 * Queries Wikidata (wikidata.org) to get a table of structured data, which
 * is then saved to a CSV file, based on the contents of an "import settings"
 * file.
 *
 * @author Yaron Koren
 */

$gImportPageList = array();
$gLanguageCode = 'en';

if ( count( $argv ) != 2 ) {
	die( "Error: Script must be called in the form \"WikidataImporter.php settings-file\"\n" );
}

$fileName = $argv[1];

if ( ! file_exists( $fileName ) ) {
	die( "Error: File not found.\n" );
}

include_once( $fileName );
include_once('botclasses.php');

$gWikidataBot = new wikipedia( "http://www.wikidata.org/w/api.php" );

function getWikidataValues( $pageName, $propertyNames ) {
	global $gWikidataBot, $gLanguageCode;

	$title = null;
	$values = array();
	$ret = $gWikidataBot->query( '?action=wbgetentities&sites=' . $gLanguageCode . 'wiki&languages=' . $gLanguageCode . '&titles=' . urlencode( $pageName ) . '&format=php' );
	if ( !array_key_exists( 'entities', $ret ) ) {
		return array( null, null );
	}

	foreach ( $ret['entities'] as $entity ) {
		if ( ! array_key_exists( 'claims', $entity ) ) {
			continue;
		}
		if ( is_null( $title ) ) {
			$title = $entity['title'];
		}
		foreach ( $entity['claims'] as $id => $property ) {
			$labelsOfCurProperty = getWikidataLabelsFromID( $id );
			$mainPropertyLabel = $labelsOfCurProperty[0];
			if ( in_array( $mainPropertyLabel, $propertyNames ) ) {
				foreach( $property as $claim ) {
					$valueID = $claim['mainsnak']['datavalue']['value']['numeric-id'];
					$valueLabels = getWikidataLabelsFromID( 'Q' . $valueID );
					if ( array_key_exists( $mainPropertyLabel, $values ) ) {
						$values[$mainPropertyLabel] = array_merge( $values[$mainPropertyLabel], $valueLabels );
					} else {
						$values[$mainPropertyLabel] = $valueLabels;
					}
				}
			}
		}
	}
	return array( $title, $values );
}

function getWikidataLabelsFromID( $id ) {
	global $gWikidataBot, $gLanguageCode;
	static $gCachedWikidataLabels;

	// Use a cache, to save some time.
	if ( $gCachedWikidataLabels == null ) {
		$gCachedWikidataLabels = array();
	} elseif ( array_key_exists( $id, $gCachedWikidataLabels ) ) {
		return $gCachedWikidataLabels[$id];
	}

	$labels = array();
	$ret = $gWikidataBot->query('?action=wbgetentities&sites=enwiki&languages=en&ids=' . $id . '&format=php' );
	if ( !array_key_exists( 'entities', $ret ) ) {
		$gCachedWikidataLabels[$id] = array();
		return array();
	}

	foreach ( $ret['entities'] as $entity ) {
		if ( ! array_key_exists( 'labels', $entity ) ) {
			continue;
		}
		foreach ( $entity['labels'] as $label ) {
			$labels[] = $label['value'];
		}
	}
	$gCachedWikidataLabels[$id] = $labels;
	return $labels;
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
fclose( $file_handle );

// Why is this necessary? Who knows.
$file_handle2 = fopen( $gImportFileName, "a" );

$propertyNames = array_values( $gImportFields );

foreach( $members as $i => $page ) {
	list( $wikidataTitle, $values ) = getWikidataValues( $page, $propertyNames );
	if ( is_null( $wikidataTitle ) ) continue;

	$noFieldsFound = true;
	$line = array();

	foreach ( $gImportFields as $header => $fieldInfo ) {
		if ( $fieldInfo == '_name' ) {
			$line[] = $page;
		} elseif ( $fieldInfo == '_url' ) {
			$line[] = "http://www.wikidata.org/wiki/" . $wikidataTitle;
		} else {
			if ( array_key_exists( $fieldInfo, $values ) ) {
				$line[] = implode( ', ', $values[$fieldInfo] );
				$noFieldsFound = false;
			} else {
				$line[] = '';
			}
		}
	}

	if ( !$noFieldsFound ) {
		fputcsv( $file_handle2, $line );
	}
}


fclose($file_handle2);
