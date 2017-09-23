import mapStyles from './mapStyles';

const initMap = (onMapLoaded, onError = null) => {
  // Expose the callback globally by binding them to window
  // Google maps callback, gets called once loaded
  window.initMap = () => {
    const map = new google.maps.Map(document.getElementById('map'), {
      center: { lat: 50.110924, lng: 8.682127 },
      zoom: 14,
      styles: mapStyles,
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
    onMapLoaded(map);
  };

  // Bound to script tag onerror
  window.handleMapError = (err) => {
    onError(err);
  };
};

export default initMap;
