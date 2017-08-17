window.$         = window.jQuery = require('jquery');
var ko           = require('knockout');
var stationData  = require('./map-data.js');
var mapStyles    = require('./map-styles.js');
var bootstrap    = require('bootstrap');
var timepicker   = require('bootstrap-timepicker');

/*******************************************
/  Globals
/*******************************************/

var map;
var info;
var stations = [];
var placesService;
var overlay;

/*******************************************
/  Station class
/  °°°°°°°°°°°°°
/  holds data and methods to show the user
/  information on a train station
/*******************************************/

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

Station.prototype.getTimetable = function() {
  var url = 'https://www.rmv.de/hapi/departureBoard';
  url += '?' + $.param({
    'id': this.hafasId,
    'accessId': 'b73b4c0a-3fda-46e2-803a-46c4ad8cda0c',
    'format': 'json',
    'jsonpCallback': 'jsonpCallback'
  });
  $.ajax({
    url: url,
    method: 'GET',
    dataType: 'jsonp',
    jsonp: 'jsonpCallback'
  }).done(renderTimetable).fail(function(err) {
    throw err;
  });
}

function renderTimetable(result) {
  console.log(result);
  var departure = result.Departure;
  if (departure) {
    // Make table headings
    var departureString = [
      '  <tr>',
      '    <th>Line</th>',
      '    <th>Direction</th>',
      '    <th>Departure</th>',
      '  </tr>',
    ].join('\n');
    for (var i = 0; i < 10 && i < departure.length; i++) {
      var time = departure[i].time.replace(/(\d\d:\d\d):\d\d/, '$1');
      departureString += [
        '  <tr>',
        '    <td>' + departure[i].name + '</td>',
        '    <td>' + departure[i].direction + '</td>',
        '    <td>' + time + '</td>',
        '  </tr>',
      ].join('\n');
    }
    $('.info-timetable').html(departureString);
  } else {
    console.log('Expected departure data. Instead I got this..  ', result);
    $('.info-timetable').html('<strong>Could not fetch data</strong>');
  }
}

function getRoute() {
  var origin = $('#route-input-origin').val();
  var destination = $('#route-input-destination').val();
  var time = $('#route-input-time').val();
  var timeMode = $('input[name=route-time-mode]:checked').val();

  console.log('From ', origin, ' to ', destination, timeMode, time);

  // TODO: Fetch route details from RMV API
}

// TODO: Refactor
Station.prototype.getInfo = function() {
  var self = this;

  $('.info-title').html(self.name);
  $('.info-district').html(self.district);
  // Set disabled field to THIS station
  var now = new Date();
  console.log($('#route-input-time').val());
  var formattedTime = ('0' + now.getHours()).slice(-2) + ':' +
                      ('0' + now.getMinutes()).slice(-2);
  $('#route-input-time').val(formattedTime);
  console.log(formattedTime);
  $('.route-input-station:disabled').val(self.longName);
  // Enable autocomplete for active field
  $('.route-input-station:not(disabled)').val(self.longName);

  // Get photo, rating, reviews from Google Places API
  var request = {
    location: self.location,
    type: 'transit_station',
    query: self.longName + ' station'
  };
  placesService.textSearch(request, function(results, status) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {
      placesService.getDetails(results[0], function (place, status) {
        if (status == google.maps.places.PlacesServiceStatus.OK) {
          var photoString = '';
          if (place.photos) {
            var url = place.photos[0].getUrl({
              maxWidth: 100,
              maxHeight: 100
            });
            photoString += '<img src="' + url + '" alt="photo of "' + place.name + '"/>';
            console.log(photoString);
          } else {
            photoString += '<strong>Could not fetch data</strong>';
          }
          var reviewString = '';
          if (place.reviews) {
            for (var i = 0; i < place.reviews.length && i < 10; i++) {

              reviewString += '<strong>' + place.reviews[i].author_name + '</strong>' +
                              '<p>' + place.reviews[i].text + '</p>';
            }
          } else {
            reviewString = 'No reviews yet';
          }
          var ratingString = place.rating || '---';

          // TODO: create function for changes implement locking
          $('.info-thumbnail').html(photoString);
          $('.info-rating').html(ratingString);
          $('.info-review').html(reviewString);
        } else {
          console.log('Error: Could not get place details');
        }
      });
    } else {
      console.log('Error: Could not find place');
    }
  });
}

// Populate info window and open on marker
Station.prototype.showInfo = function() {
  info.open(map, this.marker);
  this.getInfo();
  addInfoListeners();
  this.getTimetable();
}

Station.prototype.hideInfo = function() {
  info.close();
}

// Highlight the active marker
Station.prototype.setActiveState = function(state) {
  if (state === true) {
    map.panTo(this.marker.getPosition());
    // TODO: Make marker bigger
  } else {
    // TODO: Make marker normal size
  }
}

// TODO: inconsistent id / class usage
function addInfoListeners() {
  $('#route-go-btn').click(getRoute);
  $('.route-switch-btn').click(switchOriginDestination);
}

function switchOriginDestination() {
  if ($('.route-form').hasClass('route-switch-animation') === false) {
    // Toggle disabled property on both inputs
    $('.route-input-station').prop('disabled', function(i, v) { return !v; });
    // Exchange input values;
    var from = $('#route-input-origin').val();
    $('#route-input-origin').val($('#route-input-destination').val());
    $('#route-input-destination').val(from);

    // Trigger animation
    $('.route-form').addClass('route-switch-animation');
    // Remove the animation class after it finishes
    // If I don't remove the class, the element will animate every
    // time it gets added to the DOM i.e. on every tab switch
    // TODO: find a neater solution
    setTimeout(function() {
      $('.route-form').removeClass('route-switch-animation');
    }, 500);
  }

  return false;
}

// TODO: Not necessary anymore
function reflow(elements) {
  $.each($(elements), function(i, el) {
      el.offsetHeight = el.offsetHeight;
      console.log('Reflowing Element ', $(el), ';; offset = ', el.offsetHeight);
  });
}

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
  info = new google.maps.InfoWindow({
    maxWidth: 400,
    content: $('#info-template').html()
  });
  placesService = new google.maps.places.PlacesService(map);
  overlay = new google.maps.OverlayView();
  overlay.draw = function() {
    this.getPanes().markerLayer.id='markerLayer';
  };
  overlay.setMap(map);
}

/*******************************************
/  neighborhoodMapViewModel
/  °°°°°°°°°°°°°
/  The knockout view model to handle user
/  interaction
/*******************************************/

var neighborhoodMapViewModel = function() {
  var self = this;

  self.searchTerm = ko.observable("");
  // TODO: Implement more complex searches (Tags, Subway Line, etc.)
  self.searchResults = ko.computed(function() {
    return ko.utils.arrayFilter(stations, function(station) {
      return station.longName.toLowerCase().indexOf(self.searchTerm().toLowerCase()) != -1;
    });
  });

  // Hook up the markers to set active state on click
  // TODO: Is it possible to reduce this to a single
  // listener? Would that increase performance?
  stations.forEach(function(station) {
    station.marker.addListener('click', function() {
      self.setActive.call(station);
    });
  });

  // Remove active state from station when info window is closed
  google.maps.event.addListener(info, 'closeclick', function() {
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
    // Populate and show info window on the marker
    this.showInfo();
    // Set active item to the one the user clicked
    activeItem(this);
    // Hide the station list for tablet and smartphone users
    hideStationList();
  }

  self.removeActiveState = function() {
    self.activeItem().setActiveState(false);
    self.activeItem().hideInfo();
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

initMap();
ko.applyBindings(neighborhoodMapViewModel);
