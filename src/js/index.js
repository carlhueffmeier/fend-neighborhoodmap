import ko from 'knockout';
import NeighborhoodMapViewModel from './NeighborhoodMapViewModel';
import initMap from './initMap';
import StationData from './StationData';
import Station from './Station';
import Console from './Console';
import '../css/styles.css';

// [Webpack] Require our html file
require('file-loader?name=[name].[ext]!../index.html');

// Initialize stations with basic information
// TODO: Maybe it would make sense to store this in a database
const stations = StationData.map(stationData => new Station(stationData));

// Resolves when map is loaded
const promise = new Promise((resolve, reject) => {
  // Creates callbacks for google maps
  initMap()
    .then((map) => {
      stations.forEach(station => station.setMap(map));
      resolve({ map, stations });
    })
    .catch(() => {
      const errorMessage = 'Could not load Google Maps';
      Console(`[index] ${errorMessage}`);
      reject(Error(errorMessage));
    });
});

// Apply Knockout view model
ko.applyBindings(new NeighborhoodMapViewModel(promise));
