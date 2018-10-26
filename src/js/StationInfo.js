import TrafficService from './TrafficService';
import GooglePlacesRequest from './GooglePlacesRequest';
import StatusCodes from './StatusCodes';

// There is only one instance of StationInfo that is initialized with
// the update() function. we only need to call fetch(station) to get
// all station information
class StationInfo {
  // Gets initialized with update(newData) callback
  // newData is an object with key: value pairs
  constructor(update) {
    this.update = update;
    this.placesRequest = null;
  }

  // Fetch all data for that station
  fetch(station) {
    this.basicInfo(station);
    this.startPlacesRequest(station);
    this.startDepartureRequest(station);
  }

  // We can update name and district immediately
  basicInfo(station) {
    this.update({
      name: station.name,
      district: station.district,
    });
  }

  //
  // GooglePlaces
  handlePlacesError(err) {
    this.setStatus({
      places: StatusCodes.ERROR,
      places_message: err,
    });
  }

  handlePlacesSuccess(result) {
    this.update(result);
    this.setStatus({ places: StatusCodes.OK });
  }

  // Kick off GooglePlaces request
  startPlacesRequest(station) {
    const request = {
      query: station.name,
      location: station.location,
    };
    if (this.placesRequest) {
      this.placesRequest.discard();
    }
    this.placesRequest = new GooglePlacesRequest(
      request,
      this.handlePlacesSuccess.bind(this),
      this.handlePlacesError.bind(this)
    );
    this.placesRequest.start();
  }

  //
  // Departure Info
  handleDepartureError(err) {
    this.setStatus({
      departure: StatusCodes.ERROR,
      departure_message: err,
    });
  }

  handleDepartureSuccess(departures) {
    this.update({ departures });
    this.setStatus({ departure: StatusCodes.OK });
  }

  // Start request to fetch departure board data
  startDepartureRequest(station) {
    this.setStatus({ departure: StatusCodes.FETCHING });
    TrafficService.getDepartureBoard(
      station.hafasId,
      this.handleDepartureSuccess.bind(this),
      this.handleDepartureError.bind(this)
    );
  }

  //
  // Route
  handleRouteError(err) {
    this.setStatus({
      route: StatusCodes.ERROR,
      route_message: err,
    });
  }

  handleRouteSuccess(result) {
    this.update({ trips: result });
    this.setStatus({ route: StatusCodes.OK });
  }

  // Start request to fetch departure board data
  fetchRoute(request) {
    this.setStatus({ route: StatusCodes.FETCHING });
    TrafficService.getRoute(
      request,
      this.handleRouteSuccess.bind(this),
      this.handleRouteError.bind(this)
    );
  }

  //
  // Helper function
  setStatus(status) {
    this.update({
      status: { ...status },
    });
  }
}

export default StationInfo;
