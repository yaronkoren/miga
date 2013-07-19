/**
 * MDVCoordinates.js
 *
 * Defines the MDVCoordinates class.
 *
 * (MDV = Miga Data Viewer)
 */

function MDVCoordinates( latitude, longitude ) {
	this.latitude = latitude;
	this.longitude = longitude;
}

MDVCoordinates.coordinatePartToNumber = function( coordinateStr ) {
	var degreesSymbols = ["\xB0", "d"];
	var minutesSymbols = ["'", "\u2032", "\xB4"];
	var secondsSymbols = ['"', "\u2033", "\xB4\xB4"];

	var numDegrees = null;
	var numMinutes = null;
	var numSeconds = null;

	for ( i = 0; i < degreesSymbols.length; i++ ) {
		var regexp = new RegExp('\\d+' + degreesSymbols[i]);
		var matches = coordinateStr.match(regexp);
		if ( matches != null ) {
			numDegrees = parseFloat(matches[0].replace(degreesSymbols[i], ''));
			break;
		}
	}
	if ( numDegrees == null ) {
		alert( "Error: could not parse degrees in " + coordinateStr );
		return null;
	}

	for ( i = 0; i < minutesSymbols.length; i++ ) {
		var regexp = new RegExp('\\d+' + minutesSymbols[i]);
		var matches = coordinateStr.match(regexp);
		if ( matches != null ) {
			numMinutes = parseFloat(matches[0].replace(minutesSymbols[i], ''));
			break;
		}
	}
	if ( numMinutes == null ) {
		// This might not be an error - the number of minutes
		// might just not have been set.
		numMinutes = 0;
	}

	for ( i = 0; i < secondsSymbols.length; i++ ) {
		var regexp = new RegExp('\\d+' + secondsSymbols[i]);
		var matches = coordinateStr.match(regexp);
		if ( matches != null ) {
			numSeconds = parseFloat(matches[0].replace(secondsSymbols[i], ''));
			break;
		}
	}
	if ( numSeconds == null ) {
		// This might not be an error - the number of seconds
		// might just not have been set.
		numSeconds = 0;
	}

	return ( numDegrees + ( numMinutes / 60 ) + ( numSeconds / 3600 ) );
}

/*
 * Parses a coordinate string in (hopefully) any standard format.
 */
MDVCoordinates.prototype.setFromString = function(coordinatesString) {
	coordinatesString.trim();
	if ( coordinatesString == null ) {
		return;
	}

	// This is safe to do, right?
	coordinatesString = coordinatesString.replace('[', '').replace(']', '');
	// See if they're separated by commas.
	if ( coordinatesString.indexOf(',') > 0 ) {
		var latAndLonStrings = coordinatesString.split(',');
	} else {
		// If there are no commas, the first half, for the latitude,
		// should end with either 'N' or 'S', so do a little hack
		// to split up the two halves.
		coordinatesString = coordinatesString.replace('N', 'N,').replace('S','S,');
		var latAndLonStrings = coordinatesString.split(',');
	}

	if ( latAndLonStrings.length != 2 ) {
		alert("Error parsing coordinates string: " + coordinatesString);
		return null;
	}
	var latString = latAndLonStrings[0];
	var lonString = latAndLonStrings[1];

	// Handle strings one at a time.
	var latIsNegative = false;
	if ( latString.indexOf('S') > 0 ) {
		latIsNegative = true;
	}
	latString = latString.replace('N', '').replace('S', '');
	if ( jQuery.isNumeric( latString ) ) {
		var latNum = parseFloat( latString );
	} else {
		var latNum = MDVCoordinates.coordinatePartToNumber( latString );
	}
	if ( latIsNegative ) latNum *= -1;
	this.latitude = latNum;

	var lonIsNegative = false;
	if ( lonString.indexOf('W') > 0 ) {
		lonIsNegative = true;
	}
	lonString = lonString.replace('E', '').replace('W', '');
	if ( jQuery.isNumeric( lonString ) ) {
		var lonNum = parseFloat( lonString );
	} else {
		var lonNum = MDVCoordinates.coordinatePartToNumber( lonString );
	}
	if ( lonIsNegative ) lonNum *= -1;
	this.longitude = lonNum;
}

MDVCoordinates.prototype.setFromDBItem = function( dbItem ) {
	this.latitude = dbItem['Latitude'];
	this.longitude = dbItem['Longitude'];
}

MDVCoordinates.prototype.toString = function() {
	// We call both parseFloat() and toFixed() so that coordinates have
	// a maximum of 6 decimal points, but can have less than that.
	var latitudeStr = parseFloat(this.latitude.toFixed(6));
	if ( latitudeStr >= 0 ) {
		latitudeStr += "&deg; N";
	} else {
		latitudeStr *= -1;
		latitudeStr += "&deg; S";
	}

	var longitudeStr = parseFloat(this.longitude.toFixed(6));
	if ( longitudeStr >= 0 ) {
		longitudeStr += "&deg; E";
	} else {
		longitudeStr *= -1;
		longitudeStr += "&deg; W";
	}

	return latitudeStr + ", " + longitudeStr;
}

// Mapping service-specific functions
MDVCoordinates.prototype.toGoogleMapsLatLng = function() {
	return new google.maps.LatLng( this.latitude, this.longitude );
}

MDVCoordinates.prototype.toOpenLayersLonLat = function(map) {
	return new OpenLayers.LonLat( this.longitude, this.latitude ).transform(
		new OpenLayers.Projection("EPSG:4326"), // transform from WGS 1984
		map.getProjectionObject() // to Spherical Mercator Projection
	);
}
