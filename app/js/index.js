window.$        = window.jQuery = require('jquery');
var jQueryUI    = require('jquery-ui-dist/jquery-ui.js');
var ko          = require('knockout');
var stationData = require('./map-data.js');
var mapStyles   = require('./map-styles.js');
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
  self = this;
  var trafficService = new TrafficService();
  var placesService = new google.maps.places.PlacesService(map);

  self.station = null;
  self.status = {
    // Status codes
    FETCHING: 'FETCHING',
    ERROR: 'ERROR',
    // Keep status codes consistent between my code and API
    ZERO_RESULTS: google.maps.places.PlacesServiceStatus.ZERO_RESULTS,
    OK: google.maps.places.PlacesServiceStatus.OK,
    NOT_FOUND: google.maps.places.PlacesServiceStatus.NOT_FOUND,
    UNKNOWN_ERROR: google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR,
    departureBoard: false,
    placesService: false
  };
  self.placeholderUrl = "assets/ic_train_thumbnail.svg";
  self.infowindow = new google.maps.InfoWindow({
    content: $('#info-template').html()
  });

  self.open = function() {
    self.infowindow.open(map, self.station.marker);
    return self;
  }

  self.setInfoStyles = function() {
    // Adapted from http://en.marnoto.com/2014/09/5-formas-de-personalizar-infowindow.html
    // WARNING: Relying on inner working of Maps API. May stop working with newer versions.

    // Reference to the DIV which receives the contents of the infowindow using jQuery
    var iwOuter = $('.gm-style-iw');
    $(iwOuter).parent().addClass('iw-container');
    // The DIV we want to change is above the .gm-style-iw DIV.
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

  self.addInfoListeners = function() {
    $('#timepicker').timepicker().on('changeTime.timepicker', function(e) {
      console.log('The time is ' + e.time.value);
      console.log('The hour is ' + e.time.hours);
      console.log('The minute is ' + e.time.minutes);
      console.log('The meridian is ' + e.time.meridian);
    });
    $('input[type=radio][name=time-mode]').change(function () {
      $('.time-mode-radio-btn').each(function() {
        $(this).toggleClass('active', $(this).children('input').prop('checked'));
      });
    });
    console.log('domready!');
  }

  self.prepareInfowindow = function() {
    // Adapt styles when infowindow gets inserted into the DOM
    self.setInfoStyles();
    // Add listeners to info window (TODO Do I have to set them every time or are bindings persistent?)
    self.addInfoListeners();
    // Show first tab
    $('a[href="#general"]').tab('show');
    // Set "departure" time mode by default
    $('input[name="time-mode"][value="departure"]').prop('checked', true).trigger('change');
    // Reset route planner inputs
    $('#route-input-origin').val(self.station.name);
    $('#route-input-destination').val('');
    // Enable timepicker widget
    $('#timepicker').timepicker();
    // Enable autocomplete on route planner inputs
    var numOfSuggestions = 15;
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
  }
  // Gets called every time the info window is newly inserted into the DOM
  google.maps.event.addListener(self.infowindow, 'domready', self.prepareInfowindow);

  self.close = function() {
    self.infowindow.close();
    return self;
  }

  self.setStation = function(station) {
    self.station = station;
    return self.clear();
  }

  self.onclose = function(callback) {
    google.maps.event.addListener(info, 'closeclick', callback);
  }

  self.fetchInfo = function() {
    return self.getPlacesInfo()
               .getDepartureBoard()
               .render();
  }

  self.getDepartureBoard = function() {
    self.setDepartureBoardStatus(self.status.FETCHING);
    trafficService.getDepartureBoard(self.station, function(result) {
      result.Departure;
      if (!result.Departure || result.Departure.length === 0) {
        self.setDepartureBoardStatus(self.status.ERROR);
      } else {
        self.departure = result.Departure;
        self.setDepartureBoardStatus(self.status.OK);
      }
      self.renderDepartureBoard();
    })
    return self;
  }

  self.getPlacesInfo = function(type) {
    var request = {
      location: self.station.location,
      radius: 300,
      type: type || 'transit_station',
      query: self.station.name
    };
    // Search for place
    self.setPlacesStatus(self.status.FETCHING);
    self.status.placesRequest = request;
    placesService.textSearch(request, self.getPlacesDetails);
    return self;
  }

  self.getPlacesDetails = function(results, status) {
    var secondInquiry = function() {
      // If we are on the first attempt, try again with a more general type attribute
      if (self.status.placesRequest.type === 'transit_station') {
        console.log('Attempting second Places API request..');
        self.getPlacesInfo('point_of_interest');
      } else {
        self.setPlacesStatus(status);
      }
    }
    // If place is found..
    if (status === self.status.OK) {
      // Choose a place with enough information
      var place = self.choosePlace(results);
      console.log('Results: ', results, 'Choice: ', place);
      if (place) {
        return placesService.getDetails(place, self.getPlacesResults);
      } else {
        // If no suitable place was found make a second attempt
        status = self.status.ZERO_RESULTS;
        secondInquiry();
      }
    } else if (status === self.status.ZERO_RESULTS) {
      // Try to find the place with different attributes
      secondInquiry();
    } else {
      self.setPlacesStatus(status);
    }
    self.renderPlacesInfo();
  }

  self.choosePlace = function(places) {
    // TODO: There are some complex patterns Frankfurt(Main)Süd
    var nameMatches = function(place) {
      return place.name.indexOf(self.station.name.slice(0, 5)) >= 0 ||
             self.station.name.indexOf(place.name.replace(/%w+%s?\(%w+\)%s?(%w+)/, '$1')) >= 0;
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
    return false;
  }

  self.getPlacesResults = function(place, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
      self.getThumbnail(place);
      self.getReviews(place);
      self.rating = place.rating;
    } else {
      console.log('Error: Could not get place details (' + status + ')');
    }
    self.setPlacesStatus(self.status.OK);
    return self.renderPlacesInfo();
  }

  self.getThumbnail = function(place) {
    if (place.photos) {
      self.thumbnailUrl = place.photos[0].getUrl({
        maxWidth: 200,
        maxHeight: 200
      });
    }
    // TODO: Pre-load image
    return self;
  }

  self.getReviews = function(place) {
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
    return self;
  }

  self.clear = function() {
    self.reviews = null;
    self.departure = null;
    self.thumbnailUrl = null;
    self.rating = null;
    self.status.departureBoard = false;
    self.status.placesService = false;
    return self;
  }

  self.setDepartureBoardStatus = function(status) {
    self.status.departureBoard = status;
  }

  self.setPlacesStatusMessage = function() {
    var messages = [
      {
        status: 'default',
        heading: 'Error!',
        message: 'An error occured: ' + self.status.placesService
      },
      { status: self.status.ZERO_RESULTS,
        heading: 'Not found!',
        message: 'Google has no information on this location yet.'
      },
      { status: self.status.UNKNOWN_ERROR,
        heading: 'Unknown Error!',
        message: 'An unknown error occured. Please try again later.'
      }
    ];
    var result = messages.find(function(msg) {
      return msg.status === self.status.placesService;
    }) || messages.default;
    $('#alert-general-heading').html(result.heading);
    $('#alert-general-message').html(result.message);
  }

  self.setPlacesStatus = function(status) {
    self.status.placesService = status;
    // Show spinner in general tab when fetching from Places API
    var showAlert = showSpinner = false;
    if (status === self.status.FETCHING) {
      showSpinner = true;
    } else if (status !== self.status.OK) {
      showAlert = true;
      self.setPlacesStatusMessage()
    }
    $('#general-spinner').toggleClass('visible', showSpinner);
    $('#alert-general').toggleClass('visible', showAlert);
  }

  self.updateDomElement = function(selector, content) {
    var element = $(selector);
    if (element.html() !== content) {
      element.html(content);
    } else {
      console.log('not updating ' + selector + ' with ' + content);
    }
  }

  self.render = function() {
    self.updateDomElement('.info-name', self.station.name);
    self.updateDomElement('.info-district', self.station.district);
    self.renderPlacesInfo();
    self.renderDepartureBoard();
    return self;
  }

  self.renderPlacesInfo = function() {
    self.renderThumbnail()
        .renderRating()
        .renderReviews();
  }

  self.renderThumbnail = function() {
    var url = self.thumbnailUrl || self.placeholderUrl;
        html = '<img src="' + url + '" alt="photo of ' + self.station.name + '"/>';
    self.updateDomElement('.info-thumbnail', html);
    return self;
  }

  self.renderRating = function() {
    var html = '';
    if (self.status.placesService === self.status.OK) {
      html = self.rating ? 'Rating: ' + self.rating
                         : 'Rating: ---';
    }
    self.updateDomElement('.info-rating', html);
    return self;
  }

  self.renderReviews = function() {
    var html = '';
    if (self.status.placesService === self.status.OK && self.reviews) {
      if (self.reviews.length === 0) {
        html = '<h3 class="info-review-heading">No reviews yet.</h3>';
      }
      var sortedReviews = self.reviews.sort(self.compareReviews);
      for (var i = 0; i < sortedReviews.length; i++) {
        html += [
          '<p>',
          '<h3 class="info-review-heading">' + sortedReviews[i].author,
          self.ratingToStars(sortedReviews[i].rating) + '</h3>',
          sortedReviews[i].text,
          '</p>'
        ].join('\n');
      }
    }
    self.updateDomElement('.info-review', html);
    return self;
  }

  self.compareReviews = function(a, b) {
    // TODO: Get user language
    var userLang = 'en';
    if (a.language === b.language) {
      return 0;
    } else if (a.language === userLang) {
      return -1;
    } else if (b.language === userLang) {
      return 1;
    } else {
      return 0;
    }
  }

  self.ratingToStars = function(rating) {
    var html = '<div class="info-star-rating">';
    for (var i = 0; i < 5; i++) {
      html += (i < rating)
                  ? '<span class="glyphicon glyphicon-star"></span>'
                  : '<span class="glyphicon glyphicon-star-empty"></span>';
    }
    return html + '</div>';
  }

  self.renderDepartureBoard = function() {
    var html;
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
    } else if (self.status.departureBoard === self.status.FETCHING) {
      html = 'Fetching...';
    } else {
      html = 'Could not fetch traffic information. (' + self.status.departureBoard + ')';
    }
    self.updateDomElement('.info-departure-board', html);
    return self;
  }

  self.getFormattedTime = function() {
    var now = new Date();
    return ('0' + now.getHours()).slice(-2) + ':' +
           ('0' + now.getMinutes()).slice(-2);
  }
}

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

  self.ajax = function(url, callback) {
    $.ajax({
      url: url,
      method: 'GET',
      dataType: 'jsonp',
      jsonp: 'jsonpCallback'
    }).done(callback).fail(function(err) {
      throw err;
    });
  }

  self.getDepartureBoard = function(station, callback) {
    var url = self.getUrl('departureBoard', {
      'id': station.hafasId,
      'maxJourneys': 10
    });
    self.ajax(url, callback);
  }

  self.getRoute = function(inquiry, callback) {
    var url = getUrl('trip', inquiry);
    self.ajax(url, callback);
  }
}

function Station(data) {
  this.hafasId = data.hafasId;
  this.rmvId = data.rmvId;
  this.name = data.name;
  this.longName = data.longName;
  this.district = data.district;
  this.location = { lat: parseFloat(data.lat), lng: parseFloat(data.lng) };
  var stationIcon = {
    url: 'assets/ic_train.svg',
    size: new google.maps.Size(24, 24),
    scaledSize: new google.maps.Size(24, 24),
    origin: new google.maps.Point(0, 0),
    anchor: new google.maps.Point(12, 20)
  };
  this.marker = new google.maps.Marker({
    icon: stationIcon,
    map: map,
    position: this.location,
    title: this.name,
    optimized: false
  });
}

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

// Highlight the active marker
Station.prototype.setActiveState = function(state) {
  var markerImage = $('.gmnoprint[title="' + this.name + '"]');
  if (state === true) {
    map.panTo(this.marker.getPosition());
    $(markerImage).addClass('marker-animate');
  } else {
    $(markerImage).removeClass('marker-animate');
  }
}

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
  // TODO: Implement more complex searches (Tags, Subway Line, etc.)
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
      removeActiveState(self.activeItem());
      self.activeItem(null);
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
      self.removeActiveState();
    });
    // Show the station list when user clicks the search input
    $('.searchbox-input').focus(function() {
      $('.station-list').addClass('station-list-active');
    });
    // Hook up the searchbox "back" and "cancel" buttons
    $('.searchbox-btn-back').click(function() {
      hideStationList();
    });
    $('.searchbox-btn-cancel').click(function() {
      self.searchTerm('');
      $('.searchbox-input').focus();
    });
  }

  // Track the currently selected station
  self.activeItem = ko.observable(null);

  // When the user clicks a station, set it as active and reveal information
  self.setActive = function() {
    if (self.activeItem() !== null) {
      self.removeActiveState(self.activeItem());
    }
    // Scroll the station list to the new active station
    scrollToElement(this);
    // Visually highlight the marker on the map
    this.setActiveState(true);
    // Set active item to the one the user clicked
    activeItem(this);
    // Populate and show info window on the marker
    self.info.setStation(this)
             .open()
             .fetchInfo();
    // Hide the station list for tablet and smartphone users
    hideStationList();
  }

  self.removeActiveState = function() {
    self.activeItem().setActiveState(false);
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

  var hideStationList = function() {
    $('.station-list').removeClass('station-list-active');
  }
};

function initStationData() {
  stations = stationData.map(function(data) {
    return new Station(data);
  });
}

function initMap() {
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
}

initMap();
ko.applyBindings(neighborhoodMapViewModel);
