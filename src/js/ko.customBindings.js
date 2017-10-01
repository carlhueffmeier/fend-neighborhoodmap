import ko from 'knockout';
import moment from 'moment';
import 'bootstrap-timepicker';

// Adds timeValue binding for use with bootstrap-timepicker
// See http://jdewit.github.io/bootstrap-timepicker/index.html
ko.bindingHandlers.timeValue = {
  init(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
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
  update(element, valueAccessor, allBindings, viewModel, bindingContext) {
    const date = ko.unwrap(valueAccessor());

    if (date) {
      // Try to parse observable value in desired format
      const time = moment(date).format('HH:mm');
      // Update timepicker element
      $(element).timepicker('setTime', time);
    }
  },
};

ko.unwrap = ko.unwrap || ko.utils.unwrapObservable;
