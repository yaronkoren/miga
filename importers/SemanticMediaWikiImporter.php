<?php

/**
 * SemanticMediaWikiImporter.php - a script that turns the data contained in
 * a Semantic MediaWiki-based wiki into a CSV file, based on the contents of
 * an "import settings" file.
 *
 * @author Yaron Koren
 */

if ( count( $argv ) != 2 ) {
	die( "Error: Script must be called in the form \"SemanticMediaWikiImporter.php settings-file\"\n" );
}

$fileName = $argv[1];

if ( ! file_exists( $fileName ) ) {
	die( "Error: No such file found.\n" );
}

include_once( $fileName );

$file_handle = fopen( $gImportFileName, "w" );
$headers = array_keys( $gImportFields );
fputcsv( $file_handle, $headers );
fclose( $file_handle );

$askURL = $gImportSpecialAskURL . "?q=";
if ( $gImportCategoryName == null ) {
	$firstProperty = reset( $gImportFields );
	$askURL .= urlencode( "[[$firstProperty::+]]" );
} else {
	$askURL .= urlencode( "[[$gImportCategoryName]]" );
}

$askURL .= "&po=";
foreach ( $gImportFields as $propertyName ) {
	// Ignore all special fields
	if ( strpos( $propertyName, '_' ) === 0 ) continue;
	$askURL .= urlencode( '?' . $propertyName . "\n" );
}

if ( !in_array( '_name', $gImportFields ) ) {
	$askURL .= "&p%5Bmainlabel%5D=-";
}
$askURL .= "&p%5Bformat%5D=csv&p%5Bheaders%5D=hide&p%5Blimit%5D=100";
//die($askURL);

// We need to get another handle, for some reason.
$file_handle2 = fopen( $gImportFileName, "a" );

$offset = 0;
do {
	// @TODO - probably should have a "verbose" mode
	//print "Getting batch starting at row $offset...";
	$fullAskURL = $askURL . "&p%5Boffset%5D=$offset";
	$contents = file_get_contents( $fullAskURL );
	//die($contents);

	if ( $contents != '' ) {
		fwrite( $file_handle2, $contents );
	} else {
		//print " No such batch found; exiting.";
	}
	//print "\n";
	$offset += 100;
} while ( $contents != '' );

fclose( $file_handle2 );
