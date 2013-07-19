<?php

$appSettings = parse_ini_file( 'settings.ini', true, INI_SCANNER_RAW );

$url = $_REQUEST['url'];

$settings = array();
foreach( $appSettings as $key => $value ) {
	if ( !is_array( $value ) ) {
		$settings[$key] = $value;
	} else {
		if ( array_key_exists( 'URL', $value) && $value['URL'] == $url ) {
			$settings['Name'] = $key;
			$settings = array_merge( $settings, $value );
			print json_encode( $settings );
			return;
		}
	}
}


// If there were no matches, use the first app
foreach( $appSettings as $key => $value ) {
	// We've already added in the general settings - just take care of
	// the rest.
	if ( !is_array( $value ) ) continue;
	$settings['Name'] = $key;
	$settings = array_merge( $settings, $value );
	print json_encode( $settings );
	return;
}

?>
