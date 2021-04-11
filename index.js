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
            "rename": [ 
                {
                    "find" : "teams[0][id]",
                    "replace" : "teamId"
                },
                {
                    "find": "teams[0][name]",
                    "replace": "teamName"
                }
            ],
            "priority": 1,
            
        },
        {
            "apiSlug": "NHLPublicAPI",
            "endpointSlug": "TeamRoster",
            "priority": 10,
            "depParams": [
                {
                    "key": "id",      // we're expecting to pass a team id, so
                    "value": "teamId" // we use the previously acquired
                                      // & renamed 'teamId' property
                }
            ]
        }
    ],
    "outputTransform": [
        { 
            "find": "teamId",
            "replace": "TeamID"
        },
        {
            "find": "teamName",
            "replace": "TeamName"
        },
        {
            "find": "roster[0][person][fullName]",
            "replace": "NameOfFirstPlayer"
        }
    ]
};

var testCase = ETL.Build(TestQuery);
var result = testCase.RunQuery({"id" : 1});
result.then((output) => {
    console.log(obj2csv(output));
});