import ko from 'knockout';
import moment from 'moment';
import 'bootstrap-timepicker';

// Adds timeValue binding for use with bootstrap-timepicker
// See http://jdewit.github.io/bootstrap-timepicker/index.html
ko.bindingHandlers.timeValue = {
  init(element, valueAccessor) {
    const options = {
      showMeridian: false,
      maxHours: 24,
    };
    // Initialize timepicker
    const tpicker = $(element).timepicker(options);
    // Update observable when element changes
    tpicker.on('changeTime.timepicker', (e) => {
      const value = valueAccessor();
      if (!value) {
        throw new Error('timeValue binding observable not found');
      }
      const date = ko.unwrap(value);
      const mdate = moment(date || new Date());
      // Get hours and minutes from timepicker element
      mdate.hours(e.time.hours);
      mdate.minutes(e.time.minutes);
      // Update value of observable
      value(mdate.toDate());
    });
  },
  // Update timepicker when observable changes
  update(element, valueAccessor) {
    const date = ko.unwrap(valueAccessor());

    if (date) {
      // Try to parse observable value in desired format
      const time = moment(date).format('HH:mm');
      // Update timepicker element
      $(element).timepicker('setTime', time);
    }
  },
};

// Adds binding for tabbed navigation for bootstrap
// Note that this is not universal, as I didn't make the effort to support data-target as well as href
ko.bindingHandlers.activeTab = {
  // I am ignoring the initial value of the observable, because I don't need that functionality
  init(element, valueAccessor) {
    const tabs = $(element).children('li');
    tabs.on('show.bs.tab', (e) => {
      const value = valueAccessor();
      // Retrieve the target tab name
      const newTab = $(e.target)
        .attr('href')
        .replace(/^#/, ''); // Strip leading #
      value(newTab);
    });
  },
  // Change tab when observable changes
  update(element, valueAccessor) {
    // Get id from observable
    const newTabId = ko.unwrap(valueAccessor());
    // Select tab with the right id and display it
    $(`a[href="#${newTabId}"]`).tab('show');
  },
};

ko.unwrap = ko.unwrap || ko.utils.unwrapObservable;
