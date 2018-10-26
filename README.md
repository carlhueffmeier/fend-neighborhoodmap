# Frankfurt Subway Map

<p align="center">
<img width="600" src="https://user-images.githubusercontent.com/27681148/47577336-ece26c00-d946-11e8-8aa3-61d3d4acb5ea.png" alt="Main map screen">
</p>

This project displays bus, tram and subway stations in Frankfurt, Germany. It allows the user to see detail information about the stations, view next departures and plan routes.
This was my first application using a frontend framework and (looking back at it) let me say the code is horrible. It is the first time I experienced the pain of not knowing how to structure a slightly more complex application and, let me tell you, I learnt _a lot_.

Still being amazed, this bunch of Spaghetti actually works. 🍝

# Features

- Filter station by name
- View place information (Google Places API)
- Show next departures
- Plan a route (RMV local traffic API)
- Fully responsive design

# Showcase

<center>
  <table>
    <tr>
      <td><img width="100" alt="Group View (light theme)" src="https://user-images.githubusercontent.com/27681148/47578195-0c7a9400-d949-11e8-879d-add8d1d0e8c4.png"></td>
      <td><img width="300" alt="Group View (dark theme)" src="https://user-images.githubusercontent.com/27681148/47578235-2fa54380-d949-11e8-9a81-ce239ad587d5.png"></td>
    </tr>
  </table>
</center>

# Get started

1. Clone the repository

```sh
> git clone https://github.com/carlhueffmeier/raven-notes.git
```

2. Install dependencies

```sh
> npm install
```

3. Run the project

```sh
> npm start
```

4. Open up [http://localhost:8080](http://localhost:8080)

# Attribution

Map and places info provided by [Google](https://developers.google.com/maps/documentation/javascript/?hl=en).

Station information kindly provided by Frankfurt local traffic provider [RMV](https://opendata.rmv.de/site/start.html).
