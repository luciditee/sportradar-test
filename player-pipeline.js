const ETL = require("./etl/etl-ingest.js").QueryUnit;
const obj2csv = require("./etl/etl-csv.js").obj2csv;
const NHLPublicAPI = require("./apidefs.js").NHLPublicAPI;
const fs = require('fs');

/*
 * PLAYER PIPELINE
 * REQUIREMENTS (verbatim):
 * Provide a player ID and season year which outputs a CSV file.
 * The CSV should include the following:
 * - Player ID
 * - Player Name
 * - Current Team
 * - Player Age
 * - Player Number
 * - Player Position
 * - If the player is a rookie
 * - Assists
 * - Goals
 * - Games
 * - Hits
 * - Points
 */

var PlayerPipeline = {
    "handle": "PlayerPipeline",
    "apiDefs": [NHLPublicAPI],
    "workUnits": [
        {
            "apiSlug": "NHLPublicAPI",
            "endpointSlug": "PlayerInfo",
            "rename": [ 
                {
                    "find" : "people[0][id]",
                    "replace" : "personId"
                },
            ],
            "priority": 1,
            "depParams": [
                {
                    "key": "id",
                    "value": "personId"
                },
            ]
        },
        {
            "apiSlug": "NHLPublicAPI",
            "endpointSlug": "PlayerStatsBySeason",
            "priority": 2,
            "depParams": [
                {
                    "key": "id",
                    "value": "personId"
                },
            ],
            "depMods": [
                {
                    "key": "stats",
                    "value": "stats"
                },
                {
                    "key": "season",
                    "value": "season"
                }
            ]
        },
    ],
    "outputTransform": [
        {
            "find": "personId",
            "replace": "PlayerID",
        },
        {
            "find": "people[0][fullName]",
            "replace": "PlayerName",
        },
        {
            "find": "people[0][currentTeam][name]",
            "replace": "CurrentTeam",
        },
        {
            "find": "people[0][currentAge]",
            "replace": "PlayerAge",
        },
        {
            "find": "people[0][primaryNumber]",
            "replace": "PlayerNumber",
        },
        {
            "find": "people[0][primaryPosition][name]",
            "replace": "PlayerPosition",
        },
        {
            "find": "people[0][rookie]",
            "replace": "IsCurrentlyRookie",
        },
        {
            "find": "stats[0][splits][0][stat][assists]",
            "replace": "Assists",
        },
        {
            "find": "stats[0][splits][0][stat][goals]",
            "replace": "Goals",
        },
        {
            "find": "stats[0][splits][0][stat][games]",
            "replace": "PlayerGames",
        },
        {
            "find": "stats[0][splits][0][stat][hits]",
            "replace": "PlayerHits",
        },
        {
            "find": "stats[0][splits][0][stat][points]",
            "replace": "PlayerPoints",
        },
    ]
};

// Argument parser function, really really elementary approach
// just pass key=value, INI style, i.e.
// node file.js foo=1 season=2018
let defaultValues = {"id" : 1, "season": ""};
let outputFilename = "./playerOutput.csv";
let argParser = (arr, valuesPassed={}) => {
    let season = defaultValues['season'];
    let id = null;
    for (i in arr) {
        let split = arr[i].split('=');
        if (split.length != 2) continue;
        else {
            if (split[0] === "id") {
                id = parseInt(split[1]);
                if (isNaN(id) || id < 1) {
                    console.warn("Invalid ID passed, using default of " + defaultValues.id);
                    id = defaultValues['id'];
                }
            }

            if (split[0] === "season") {
                season = split[1];
            }

            if (split[0] === "output") {
                outputFilename = split[1];
            }
        }
    }

    if (isNaN(parseInt(season))) {
        console.warn("empty or invalid season year passed, using most recently started season by default");
    }

    if (id === null) {
        console.warn("no ID passed, using default of " + defaultValues.id);
        id = defaultValues.id;
    }

    // apply final data
    valuesPassed['id'] = id;
    seasonProcessor(season, valuesPassed);
    return valuesPassed;
}

// The requirements say "given a season year" and the API docs typically
// define this as YYYYYYYY, where the first four YYYYs are the opening year
// and the latter four are the closing year (i.e. 20192020). However, the
// endpoints expect them in actual YYYY-MM-DD format, and hockey seasons
// start in October and end at the end of April, so we assume currrent year
// if all else fails.
let seasonProcessor = (str, valuesPassed) => {
    let n = parseInt(str);
    let year = new Date().getFullYear();
    if (isNaN(n) || n < 1900 || n > year) { // wasn't sure of a minimum year, picked something safe
        console.warn("specified season year falls out of range, using most recently started season");
        let month = parseInt(new Date().getMonth());
        if (month > 9) { // October onwards, use current year
            return seasonProcessor(parseInt(year), valuesPassed);
        } // else, use previous year

        return seasonProcessor(parseInt(year)-1, valuesPassed);
    }   
    let next = n+1;
    valuesPassed['season'] = n.toString() + next.toString();
}

// parse CLI arguments
let cliArgs = process.argv.slice(2); // first two aren't needed
let inputData = argParser(cliArgs);

// An extra paramter is required for the endpoint we are interacting with,
// which is just to say that we are grabbing singleSeasonStats, as this is all
// the requirements state for the challenge
inputData['stats'] = "statsSingleSeason";

console.log(inputData);

// build and run pipeline, then post result
let testCase = ETL.Build(PlayerPipeline);
let result = testCase.RunQuery(inputData);
result.then((output) => {
    let csv = obj2csv(output);
    console.log("\noutput:\n" + csv);
    console.log("\nsaving to " + outputFilename);
    fs.writeFile(outputFilename, csv, (err) => {
        if(err)
            return console.log("error while saving: " + err);

        console.log("save complete");
    });
});