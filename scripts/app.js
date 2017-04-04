// Copyright 2016 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


(function() {
  'use strict';

  var app = {
    isLoading: true,
    visibleCards: {},
    selectedCities: [],
    spinner: document.querySelector('.loader'),
    cardTemplate: document.querySelector('.cardTemplate'),
    container: document.querySelector('.main'),
    addDialog: document.querySelector('.dialog-container'),
    authorizeButton: document.getElementById('authorize-button'),
    signoutButton: document.getElementById('signout-button'),
    googleApi: document.getElementById('google-api'),
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    // Client ID and API key from the Developer Console.
    clientId: config.CLIENT_ID,
    // Array of API discovery doc URLs for APIs used by the quickstart.
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
                    "https://www.googleapis.com/discovery/v1/apis/admin/directory_v1/rest"],
    // Authorization scopes required by the API; multiple scopes can be
    // included, separated by spaces.
    scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/admin.directory.resource.calendar"
  };


  /*****************************************************************************
   *
   * Event listeners for UI elements
   *
   ****************************************************************************/

  app.googleApi.addEventListener('load', function() {
      app.googleApi.onload=function(){};
      app.handleClientLoad();
  });

  app.googleApi.addEventListener('readystatechange', function() {
      if (app.googleApi.readyState === 'complete') {
          app.googleApi.onload();
      }
  });

  app.authorizeButton.addEventListener('click', function(event) {
      app.handleAuthClick(event);
  });

  app.signoutButton.addEventListener('click', function(event) {
      app.handleSignoutClick(event);
  });

  document.getElementById('butRefresh').addEventListener('click', function() {
    // Refresh all of the forecasts
    app.updateForecasts();
  });


  /*****************************************************************************
   *
   * Methods to update/refresh the UI
   *
   ****************************************************************************/

   app.bookRoom = function(resourceId) {
       var now = new Date();
       var halfHourFromNow = new Date(now.getTime() + 30*60000);
       var event = {
         'summary': 'My Booked Room',
         'description': 'An event booked through the meeting room service',
         'start': {
           'dateTime': now,
           'timeZone': 'America/New_York',
         },
         'end': {
           'dateTime': halfHourFromNow,
           'timeZone': 'America/New_York',
         },
         'attendees': [
           {
               'resource': true,
               'email': resourceId
           },
         ]
       };
       gapi.client.calendar.events.insert({
           calendarId: 'primary',
           resource: event,
       }).then(function(response) {
           appendPre('Event created: ' + response.htmlLink);
       });
   };

  app.updateResourceCard = function(resource) {
    var resourceId = resource.resourceId;
    var resourceEmail = resource.resourceEmail;
    var resourceName = resource.resourceName;
    var resourceDescription = resource.resourceDescription;
    var resourceType = resource.resourceType;

    var card = app.visibleCards[resourceId];
    if (!card) {
      card = app.cardTemplate.cloneNode(true);
      card.classList.remove('cardTemplate');
      card.removeAttribute('hidden');
      app.container.appendChild(card);
      app.visibleCards[resourceId] = card;
    }

    card.querySelector('.location').textContent = resourceName;
    card.querySelector('.type').textContent = resourceType;
    card.querySelector('.description').textContent = resourceDescription;
    card.querySelector(".reserve-room-button").addEventListener('click', function() {
      app.bookRoom(resourceEmail);
    });
    if (app.isLoading) {
      app.spinner.setAttribute('hidden', true);
      app.container.removeAttribute('hidden');
      app.isLoading = false;
    }
  };

  /*****************************************************************************
   *
   * Methods for dealing with the model
   *
   ****************************************************************************/

   /**
   * Print the summary and start datetime/date of the next ten events in
   * the authorized user's calendar. If no events are found an
   * appropriate message is printed.
   */
   app.listUpcomingEvents = function() {
       gapi.client.calendar.events.list({
         'calendarId': 'primary',
         'timeMin': (new Date()).toISOString(),
         'showDeleted': false,
         'singleEvents': true,
         'maxResults': 10,
         'orderBy': 'startTime'
       }).then(function(response) {
         var events = response.result.items;
         console.log('Upcoming events:');

         if (events.length > 0) {
           for (var i = 0; i < events.length; i++) {
             var event = events[i];
             var when = event.start.dateTime;
             if (!when) {
               when = event.start.date;
             }
             console.log(event.summary + ' (' + when + ')')
           }
         } else {
           console.log('No upcoming events found.');
         }
       })
   };

   app.groupBy = function(xs, key) {
     return xs.reduce(function(rv, x) {
       (rv[x[key]] = rv[x[key]] || []).push(x);
       return rv;
     }, {});
   };

   app.getResourceIds = function(resources) {
     var items = [];
     for (var r in resources) {
       if (resources[r].resourceEmail) {
         var resource = { 'id' : resources[r].resourceEmail };
         items.push(resource)
       }
     }

     return items;
   }

   app.availableResources = function(resources, timeMin, timeMax) {
       var resourceIds = app.getResourceIds(resources);

       resources.forEach(function(r) {
           app.updateResourceCard(r);
       });
       gapi.client.calendar.freebusy.query({
         'items': resourceIds,
         'timeMin': timeMin,
         'timeMax': timeMax
       }).then(function(response) {
         var calendars = response.result.calendars;
         console.log('Available rooms from:' + timeMin + ' to ' + timeMax);

         if (calendars) {
           for (var r in calendars) {
             var resource = calendars[r];
             var busy = resource.busy;
             var errors = resource.errors;
             if (!errors && busy && busy.length === 0) {
               console.log(r);
             }
           }
         } else {
           console.log('No upcoming events found.');
         }
       })
   };

   app.getResources = function() {
       gapi.client.directory.resources.calendars.list({
         'customer': 'my_customer',
         'maxResults': 50
       }).then(function(response) {
         var resources = response.result.items;
         var filteredResources = resources.filter(filterResources);
         console.log('Resources:');


         var justResources = [];
         if (resources.length > 0) {
           var groupedResources = app.groupBy(filteredResources, 'resourceType');
           for(var resourceKey in groupedResources) {
             console.log(resourceKey + ':');
             for(var resourceIndex in groupedResources[resourceKey]) {
               var resource = groupedResources[resourceKey][resourceIndex]
               console.log(resource.resourceName + ' - ' + resource.resourceEmail);
               justResources.push(resource);
             }
           }
         } else {
           console.log('No resources found.');
         }

         var now = new Date();
         var halfHourFromNow = new Date(now.getTime() + 30*60000);
         app.availableResources(justResources, now, halfHourFromNow.toISOString());
       });
   }

   var filterResources = function(r) {
       if (!r.resourceName.includes('archive') && (r.resourceName.includes('Room') || r.resourceName.includes('Standup'))) {
           return r;
       }
   }

  /************************************************************************
   *
   * Code required to start the app
   *
   * NOTE: To simplify this codelab, we've used localStorage.
   *   localStorage is a synchronous API and has serious performance
   *   implications. It should not be used in production applications!
   *   Instead, check out IDB (https://www.npmjs.com/package/idb) or
   *   SimpleDB (https://gist.github.com/inexorabletash/c8069c042b734519680c)
   ************************************************************************/

   /**
   *  On load, called to load the auth2 library and API client library.
   */
   app.handleClientLoad = function() {
       gapi.load('client:auth2', app.initClient);
   }

   /**
   *  Initializes the API client library and sets up sign-in state
   *  listeners.
   */
   app.initClient = function() {
       gapi.client.init({
         discoveryDocs: app.discoveryDocs,
         clientId: app.clientId,
         scope: app.scopes
       }).then(function () {
         // Listen for sign-in state changes.
         gapi.auth2.getAuthInstance().isSignedIn.listen(app.updateSigninStatus);

         // Handle the initial sign-in state.
         app.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
         app.authorizeButton.onclick = app.handleAuthClick;
         app.signoutButton.onclick = app.handleSignoutClick;
       });
   }

   /**
   *  Called when the signed in status changes, to update the UI
   *  appropriately. After a sign-in, the API is called.
   */
   app.updateSigninStatus = function(isSignedIn) {
       if (isSignedIn) {
         app.authorizeButton.style.display = 'none';
         app.signoutButton.style.display = 'block';
         app.listUpcomingEvents();
         app.getResources();
       } else {
         app.authorizeButton.style.display = 'block';
         app.signoutButton.style.display = 'none';
       }
   }

   /**
   *  Sign in the user upon button click.
   */
   app.handleAuthClick = function(event) {
       gapi.auth2.getAuthInstance().signIn();
   }

   /**
   *  Sign out the user upon button click.
   */
   app.handleSignoutClick = function(event) {
       gapi.auth2.getAuthInstance().signOut();
   }

   /************************************************************************
    *
    * Install Service Worker
    ************************************************************************/

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
             .register('./service-worker.js')
             .then(function() { console.log('Service Worker Registered'); });
  }
})();

/**
* Append a pre element to the body containing the given message
* as its text node. Used to display the results of the API call.
*
* @param {string} message Text to be placed in pre element.
*/
function appendPre(message) {
    var pre = document.getElementById('content');
    var textContent = document.createTextNode(message + '\n');
    pre.appendChild(textContent);
}
