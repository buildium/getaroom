var model = {};

model.getResources = function(callback) {
    gapi.client.directory.resources.calendars.list({
        'customer': 'my_customer',
        'maxResults': 50
    }).then(function(response) {
        
        var resources = response.result.items;
        var filteredResources = resources.filter(filterResources);
        console.log('Resources:');

        var justResources = [];
        if (resources.length > 0) {
            var groupedResources = groupBy(filteredResources, 'resourceType');
            for(var resourceKey in groupedResources) {
                console.log(resourceKey + ':');
                for(var resourceIndex in groupedResources[resourceKey]) {
                    var resource = groupedResources[resourceKey][resourceIndex]
                    console.log(resource.resourceName + ' - ' + resource.resourceEmail);
                    justResources.push(resource);
                }
            }
            callback(justResources);
        } else {
            console.log('No resources found.');
            callback(justResources);
        }
    });
}

model.getAvailableResources = function(callback, timeMin, timeMax) {
    model.getResources(function(resources) {
        var resourceIds = getResourceIds(resources);
        gapi.client.calendar.freebusy.query({
          'items': resourceIds,
          'timeMin': timeMin,
          'timeMax': timeMax
        }).then(function(response) {
            
            var justAvailable = [];
            var calendars = response.result.calendars;
            console.log('Available rooms from:' + timeMin + ' to ' + timeMax);
            if (calendars) {
                var groupedResources = groupBy(resources, 'resourceEmail');
                for (var r in calendars) {
                    var resource = calendars[r];
                    var busy = resource.busy;
                    var errors = resource.errors;
                    if (!errors && busy && busy.length === 0) {
                        console.log(r);
                        justAvailable.push(groupedResources[r][0]);
                    }
                }
                callback(justAvailable);
            } else {
                callback(justAvailable);
            }
        });
    });
};

var filterResources = function(r) {
    if (!r.resourceName.includes('archive') && (r.resourceName.includes('Room') || r.resourceName.includes('Standup'))) {
        return r;
    }
};

var groupBy = function(xs, key) {
    return xs.reduce(function(rv, x) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
};

var getResourceIds = function(resources) {
    var items = [];
    for (var r in resources) {
        if (resources[r].resourceEmail) {
            var resource = { 'id' : resources[r].resourceEmail };
            items.push(resource)
        }
    }
    return items;
};
