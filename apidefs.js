const OutboundJS = require('./api/outbound.js');

// will continue to expand this as functionality is added
var NHLPublicAPI = {
    "slug": "NHLPublicAPI",
    "parentURI": "https://statsapi.web.nhl.com/api",
    "version": "1.0",
    "endpoints": [
        {
            "slug": "Teams",
            "request": "teams",
            "parameters": [],
            "modifiers": [
                {
                    "handle" : "expand",
                },
                {
                    "handle" : "teamId",
                },
                {
                    "handle" : "stats",
                },
            ]
        },
        {
            "slug": "TeamByID",
            "request": "teams/{ID}",
            "parameters": ["ID"],
            "modifiers": [
                {
                    "handle" : "expand",
                },
                {
                    "handle" : "stats",
                },
            ]
        },
    ]
};

module.exports = {
    NHLPublicAPI : NHLPublicAPI
};
