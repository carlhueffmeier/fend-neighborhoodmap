import ko from 'knockout';
import moment from 'moment';
import './ko.customBindings';
import StationInfo from './StationInfo';
import StatusCodes from './StatusCodes';
import Console from './Console';
import placeholderImg from '../icons/ic_train_thumbnail.svg';

// Our view model expects a promise that resolves with { map, stations }
// when GoogleMaps finishes loading
const NeighborhoodMapViewModel = function NeighborhoodMapViewModel(mapLoading) {
  // Shows status of critical dependencies
  this.appStatus = ko.observable(StatusCodes.FETCHING);
  this.appStatusMessage = ko.observable('');
  // map, infowindow, stations are set when mapLoading resolves
  this.map = null;
  this.stations = ko.observable([]);
  this.windowWidth = ko.observable();
  // Manage the different views for info and list
  this.infoStyles = ko.observable('info-hidden');
  this.stationListStyles = ko.observable('station-list-hidden');
  // This is the currently selected station
  this.activeItem = ko.observable(null);
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

  // Set station information to default values
  this.purgeData = () => {
    this.infoContent.thumbnail(placeholderImg);
    this.infoContent.name('');
    this.infoContent.district('');
    this.infoContent.departures([]);
    this.infoContent.rating('');
    this.infoContent.reviews([]);
    this.infoContent.routePlannerTime(new Date());
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

  // Input validation for route form
  this.infoContent.routePlannerOriginId = ko.pureComputed(() =>
    this.getStationId(this.infoContent.routePlannerOrigin()));

  this.infoContent.routePlannerDestinationId = ko.pureComputed(() =>
    this.getStationId(this.infoContent.routePlannerDestination()));

  // Input validation for route form
  this.infoContent.routePlannerOriginValid = ko.pureComputed(() => this.infoContent.routePlannerOriginId() !== null);

  this.infoContent.routePlannerDestinationValid = ko.pureComputed(() => this.infoContent.routePlannerDestinationId() !== null);

  this.infoContent.routePlannerAllValid = ko.pureComputed(() =>
    this.infoContent.routePlannerOriginValid() && this.infoContent.routePlannerDestinationValid());

  // Add styles to route planner "go" button
  this.routePlannerGoButtonStyle = ko.pureComputed(() => {
    if (this.infoContent.status.route() === StatusCodes.OK && this.infoContent.trips.length > 0) {
      return 'route-go-btn-success';
    } else if (this.infoContent.status.route() === StatusCodes.FETCHING) {
      return 'route-go-btn-fetching';
    } else if (this.infoContent.status.route() === StatusCodes.ERROR) {
      return 'route-go-btn-error';
    }
    return '';
  });

  this.toggleButtonStyles = ko.pureComputed(() => {
    const styles = [];
    // User can't navigate to info when there is no station selected
    // Hide the button on medium or large devices
    if (this.activeItem() === null) {
      styles.push('toggle-btn-hidden-md-up');
    }
    // Rotate the button for a more intuitive feel
    if (this.stationListStyles() === 'station-list-visible') {
      styles.push('toggle-btn-close-list');
    } else if (this.infoStyles() === 'info-full') {
      styles.push('toggle-btn-close-info');
    }
    return styles.join(' ');
  });

  // Toggle button inside search field
  // Behaviour depends on current state, made obvious through different css styles
  this.onToggle = () => {
    if (this.infoStyles() === 'info-full') {
      this.infoStyles('info-mini');
    } else if (this.stationListStyles() === 'station-list-hidden') {
      this.infoStyles('info-hidden');
      this.stationListStyles('station-list-visible');
    } else if (this.stationListStyles() === 'station-list-visible') {
      this.stationListStyles('station-list-hidden');
      if (this.activeItem()) {
        this.infoStyles('info-mini');
      }
    }
  };

  // Cancel ⓧ button inside search field
  this.onCancel = () => {
    // Show station list
    this.infoStyles('info-hidden');
    this.stationListStyles('station-list-visible');
    // Empty and focus search
    this.searchTerm('');
    this.searchFocus(true);
  };

  // Maximize the station info when header is clicked
  this.onInfoHeaderClick = () => {
    if (this.infoStyles() === 'info-mini') {
      this.infoStyles('info-full');
    }
  };

  // Show station list when user begins typing
  this.searchTerm.subscribe((newValue) => {
    if (newValue.length > 0) {
      this.infoStyles('info-hidden');
      this.stationListStyles('station-list-visible');
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
    ko.utils
      .arrayFilter(
        this.stations(),
        station => station.name.toLowerCase().indexOf(this.searchTerm().toLowerCase()) !== -1,
      )
      .sort((a, b) => a.name.localeCompare(b.name)));

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
    $('a[href="#departures"]').tab('show');
  };

  // Select a new station and display its info to the user
  this.makeActive = (station) => {
    this.purgeData();
    this.resetTab();
    this.activeItem(station);
    // Set the 'From' field to this station
    this.infoContent.routePlannerOrigin(station.name);
    this.stationListStyles('station-list-hidden');
    this.infoStyles('info-mini');
    this.stationInfo.fetch(station);
    this.scrollToElement(station);
  };

  this.clearActive = () => {
    this.purgeData();
    this.resetTab();
    this.activeItem(null);
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
    const time = this.infoContent.routePlannerTime();
    const timeMode = this.infoContent.routePlannerTimeMode() === 'departure' ? 0 : 1;
    this.stationInfo.fetchRoute({
      originId: this.infoContent.routePlannerOriginId(),
      destId: this.infoContent.routePlannerDestinationId(),
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

  // This promise gets resolved once our map is ready
  mapLoading
    .then(({ map, stations }) => {
      // Select station when marker is clicked
      stations.forEach((station) => {
        station.registerClickHandler(() => this.makeActive(station));
      });
      this.stations(stations);
      this.map = map;
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
