const OutboundJS = require('./api/outbound.js');

// will continue to expand this as functionality is added
// A slick way to do this would be to have a way for us to
// load in these API defs from, say, an external file or a
// database. I'm keeping it this way for now, but I do want
// to acknowledge that this could be made even slicker.
var NHLPublicAPI = {
    "slug": "NHLPublicAPI",
    "parentURI": "https://statsapi.web.nhl.com/api",
    "version": "v1",
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
