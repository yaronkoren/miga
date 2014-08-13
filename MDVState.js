/**
 * MDVState.js
 *
 * Defines the class MDVState, which holds the current state of
 * the application, based on the URL - and also sets the URL accordingly.
 *
 * (MDV = Miga Data Viewer)
 */
function MDVState( categoryName, selectedFilters, displayFilter, searchString, pageNum, displayFormat ) {
	this.categoryName = categoryName;
	if ( selectedFilters == null ) {
		this.selectedFilters = [];
	} else {
		this.selectedFilters = selectedFilters;
	}
	this.displayFilter = displayFilter;
	this.searchString = searchString;
	this.pageNum = pageNum;
	this.displayFormat = displayFormat;

	// Not set via the constructor
	this.itemID = null;
	this.pageName = null;
	this.filterDisplayFormat = null;
	this.currentEventsOnly = false;
	this.upcomingEventsOnly = false;

	this.useSearchForm = false;
	this.showSearchFormResults = false;
}

/**
 * Do a "deep copy" of this instance.
 */
MDVState.prototype.clone = function() {
	var newDBState = new MDVState();
	for ( var propName in this ) {
		if ( typeof( this[propName] ) == 'object' && this[propName] != null ) {
			// objects need special handling
			newDBState[propName] = {};
			for ( var propName2 in this[propName] ) {
				newDBState[propName][propName2] = this[propName][propName2];
			}
		} else {
			newDBState[propName] = this[propName];
		}
	}
	return newDBState;
}

MDVState.prototype.setFromURLHash = function( hash ) {
	if ( hash.charAt(0) != '#' ) {
		// do something
	}

	// If there's nothing here, we're on the start page.
	if ( hash.length < 3 ) {
		this.pageName = '_start';
		return;
	}

	// Remove first pound sign.
	hashParts = hash.substring(1).split("/");

	for ( var i = 0; i < hashParts.length; i++ ) {

		var hashPartParts = hashParts[i].split('=');
		if ( hashPartParts.length == 1 ) {
			if ( hashParts[i] == '_current' ) {
				this.currentEventsOnly = true;
			} else if ( hashParts[i] == '_upcoming' ) {
				this.upcomingEventsOnly = true;
			} else if ( hashParts[i] == '_search' ) {
				this.useSearchForm = true;
			} else if ( hashParts[i] == '_searchResults' ) {
				this.showSearchFormResults = true;
			}
			continue;
		} else if ( hashPartParts.length > 2 ) {

			// Just ignore this.
			continue;
		}
		var key = hashPartParts[0];
		var value = hashPartParts[1];
		if ( key == '_cat' ) {
			this.categoryName = decodeURIComponent(value);
		} else if ( key == '_pageNum' ) {
			this.pageNum = value;
		} else if ( key == '_format' ) {
			this.displayFormat = decodeURIComponent(value);
		} else if ( key == '_filterFormat' ) {
			this.filterDisplayFormat = decodeURIComponent(value);
		} else if ( key == '_displayFilter' ) {
			this.displayFilter = decodeURIComponent(value);
		} else if ( key == '_searchStr' ) {
			this.searchString = decodeURIComponent(value);
		} else if ( key == '_item' ) {
			this.itemID = value;
		} else if ( key == '_page' ) {
			this.pageName = decodeURIComponent(value);
		} else if ( key.charAt(0) == '_' ) {
			continue;
		} else {
			var propName = decodeURIComponent(key);
			var propValue = decodeURIComponent(value);
			this.selectedFilters[propName] = propValue;
		}
	}
}

MDVState.prototype.getURLHash = function() {
	var hash = "#";
	if ( this.useSearchForm ) {
		hash += "_search/";
	} else if ( this.showSearchFormResults ) {
		hash += "_searchResults/";
	}
	if ( this.categoryName != null ) {
		hash += "_cat=" + encodeURIComponent(this.categoryName);
	}
	if ( this.itemID != null ) {
		hash += "_item=" + this.itemID;
	}
	if ( this.pageName != null ) {
		hash += "_page=" + encodeURIComponent(this.pageName);
	}
	if ( this.displayFormat != null && this.displayFormat != '' ) {
		hash += "/_format=" + this.displayFormat;
	}
	if ( this.currentEventsOnly ) {
		hash += "/_current";
	} else if ( this.upcomingEventsOnly ) {
		hash += "/_upcoming";
	}
	for ( var propName in this.selectedFilters ) {
		hash += "/" + encodeURIComponent(propName) + '=' + encodeURIComponent(this.selectedFilters[propName]);
	}
	if ( this.searchString != null ) {
		hash += "/_searchStr=" + encodeURIComponent(this.searchString);
	}
	if ( this.displayFilter != null ) {
		hash += "/_displayFilter=" + encodeURIComponent(this.displayFilter);
	}
	if ( this.filterDisplayFormat != null ) {
		hash += "/_filterFormat=" + encodeURIComponent(this.filterDisplayFormat);
	}
	if ( this.pageNum != null ) {
		hash += "/_pageNum=" + this.pageNum;
	}
	return hash;
}

MDVState.prototype.getDisplayFilterType = function() {
	if ( this.displayFilter.indexOf('::') > 0 ) {
		var filterParts = this.displayFilter.split('::');
		return gDataSchema[filterParts[0]]['fields'][filterParts[1]]['fieldType'];
	} else {
		return gDataSchema[this.categoryName]['fields'][this.displayFilter]['fieldType'];
	}
}
