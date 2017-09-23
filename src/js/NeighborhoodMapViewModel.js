import ko from 'knockout';
import moment from 'moment';
import './ko.dateBindings';
import StationInfo from './StationInfo';
import StatusCodes from './StatusCodes';
import States from './States';
import placeholderImg from '../icons/ic_train_thumbnail.svg';

const DESKTOP = 'DESKTOP';
const MOBILE = 'MOBILE';

const NeighborhoodMapViewModel = function NeighborhoodMapViewModel(stations, callbackRegister) {
  this.map = null;
  this.infowindow = null;
  this.stations = [];
  this.windowWidth = ko.observable();
  this.displayMode = ko.observable(MOBILE);
  this.activeItem = ko.observable(null);
  this.state = ko.observable(States.Idle);
  this.searchFocus = ko.observable(true);
  this.searchTerm = ko.observable('');
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
  this.infoStyles = {
    'info-glance': false,
    'info-in': false,
  };

  // Reset all data to defaults
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

  this.openInfoWindow = () => {
    console.log('open iw');
    if (this.infowindow && this.activeItem()) {
      this.infowindow.open(this.map, this.activeItem().marker);
    }
    const iwAnchor = $('#iw-anchor');
    if ($(iwAnchor).length > 0) {
      $('.info').insertAfter($(iwAnchor));
    } else {
      console.log('(openInfoWindow) iwAnchor does not exist.', iwAnchor);
    }
  };

  this.closeInfoWindow = () => {
    console.log('close iw');
    $('.info').appendTo($('.info-container'));
    if (this.infowindow) {
      this.infowindow.close();
    }
  };

  this.showInfoWindow = ko.pureComputed(() => this.displayMode() === 'DESKTOP' && this.activeItem());

  this.displayMode.subscribe((newValue) => {
    console.log('switch display mode to ', newValue);
    if (this.activeItem() === null) {
      // Nothing to do
      return;
    }
    if (newValue === DESKTOP) {
      this.openInfoWindow();
    } else {
      this.closeInfoWindow();
    }
  });

  this.windowWidth.subscribe((newWidth) => {
    // console.log('windowWidth to ', $(window).width());
    const breakpoint = 768;
    if (newWidth > breakpoint) {
      // console.log('display mode: DESKTOP');
      this.displayMode(DESKTOP);
    } else {
      // console.log('display mode: MOBILE');
      this.displayMode(MOBILE);
    }
  });

  $(window).on('resize', () => {
    this.windowWidth($(window).width());
    // console.log('resizing to ', $(window).width());
  });

  /* State handling */
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

  this.onCancel = () => {
    const { state } = this;
    if (state() === States.Info) {
      state(States.Idle);
    }
    this.searchTerm('');
    this.searchFocus(true);
  };

  this.onClickInfoHeader = () => {
    const { state } = this;
    if (state() === States.ItemSelected) {
      state(States.Info);
    }
  };

  this.infoContent.routePlannerTime.subscribe((newValue) => {
    console.log(newValue);
  });

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

  // TODO: should be a general deep update independent from structure
  this.processUpdate = (state, update) => {
    for ([key, value] of Object.entries(update)) {
      if (ko.isObservable(state[key])) {
        state[key](value);
        console.log(`setting state.${key} to`, value);
      } else if (key === 'status') {
        for ([subKey, subValue] of Object.entries(update[key])) {
          state[key][subKey](subValue);
          console.log(`setting state.${key}.${subKey} to `, subValue);
        }
      }
    }
  };

  this.handleUpdate = (newContent) => {
    this.processUpdate(this.infoContent, newContent);
  };

  // Give stationInfo a callback to update my content
  this.stationInfo = new StationInfo(this.handleUpdate);

  // Track the currently selected station
  this.searchResults = ko.pureComputed(() =>
    ko.utils.arrayFilter(
      stations,
      station => station.name.toLowerCase().indexOf(this.searchTerm().toLowerCase()) !== -1,
    ));

  // Handle updates of searchResults
  this.searchResults.subscribe((newValue) => {
    // If the active Item is not in the search results, reset it
    if (this.activeItem() && $.inArray(this.activeItem(), newValue) === -1) {
      this.clearActive();
    }
    // Display markers if they are in the new results
    stations.forEach((station) => {
      if ($.inArray(station, newValue) === -1) {
        station.hideFromMap();
      } else {
        station.showOnMap();
      }
    });
  });

  // [Cosmetic DOM manipulation]
  // Switch to first tab of info
  this.resetTab = () => {
    $('a[href="#departure-board"]').tab('show');
  };

  // Active item tracking
  this.makeActive = (station) => {
    this.activeItem(station);
    if (this.displayMode() === DESKTOP) {
      this.openInfoWindow();
    }
    this.purgeData();
    this.resetTab();
    this.infoContent.routePlannerOrigin(station.name);
    this.state(States.ItemSelected);
    this.stationInfo.fetch(station);
    this.scrollToElement(station);
  };

  this.clearActive = () => {
    this.purgeData();
    this.resetTab();
    this.activeItem(null);
    if (this.displayMode() === DESKTOP) {
      console.log('clear active > close iw');
      this.closeInfoWindow();
    }
  };

  // Change highlight status on map
  this.activeItem.subscribe(
    (oldStation) => {
      if (oldStation) {
        oldStation.toggleHighlight(false);
      }
    },
    null,
    'beforeChange',
  );

  this.activeItem.subscribe((newStation) => {
    if (newStation) {
      newStation.toggleHighlight(true);
    }
  });

  this.switchInputs = () => {
    const tmp = this.infoContent.routePlannerOrigin();
    this.infoContent.routePlannerOrigin(this.infoContent.routePlannerDestination());
    this.infoContent.routePlannerDestination(tmp);
  };

  // Fetch route
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

  this.clearTripResults = () => {
    this.infoContent.trips([]);
  };

  this.constructTripTitle = (trip) => {
    const arrow = '<span class="glyphicon glyphicon-chevron-right trip-chevron"></span>';
    return `${trip.legs[0].departure} - ${trip.legs.slice(-1)[0].arrival}
      <span class="pull-right">${trip.duration}</span><br>
      ${trip.legs
    .map((leg, index) => `${index > 0 ? arrow : ''}${this.createBadge(leg.type)}`)
    .join('')}`;
  };

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

  // Scroll animation
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

  // Converts rating to glyphicons
  // For example 4 -> ★★★★☆
  this.starRating = (rating) => {
    const star = '<span class="glyphicon glyphicon-star"></span>';
    const starEmpty = '<span class="glyphicon glyphicon-star-empty"></span>';
    return `${star.repeat(rating)}${starEmpty.repeat(5 - rating)}`;
  };

  // Returns the stations id (for traffic services)
  this.getStationId = (stationName) => {
    // TODO: If multiple matches for /stationName/i are found, ask user to choose
    const result = this.stations.find(station => stationName.toLowerCase() === station.name.toLowerCase());
    return result ? result.hafasId : null;
  };

  // Changes the internal google info window representation to make it look sleeker
  this.setInfoStyles = () => {
    // Adapted from http://en.marnoto.com/2014/09/5-formas-de-personalizar-infowindow.html
    // WARNING: Relying on inner working of Maps API. May stop working with newer versions.

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
    iwCloseBtn.mouseout(function () {
      $(this).css({ opacity: '1' });
    });
  };

  // Gets called from index.js when map is initialized
  // TODO: Try using promises
  callbackRegister.onMapLoaded = (map) => {
    stations.forEach((station) => {
      station.registerClickHandler(() => this.makeActive(station));
    });
    this.stations = stations;
    this.map = map;
    // Setting content to ensure DOM structure gets fully built as expected
    this.infowindow = new google.maps.InfoWindow({ content: '<div id="iw-anchor"></div>' });
    google.maps.event.addListener(this.infowindow, 'domready', this.setInfoStyles);
    this.windowWidth($(window).width());
  };
};

export default NeighborhoodMapViewModel;
