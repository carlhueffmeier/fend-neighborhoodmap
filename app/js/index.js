window.$        = window.jQuery = require('jquery');
var jQueryUI    = require('jquery-ui-dist/jquery-ui');
var ko          = require('knockout');
var stationData = require('./map-data');
var mapStyles   = require('./map-styles');
var bootstrap   = require('bootstrap');
var timepicker  = require('bootstrap-timepicker');

/*******************************************
/  Globals
/*******************************************/

var map;
var info;
var stations = [];
var overlay;

// Info window
function StationInfo() {
  var self = this;
  var trafficService = new TrafficService();
  var placesService = new google.maps.places.PlacesService(map);
  // Placeholder image being used when no picture can be fetched
  var thumbnailPlaceholderUrl = "assets/ic_train_thumbnail.svg";

  // Holds the station for which info is being displayed
  self.station = null;

  // Holds status information used to render progress bars etc.
  self.status = {
    // Constant status codes
    FETCHING: 'FETCHING',
    ERROR: 'ERROR',
    IDLE: 'IDLE',
    // Keep status codes consistent between my code and API
    ZERO_RESULTS: google.maps.places.PlacesServiceStatus.ZERO_RESULTS,
    OK: google.maps.places.PlacesServiceStatus.OK,
    NOT_FOUND: google.maps.places.PlacesServiceStatus.NOT_FOUND,
    UNKNOWN_ERROR: google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR,
    // Actual service status
    departureBoard: 'IDLE',
    tripService: 'IDLE',
    placesService: 'IDLE',
    eventBindings: false,
    timepicker: false,
    autocomplete: false,
  };

  // Create new info window using html template
  self.infowindow = new google.maps.InfoWindow({
    content: $('#info-template').html()
  });

  //
  // Public methods
  //

  self.setStation = function(station) {
    self.station = station;
    clearDataCache();
    return self;
  }

  self.fetchInfo = function() {
    getPlacesInfo();
    getDepartureBoard();
    render();
    return self;
  }

  self.isFullscreen = function() {
    return $('.info').parent().is('.content');
  }

  // Publicize some infowindow functions for convenience

  self.open = function() {
    $('.content').addClass('info-active');
    self.infowindow.open(map, self.station.marker);
    resize();
    return self;
  }

  self.close = function() {
    $('.content').removeClass('info-active');
    attachToInfowindow();
    self.infowindow.close();
    return self;
  }

  self.onclose = function(callback) {
    google.maps.event.addListener(self.infowindow, 'closeclick', callback.bind(self));
    return self;
  }


  //
  // Private Methods
  //

  // Info window preparation and setup of bindings
  //

  // Call prepareInfowindow every time the info window is newly inserted into the DOM
  google.maps.event.addListener(self.infowindow, 'domready', prepareInfowindow);

  function prepareInfowindow() {
    setInfoStyles();
    attachListeners();
    resetElements();
    enableTimepicker();
    enableAutocomplete();
  }

  // Changes the internal google info window representation to make it look sleeker
  function setInfoStyles() {
    // Adapted from http://en.marnoto.com/2014/09/5-formas-de-personalizar-infowindow.html
    // WARNING: Relying on inner working of Maps API. May stop working with newer versions.

    // Reference to the DIV which receives the contents of the info window
    var iwOuter = $('.gm-style-iw');
    $(iwOuter).parent().addClass('iw-container');
    // The DIV we want to change is above the .gm-style-iw DIV
    var iwBackground = iwOuter.prev();
    // Remove the background shadow DIV
    iwBackground.children(':nth-child(2)').css({'display' : 'none'});
    // Remove the white background DIV
    iwBackground.children(':nth-child(4)').css({'display' : 'none'});
    // Changes the desired color for the tail outline
    // The outline of the tail is composed of two descendants of div which contains the tail.
    // Set left / right borders on respective parts of the tail
    iwBackground.children(':nth-child(3)').find('div').children().eq(0).addClass('iw-tail-left');
    iwBackground.children(':nth-child(3)').find('div').children().eq(1).addClass('iw-tail-right');
    // Replace img Google uses with glyphicon
    var iwCloseBtn = iwOuter.next();
    iwCloseBtn.addClass('iw-close-btn');
    iwCloseBtn.html('<span class="iw-close-glyphicon glyphicon glyphicon-remove"></span>');
    // The API automatically applies 0.7 opacity to the button after the mouseout event.
    // This function reverses this event to the desired value.
    iwCloseBtn.mouseout(function(){
      $(this).css({opacity: '1'});
    });
  }

  // Setup Event Handlers for info window
  function attachListeners() {
    if (!self.status.eventBindings) {
      // Start trip search on click
      $('#route-go-btn').click(getRoute);
      // Make the time-mode buttons change status according to radio button status
      $('input[type=radio][name=time-mode]').change(function () {
        $('.time-mode-radio-btn').each(function() {
          $(this).toggleClass('active', $(this).children('input').prop('checked'));
        });
      });
      // Switch origin / destination on click
      $('.route-switch-btn').click(switchStationInputs);
      // Button to return from the trip results in route planner
      $('.route-btn-return').click(clearTripResults);
      self.status.eventBindings = self.status.OK;
      // Handle window resize
      $(window).resize(resize);
    }
  }

  function resize() {
    var breakpoint = 768;
    var iwContainer = $('.gm-style-iw').find('div:first > div:first');
    if ($(window).width() < breakpoint) {
      attachToContent();
    } else if ($(window).width() >= breakpoint) {
      attachToInfowindow();
      self.infowindow.open(map, self.station.marker);
    }
  }

  function attachToInfowindow() {
    var iwContainer = $('.gm-style-iw').find('div:first > div:first');
    if ($('.info').parent().is('.content')) {
      $('.info').appendTo($(iwContainer));
    }
  }

  function attachToContent() {
    var iwContainer = $('.gm-style-iw').find('div:first > div:first');
    if ($('.info').parent().is(iwContainer)) {
      $('.info').appendTo($('.content'));
    }
  }

  // Clear results and return to form
  function clearTripResults() {
    $('.route-container').removeClass('route-container-show-trips');
    $('#trip-results').html('');
    setTripServiceStatus(self.status.IDLE);
  }

  // Switch "origin" and "destination" input values
  function switchStationInputs() {
    var origin = $('#route-input-origin').val();
    $('#route-input-origin').val($('#route-input-destination').val());
    $('#route-input-destination').val(origin);
  }

  // Reset DOM elements to initial state
  function resetElements() {
    // Show first tab
    $('a[href="#departure-board"]').tab('show');
    // Set "departure" time mode by default
    $('input[name="time-mode"][value="departure"]').prop('checked', true).trigger('change');
    // Reset route planner inputs
    $('#route-input-origin').val('');
    $('#route-input-destination').val(self.station.name);
    // Reset trip results and return to route form
    clearTripResults();
  }

  // Returns hafasId for station name string
  function getIdByName(stationName) {
    // TODO: If multiple matches for /stationName/i are found, ask user to choose
    var result = stations.find(function(station) {
      return stationName.toLowerCase() == station.name.toLowerCase();
    });
    return result ? result.hafasId : null;
  }

  // Enable autocomplete on route planner inputs
  function enableAutocomplete() {
    var numOfSuggestions = 15;

    if (!self.status.autocomplete) {
      var stationNames = stations.map(function(station) {
                           return station.name;
                         });
      $('.route-input-station').autocomplete({
        source: function(request, response) {
          var matcher = new RegExp($.ui.autocomplete.escapeRegex(request.term), 'i');
          response($.grep(stationNames, function(item) {
            return matcher.test(item);
          }).sort().slice(0, numOfSuggestions));
        }
      });
      self.status.autocomplete = self.status.OK;
    }
  }

  // Enable timepicker widget in 24h mode
  function enableTimepicker() {
    if (!self.status.timepicker) {
      $('#timepicker').timepicker({
        showMeridian: false
      });
      self.status.timepicker = self.status.OK;
    }
  }

  //
  // Methods for fetching data
  //

  function getRoute() {
    setTripServiceStatus(self.status.FETCHING);
    var request = {};
    request.originId = getIdByName($('#route-input-origin').val());
    request.destId = getIdByName($('#route-input-destination').val());
    request.time = getTimepickerValue();
    if ($('input[type=radio][name=time-mode]:checked').val() === 'arrival') {
      request.searchForArrival = 1;
    } else {
      request.searchForArrival = 0;
    }
    if (isValidTripRequest(request)) {
      var setErrorStatus = function() {
        setTripServiceStatus(self.status.ERROR, 'Error fetching trip results');
      }
      trafficService.getRoute(request, renderRoute.bind(self), setErrorStatus);
    }
  }

  function isValidTripRequest(request) {
    // TODO: Instant validation with colors would be neeter
    if (!request.originId) {
      setTripServiceStatus(self.status.ERROR, 'Could not find the origin');
    } else if (!request.destId) {
      setTripServiceStatus(self.status.ERROR, 'Could not find the destination');
    } else if (!request.time || !(/^\d\d:\d\d$/).test(request.time)) {
      setTripServiceStatus(self.status.ERROR, 'Error parsing the time');
    } else {
      // All checks passed!
      console.log(request);
      return true;
    }
    return false;
  }

  // Fetches departure data and stores it in property
  function getDepartureBoard() {
    const setErrorStatus = function() {
      setDepartureBoardStatus(self.status.ERROR);
    }
    setDepartureBoardStatus(self.status.FETCHING);
    trafficService.getDepartureBoard(self.station.hafasId, function(result) {
      if (!result.Departure || result.Departure.length === 0) {
        setDepartureBoardStatus(self.status.ERROR);
      } else {
        self.departure = result.Departure;
        setDepartureBoardStatus(self.status.OK);
      }
      renderDepartureBoard();
    }, setErrorStatus);
  }

  function getPlacesInfo(type) {
    var request = {
      location: self.station.location,
      radius: 300,
      type: type || 'transit_station',
      query: self.station.name
    };
    // Search for place
    setPlacesStatus(self.status.FETCHING);
    // TODO: This is not pretty, refactor to untangle this process
    // I am saving the request to see what the last request used as search parameters
    self.status.placesRequest = request;
    placesService.textSearch(request, getPlacesDetails);
  }

  function getPlacesDetails(results, status) {
    var secondInquiry = function() {
      // If we are on the first attempt, try again with a more general type attribute
      if (self.status.placesRequest.type === 'transit_station') {
        getPlacesInfo('point_of_interest');
      } else {
        setPlacesStatus(status);
      }
    }
    // If place is found..
    if (status === self.status.OK) {
      // Choose a place with enough information
      var place = choosePlace(results);
      console.log('Results: ', results, 'Choice: ', place);
      if (place) {
        return placesService.getDetails(place, getPlacesResults);
      } else {
        // If no suitable place was found make a second attempt
        status = self.status.ZERO_RESULTS;
        secondInquiry();
      }
    } else if (status === self.status.ZERO_RESULTS) {
      // Try to find the place with different attributes
      secondInquiry();
    } else {
      setPlacesStatus(status);
    }
    renderPlacesInfo();
  }

  // Takes an array of places and returns matching item if any or null if none found
  function choosePlace(places) {
    // TODO: Use a single clean regular expression
    var nameMatches = function(place) {
      // The second part takes care of this common pattern
      // "Frankfurt Süd" - "Frankfurt(Main)Süd"
      return place.name.indexOf(self.station.name.slice(0, 5)) >= 0 ||
             self.station.name.indexOf(place.name.replace(/\w+\s?\(\w+\)\s?(\w+)/, '$1')) >= 0;
    }
    // Reject data sets without rating, review and photo information
    var hasRelevantInformation = function(place) {
      return place.rating || place.reviews || place.photos;
    }
    for (var i = 0; i < places.length; i++) {
      if (hasRelevantInformation(places[i]) && nameMatches(places[i])) {
        return places[i];
      }
    }
    return null;
  }

  function getPlacesResults(place, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
      getThumbnail(place);
      getReviews(place);
      self.rating = place.rating;
    } else {
      console.log('Error: Could not get place details (' + status + ')');
    }
    setPlacesStatus(self.status.OK);
    renderPlacesInfo();
  }

  function getThumbnail(place) {
    if (place.photos) {
      self.thumbnailUrl = place.photos[0].getUrl({
        maxWidth: 200,
        maxHeight: 200
      });
    }
    // TODO: Pre-load image
  }

  function getReviews(place) {
    self.reviews = [];
    if (place.reviews) {
      for (var i = 0; i < place.reviews.length; i++) {
        self.reviews.push({
          author: place.reviews[i].author_name,
          text: place.reviews[i].text,
          language: place.reviews[i].language,
          rating: place.reviews[i].rating
        });
      }
    }
  }

  //
  // Render Methods
  //

  function render() {
    updateDomElement('.info-name', self.station.name);
    updateDomElement('.info-district', self.station.district);
    renderPlacesInfo();
    renderDepartureBoard();
  }

  function renderPlacesInfo() {
    renderThumbnail()
    renderOverallRating()
    renderReviews();
  }

  function renderThumbnail() {
    var url = self.thumbnailUrl || thumbnailPlaceholderUrl;
        html = '<img src="' + url + '" alt="photo of ' + self.station.name + '"/>';
    updateDomElement('.info-thumbnail', html);
  }

  function renderOverallRating() {
    var html = '';
    if (self.status.placesService === self.status.OK) {
      html = self.rating ? 'Rating: ' + self.rating
                         : 'Rating: ---';
    }
    updateDomElement('.info-rating', html);
  }

  function renderReviews() {
    var html = '';
    if (self.status.placesService === self.status.OK && self.reviews) {
      if (self.reviews.length === 0) {
        html = '<h3 class="info-review-heading">No reviews yet.</h3>';
      }
      var sortedReviews = self.reviews.sort(compareReviews);
      for (var i = 0; i < sortedReviews.length; i++) {
        html += [
          '<p>',
          '<h3 class="info-review-heading">' + sortedReviews[i].author,
          ratingToStars(sortedReviews[i].rating) + '</h3>',
          sortedReviews[i].text,
          '</p>'
        ].join('\n');
      }
    }
    updateDomElement('.info-review', html);
  }

  function renderDepartureBoard() {
    var html = '';
    if (self.status.departureBoard === self.status.OK) {
      // Make table headings
      html = [
        '  <tr>',
        '    <th>Line</th>',
        '    <th>Direction</th>',
        '    <th>Departure</th>',
        '  </tr>',
      ].join('\n');
      for (var i = 0; i < self.departure.length; i++) {
        var time = self.departure[i].time.replace(/(\d\d:\d\d):\d\d/, '$1');
        var direction = self.departure[i].direction.replace(/^Frankfurt \(Main\)/, '');
        html += [
          '  <tr>',
          '    <td>' + self.departure[i].name + '</td>',
          '    <td>' + direction + '</td>',
          '    <td>' + time + '</td>',
          '  </tr>',
        ].join('\n');
      }
    }
    updateDomElement('.info-departure-board', html);
  }

  function renderRoute(result, status) {
    if (result && result.Trip && result.Trip.length > 0) {
      result.Trip.forEach(function(item, index) {
        renderTrip(item, 'Trip' + index);
      });
    } else {
      $('#trip-results').html('<h1>No results</h1>');
    }
    setTripServiceStatus(self.status.OK);
    $('.route-container').addClass('route-container-show-trips');
  }

  // Renders a single trip and attaches it to the trip results
  function renderTrip(trip, id) {
    var tripTitle = constructTripTitle(trip);
    var tripBody = constructTripBody(trip);

    // Append new result to list using the html template
    $('#trip-results').append($('#info-trip-template').html().replace(/#DATA_ID#/g, id));
    // Fill in the content of the new panel
    $('.trip-panel').last().find('.trip-body').html(tripBody);
    $('.trip-panel').last().find('.trip-title').html(tripTitle)
  }

  function prettyPrintDuration(duration) {
    // Pretty sure this can be done in one convoluted regex
    var str = '';
    var hours = duration.match(/(\d+)H/);
    var minutes = duration.match(/(\d+)M/);
    if (hours) {
      str += hours[1] + 'h ';
    }
    if (minutes) {
      str += minutes[1] + 'm';
    }
    return str;
  }

  function constructTripTitle(trip) {
    var legs = trip.LegList.Leg;
    var departureTime = removeTrailingSeconds(legs[0].Origin.time);
    var arrivalTime = removeTrailingSeconds(legs[legs.length - 1].Destination.time);
    var tripDuration = prettyPrintDuration(trip.duration);
    var tripTitle = [
      departureTime + ' – ' + arrivalTime,
      '<span class="pull-right">' + tripDuration + '</span><br>',
    ].join(' ');
    // Add an overview of transfers to the title
    legs.forEach(function(leg, index) {
      if (index > 0) {
        tripTitle += '<span class="glyphicon glyphicon-chevron-right trip-chevron"></span>'
      }
      tripTitle += createProductBadge(leg);
    });
    return tripTitle;
  }

  function createProductBadge(leg) {
    var product = leg.name || leg.type;
    var productClass = '';
    if (product.search(/^\s*U/) === 0) {
      productClass = 'trip-product-badge-ubahn';
    } else if (product.search(/^\s*S/) === 0) {
      productClass = 'trip-product-badge-sbahn';
    } else if (product.search(/^\s*Tram/) === 0) {
      productClass = 'trip-product-badge-tram';
    } else if (product.search(/^\s*Bus/) === 0) {
      productClass = 'trip-product-badge-bus';
    } else if (product.search(/^\s*WALK/) === 0) {
      productClass = 'trip-product-badge-walk';
    }
    var badge = [
      '<div class="trip-product-badge ' + productClass + '">',
      product,
      '</div>'
    ].join('\n');
    return badge;
  }

  function constructTripBody(trip) {
    var legs = trip.LegList.Leg;
    var tripBody = '';
    legs.forEach(function(leg, index) {
      legDescription = leg.name || leg.type;
      legDirection = leg.direction || '';
      // Panel content
      tripBody += [
        '<table class="table-condensed">',
        '  <tr>',
        '    <th>' + legDescription + '</th>',
        '    <th>' + legDirection + '</th>',
        '  </tr>',
        '  <tr>',
        '    <td>' + removeTrailingSeconds(leg.Origin.time) + '</td>',
        '    <td>' + removeLeadingCityName(leg.Origin.name) + '</td>',
        '  </tr>',
        '  <tr>',
        '    <td>' + removeTrailingSeconds(leg.Destination.time) + '</td>',
        '    <td>' + removeLeadingCityName(leg.Destination.name) + '</td>',
        '  </tr>',
        '</table><br>'
      ].join('\n');
    });
    return tripBody;
  }

  //
  // Status Helper
  // Methods to set status property and apply style changes if necessary
  //

  function setDepartureBoardStatus(status) {
    $('#departure-spinner').toggleClass('visible', status === self.status.FETCHING);
    $('#departure-alert').toggleClass('visible', status === self.status.ERROR);
    self.status.departureBoard = status;
    renderDepartureBoard();
  }

  // Styles "Go" button according to trip service status
  function setTripServiceStatus(status, message) {
    self.status.tripService = status;
    if (message) {
      $('.route-go-btn-error-message').html(message);
    }
    $('#route-go-btn').toggleClass('route-go-btn-fetching',
                                    status === self.status.FETCHING);
    $('#route-go-btn').toggleClass('route-go-btn-error',
                                    status === self.status.ERROR);
    $('#route-go-btn').toggleClass('route-go-btn-success',
                                    status === self.status.SUCCESS);
  }

  // Shows spinner or alert window depending on new status
  function setPlacesStatus(status) {
    self.status.placesService = status;
    // Show spinner in reviews tab when fetching from Places API
    var showAlert = showSpinner = false;
    if (status === self.status.FETCHING) {
      showSpinner = true;
    } else if (status !== self.status.OK) {
      showAlert = true;
      setPlacesStatusMessage();
    }
    $('#places-spinner').toggleClass('visible', showSpinner);
    $('#places-alert').toggleClass('visible', showAlert);
  }

  // Sets alert window message for places error
  function setPlacesStatusMessage() {
    var messages = [
      {
        status: 'default',
        heading: 'Error!',
        message: 'An error occured: ' + self.status.placesService
      },
      {
        status: self.status.ZERO_RESULTS,
        heading: 'Not found!',
        message: 'Google has no information on this location yet.'
      },
      {
        status: self.status.UNKNOWN_ERROR,
        heading: 'Unknown Error!',
        message: 'An unknown error occured. Please try again later.'
      }
    ];
    var result = messages.find(function(msg) {
      return msg.status === self.status.placesService;
    }) || messages.default;
    $('#places-alert-heading').html(result.heading);
    $('#places-alert-message').html(result.message);
  }

  //
  // Helper Methods
  //

  // Applies changes to DOM only when necessary
  function updateDomElement(selector, content) {
    var element = $(selector);
    if (element.html() !== content) {
      element.html(content);
    }
  }

  // Removes all cached station data
  function clearDataCache() {
    self.reviews = null;
    self.departure = null;
    self.thumbnailUrl = null;
    self.rating = null;
    self.status.departureBoard = false;
    self.status.placesService = false;
  }

  // For sorting: makes reviews in the user language appear first
  function compareReviews(a, b) {
    // TODO: Get user language
    var userLang = 'en';
    if (a.language === userLang) {
      return -1;
    } else if (b.language === userLang) {
      return 1;
    } else {
      return 0;
    }
  }

  // Renders a five-star rating as combination of stars like this ★★★☆☆
  function ratingToStars(rating) {
    var html = '<div class="info-star-rating">';
    for (var i = 0; i < 5; i++) {
      html += (i < rating)
                  ? '<span class="glyphicon glyphicon-star"></span>'
                  : '<span class="glyphicon glyphicon-star-empty"></span>';
    }
    return html + '</div>';
  }

  function getTimepickerValue() {
    var pad = function(s) {
      return ('00' + s).slice(-2);
    }
    var data = $('#timepicker').data('timepicker');
    return pad(data.hour) + ':' + pad(data.minute);
  }

  // Returns only hours and minutes, e.g. "08:55:00" -> "08:55"
  function removeTrailingSeconds(time) {
    return time.slice(0, 5);
  }

  function removeLeadingCityName(locationStr) {
    return locationStr.replace(/^Frankfurt \(Main\)/, '');
  }
}

// Interfaces with local transit provider API
function TrafficService() {
  var self = this;
  var baseURL = 'https://www.rmv.de/hapi/';
  var baseParameter = {
    'accessId': 'b73b4c0a-3fda-46e2-803a-46c4ad8cda0c',
    'format': 'json',
    'jsonpCallback': 'jsonpCallback'
  };

  self.getUrl = function(service, inquiryParameter) {
    var params = $.extend({}, baseParameter, inquiryParameter);
    return baseURL + service + '?' + $.param(params);
  }

  self.ajax = function(url, callback, errorHandler) {
    $.ajax({
      url: url,
      method: 'GET',
      dataType: 'jsonp',
      jsonp: 'jsonpCallback'
    }).done(callback).fail(function(err) {
      console.log('Error on AJAX request: ', err.status);
      errorHandler && errorHandler();
    });
  }

  self.getDepartureBoard = function(hafasId, callback, errorHandler) {
    var url = self.getUrl('departureBoard', {
      'id': hafasId,
      'maxJourneys': 10
    });
    self.ajax(url, callback, errorHandler);
  }

  self.getRoute = function(request, callback, errorHandler) {
    var url = self.getUrl('trip', request);
    self.ajax(url, callback, errorHandler);
  }
}

function Station(data) {
  this.hafasId = data.hafasId;
  this.rmvId = data.rmvId;
  this.name = data.name;
  this.longName = data.longName;
  this.district = data.district;
  this.location = { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
  this.isHighlighted = false;
  this.defaultIcon = {
    url: 'assets/ic_train.svg',
    scaledSize: new google.maps.Size(24, 24),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(12, 20)
  };
  this.highlightedIcon = {
    url: 'assets/ic_train-highlight.svg',
    scaledSize: new google.maps.Size(32, 32),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(16, 27)
  };
  this.marker = this.createMarker(this.defaultIcon);
}

Station.prototype.createMarker = function(icon) {
  return new google.maps.Marker({
    icon: icon,
    map: map,
    position: this.location,
    title: this.name
  });
};

Station.prototype.toggleHighlight = function() {
  this.isHighlighted = !this.isHighlighted;
  console.log('Toggle ' + this.name + ' to ' + this.isHighlighted);
  if (this.isHighlighted) {
    // map.setCenter(this.marker.getPosition());
    this.marker.setIcon(this.highlightedIcon);
    this.marker.setZIndex(1000);
  } else {
    this.marker.setIcon(this.defaultIcon);
    this.marker.setZIndex(100);
  }
};

Station.prototype.showMarker = function() {
  if (this.marker.map === null) {
    this.marker.setMap(map);
  }
};

Station.prototype.hideMarker = function() {
  if (this.marker.map !== null) {
    this.marker.setMap(null);
  }
};

/*******************************************
/  neighborhoodMapViewModel
/  °°°°°°°°°°°°°
/  The knockout view model to handle user
/  interaction
/*******************************************/

var neighborhoodMapViewModel = function() {
  var self = this;
  self.info = new StationInfo();
  self.searchTerm = ko.observable("");
  self.searchResults = ko.computed(function() {
    return ko.utils.arrayFilter(stations, function(station) {
      return station.longName.toLowerCase().indexOf(self.searchTerm().toLowerCase()) != -1;
    });
  });

  setupEventHandlers();

  // Handle updates of searchResults
  self.searchResults.subscribe(function(newValue) {
    // If the active Item is not in the search results, reset it
    if (self.activeItem() && $.inArray(self.activeItem(), newValue) === -1) {
      self.clearActive();
    }
    // Display markers if they are in the new results
    stations.forEach(function(station) {
      if ($.inArray(station, newValue) === -1) {
        station.hideMarker();
      } else {
        station.showMarker();
      }
    });
  });


  // Track the currently selected station
  self.activeItem = ko.observable(null);

  // When the user clicks a station, set it as active and reveal information
  self.setActive = function() {
    // 'this' refers to the newly selected station
    if (self.activeItem() === this) {
      self.info.open();
    } else {
      // Remove highlight from current item
      if (self.activeItem() !== null) {
        self.activeItem().toggleHighlight();
      }
      // Scroll the station list to the new active station
      scrollToElement(this);
      // Visually highlight the marker on the map
      this.toggleHighlight();
      // Set active item to the one the user clicked
      activeItem(this);
      // Populate and show info window on the marker
      self.info.setStation(this)
               .open()
               .fetchInfo();
      // Hide the station list for tablet and smartphone users
      hideStationList();
    }
  }

  // When the user clicks a station, set it as active and reveal information
  self.clearActive = function() {
    self.activeItem().toggleHighlight();
    self.info.close(); // If it isn't closed already
    self.activeItem(null);
  }

  // Scroll station list to active item
  self.scrollToElement = function(element) {
    var listNumber = searchResults().indexOf(element);
    var scrollTop = $('.station-list').scrollTop();
    var listTop = $('.station-list').offset().top;
    var elementTop = $('.station-list li').eq(listNumber).offset().top;
    $('.station-list').animate({
      // Scroll position needs to be offset by (y-position of <li>) - (y-position of <ul>)
      scrollTop: scrollTop + elementTop - listTop
    }, 400);
  }

  function setupEventHandlers() {
    // Hook up the markers to set active state on click
    // TODO: Is it possible to reduce this to a single
    // listener? Would that increase performance?
    stations.forEach(function(station) {
      station.marker.addListener('click', function() {
        self.setActive.call(station);
      });
    });
    // Remove active state from station when info window is closed
    self.info.onclose(function() {
      self.clearActive();
    });
    // Show the station list when user clicks the search input
    $('.searchbox-input').focus(function() {
      $('.station-list').addClass('station-list-active');
    });
    // Hook up the searchbox "back" and "cancel" buttons
    $('.searchbox-btn-back').click(function() {
      hideStationList();
      if (self.info.isFullscreen()) {
        self.info.close();
      }
    });
    $('.searchbox-btn-cancel').click(function() {
      self.searchTerm('');
      $('.searchbox-input').focus();
    });
  }

  function hideStationList() {
    $('.station-list').removeClass('station-list-active');
  }
};

function initStationData() {
  stations = stationData.map(function(data) {
    return new Station(data);
  });
}

function initMap() {
  if (google && google.maps) {
    map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: 50.110924, lng: 8.682127 },
      zoom: 14,
      styles: mapStyles
    });
    initStationData();
    info = new StationInfo();

    overlay = new google.maps.OverlayView();
    overlay.draw = function() {
      this.getPanes().markerLayer.id='markerLayer';
    };
    overlay.setMap(map);
  } else {
    $('#map').html('<h1>Networking Issues</h1>');
  }
}

initMap();
ko.applyBindings(neighborhoodMapViewModel);
