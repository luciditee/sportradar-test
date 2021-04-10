const ETL = require("./etl/etl-ingest.js").QueryUnit;
const obj2csv = require("./etl/etl-csv.js").obj2csv;
const NHLPublicAPI = require("./apidefs.js").NHLPublicAPI;

// A test ETL query that fetches the name of the first player on the roster,
// the name of the team, and the team ID, if you need that information for
// some strange reason!
var TestQuery = {
    "handle": "TestQueryUnit",
    "apiDefs": [NHLPublicAPI],
    "workUnits": [
        {
            "apiSlug": "NHLPublicAPI",
            "endpointSlug": "TeamByID",
            "remoteKey": "id",
            "localKey": "teamNumericID",
            "isPrimary": true,
            "depParams": ["id"]
        },
        {
            "apiSlug": "NHLPublicAPI",
            "endpointSlug": "TeamRoster",
            "remoteKey": "roster",
            "localKey": "roster",
            "isPrimary": false,
            "depParams": ["id"]
        }
    ],
    "outputTransform": [
        { 
            "key": "id",
            "value": "teamId"
        },
        {
            "key": "name",
            "value": "teamName"
        },
        {
            "key": "key[0][person][name]",
            "value": "firstPlayerName"
        }
    ]
};

var testCase = ETL.Build(TestQuery);