<?php

include_once('TableSchema.php');

$schemaFile = $_REQUEST['file'];

if ( is_null( $schemaFile ) ) {
	die( "A \"file=\" parameter must be specified." );
}

$schemaPath = "apps/$schemaFile";
if ( !file_exists( $schemaPath ) ) {
	die( "No file exists by the name \"$schemaFile\"." );
}

$dataSchemaArray = parse_ini_file( $schemaPath, true, INI_SCANNER_RAW );

$tableSchemas = array();

foreach ( $dataSchemaArray as $tableName => $tableSchemaArray ) {
	$tableSchema = new TableSchema( $tableName, $tableSchemaArray );
	$tableSchemas[] = $tableSchema;
}

$fullDataSchema = array();

foreach ($tableSchemas as $tableSchema) {
	$fullDataSchema[$tableSchema->getName()] = $tableSchema->getIterator();
}

print json_encode($fullDataSchema);
?>
