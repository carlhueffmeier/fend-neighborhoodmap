# FND: Neighborhood Map

This is the Neighborhood Map project of the [Udacity Frontend Nanodegree](
https://www.udacity.com/course/front-end-web-developer-nanodegree--nd001).
It is a local traffic map showing bus, tram and subway stations in Frankfurt, Germany.

See the [project rubric](https://review.udacity.com/#!/rubrics/17/view) for detailed project requirements.

## Features
- Filter station by name
- View place information
- Show next departures
- Plan a route

## Getting Started
1. Install [npm](https://www.npmjs.com/get-npm)
2. Install [Git](https://git-scm.com/downloads)
3. Open a terminal and change to the location you want to save the application folder to
4. Enter `git clone https://github.com/carlhueffmeier/fend-neighborhoodmap.git` to download the project directory
5. Enter `cd fend-neighborhoodmap` to open the project directory
6. Enter `npm install` to install all requirements
8. Enter `npm start` to launch the server
9. Browse to `localhost:8080` in your web browser
10. Enjoy

## Future Versions
Bundle size is really big, in part due to my Webpack trouble.
But in this case it might make sense to set up a simple Node server to handle the API requests and also store the station data.

## Issues
### Webpack Configuration
- Hot reloading does not work.
- Separating vendor and application code into chunks did not work out.
Part of the issue is, that I am not able to configure Webpack to put my script tags before Google Maps script tag.

## Attribution
Map and places info provided by [Google](https://developers.google.com/maps/documentation/javascript/?hl=en).

Station information provided by Frankfurt local traffic provider [RMV](https://opendata.rmv.de/site/start.html).