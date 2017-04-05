
/**
* Get the resources for the authenticated user
*/
(function() {
  'use strict';

var groupBy = function(xs, key) {
  return xs.reduce(function(rv, x) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

function getResources() {
gapi.client.directory.resources.calendars.list({
  'customer': 'primary',
  'maxResults': 50
}).then(function(response) {
  var resources = response.result.items;
  appendPre('Resources:');

  if (resources.length > 0) {
  	var groupedResources = groupBy(resources, 'resourceType');
  	for(resourceKey in groupedResources) {
  		appendPre(resourceKey);
  	}
  } else {
    appendPre('No resources found.');
  }
});
}



