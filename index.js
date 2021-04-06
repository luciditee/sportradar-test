const OutboundJS = require('./api/outbound.js');
const API = require('./apidefs.js');

var outbound = OutboundJS.OutboundHandler.CreateHandler(API.NHLPublicAPI);
outbound.sendRequest("Teams", 
    (data, uri) => {
        console.log("Success! Response printing for request URI " + uri);
        console.log(data);
    },
    (error, uri) => {
        console.log("Error code: " + error + " -- for uri: " + uri);
    }
);