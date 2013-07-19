<?php

include_once('TableFieldSchema.php');

class TableSchema {

	private $mTableName = null;
	private $mFileName = null;
	private $mFieldSchemas = array();

	function __construct($tableName, $tableSchemaArray) {
		$this->mTableName = $tableName;
		foreach ($tableSchemaArray as $fieldName => $fieldDescription ) {
			$this->mFieldSchemas[] = new TableFieldSchema($fieldName, $fieldDescription);
		}
	}

	function validateSchema() {
		return null;
	}

	function getName() {
		return $this->mTableName;
	}

	function getIterator() {
		$iArray['fields'] = array();
		foreach ($this->mFieldSchemas as $fieldSchema) {
			$fieldName = $fieldSchema->getName();
			if ( $fieldName == '_file' ) {
				$iArray['file'] = $fieldSchema->getFieldType();
			} else {
				$iArray['fields'][$fieldName] = $fieldSchema->getIterator();
			}
		}
		return new ArrayIterator($iArray);
	}

	// Unused.
	function toJSON() {
		return json_encode($this->getIterator());
	}

	function toString() {
		$str = "Table: " . $this->mTableName . ". ";
		$str .= "Fields: ";
		foreach ($this->mFieldSchemas as $fieldSchema) {
			$str .= $fieldSchema->toJSON();
		}
		return $str;
	}
}

?>
