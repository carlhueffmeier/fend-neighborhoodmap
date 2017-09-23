import TrafficService from './TrafficService';
import GooglePlacesRequest from './GooglePlacesRequest';
import StatusCodes from './StatusCodes';

class StationInfo {
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
  // Google Places
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

  // Get Google Places info
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
      this.handlePlacesError.bind(this),
    );
    this.placesRequest.start();
  }

  //
  // Departures
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
      this.handleDepartureError.bind(this),
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
    console.log(result);
    this.update({ trips: result });
    this.setStatus({ route: StatusCodes.OK });
  }

  // Start request to fetch departure board data
  fetchRoute(request) {
    console.log(request);
    this.setStatus({ route: StatusCodes.FETCHING });
    TrafficService.getRoute(
      request,
      this.handleRouteSuccess.bind(this),
      this.handleRouteError.bind(this),
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
