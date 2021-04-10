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
            "useCache": true,
            "cacheTTL": 300,
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
            "request": "teams/{id}",
            "useCache": true,
            "parameters": ["id"],
            "modifiers": [
                {
                    "handle" : "expand",
                },
                {
                    "handle" : "stats",
                },
            ]
        },
        {
            "slug": "TeamRoster",
            "request": "teams/{id}/roster",
            "useCache": true,
            "parameters": ["id"],
            "modifiers": []
        },
    ]
};

module.exports = {
    NHLPublicAPI : NHLPublicAPI
};
