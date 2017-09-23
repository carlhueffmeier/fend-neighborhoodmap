import ko from 'knockout';
import NeighborhoodMapViewModel from './NeighborhoodMapViewModel';
import initMap from './initMap';
import mapData from './mapData';
import Station from './Station';
import Console from './Console';
import '../css/styles.css';

// [Webpack] Require our html file
require('file-loader?name=[name].[ext]!../index.html');

const stations = mapData.map(stationData => new Station(stationData));

const callbackRegister = {
  onMapLoaded: null,
};

const handleMapLoaded = (map) => {
  stations.forEach(station => station.setMap(map));
  if (callbackRegister.onMapLoaded) {
    callbackRegister.onMapLoaded();
  } else {
    console.log(
      'View model callback is ',
      callbackRegister.onMapLoaded,
      '. This should not happen.',
    );
  }
};

const handleMapError = (err) => {
  console.log('Error loading Google maps: ', err);
  // TODO: Regression
};

// Create callbacks for google maps
initMap(handleMapLoaded, handleMapError);

// Apply Knockout view model
ko.applyBindings(new NeighborhoodMapViewModel(stations, callbackRegister));
