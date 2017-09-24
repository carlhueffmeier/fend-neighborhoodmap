import stationIcon from '../icons/ic_train.svg';
import stationIconHighlight from '../icons/ic_train-highlight.svg';

const defaultIcon = () => ({
  url: stationIcon,
  scaledSize: new google.maps.Size(24, 24),
  origin: new google.maps.Point(0, 0),
  anchor: new google.maps.Point(12, 20),
});

const highlightedIcon = () => ({
  url: stationIconHighlight,
  scaledSize: new google.maps.Size(32, 32),
  origin: new google.maps.Point(0, 0),
  anchor: new google.maps.Point(16, 27),
});

class Station {
  constructor(props) {
    this.hafasId = props.hafasId;
    this.rmvId = props.rmvId;
    this.name = props.name;
    this.longName = props.longName;
    this.district = props.district;
    this.location = { lat: parseFloat(props.lat), lng: parseFloat(props.lng) };
    this.marker = null;
  }

  setMap(map) {
    this.marker = new google.maps.Marker({
      map,
      icon: defaultIcon(),
      position: this.location,
      title: this.name,
    });
  }

  toggleHighlight(condition) {
    if (condition === true) {
      // map.setCenter(this.marker.getPosition());
      this.marker.setIcon(highlightedIcon());
      this.marker.setZIndex(1000);
    } else {
      this.marker.setIcon(defaultIcon());
      this.marker.setZIndex(100);
    }
  }

  showOnMap() {
    this.marker.setVisible(true);
  }

  hideFromMap() {
    this.marker.setVisible(false);
  }

  registerClickHandler(callback) {
    this.marker.addListener('click', callback);
  }
}

export default Station;
