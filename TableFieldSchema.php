<?php

class TableFieldSchema {

	private $mFieldName = null;
	private $mFieldType = 'Text';
	private $mEntityConnectorTable = null;
	private $mEntityConnectorField = null;
	private $mIsList = false;
	private $mListDelimiter = ',';

	function __construct($fieldName, $fieldDescription) {
		$this->mFieldName = $fieldName;
		if ( strpos($fieldDescription, 'List') === 0 ) {
			$this->mIsList = true;
			$matches = array();
			$foundMatch = preg_match( '/List \((.*)\) of (.*)/', $fieldDescription, $matches);
			if (! $foundMatch) {
				print "Error!";
			}
			$this->mListDelimiter = $matches[1];
			$typeDescription = $matches[2];
		} else {
			$typeDescription = $fieldDescription;
		}
		if ( strpos($typeDescription, 'Entity') === 0 ) {
			$this->mFieldType = 'Entity';
			$matches = array();
			$foundMatch = preg_match( '/Entity \((.*)\/(.*)\)/', $typeDescription, $matches);
			if (! $foundMatch) {
				print "Error!";
			}
			$this->mEntityConnectorTable = $matches[1];
			$this->mEntityConnectorField = $matches[2];
		} else {
			$this->mFieldType = $typeDescription;
		}
	}

	public function getName() {
		return $this->mFieldName;
	}

	public function getFieldType() {
		return $this->mFieldType;
	}

	// Needed to improve output of json_encode().
	public function getIterator() {
		$iArray['fieldType'] = $this->mFieldType;
		if ( $this->mFieldType == 'Entity' ) {
			$iArray['connectorField'] = $this->mEntityConnectorField;
			$iArray['connectorTable'] = $this->mEntityConnectorTable;
		}
		if ( $this->mIsList ) {
			$iArray['isList'] = $this->mIsList;
			$iArray['listDelimiter'] = $this->mListDelimiter;
		}
		return new ArrayIterator($iArray);
	}

	// Unused.
	function toJSON() {
		return json_encode($this->getIterator());
	}

	function toString() {
		$str = $this->mFieldName . ' (';
		if ( $this->mIsList) {
			$str .= "List, separated by \"" . $this->mListDelimiter . "\", of ";
		}
		$str .= $this->mFieldType;
		if ($this->mFieldType == 'Entity') {
			$str .= ' (connects to field ' . $this->mEntityConnectorField . ' in table ' . $this->mEntityConnectorTable . ')';
		}
		$str .= "). ";
		return $str;
	}

}

?>
