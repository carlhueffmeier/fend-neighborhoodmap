import 'jquery';
import Console from './Console';

const baseURL = 'https://www.rmv.de/hapi/';
// TODO: Store API key in separate json file
const baseParameter = {
  accessId: 'b73b4c0a-3fda-46e2-803a-46c4ad8cda0c',
  format: 'json',
  jsonpCallback: 'jsonpCallback',
};

const getUrl = (service, inquiryParameter) => {
  const params = $.extend({}, baseParameter, inquiryParameter);
  return `${baseURL}${service}?${$.param(params)}`;
};

const ajax = (url, callback, errorHandler = null) => {
  $.ajax({
    url,
    method: 'GET',
    dataType: 'jsonp',
    jsonp: 'jsonpCallback',
  })
    .done(callback)
    .fail((err) => {
      const errorMessage = `Error on AJAX request: ${err.status}`;
      Console(`[TrafficService] ${errorMessage}`);
      if (errorHandler) {
        errorHandler(errorMessage);
      }
    });
};

// Helper functions to format data
const prettyPrintTime = time => time.replace(/(\d\d:\d\d):\d\d/, '$1');

const abbreviateStationName = name => name.replace(/^\s*Frankfurt \(Main\)\s*/, '');

const prettyPrintDuration = (duration) => {
  // TODO: Pretty sure this can be done in a single regex
  let str = '';
  const hours = duration.match(/(\d+)H/);
  const minutes = duration.match(/(\d+)M/);
  if (hours) {
    str += `${hours[1]}h`;
  }
  if (minutes) {
    str += `${minutes[1]}m`;
  }
  return str;
};

// Wrapper for callback, making the results more usable
const handleDepartureResponse = (callback, errorHandler) => (result) => {
  if (!result.Departure) {
    const errorMessage = `Received strange results: ${result}`;
    Console(`[TrafficService] ${errorMessage}`);
    return errorHandler(errorMessage);
  }
  return callback(result.Departure.map(connection => ({
    line: connection.name,
    direction: abbreviateStationName(connection.direction),
    departure: prettyPrintTime(connection.time),
  })));
};

const handleRouteResponse = (callback, errorHandler) => (result) => {
  if (!result.Trip) {
    const errorMessage = `Received strange results: ${result}`;
    Console(`[TrafficService] ${errorMessage}`);
    return errorHandler(errorMessage);
  }
  return callback(result.Trip.map(trip => ({
    duration: prettyPrintDuration(trip.duration),
    legs: trip.LegList.Leg.map(leg => ({
      origin: abbreviateStationName(leg.Origin.name),
      destination: abbreviateStationName(leg.Destination.name),
      direction: leg.direction ? abbreviateStationName(leg.direction) : '',
      departure: prettyPrintTime(leg.Origin.time),
      arrival: prettyPrintTime(leg.Destination.time),
      type: (leg.name || leg.type).trim(),
    })),
  })));
};

const TrafficService = {
  getDepartureBoard(hafasId, callback, errorHandler = null) {
    const url = getUrl('departureBoard', {
      id: hafasId,
      maxJourneys: 10,
    });
    ajax(url, handleDepartureResponse(callback, errorHandler), errorHandler);
  },
  getRoute(request, callback, errorHandler) {
    const url = getUrl('trip', request);
    ajax(url, handleRouteResponse(callback, errorHandler), errorHandler);
  },
};

export default TrafficService;
