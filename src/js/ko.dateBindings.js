import ko from 'knockout';
import moment from 'moment';
import 'bootstrap-timepicker';

// https://github.com/hugozap/knockoutjs-date-bindings
// The MIT License (MIT)
// Copyright (c) 2013 Hugo Zapata
// (Slightly adapted for my use case)

/* Adds the binding dateValue to use with bootstrap-datepicker
   Usage :
   <input type="text" data-bind="dateValue:birthday"/>
   <input type="text" data-bind="dateValue:birthday,format='MM/DD/YYY'"/>
*/
ko.bindingHandlers.dateValue = {
  init(element, valueAccessor, allBindings) {
    let format;
    const defaultFormat = 'yyyy/mm/dd';
    if (typeof allBindings === 'function') {
      format = allBindings().format || defaultFormat;
    } else format = allBindings.get('format') || defaultFormat;

    const dpicker = $(element)
      .datepicker({
        format,
      })
      .on('changeDate', (ev) => {
        const newDate = moment(new Date(ev.date));
        const value = valueAccessor();
        const currentDate = moment(value() || new Date());
        newDate.hour(currentDate.hour());
        newDate.minute(currentDate.minute());
        newDate.second(currentDate.second());
        value(newDate.toDate());
      });
  },
  update(element, valueAccessor, allBindingsAccessor) {
    const date = ko.unwrap(valueAccessor());
    if (date) {
      $(element).datepicker('setDate', date);
    }
  },
};

/* Adds the binding timeValue to use with bootstrap-timepicker
   This works with the http://jdewit.github.io/bootstrap-timepicker/index.html
   component.
   Use: use with an input, make sure to use your input with this format
   <div class="bootstrap-timepicker pull-right">
       <input id="timepicker3" type="text" class="input-small">
   </div>
*/
ko.bindingHandlers.timeValue = {
  init(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
    const options = {
      showMeridian: false,
      maxHours: 24,
    };
    const tpicker = $(element).timepicker(options);
    tpicker.on('changeTime.timepicker', (e) => {
      // Asignar la hora y los minutos
      const value = valueAccessor();
      if (!value) {
        throw new Error('timeValue binding observable not found');
      }
      const date = ko.unwrap(value);
      const mdate = moment(date || new Date());
      $(element).data('updating', true);
      value(mdate.toDate());
      $(element).data('updating', false);
      $(element)
        .timepicker()
        .on('show.timepicker', (e) => {
          console.log(`The time is ${e.time.value}`);
          console.log(`The hour is ${e.time.hours}`);
          console.log(`The minute is ${e.time.minutes}`);
          console.log(`The meridian is ${e.time.meridian}`);
        });
    });
  },
  update(element, valueAccessor, allBindings, viewModel, bindingContext) {
    // Avoid recursive calls
    if ($(element).data('updating')) {
      return;
    }
    const date = ko.unwrap(valueAccessor());

    if (date) {
      const time = moment(date).format('HH:mm');
      $(element).timepicker('setTime', time);
    }
  },
};

ko.unwrap = ko.unwrap || ko.utils.unwrapObservable;
