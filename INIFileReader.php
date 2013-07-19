<?php

$iniFile = $_REQUEST['file'];

if ( is_null( $iniFile ) ) {
	die( "A \"file=\" parameter must be specified." );
}

$iniFilePath = "apps/$iniFile";
if ( !file_exists( $iniFilePath ) ) {
	die( "No file exists by the name \"$iniFile\"." );
}

$iniData = parse_ini_file( $iniFilePath, true, INI_SCANNER_RAW );

print json_encode( $iniData );
?>
