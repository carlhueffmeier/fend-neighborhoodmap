import MapStyles from './MapStyles';

// Returns a promise that is resolved when map is loaded
// resolve: gets map object
// reject: gets error string

const initMap = () =>
  new Promise((resolve, reject) => {
    // Creating callback for Google Maps in the global namespace
    window.initMap = () => {
      const map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 50.110924, lng: 8.682127 },
        zoom: 14,
        styles: MapStyles,
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_CENTER,
        },
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.LEFT_CENTER,
        },
        scaleControl: true,
        streetViewControl: true,
        streetViewControlOptions: {
          position: google.maps.ControlPosition.LEFT_TOP,
        },
        fullscreenControl: true,
      });
      resolve(map);
    };
    // This function is called by the 'onerror' handler of the script tag
    // TODO: Does onerror pass a value?
    window.handleMapError = (err) => {
      reject(err);
    };
  });

export default initMap;
