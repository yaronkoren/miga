<?php

// Simulate a CSV file.
header( 'Content-type: text/csv' );

$dataFile = $_REQUEST['file'];
//$dataFormat = $_REQUEST['format'];
//$getTimestamp = $_REQUEST['timestamp'];

if ( is_null( $dataFile ) ) {
	die( "A \"file=\" parameter must be specified." );
}

if ( strpos( $dataFile, '://' ) !== false ) {
	$handle = fopen( $dataFile, 'r' );
} else {
	$dataFilePath = dirname(__FILE__) . "/apps/$dataFile";
	if ( !file_exists( $dataFilePath ) ) {
		die( "No file exists by the name \"$dataFile\"." );
	}
	//$dataContents = file_get_contents( $dataFilePath );
	$handle = fopen( $dataFilePath, 'r' );

	//if ( $getTimestamp ) {
	//	print date ("F d Y H:i:s.", filemtime($dataFilePath));
	//	return;
	//}
}

$data = array();

// Possibly handle format here - right now only CSV is handled.
while ( $row = fgetcsv( $handle ) ) {
	$data[] = $row;
}

print json_encode( $data );
?>
