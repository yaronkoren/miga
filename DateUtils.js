/**
 * DateUtils.js
 *
 * Functions for displaying and filtering on dates.
 *
 * This includes a fair amount of overloading Javascript's built-in
 * Date class.
 *
 * @author Yaron Koren
 */

Date.prototype.setFromDBString = function( dbDateString ) {
	dbDateString = dbDateString.toString();
	// The second argument to parseInt, "10", is needed so that
	// parseInt knows it's in base 10 - in some browsers, a leading
	// "0" in the substring makes parseInt think the number is octal. (!)
	var year = parseInt(dbDateString.substring(0,4), 10);
	var month = parseInt(dbDateString.substring(4,6), 10) - 1;
	var day = parseInt(dbDateString.substring(6,8), 10);
	var yearOnly = false;

	if ( month == -1 ) {
		month = 0;
		yearOnly = true;
	}
	if ( day == 0 ) {
		day = 1;
		yearOnly = true;
	}

	// For some reason, "new Date(...)" doesn't work for dates before
	// 1970, but setFullYear() does.
	this.setFullYear(year, month, day);
	if ( yearOnly ) {
		this['yearOnly'] = true;
		return;
	}

	// Handle the time, if there is any.
	if ( dbDateString.indexOf('.') > 0 ) {
		this['includesTime'] = true;
		// Add extra zeros for padding, just in case.
		dbTimeString = ( dbDateString + '000000' ).substring(9, 15);
		var hours = parseInt(dbTimeString.substring(0, 2), 10);
		this.setHours(hours);
		var minutes = parseInt(dbTimeString.substring(2, 4), 10);
		this.setMinutes(minutes);
		var seconds = parseInt(dbTimeString.substring(4, 6), 10);
		this.setSeconds(seconds);
	}
}

Date.prototype.getDBString = function() {
	if (this.hasOwnProperty('yearOnly')) {
		return yearToDBString( this.getFullYear() );
	}
		
	var monthNum = this.getMonth() + 1;
	if ( isNaN( monthNum ) ) return null;
	var dbString = this.getFullYear() + ('0' + monthNum).slice(-2) + ('0' + this.getDate()).slice(-2);
	if ( this.getHours() == 0 && this.getMinutes() == 0 && this.getSeconds() == 0 ) {
		return dbString;
	}
	// If there's a time, add that in too.
	dbString += '.' + ('0' + this.getHours()).slice(-2) + ('0' + this.getMinutes()).slice(-2) + ('0' + this.getSeconds()).slice(-2);
	return dbString;
}

function yearToDBString( year ) {
	if( isNaN( year ) ) return null;
	return year + '0000';
}

Date.prototype.getTimeDisplayString = function() {
	var use24HourTime = false;
	if ( gAppSettings.hasOwnProperty('24-hour time') && gAppSettings['24-hour time'] == 'true' ) {
		use24HourTime = true;
	}

	if ( use24HourTime ) {
		var displayString = this.getHours();
	} else {
		var displayString = ( ( this.getHours() + 11 ) % 12 ) + 1;
	}
	// The "minutes" part seems to be needed by Javascript to
	// parse the date string correctly, so just always stick it in.
	displayString += ':' + ('0' + this.getMinutes()).slice(-2);
	if ( this.getSeconds() > 0 ) {
		displayString += ':' + ('0' + this.getSeconds()).slice(-2);
	}
	if ( ! use24HourTime ) {
		displayString += ' ' + ( this.getHours() < 12 ? 'AM' : 'PM' );
	}
	return displayString;
}

Date.prototype.getDisplayString = function() {
	if ( this.hasOwnProperty('yearOnly') ) {
		return this.getFullYear();
	}

	var displayString = monthNumberToString( this.getMonth() + 1 ) + " " + this.getDate() + ", " + this.getFullYear();

	if ( this.hasOwnProperty('includesTime') ) {
		displayString += ' ' + this.getTimeDisplayString();
	}

	return displayString;
}

Date.dbStringToDisplayString = function( dbDateString ) {
	var date = new Date();
	date.setFromDBString( dbDateString );
	return date.getDisplayString();
}

function monthNumberToString( monthNum ) {
	if (monthNum == 1 ) {
		return 'January';
	} else if (monthNum == 2) {
		return 'February';
	} else if (monthNum == 3) {
		return 'March';
	} else if (monthNum == 4) {
		return 'April';
	} else if (monthNum == 5) {
		return 'May';
	} else if (monthNum == 6) {
		return 'June';
	} else if (monthNum == 7) {
		return 'July';
	} else if (monthNum == 8) {
		return 'August';
	} else if (monthNum == 9) {
		return 'September';
	} else if (monthNum == 10) {
		return 'October';
	} else if (monthNum == 11) {
		return 'November';
	} else if (monthNum == 12) {
		return 'December';
	}
	return 'Invalid month - ' + monthNum;
}

function monthStringToNumber( monthName ) {
	if (monthName == 'January') {
		return 1;
	} else if ( monthName == 'February') {
		return 2;
	} else if ( monthName == 'March') {
		return 3;
	} else if ( monthName == 'April') {
		return 4;
	} else if ( monthName == 'May') {
		return 5;
	} else if ( monthName == 'June') {
		return 6;
	} else if ( monthName == 'July') {
		return 7;
	} else if ( monthName == 'August') {
		return 8;
	} else if ( monthName == 'September') {
		return 9;
	} else if ( monthName == 'October') {
		return 10;
	} else if ( monthName == 'November') {
		return 11;
	} else if ( monthName == 'December') {
		return 12;
	}
	return 'Invalid month - ' + monthName;
}

// We need special handling, instead of just using the '>=' comparator,
// because of the 'year only' option.
Date.prototype.greaterThanOrEquals = function( otherDate ) {
	if ( otherDate.hasOwnProperty('yearOnly') ) {
		return this.getFullYear() >= otherDate.getFullYear();
	} else if ( this.hasOwnProperty('yearOnly') ) {
		return false;
	} else {
		return this >= otherDate;
	}
}

/**
 * We generate buckets based on the date range - unlike with number
 * filtering, where the ranges are based on the precise distribution of
 * values, here the buckets are separated into even distances:
 * centuries, decades, years, months, etc.
 */
function generateDatePropertyValues( dateArray ) {
	var len = dateArray.length;
	var earliestDate = dateArray[0];
	var latestDate = dateArray[len - 1];

	var earliestYear = earliestDate.getFullYear();
	var earliestMonth = earliestDate.getMonth() + 1;
	var earliestDay = earliestDate.getDate();
	var latestYear = latestDate.getFullYear();
	var latestMonth = latestDate.getMonth() + 1;
	var latestDay = latestDate.getDate();

	var yearDifference = latestYear - earliestYear;
	var monthDifference = (12 * yearDifference) + (latestMonth - earliestMonth);
	var dayDifference = (30 * monthDifference) + (latestDay - earliestDay);

	var propertyValues = [];
	if ( yearDifference > 300 ) {
		// Split into centuries.
		// This, and the other year-based ones, should probably be
		// done as dates instead of just integers, to handle BC years
		// correctly.
		var curYear = Math.floor( earliestYear / 100 ) * 100;
		while ( curYear <= latestYear ) {
			propertyValues.push( curYear + " - " + (curYear + 99) );
			curYear += 100;
		}
	} else if ( yearDifference > 150 ) {
		// Split into fifty-year increments.
		var curYear = Math.floor( earliestYear / 50 ) * 50;
		while ( curYear <= latestYear ) {
			propertyValues.push( curYear + " - " + (curYear + 49) );
			curYear += 50;
		}
	} else if ( yearDifference > 50 ) {
		// Split into decades.
		var curYear = Math.floor( earliestYear / 10 ) * 10;
		while ( curYear <= latestYear ) {
			propertyValues.push( curYear + " - " + (curYear + 9) );
			curYear += 10;
		}
	} else if ( yearDifference > 15 ) {
		// Split into five-year increments.
		var curYear = Math.floor( earliestYear / 5 ) * 5;
		while ( curYear <= latestYear ) {
			propertyValues.push( curYear + " - " + (curYear + 4) );
			curYear += 5;
		}
	} else if ( yearDifference > 2 ) {
		// Split into years.
		var curYear = earliestYear;
		while ( curYear <= latestYear ) {
			propertyValues.push( curYear );
			curYear++;
		}
	} else if ( monthDifference > 1 ) {
		// Split into months.
		var curYear = earliestYear;
		var curMonth = earliestMonth;
		// Add in year filter values as well, to handle year-only
		// values.
		propertyValues.push( curYear );
		while ( curYear < latestYear || ( curYear == latestYear && curMonth <= latestMonth ) ) {
			propertyValues.push( monthNumberToString( curMonth ) + " " + curYear );
			if ( curMonth == 12 ) {
				curMonth = 1;
				curYear++;
				// Year-only filter value.
				propertyValues.push( curYear );
			} else {
				curMonth++;
			}
		}
	} else if ( dayDifference > 1 ) {
		// Split into days.
		// We can't just do "curDate = earliestDate" because that
		// won't make a copy.
		var curDate = new Date();
		curDate.setTime( earliestDate.getTime() );
		while ( curDate <= latestDate ) {
			propertyValues.push( monthNumberToString( curDate.getMonth() + 1 ) + " " + curDate.getDate() + ", " + curDate.getFullYear() );
			curDate.setDate( curDate.getDate() + 1 );
		}
	} else {
		// It's all part of one day - just show all the individual times.
		var lastDate = earliestDate;
		propertyValues.push( earliestDate.getDisplayString() );
		for ( var i = 0; i < len; i++ ) {
			if ( dateArray[i] > lastDate ) {
				lastDate = dateArray[i];
				propertyValues.push( lastDate.getDisplayString() );
			}
		}
	}
	var fullPropertyValues = [];
	for ( var i = 0; i < propertyValues.length; i++ ) {
		var curFilter = {};
		curFilter['filterName'] = propertyValues[i];
		curFilter['numValues'] = 0;
		fullPropertyValues.push(curFilter);
	}
	return fullPropertyValues;
}

function parseDateFilter( dateFilter ) {
	dateFilter = String(dateFilter);
	if ( dateFilter.indexOf(' - ') > 0 ) {
		var years = dateFilter.split(' - ');
		var lowerYear = parseInt(years[0], 10);
		var upperYear = parseInt(years[1], 10);
		var lowerBoundDate = new Date();
		lowerBoundDate.setFullYear( lowerYear, 0, 1 );
		lowerBoundDate['yearOnly'] = true;
		var upperBoundDate = new Date();
		upperBoundDate.setFullYear( upperYear + 1, 0, 1 );
		upperBoundDate['yearOnly'] = true;
		return [lowerBoundDate, upperBoundDate];
	} else if ( dateFilter.charAt(0) == '>' ) {
		// HACK - this is how we represent inequalities
		return ['>', dateFilter.substring(1)];
	} else if ( dateFilter.charAt(0) == '<' ) {
		// HACK - this is how we represent inequalities
		return ['<', dateFilter.substring(1)];
	} else {
		var dateFilterParts = dateFilter.split(' ');
		if (dateFilterParts.length > 3) { // full date, with time
			var lowerBoundDate = new Date( dateFilter );
			lowerBoundDate['includesTime'] = true;
			var upperBoundDate = new Date( dateFilter );
			upperBoundDate.setSeconds( upperBoundDate.getSeconds() + 1 );
			upperBoundDate['includesTime'] = true;
			return [lowerBoundDate, upperBoundDate];
		} else if (dateFilterParts.length == 3) { // full date
			var lowerBoundDate = new Date( dateFilter );
			var upperBoundDate = new Date( dateFilter );
			upperBoundDate.setDate( upperBoundDate.getDate() + 1 );
			return [lowerBoundDate, upperBoundDate];
		} else if (dateFilterParts.length == 2) { // month and year
			var month = monthStringToNumber(dateFilterParts[0]);
			var year = dateFilterParts[1];
			var lowerBoundDate = new Date();
			var upperBoundDate = new Date();
			lowerBoundDate.setFullYear( year, month - 1, 1 );
			upperBoundDate.setFullYear( year, month, 1 );
			return [lowerBoundDate, upperBoundDate];
		} else {
			var year = parseInt(dateFilter, 10);
			var lowerBoundDate = new Date();
			lowerBoundDate.setFullYear( year, 0, 1 );
			lowerBoundDate['yearOnly'] = true;
			var upperBoundDate = new Date();
			upperBoundDate.setFullYear( year + 1, 0, 1 );
			upperBoundDate['yearOnly'] = true;
			return [lowerBoundDate, upperBoundDate];
		}
	}
}

function generateFilterValuesFromDates( dateArray ) {
	var len = dateArray.length;

	if ( len == 1 ) {
		// Hasty exit
		var dateString;
		if ( dateArray[0].hasOwnProperty('yearOnly') ) {
			dateString = dateArray[0].getFullYear();
		} else {
			dateString = monthNumberToString( dateArray[0].getMonth() + 1 ) + " " + dateArray[0].getDate() + ", " + dateArray[0].getFullYear();
		}
		var propertyValues = [{'filterName': dateString, 'numValues': 1}];
		return propertyValues;
	}

	// Create the "buckets".
	var propertyValues = generateDatePropertyValues( dateArray );

	// If there's only one bucket, put everything in there and exit.
	if ( propertyValues.length == 1 ) {
		propertyValues[0]['numValues'] = len;
		return propertyValues;
	}

	// Now go through the date values, calculating the number that fit
	// into each bucket.
	var dateNum;
	var bucketNum = 0;
	var curBucketComponents = parseDateFilter( propertyValues[0]['filterName'] );
	var startOfCurBucket = curBucketComponents[0];
	var nextBucketComponents = parseDateFilter( propertyValues[1]['filterName'] );
	var startOfNextBucket = nextBucketComponents[0];
	for ( dateNum = 0; dateNum < len; dateNum++ ) {
		var curDate;
		if ( dateArray[dateNum] instanceof Date ) {
			// Why not just set curDate = dateArray[dateNum] ?
			// I wish I could remember.
			curDate = new Date();
			curDate.setTime( dateArray[dateNum].getTime() );
			if ( dateArray[dateNum].hasOwnProperty('yearOnly') ) {
				curDate['yearOnly'] = true;
			}
		} else {
			curDate = dateArray[dateNum][0];
		}
		while ( curDate.greaterThanOrEquals( startOfNextBucket ) ) {
			bucketNum++;
			startOfCurBucket = startOfNextBucket;
			if ( bucketNum < propertyValues.length - 1 ) {
				nextBucketComponents = parseDateFilter( propertyValues[bucketNum + 1]['filterName'] );
				startOfNextBucket = nextBucketComponents[0];
			} else {
				startOfNextBucket = nextBucketComponents[1];
			}
		}
		propertyValues[bucketNum]['numValues']++;
	}
	return propertyValues;
}
