import Console from './Console';

// TODO: What is the best practice on sharing properties between all class instances?
let PlacesService = null;

// TODO: Interface might be cleaner when returning a promise instead
class GooglePlacesRequest {
  // Usage
  // -----
  // const places_request = new GooglePlacesRequest(request, onSuccess, onError);
  // request: valid parameters include name, radius, type, query, location
  // (see Google documentation for details)
  // onSuccess: callback is given result as parameter
  // onError: error handler is given status as parameter
  constructor(request, onSuccess, onError) {
    // Google needs a node to show attributions, no need to make map object available here
    if (!PlacesService) {
      PlacesService = new google.maps.places.PlacesService(
        document.getElementById('attribution')
      );
    }
    const defaults = {
      radius: 100,
      type: 'transit_station',
    };
    this.request = { ...defaults, ...request };
    Console('[GooglePlacesRequest] Initialized. My request: ', this.request);
    this.onSuccess = onSuccess;
    this.onError = onError;
    this.requestCount = 0;
    if (!this.request.query) {
      Console('Warning: Google Places request without query.');
    }
  }

  // Kicks off the request
  start() {
    this.requestCount += 1;
    PlacesService.textSearch(this.request, this.textSearchCallback.bind(this));
  }

  // Prevents changes after response becomes irrelevant
  discard() {
    this.onSuccess = () => {};
    this.onSuccess = () => {};
  }

  textSearchCallback(results, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      this.handleTextSearchResponse(results);
    } else if (
      status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS &&
      this.requestCount === 1
    ) {
      this.startSecondRequest();
    } else {
      Console('[GooglePlacesRequest] Error on places request: ', status);
      this.onError(status);
    }
  }

  handleTextSearchResponse(results) {
    const place = this.choosePlace(results);
    if (place) {
      PlacesService.getDetails(place, this.handleDetailsResponse.bind(this));
    } else if (this.requestCount === 1) {
      // If no fitting data is found, try another time with different search parameters
      this.startSecondRequest();
    } else {
      Console('[GooglePlacesRequest] No place found.');
      this.onError('No place found.');
    }
  }

  // Places results are really fuzzy, this function chooses the best candidate
  // Or returns null if no suitable data was found
  choosePlace(places) {
    const stationName = this.request.query;
    // First get rid of all places which names don't match
    let results = places.filter(
      place =>
        place.name.match(`/^${stationName}/`) ||
        stationName.indexOf(
          place.name.replace(/\w+\s?\(\w+\)\s?(\w+)/, '$1')
        ) >= 0
    );
    // Next expose of the results without any relevant info
    results = results.filter(
      place => place.rating || place.review || place.photos
    );
    return results.length > 0 ? results[0] : null;
  }

  startSecondRequest() {
    Console('[GooglePlacesRequest] Place not found, starting second request.');
    this.request.type = 'point_of_interest';
    this.start();
  }

  handleDetailsResponse(place, status) {
    if (status === google.maps.places.PlacesServiceStatus.OK) {
      this.processPlacesResults(place);
    } else {
      Console('[GooglePlacesRequest] Got an error: ', status);
      this.onerror(status);
    }
  }

  processPlacesResults(place) {
    const results = {};
    Console('[GooglePlacesRequest] This is the response I got: ', place);
    results.rating = place.rating;
    if (place.photos) {
      results.thumbnail = place.photos[0].getUrl({
        maxWidth: 200,
        maxHeight: 200,
      });
    }
    if (place.reviews) {
      results.reviews = [];
      place.reviews.forEach(review => {
        results.reviews.push({
          author: review.author_name,
          body: review.text,
          language: review.language,
          rating: review.rating,
        });
      });
    }
    Console('[GooglePlacesRequest] These are my results: ', results);
    this.onSuccess(results);
  }
}

export default GooglePlacesRequest;
