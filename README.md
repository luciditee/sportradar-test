# SportRadar API Challenge Solution
This is a solution for the [SportRadar API Challenge](https://github.com/sportradarus/sportradar-api-challenge). Most work was done at night after completing any IRL-responsibilities and obviously so as to not conflict with my current work hours.

For this challenge, I chose to write in JavaScript (ES6+), striving to not rely so much on external dependencies of any kind. I dislike forcing people to have a ton of dependencies installed and taking up disk space, especially if it's just for 1-2 features in a given library. However, I do recognize that for each of the sub-problem solutions implemented here, like REST integration and caching, there are likely other more mature solutions.

Nevertheless, this was written in 5 days, and I'm happy with how far it's come. Prior to this, it was nice to get my feet wet with JS again after a long break.

**Note:** While there are unit tests, I feel that there could be more thorough tests other than just "does the endpoint handler and cache core function as expected." While either of these things would present as a single point of failure and are likewise good to test, there can always be more tests, and I'm interested in writing more.

## Table of Contents
   * [SportRadar API Challenge Solution](#sportradar-api-challenge-solution)
      * [Table of Contents](#table-of-contents)
      * [Requirements](#requirements)
      * [How to use](#how-to-use)
         * [Team Pipeline](#team-pipeline)
      * [Player Pipeline](#player-pipeline)
      * [Developer Commentary](#developer-commentary)
         * [Self-Constraints](#self-constraints)
         * [Timing &amp; more unit tests](#timing--more-unit-tests)
         * [Results](#results)
      * [In-Depth Look](#in-depth-look)
         * [Generalized ETL handling](#generalized-etl-handling)
            * [Extract](#extract)
            * [Transform](#transform)
            * [Load](#load)
            * [Caching](#caching)
            * [What does an ETL unit (query unit) look like?](#what-does-an-etl-unit-query-unit-look-like)
         * [Generalized endpoint handling](#generalized-endpoint-handling)
         * [Response caching](#response-caching)
         * [Unit testing](#unit-testing)


## Requirements
These are the JS-relevant tools used in my WSL 18.04 environment. Any other versions may cause undefined behavior, so use something >= these versions:

* node >= v8.10.0
* npm >= v3.5.2

For editing, anything works. I used VSCode (running under WSL).

## How to use
Firstly, ensure your environment matches the above requirements.

An example of how to create a pipeline, using the requirements specified in the challenge, can be found in `team-pipeline.js` and `player-pipeline.js`, if you want to try working with your own pipelines. An example of how endpoints are defined can be found in `apidefs.js` if you wish to hook this up to a different API.

### Team Pipeline
While `cd`ed into the project directory, use the following syntax to supply an `id`, a `season`, and an `output` file. Default values if malformed or unpopulated are `id=1`, `season=mostRecentlyStartedSeason` (see code for how this works), and
`output=teamOutput.csv`:
```
$ node team-pipeline.js id=3 season=2016 output=result.csv

output:
TeamID,TeamName,TeamVenueName,GamesPlayed,GamesWon,GamesLost,Points,GoalsPerGame,DateOfFirstGameInSeason,OpponentInFirstGameInSeason
3,New York Rangers,Madison Square Garden,40,19,16,43,3.25,2016-10-01T23:00:00Z,New Jersey Devils

saving to result.csv
save complete
```

**Note**: *If a team ID that does not match to a known team is supplied, the CSV will still be created, but all values will be undefined.*

## Player Pipeline
Likewise, for the player pipeline, you can supply an `id` (default `1`\*), a `season` year (default is the most recently-started season), and an `output` filename (default is `playerOutput.csv`):

```
$ node player-pipeline.js id=8479420 season=2019 output=result.csv
{ id: 8479420, season: '20192020', stats: 'statsSingleSeason' }

output:
PlayerID,PlayerName,CurrentTeam,PlayerAge,PlayerNumber,PlayerPosition,IsCurrentlyRookie,Assists,Goals,PlayerGames,PlayerHits,PlayerPoints
8479420,Tage Thompson,Buffalo Sabres,23,72,Right Wing,false,0,0,1,2,0

saving to result.csv
save complete
```

**Note**: *If a player ID is valid enough to pass a sanity check, but doesn't map to a proper player (like `2`, for instance, is valid but not a player ID in the database), the CSV will be created, but its values will be undefined. **This can also occur if the player is in the database, but has no stats for the given season.** To me, it made the most sense to at least return what data was there than to return no data at all.*

*\* While the default is 1, which is definitely a valid number and passes the sanity check of "is this a valid database key," there does not appear to be a player whose ID is equal to 1, so the contents of the CSV will be undefined if this value is passed.*

## Developer Commentary
### Self-Constraints
To start, this is the first thing I've done with JS in a while, as my work responsibilities have had me doing mostly .NET in recent times, meaning I was rusty. I set forth with the following constraints, remembering past headaches while developing using node:

1. **As few external dependencies/`npm` libs as possible** (ended up with none!). I didn't want to come off as copping out by using other peoples' code for large swaths of functionality, even though in a professional setting, if licensing/policy allows for it, I'll use an external library where appropriate. I also had lots of bad memories of having to install enormous payloads and cram them into client-side webpack payloads, and honestly, I don't want to put you guys through that.

2. **The entire thing should take JSON input and provide JSON output** except for the final step, which is a simple CSV conversion to meet the requirements. JSON is highly portable and has the advantage of being able to embed actual JS code in scenarios where you know a JS engine will be parsing it (as opposed to .NET's JSON parser, for instance).

3. **Comment the crap out of it.** I like to comment with a lot of "why" rather than "what," because you can see clearly what the code is doing (I hope), and code should comment itself. However, a lot of times, certain things are done in code that aren't clear just from looking at it, as I've learned from professional experience; so in response to this, my policy is to document the *reason* I chose to do something, rather than to restate what I'm doing. There are a few *what* comments here and there, but you'll note that __all__ the large comment blocks are of the *why* variety.

### Timing & more unit tests
I'd originally quoted that I would have everything finished by EOD Friday, which was completely on-track until Friday, at which point a number of unexpected things took place in my daily responsibilities that prevented me from having as much time as I would've liked to work on that. I still did as much as I could to get the ETL pipeline working, but there just wasn't enough time to do as much as I wanted without staying up to absolutely horrid hours of the night!

Dissatisfied with the extremely rushed code I had written under these circumstances, I took several hours out of the weekend to rewrite a significant portion of the ETL handler, which is arguably one of the most important parts of the code.

If I could change anything about this codebase, the first thing I would do is write more unit tests, and go through all of the code to find every single `throw` statement and figure out a well-structured error handler to go in its place. `throw` statements are fine, but they're quite rudimentary as far as error handlers go, as are the handful of `assert`s.

### Results
Overall, given the timeline and my overall rust with JS and modern JS patterns as a whole, I'm pretty happy with this codebase. I could see myself using this to cross-link different APIs together and write some cool little tool apps as a result. The input JSON really speaks for itself, and I feel like in its current state someone who understands JS at a moderate level of understanding could pick this up and know exactly what they needed to do to get going.

For this to run in production on a large scale application, I'd have several changes I'd want to implement as well as far, *far* more unit tests to write before I'd feel comfortable with that.

## In-Depth Look
*This section is for documentation purposes and explaining why things were made a certain way.* Reading through this section isn't really required unless you want a deeper understanding

### Generalized ETL handling
The ETL (**E**xtract, **T**ransform, **L**oad) system built into this solution is designed to be more or less dynamically controllable entirely via JSON directives.

The system is tightly coupled with the endpoint handling, [discussed below.](#generalized-endpoint-handling), but also allows you to sample from *multiple different APIs* if required. This would be useful in contexts outside of closed systems, such as if you were to combine weather data with traffic report data.

#### Extract
The data is extracted from the API by way of *work units.* Work units represent individual API calls, which are paired to specific endpoints. In the overwhelming majority of cases, accessing certain data to complete an ETL cycle requires you to run certain API calls first. For this reason, a `priority` is defined for each WorkUnit, where lower priority numbers will run first in the sequence.

For example, if you need to look up a team, and then subsequently use that team ID to look up how well they did for a particular season, then you know the team ID lookup should go first--so you assign it `'priority': 1`. Then, the work unit responsible for handling the team's stats can run and reference the `teamID` of the previous work unit.

#### Transform
Work units are encapsulated into *query units*, which handle the data ingest (transform) phase of the data returned by work units. This makes the query unit the basic, "big-picture" definition of any ETL pipeline you wish to create.

When creating a query unit, [API definitions](#generalized-endpoint-handling), work unit definitions, and *output transformations* are passed in as one JSON object. At that point, all you have to do is `RunQuery()` on the query unit! You've essentially built a multi-API-call query out of nested JSON objects, with parameterization. Once you get the output from this query, you can do whatever you want with it, but while building the query units, you should set up your *output transformation* first.

The aforementioned *output transformation* is a value matching system. The data returned by each of the work units is stored in a hashtable, and this hashtable is searched for the values you want. So, for example, if you've extracted 

You can use the following embedded JSON syntax to extract nested data if needed:

```js
// The internal query hashtable contains the result of every prior
// work unit that ran, so we can pass direct object property refs
// in the "find" string and give it a better name in the "replace"
// field. Ergo, whatever value was stored at the 'find' point will
// take on the name stored in 'replace' when returning the result.
"outputTransform" : [ 
    {
    // full name of the first person in the player roster
    "find": "roster[0][person][fullName]", 
    "replace":"firstPlayer"
    }
]
```

In addition to this, if you need to actually *act on* the data as it's passed, you can script inline with a `parseCustom` function, passed directly as part of the output transform object.

```js
"outputTransform" : [
    // . . .
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
    // . . .
];
```

#### Load
The *load phase* is simple in that it returns JSON and can be thus converted easily into any format. The return format is a hashtable, and can be flat or nested depending on how you set up your `find/``replace`/`parseCustom` elements.

If you've configured endpoints to be cacheable, the result will also be temporarily saved for fast access later on.

For the purposes of this exercise, a CSV converter is supplied (see `etl-csv.js`).

#### Caching
Outbound API requests are always cached, as long as the endpoint defs are configured to allow it (see [below](#response-caching) for details).

Consequently, this means that any requests relying on cacheable endpoints will be subject to caching.

#### What does an ETL unit (query unit) look like?
This is the primary way of handling data throughout this solution. All you need ahead of time is the API def (in this case, `NHLPublicAPI`, defined in `apidefs.js`). Then, you can just include the ETL JS file and set sail:

```js
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
    console.log(output);
});

// Output:
{
    "TeamID": 1,
    "TeamName": "New Jersey Devils",
    "NameOfFirstPlayer": "Nathan Bastian"
}

```

### Generalized endpoint handling
Within `api/outbound.js` is a generalized handler for any REST API. It defines endpoints, parameterized inputs, and modifier inputs that can be passed as part of a URI (in a GET request).\*

The general structure of this implementation follows a standard callback pattern, specifically the [continuation-passing style](https://subscription.packtpub.com/book/web_development/9781783287314/1/ch01lvl1sec10/the-callback-pattern).

Target REST APIs can be defined as pure JSON, as seen in `apidefs.js`. You just define the endpoint, what parameters it takes, any modifiers you think may be relevant to its usage, and then send for an API call like so:

```js
out.sendRequest("TeamByID", {"ID": 5}, null, // "ID" parameter set to 5, null (no) modifiers.
    (data, uri) => { 
        // This is the "request succeeded" callback.
        console.log(data); // do something with the data, like JSON.parse()
     },
    (data, uri) => {
        // This is the "request in progress" callback and runs as each chunk of data is received
        // from the remote server. Could use this for a progress bar, for example.
        // If you don't need to use this, just pass null instead of a function.
    },
    (error, uri) => {  
        // This is the "request failed/errored out" callback.
    }
);   
```

\* Support for `POST`, `PUT`, `DELETE`, etc. are not included in this demonstration because the target API for the challenge does not use any of those request types. Adding them would be relatively trivial, and would only modify two functions--see comments in `api/outbound.js` for more info.

### Response caching
To combat cases of rate limiting, as well as to allow holding on to exceptionally large response bodies, or perhaps even copies of data unlikely to ever change (such as historic data), each endpoint object in `apidefs.js` can be configured to `useCache` (either `true` or `false`).

Caches are implemented in a very similar fashion to a [hashtable](https://en.wikipedia.org/wiki/Hash_table), which themselves are typically fixed-size arrays whose indices are generated from a hashing function, with a subsequent linked-list at each index to allow for standard iterative lookup in the event of a hash collision. JS possesses the ability to `arbitarily['define'] = "objects"`, but I wanted to be able to use straight HTTP requests as keys, and using URIs as keys is generally ill-advised. (I also thought it would be worth showing that I haven't forgotten compsci fundamentals!)

A `.cache` file is made for each `outbound.js` instance, and named after the API def the instance is tied to.

**Note:** The cache engine is not designed to have many different processes accessing it at once. If this were a distributed application, each node running the application code would have to possess its own cache to prevent race conditions. An asynchronous/queued I/O system could be devised to handle this, but this is a major caveat I thought worth mentioning.

### Unit testing
A basic unit test system for callback-based pattern JS code is supplied in `unit-test-generic.js`. The two most crucial parts of the ETL chain are unit tested via this, in `outbound-test.js`. However, it could be more elaborate, as more time was spent getting the ETL engine scriptable enough--particularly due to rewrites on my part to make the code as good as possible, and to require minimal code to set up. (See developer commentary for further info on this. I'd like to continue work on this to add more unit tests for it as we go.)