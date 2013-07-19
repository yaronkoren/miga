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

$url = $gImportSpecialAskURL . "?q=";
if ( $gImportCategoryName == null ) {
	$firstProperty = reset( $gImportFields );
	$url .= urlencode( "[[$firstProperty::+]]" );
} else {
	$url .= urlencode( "[[$gImportCategoryName]]" );
}

$url .= "&po=";
foreach ( $gImportFields as $propertyName ) {
	if ( $propertyName == '_name' ) continue;
	$url .= urlencode( '?' . $propertyName . "\n" );
}

$url .= "&p%5Bformat%5D=csv&p%5Bheaders%5D=hide&p%5Blimit%5D=10000";
if ( !in_array( '_name', $gImportFields ) ) {
	$url .= "&p%5Bmainlabel%5D=-";
}
//die($url);

$contents = file_get_contents( $url );
//die($contents);

$file_handle = fopen( $gImportFileName, "w" );
$headers = array_keys( $gImportFields );
fputcsv( $file_handle, $headers );

// We need to get another handle, for some reason.
$file_handle2 = fopen( $gImportFileName, "a" );
fwrite( $file_handle2, $contents );
fclose( $file_handle2 );
