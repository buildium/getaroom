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
    notAuthorizedView: document.querySelector('#not-authorized-view'),
    noRoomsView: document.querySelector('#no-rooms-view'),
    spinner: document.querySelector('.loader'),
    cardTemplate: document.querySelector('.cardTemplate'),
    container: document.querySelector('.main'),
    rooms: document.querySelector('.rooms'),
    container: document.querySelector('.main .room-cards'),
    addDialog: document.querySelector('.dialog-container'),
    authorizeButton: document.getElementById('authorize-button'),
    signoutButton: document.getElementById('signout-button'),
    filterList: document.querySelector('.filter-list'),
    googleApi: document.getElementById('google-api'),
    daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    clientId: config.CLIENT_ID,
    useServiceWorker: config.USE_SERVICE_WORKER,
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
                    "https://www.googleapis.com/discovery/v1/apis/admin/directory_v1/rest"],
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

  document.getElementById('butRefresh').addEventListener('click', function() {
    // Refresh all of the forecasts
    app.refreshResources();
  });

  app.isSignedIn = function() {
      return gapi.auth2.getAuthInstance().isSignedIn.get();
   }

  document.getElementById('butFilter').addEventListener('click', function() {
     if(app.filterList.style.display == 'block') {
         app.filterList.style.display = 'none'
     } else {
         app.filterList.style.display = 'block'
     }
    });

  document.getElementById('30-minute-button').addEventListener('click', function() {
      app.refreshResources(30);
    });

  document.getElementById('hour-button').addEventListener('click', function() {
    app.refreshResources(60);
  });

  document.getElementById('90-minute-button').addEventListener('click', function() {
    app.refreshResources(90);
    });

  document.getElementById('2-hour-button').addEventListener('click', function() {
    app.refreshResources(120);
  });

  document.getElementById('trigger-dropdown').addEventListener('click', function() {
    document.getElementById('myDropdown').classList.toggle('show');
  });




  /*****************************************************************************
   *
   * Methods to update/refresh the UI
   *
   ****************************************************************************/

   app.bookRoom = function(resourceId, card) {
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
           card.querySelector('.user-message').innerHTML = '<span class=\'success\'><a target=_blank href=\'' + response.result.htmlLink + '\'>View in calendar</a></span>';
           card.querySelector('.reserve-room-button').classList.add('reserved');
       });
   };

   app.attemptToBookRoom = function(resourceId, card) {
       var now = new Date();
       var halfHourFromNow = new Date(now.getTime() + 30*60000);
       var userAlreadyBookedRoom = false;
       model.getCurrentEvents(now.toISOString(), halfHourFromNow.toISOString(), function(items) {
           var userAlreadyBookedRoom = false;
           if (items.length > 0) {
               model.getResources(function(resources) {
                   items.forEach(function(item) {
                       if (item.attendees) {
                         item.attendees.forEach(function(attendee) {
                             resources.forEach(function(resource) {
                                 if (resource.resourceEmail === attendee.email) {
                                     card.querySelector('.user-message').innerHTML = '<span class=\'failure\'>Failed to book room. You already have a booked room during this time.</span>';
                                     card.querySelector('.reserve-room-button').classList.remove('reserved');
                                     userAlreadyBookedRoom = true;
                                 }
                             });
                         });
                      }
                   });
                   if (!userAlreadyBookedRoom) {
                       app.bookRoom(resourceId, card);
                   }
               });
           } else {
               app.bookRoom(resourceId, card);
           }
       });
   }

   app.getUsersCurrentResources = function(minutes, callback) {
       var now = new Date();
       var timeFromNow = new Date(now.getTime() + minutes*60000);
       var currentResources = [];
       model.getCurrentEvents(now.toISOString(), timeFromNow.toISOString(), function(items) {
           model.getResources(function(resources) {
               resources.forEach(function(resource) {
                   items.forEach(function(item) {
                    if (item.attendees) {
                       item.attendees.forEach(function(attendee) {
                           if (attendee.email === resource.resourceEmail) {
                               resource.isBooked = true;
                               resource.eventLink = item.htmlLink;
                               currentResources.push(resource);
                           }
                       });
                     }
                   });
               });
               callback(currentResources);
           });
       });
   }

   app.updateResourceCards = function(resources) {
       if (resources.length > 0) {
           app.noRoomsView.style.display = 'none';
       } else {
           app.noRoomsView.style.display = 'block';
       }

       resources.forEach(function(resource) {
           app.updateResourceCard(resource);
       });
   }

  app.updateResourceCard = function(resource) {
    var resourceId = resource.resourceId;
    var resourceEmail = resource.resourceEmail;
    var resourceName = getResourceName(resource.resourceName);
    var resourceDescription = resource.resourceDescription;
    var resourceType = resource.resourceType;

    var card = app.visibleCards[resourceId];
    if (!card) {
      card = app.cardTemplate.cloneNode(true);
      card.classList.remove('cardTemplate');
      card.removeAttribute('hidden');
      app.container.appendChild(card);
      app.visibleCards[resourceId] = card;
      var actionButton = card.querySelector(".room .user-action");
      if (resource.isBooked) {
          var calendarLink = resource.eventLink ? resource.eventLink : 'calendar.google.com';
          actionButton.innerHTML = '<a class=\'gcalendar-link\' target=\'_blank\' href=\'' + calendarLink +'\'><img src=\'../images/gcalendar.png\'></a>';
      } else {
            card.querySelector(".reserve-room-button").addEventListener('click', function() {
            app.bookRoom(resourceEmail, card);
          });
      }
    }

    card.setAttribute('data-room-type', getRoomType(resourceType));
    card.querySelector('.name').textContent = resourceName;
    card.querySelector('.type').textContent = resourceType;
    card.querySelector('.description').textContent = resourceDescription;
    if (app.isLoading) {
      app.removeLoading();
    }
  };

  app.removeLoading = function() {
      app.spinner.setAttribute('hidden', true);
      app.container.removeAttribute('hidden');
      app.isLoading = false;
  }

  /*****************************************************************************
   *
   * Methods for dealing with the model
   *
   ****************************************************************************/

   app.refreshResources = function(minutes = 30) {
       if (!app.isSignedIn()) {
        return;
       }
       var now = new Date();
       var timeFromNow = new Date(now.getTime() + minutes*60000);
       clearCards();
       app.getUsersCurrentResources(minutes, function(resources) {

          if (resources && resources.length > 0) {
           app.updateResourceCards(resources); //set user's resources if any
          }
           model.getAvailableResources(now, timeFromNow.toISOString(), app.updateResourceCards);//set available resources
       })
   }

   var clearCards = function() {
       app.container.innerHTML = '';
       app.visibleCards = {};
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
         scope: app.scopes,
       }).then(function () {
        // Sign in on init
        if (!app.isSignedIn()) {
          gapi.auth2.getAuthInstance().signIn();
        }

         // Handle the initial sign-in state.
         app.updateSigninStatus(app.isSignedIn());

         // Listen for sign-in state changes.
         gapi.auth2.getAuthInstance().isSignedIn.listen(app.updateSigninStatus);

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
         app.refreshResources();
         app.authorizeButton.style.display = 'none';
         app.signoutButton.style.display = 'block';
         app.notAuthorizedView.style.display = 'none';
         app.toastUserGreeting();
       } else {
         app.authorizeButton.style.display = 'block';
         app.signoutButton.style.display = 'none';
         app.notAuthorizedView.style.display = 'block';
         clearCards();
         app.removeLoading();
       }
   }

   app.toastUserGreeting = function() {
       var email = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail();
       toast('Hi, ' + email + '!');
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
       app.removeLoading();
   }

   /************************************************************************
    *
    * Install Service Worker
    ************************************************************************/

  if (app.useServiceWorker && 'serviceWorker' in navigator) {
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

/**
* Trim the resourceName string to remove text before dash and colons
*
* @param {string} name Text to be trimmed.
*/
function getResourceName(name) {
    var nameArray = name.split(' - ');
    if (nameArray.length > 1) {
        var newName = nameArray[1].split(' (')[0];
        return newName;
    }
    return name;
}

/**
* Returns a data attribute string for the card element based on the resource's resourceType
*
* @param {string} type The resourceType of the resource element
*/
function getRoomType(type) {
    if (type.indexOf('Conference room') != -1) {
        return 'conference-room';
    } else if (type.indexOf('Focus Room') != -1) {
        return 'focus-room';
    } else if (type.indexOf('Boardroom') != -1) {
        return 'boardroom';
    } else if (type.indexOf('Webinar') != -1) {
        return 'webinar';
    }

    return 'default';
}

var showTimeRangeVal = function(timeVal) {
    document.querySelector('.time-range-value').textContent = timeVal;
}
