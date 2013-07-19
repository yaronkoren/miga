/**
 * NumberUtils.js
 *
 * Defines the class NumberRange, as well as other functions for displaying,
 * and creating filters on, numbers.
 *
 * @author Yaron Koren
 */

var gBucketsPerFilter = 6;

// Copied from http://stackoverflow.com/questions/2901102/how-to-print-a-number-with-commas-as-thousands-separators-in-javascript
function numberWithCommas(x) {
	var parts = x.toString().split(".");
	parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return parts.join(".");
}

function NumberRange( lowNumber, highNumber ) {
	this.lowNumber = lowNumber;
	this.highNumber = highNumber;
}

NumberRange.fromString = function( filterText ) {
	var numberRange = new NumberRange();
	filterText = String(filterText);
	var numbers = filterText.split(' - ');
	if ( numbers.length == 2 ) {
		numberRange.lowNumber = parseFloat(numbers[0]);
		numberRange.highNumber = parseFloat(numbers[1]);
	} else {
		numberRange.lowNumber = parseFloat(filterText);
		numberRange.highNumber = null;
	}
	return numberRange;
}

/**
 * Gets the non-display string for this number range.
 */
NumberRange.prototype.toString = function() {
	if ( this.highNumber == null ) {
		return this.lowNumber;
	} else {
		return this.lowNumber + " - " + this.highNumber;
	}
}

/**
 * Gets the string to be displayed on the screen for this number range.
 */
NumberRange.prototype.toDisplayString = function() {
	if ( this.highNumber == null ) {
		return numberWithCommas( this.lowNumber );
	} else {
		return numberWithCommas( this.lowNumber ) + " - " + numberWithCommas( this.highNumber );
	}
}

function getNearestNiceNumber( num, previousNum, nextNum ) {
	if ( previousNum == null ) {
		var smallestDifference = nextNum - num;
	} else if ( nextNum == null ) {
		var smallestDifference = num - previousNum;
	} else {
		var smallestDifference = Math.min( num - previousNum, nextNum - num );
	}

	var base10LogOfDifference = Math.log(smallestDifference) / Math.LN10;
	var significantFigureOfDifference = Math.floor( base10LogOfDifference );
	
	var powerOf10InCorrectPlace = Math.pow(10, Math.floor(base10LogOfDifference));
	var significantDigitsOnly = Math.round( num / powerOf10InCorrectPlace );
	var niceNumber = significantDigitsOnly * powerOf10InCorrectPlace;

	// Special handling if it's the first or last number in the series -
	// we have to make sure that the "nice" equivalent is on the right
	// "side" of the number.

	// That's especially true for the last number -
	// it has to be greater, not just equal to, because of the way
	// number filtering works.
	// ...or does it??
	if ( previousNum == null && niceNumber > num ) {
		niceNumber -= powerOf10InCorrectPlace;
	}
	if ( nextNum == null && niceNumber < num ) {
		niceNumber += powerOf10InCorrectPlace;
	}

	// Now, we have to turn it into a string, so that the resulting
	// number doesn't end with something like ".000000001" due to
	// floating-point arithmetic.
	var numDecimalPlaces = Math.max( 0, 0 - significantFigureOfDifference );
	return niceNumber.toFixed( numDecimalPlaces );
}

/**
 * Each of these filter values will be a single number, as opposed to
 * a range.
 */
function generateIndividualFilterValuesFromNumbers( uniqueValues ) {
	// Unfortunately, object keys aren't necessarily cycled through
	// in the correct order - put them in an array, so that they can
	// be sorted.
	var uniqueValuesArray = [];
	for ( uniqueValue in uniqueValues ) {
		uniqueValuesArray.push( uniqueValue );
	}

	// Sort numerically, not alphabetically.
	uniqueValuesArray.sort( function(a,b) { return a - b; } );

	var propertyValues = [];
	for ( i = 0; i < uniqueValuesArray.length; i++ ) {
		var uniqueValue = uniqueValuesArray[i];
		var curBucket = {};
		curBucket['filterName'] = uniqueValue;
		curBucket['numValues'] = uniqueValues[uniqueValue];
		propertyValues.push( curBucket );
	}
	return propertyValues;
}

function generateFilterValuesFromNumbers( numberArray ) {
	var numNumbers = numberArray.length;

	// First, find the number of unique values - if it's the value of
	// gBucketsPerFilter, or fewer, just display each one as its own
	// bucket.
	var numUniqueValues = 0;
	var uniqueValues = {};
	for ( i = 0; i < numNumbers; i++ ) {
		var curNumber = numberArray[i];
		if ( !uniqueValues.hasOwnProperty(curNumber) ) {
			uniqueValues[curNumber] = 1;
			numUniqueValues++;
			if ( numUniqueValues > gBucketsPerFilter ) continue;
		} else {
			// We do this now to save time on the next step,
			// if we're creating individual filter values.
			uniqueValues[curNumber]++;
		}
	}

	if ( numUniqueValues <= gBucketsPerFilter ) {
		return generateIndividualFilterValuesFromNumbers( uniqueValues );
	}

	var propertyValues = [];
	var separatorValue = numberArray[0];
	var startIndexOfBucket = 0;
	var endIndexOfBucket;

	// Make sure there are at least, on average, five numbers per bucket.
	// HACK - add 3 to the number so that we don't end up with just one
	// bucket ( 7 + 3 / 5 = 2).
	var numBuckets = Math.min( gBucketsPerFilter, Math.floor( (numNumbers + 3) / 5 ) );
	var bucketSeparators = [];
	bucketSeparators.push( numberArray[0] );
	for (i = 1; i < numBuckets; i++) {
		separatorIndex = Math.floor( numNumbers * i / numBuckets ) - 1;
		previousSeparatorValue = separatorValue;
		separatorValue = numberArray[separatorIndex];
		if ( separatorValue == previousSeparatorValue ) {
			continue;
		}
		bucketSeparators.push( separatorValue );
	}
	bucketSeparators.push( Math.ceil( numberArray[numberArray.length - 1] ) );

	// Get the closest "nice" (few significant digits) number for each of
	// the bucket separators, with the number of significant digits
	// required based on their proximity to their neighbors.
	// The first and last separators need special handling.
	bucketSeparators[0] = getNearestNiceNumber( bucketSeparators[0], null, bucketSeparators[1] );
	for (i = 1; i < bucketSeparators.length - 1; i++) {
		bucketSeparators[i] = getNearestNiceNumber( bucketSeparators[i], bucketSeparators[i - 1], bucketSeparators[i + 1] );
	}
	bucketSeparators[bucketSeparators.length - 1] = getNearestNiceNumber( bucketSeparators[bucketSeparators.length - 1], bucketSeparators[bucketSeparators.length - 2], null );

	var oldSeparatorValue = bucketSeparators[0];
	var separatorValue;
	for ( i = 1; i < bucketSeparators.length; i++ ) {
		separatorValue = bucketSeparators[i];
		var curBucket = {};
		curBucket['numValues'] = 0;
		var curFilter = new NumberRange( oldSeparatorValue, separatorValue );
		curBucket['filterName'] = curFilter.toString();
		propertyValues.push(curBucket);
		oldSeparatorValue = separatorValue;
	}

	var curSeparator = 0;
	for (i = 0; i < numberArray.length; i++) {
		if ( curSeparator < propertyValues.length - 1 ) {
			var curNumber = numberArray[i];
			while ( curNumber >= bucketSeparators[curSeparator + 1] ) {
				curSeparator++;
			}
		}
		propertyValues[curSeparator]['numValues']++;
	}

	return propertyValues;
}
