import ko from 'knockout';
import moment from 'moment';
import './ko.dateBindings';
import StationInfo from './StationInfo';
import StatusCodes from './StatusCodes';
import States from './States';
import Console from './Console';
import placeholderImg from '../icons/ic_train_thumbnail.svg';

// Describes the current display mode
// INFO_WINDOW -> Station info is displayed in GoogleMaps InfoWindow on larger devices
const INFO_WINDOW = 'INFO_WINDOW';
// MOBILE -> Station info is displayed full width optimized for smaller devices
const MOBILE = 'MOBILE';
// The minimum viewport width for InfoWindow
const INFO_WINDOW_BREAKPOINT = 768; // px

// Our view model expects a promise that resolves with { map, stations }
// when GoogleMaps finishes loading
const NeighborhoodMapViewModel = function NeighborhoodMapViewModel(mapLoading) {
  // Shows status of critical dependencies
  this.appStatus = ko.observable(StatusCodes.FETCHING);
  this.appStatusMessage = ko.observable('');
  // map, infowindow, stations are set when mapLoading resolves
  this.map = null;
  this.infowindow = null;
  this.stations = ko.observable([]);
  this.windowWidth = ko.observable();
  // Expect mobile device by default
  this.displayMode = ko.observable(MOBILE);
  // This is the currently selected station
  this.activeItem = ko.observable(null);
  // Holds application state, mainly used for styles
  this.state = ko.observable(States.Idle);
  // Focus search field by default
  this.searchFocus = ko.observable(true);
  this.searchTerm = ko.observable('');
  // Holds all the station information displayed
  this.infoContent = {
    thumbnail: ko.observable(),
    name: ko.observable(),
    district: ko.observable(),
    departures: ko.observable(),
    rating: ko.observable(),
    reviews: ko.observable(),
    routePlannerTime: ko.observable(),
    routePlannerTimeMode: ko.observable(),
    routePlannerOrigin: ko.observable(),
    routePlannerDestination: ko.observable(),
    trips: ko.observable(),
    status: {
      departure: ko.observable(),
      departure_message: ko.observable(),
      route: ko.observable(),
      route_message: ko.observable(),
      places: ko.observable(),
      places_message: ko.observable(),
    },
  };

  // Verify data in order to set styles accordingly
  this.infoContent.routePlannerTimeValid = ko.pureComputed(() =>
    moment(this.infoContent.routePlannerTime(), 'HH:mm').isValid());

  this.infoContent.routePlannerOriginValid = ko.pureComputed(() =>
    this.getStationId(this.infoContent.routePlannerOrigin()));

  this.infoContent.routePlannerDestinationValid = ko.pureComputed(() =>
    this.getStationId(this.infoContent.routePlannerDestination()));

  this.infoContent.routePlannerAllValid = ko.pureComputed(() =>
    this.infoContent.routePlannerTimeValid() &&
      this.infoContent.routePlannerOriginValid() &&
      this.infoContent.routePlannerDestinationValid());

  // Set station information to default values
  this.purgeData = () => {
    this.infoContent.thumbnail(placeholderImg);
    this.infoContent.name('');
    this.infoContent.district('');
    this.infoContent.departures([]);
    this.infoContent.rating('');
    this.infoContent.reviews([]);
    this.infoContent.routePlannerTime(moment());
    this.infoContent.routePlannerTimeMode('departure');
    this.infoContent.routePlannerOrigin('');
    this.infoContent.routePlannerDestination('');
    this.infoContent.trips([]);
    this.infoContent.status.departure(StatusCodes.IDLE);
    this.infoContent.status.departure_message('');
    this.infoContent.status.route(StatusCodes.IDLE);
    this.infoContent.status.route_message('');
    this.infoContent.status.places(StatusCodes.IDLE);
    this.infoContent.status.places_message('');
  };
  this.purgeData();

  // Info styles used for mobile view
  this.infoStyles = {
    // Show only title
    'info-glance': false,
    // Show fullscreen
    'info-in': false,
  };

  // Add styles for route planner "go" button
  this.routePlannerGoButtonStyle = ko.pureComputed(() => {
    if (this.infoContent.status.route() === StatusCodes.OK) {
      return 'route-go-btn-success';
    } else if (this.infoContent.status.route() === StatusCodes.FETCHING) {
      return 'route-go-btn-fetching';
    } else if (this.infoContent.status.route() === StatusCodes.ERROR) {
      return 'route-go-btn-error';
    }
    return '';
  });

  // Open GoogleMaps InfoWindow and attach our DOM node
  this.openInfoWindow = () => {
    Console('[NeighborHoodViewModel] Opening info window');
    if (this.infowindow && this.activeItem()) {
      this.infowindow.open(this.map, this.activeItem().marker);
    }
    const iwAnchor = $('#iw-anchor');
    if ($(iwAnchor).length > 0) {
      $('.info').insertAfter($(iwAnchor));
    } else {
      Console('[NeighborHoodViewModel] iwAnchor does not exist.');
    }
  };

  // Close GoogleMaps InfoWindow and move our DOM node to its container
  this.closeInfoWindow = () => {
    Console('[NeighborHoodViewModel] Closing info window');
    $('.info').appendTo($('.info-container'));
    if (this.infowindow) {
      this.infowindow.close();
    }
  };

  this.isInfoWindowOpen = ko.pureComputed(() => this.displayMode() === INFO_WINDOW && this.activeItem());

  // When display mode changes move our content respectfully
  this.displayMode.subscribe((newValue) => {
    Console('[NeighborHoodViewModel] Switching display mode to ', newValue);
    if (this.activeItem() === null) {
      return; // Nothing to do
    }
    if (newValue === INFO_WINDOW) {
      this.openInfoWindow();
    } else {
      this.closeInfoWindow();
    }
  });

  // Set our display mode according to width of viewport
  this.windowWidth.subscribe((newWidth) => {
    if (newWidth >= INFO_WINDOW_BREAKPOINT) {
      this.displayMode(INFO_WINDOW);
    } else {
      this.displayMode(MOBILE);
    }
  });

  // Make window width available as observable
  $(window).on('resize', () => {
    this.windowWidth($(window).width());
  });

  //-----------------
  // State handling
  //-----------------

  // Back ◀ button inside search field
  // Behaviour depends on current state, made obvious through different css styles
  this.onBack = () => {
    const { state } = this;
    if (state() === States.Search || state() === States.SearchInProgress) {
      if (this.activeItem()) {
        state(States.ItemSelected);
      } else {
        state(States.Idle);
      }
    } else if (state() === States.Info) {
      state(States.ItemSelected);
    }
  };

  // Cancel ⓧ button inside search field
  // Empty and focus search
  this.onCancel = () => {
    const { state } = this;
    if (state() === States.Info) {
      state(States.Idle);
    }
    this.searchTerm('');
    this.searchFocus(true);
  };

  // Maximize the station info when header is clicked
  this.onClickInfoHeader = () => {
    const { state } = this;
    if (state() === States.ItemSelected) {
      state(States.Info);
    }
  };

  // Show station list when user begins typing
  this.searchTerm.subscribe((newValue) => {
    const { state } = this;
    if (
      newValue.length === 0 &&
      (state() === States.Search || state() === States.SearchInProgress)
    ) {
      state(States.Idle);
    } else {
      state(States.SearchInProgress);
    }
  });

  // Merges new data into object holding observables
  // TODO: should be a general deep update independent from structure
  this.processUpdate = (state, update) => {
    for ([key, value] of Object.entries(update)) {
      if (ko.isObservable(state[key])) {
        state[key](value);
        Console(`[NeighborHoodViewModel] setting state.${key} to`, value);
      } else if (key === 'status') {
        for ([subKey, subValue] of Object.entries(update[key])) {
          state[key][subKey](subValue);
          Console(`[NeighborHoodViewModel] setting state.${key}.${subKey} to `, subValue);
        }
      }
    }
  };

  // Update station information content
  this.handleUpdate = (newContent) => {
    this.processUpdate(this.infoContent, newContent);
  };

  // Give stationInfo a function to update my content
  this.stationInfo = new StationInfo(this.handleUpdate);

  // Search results are all stations which names match my search query.
  this.searchResults = ko.pureComputed(() =>
    ko.utils.arrayFilter(
      this.stations(),
      station => station.name.toLowerCase().indexOf(this.searchTerm().toLowerCase()) !== -1,
    ));

  // Handle updates of searchResults
  this.searchResults.subscribe((newValue) => {
    // If the currently selected item is not in the new search results, deselect it.
    if (this.activeItem() && $.inArray(this.activeItem(), newValue) === -1) {
      this.clearActive();
    }
    // Display only markers that belong to my new search results
    this.stations().forEach((station) => {
      if ($.inArray(station, newValue) === -1) {
        station.hideFromMap();
      } else {
        station.showOnMap();
      }
    });
  });

  // Switch to the first tab of my station information
  // TODO: I could probably make a custom binding for this,
  //       although it doesn't seem justified in this case.
  this.resetTab = () => {
    $('a[href="#departure-board"]').tab('show'); // cosmetic DOM manipulation
  };

  // Select a new station and display its info to the user
  this.makeActive = (station) => {
    this.purgeData();
    this.resetTab();
    this.activeItem(station);
    if (this.displayMode() === INFO_WINDOW) {
      this.openInfoWindow();
    }
    // Set the 'From' field to this station
    this.infoContent.routePlannerOrigin(station.name);
    this.state(States.ItemSelected);
    this.stationInfo.fetch(station);
    this.scrollToElement(station);
  };

  this.clearActive = () => {
    this.purgeData();
    this.resetTab();
    this.activeItem(null);
    if (this.displayMode() === INFO_WINDOW) {
      this.closeInfoWindow();
    }
  };

  // Remove marker highlight from currently selected item on change
  this.activeItem.subscribe(
    (oldStation) => {
      if (oldStation) {
        oldStation.toggleHighlight(false);
      }
    },
    null,
    'beforeChange', // This way we get the value before the change
  );

  // Highlight the newly selected station on the map
  this.activeItem.subscribe((newStation) => {
    if (newStation) {
      newStation.toggleHighlight(true);
    }
  });

  // Switch origin and destination input values in route planner form
  this.switchInputs = () => {
    const tmp = this.infoContent.routePlannerOrigin();
    this.infoContent.routePlannerOrigin(this.infoContent.routePlannerDestination());
    this.infoContent.routePlannerDestination(tmp);
  };

  // Kick off fetching of route planner results
  this.fetchRoute = () => {
    const origin = this.infoContent.routePlannerOrigin();
    const destination = this.infoContent.routePlannerDestination();
    const time = this.infoContent.routePlannerTime();
    const timeMode = this.infoContent.routePlannerTimeMode() === 'departure' ? 0 : 1;
    this.stationInfo.fetchRoute({
      originId: this.getStationId(origin),
      destId: this.getStationId(destination),
      time: moment(time).format('HH:mm'),
      searchForArrival: timeMode,
    });
  };

  // Clearing trip results automatically returns the user to the route planner form
  this.clearTripResults = () => {
    this.infoContent.trips([]);
  };

  // Return a nicely formatted title for a single route result
  this.constructTripTitle = (trip) => {
    const arrow = '<span class="glyphicon glyphicon-chevron-right trip-chevron"></span>';
    return `${trip.legs[0].departure} - ${trip.legs.slice(-1)[0].arrival}
      <span class="pull-right">${trip.duration}</span><br>
      ${trip.legs
    .map((leg, index) => `${index > 0 ? arrow : ''}${this.createBadge(leg.type)}`)
    .join('')}`;
  };

  // Return a div with the right classes to get differently styled badges
  this.createBadge = (product) => {
    let productClass = '';
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
    return `<div class="trip-product-badge ${productClass}">${product}</div>`;
  };

  // Scroll the station list to show the given item on top
  this.scrollToElement = (element) => {
    const listNumber = this.searchResults().indexOf(element);
    const scrollTop = $('.station-list').scrollTop();
    const listTop = $('.station-list').offset().top;
    const elementTop = $('.station-list li')
      .eq(listNumber)
      .offset().top;
    $('.station-list').animate(
      {
        // Scroll position needs to be offset by (y-position of <li>) - (y-position of <ul>)
        scrollTop: scrollTop + elementTop - listTop,
      },
      400,
    );
  };

  // Convert rating to glyphicons
  // For example 4 -> ★★★★☆
  this.starRating = (rating) => {
    const star = '<span class="glyphicon glyphicon-star"></span>';
    const starEmpty = '<span class="glyphicon glyphicon-star-empty"></span>';
    return `${star.repeat(rating)}${starEmpty.repeat(5 - rating)}`;
  };

  // Returns the stations id (necessary for traffic services)
  this.getStationId = (stationName) => {
    // TODO: If multiple matches for /stationName/i are found, ask user to choose
    const result = this.stations().find(station => stationName.toLowerCase() === station.name.toLowerCase());
    return result ? result.hafasId : null;
  };

  // Add some styles to InfoWindow elements
  // WARNING: Relying on inner working of Maps API. May stop working with unexpectedly.
  // Adapted from http://en.marnoto.com/2014/09/5-formas-de-personalizar-infowindow.html
  this.setInfoStyles = () => {
    // Reference to the DIV which receives the contents of the info window
    const iwOuter = $('.gm-style-iw');
    $(iwOuter)
      .parent()
      .addClass('iw-container');
    // The DIV we want to change is above the .gm-style-iw DIV
    const iwBackground = iwOuter.prev();
    // Remove the background shadow DIV
    iwBackground.children(':nth-child(2)').css({ display: 'none' });
    // Remove the white background DIV
    iwBackground.children(':nth-child(4)').css({ display: 'none' });
    // Changes the desired color for the tail outline
    // The outline of the tail is composed of two descendants of div which contains the tail.
    // Set left / right borders on respective parts of the tail
    iwBackground
      .children(':nth-child(3)')
      .find('div')
      .children()
      .eq(0)
      .addClass('iw-tail-left');
    iwBackground
      .children(':nth-child(3)')
      .find('div')
      .children()
      .eq(1)
      .addClass('iw-tail-right');
    // Replace img Google uses with glyphicon
    const iwCloseBtn = iwOuter.next();
    iwCloseBtn.addClass('iw-close-btn');
    iwCloseBtn.html('<span class="iw-close-glyphicon glyphicon glyphicon-remove"></span>');
    // The API automatically applies 0.7 opacity to the button after the mouseout event.
    // This function reverses this event to the desired value.
    iwCloseBtn.mouseout(function mouseOutHandler() {
      $(this).css({ opacity: '1' });
    });
  };

  // This promise gets resolved once our map is ready
  mapLoading
    .then(({ map, stations }) => {
      // Select station when marker is clicked
      stations.forEach((station) => {
        station.registerClickHandler(() => this.makeActive(station));
      });
      this.stations(stations);
      this.map = map;
      // The station information is dynamically attached to our InfoWindow on large screens.
      // Setting no content results in DOM structure not getting built as expected.
      // The anchor element facilitates moving station information to the InfoWindow.
      this.infowindow = new google.maps.InfoWindow({ content: '<div id="iw-anchor"></div>' });
      // Change styles every time InfoWindow gets attached to the DOM
      google.maps.event.addListener(this.infowindow, 'domready', this.setInfoStyles);
      // Make sure we have the correct displayMode for our screen
      this.windowWidth($(window).width());
      this.appStatus(StatusCodes.OK);
    })
    .catch((errorMessage) => {
      // Some error occurred when loading our Google Maps
      this.appStatus(StatusCodes.ERROR);
      this.appStatusMessage(errorMessage);
    });
};

export default NeighborhoodMapViewModel;
