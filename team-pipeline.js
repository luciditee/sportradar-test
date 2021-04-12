const ETL = require("./etl/etl-ingest.js").QueryUnit;
const obj2csv = require("./etl/etl-csv.js").obj2csv;
const NHLPublicAPI = require("./apidefs.js").NHLPublicAPI;
const fs = require('fs');

/*
 * TEAM PIPELINE
 * REQUIREMENTS (verbatim):
 * Provide a team id and season year which outputs a CSV file.
 * The CSV should include the following:
 * - Team ID
 * - Team Name
 * - Team Venue Name
 * - Games Played
 * - Wins
 * - Losses
 * - Points
 * - Goals Per Game
 * - Game Date of First Game of Season
 * - Opponent Name in First Game of Season
 */

var TeamPipeline = {
    "handle": "TeamPipeline",
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
            "endpointSlug": "TeamSchedule",
            "depMods": [
                {
                    "key": "teamId",    
                    "value": "teamId"
                },
                {
                    "key": "startDate",    
                    "value": "startDate"
                },
                {
                    "key": "endDate",    
                    "value": "endDate"
                },
            ],
            "priority": 3,
            
        },
        {
            "apiSlug": "NHLPublicAPI",
            "endpointSlug": "TeamStats",
            "rename": [ 
                {
                    "find" : "teams[0][id]",
                    "replace" : "teamId"
                }
            ],
            "depParams": [
                {
                    "key": "id",    
                    "value": "teamId" 
                }
            ],
            "priority": 2,
            
        },
    ],
    "outputTransform": [
        {
            "find": "id",
            "replace": "TeamID",
        },
        {
            "find": "teams[0][name]",
            "replace": "TeamName",
        },
        {
            "find": "teams[0][venue][name]",
            "replace": "TeamVenueName",
        },
        {
            "find": "stats[0][splits][0][stat][gamesPlayed]",
            "replace": "GamesPlayed",
        },
        {
            "find": "stats[0][splits][0][stat][wins]",
            "replace": "GamesWon",
        },
        {
            "find": "stats[0][splits][0][stat][losses]",
            "replace": "GamesLost",
        },
        {
            "find": "stats[0][splits][0][stat][pts]",
            "replace": "Points",
        },
        {
            "find": "stats[0][splits][0][stat][goalsPerGame]",
            "replace": "GoalsPerGame",
        },
        {
            "find": "dates[0][games][0][gameDate]",
            "replace": "DateOfFirstGameInSeason",
        },
        {
            // example of scriptable pipeline parser
            "find": "dates[0][games][0][teams]",
            "replace": "OpponentInFirstGameInSeason",
            "parseCustom": (data, raw, unfinishedOutput) => {
                // figure out which team ID doesn't match
                // the local team ID (which should be stored
                // in our unfinished output, which represents what
                // has been processed so far in the sequence of
                // find/replace ops in the outputTransform
                if (data['away'] !== undefined && data['home']) {
                    if (data['away']['team']['id'] !== unfinishedOutput['TeamID'])
                        return data['away']['team']['name'];
                    else
                        return data['home']['team']['name'];
                } else {
                    return "N/A";
                }
            }
        }
    ]
};

// Argument parser function, really really elementary approach
// just pass key=value, INI style, i.e.
// node file.js foo=1 season=2018
let defaultValues = {"id" : 1, "season": ""};
let outputFilename = "./teamOutput.csv";
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
    valuesPassed['startDate'] = n.toString() + "-10-01";
    valuesPassed['endDate'] = next.toString() + "-05-01";
}

// parse CLI arguments
let cliArgs = process.argv.slice(2); // first two aren't needed
let inputData = argParser(cliArgs);

// build and run pipeline, then post result
let testCase = ETL.Build(TeamPipeline);
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