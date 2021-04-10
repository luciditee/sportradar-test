# SportRadar API Challenge Solution
*Readme WIP until the solution is completed.*

This is a solution for the [SportRadar API Challenge](https://github.com/sportradarus/sportradar-api-challenge). **It is currently a work-in-progress** and should be "done" enough to fulfill the requirements of the challenge by EOD Friday. Most work was done at night after completing any IRL-responsibilities and obviously so as to not conflict with my current work hours.

For this challenge, I chose to write in JavaScript (ES6+), striving to not rely so much on external dependencies of any kind. I dislike forcing people to have a ton of dependencies installed and taking up disk space, especially if it's just for 1-2 features in a given library. However, I do recognize that for each of the sub-problem solutions implemented here, like REST integration and caching, there are likely other more mature solutions.

Nevertheless, this was written in a week, and I'm happy with how far it's come. Prior to this, it was nice to get my feet wet with JS again after a hiatus.

## Requirements
These are the JS-relevant tools used in my WSL 18.04 environment. Any other versions may cause undefined behavior, so use something >= these versions:

* node v8.10.0
* npm v3.5.2

VSCode (running under WSL) was used to actually write the code.

## How to use
*This section will be filled in when the challenge is completed.*

## In-Depth Look
*This section is for documentation purposes and explaining why things were made a certain way.* Reading through this section isn't really required unless you want a deeper understanding

### Generalized ETL handling
The ETL (**E**xtract, **T**ransform, **L**oad) system built into this solution is designed to be more or less dynamically controllable entirely via JSON directives.

The system is tightly coupled with the endpoint handling, [discussed below.](#generalized-endpoint-handling), but also allows you to sample from *multiple different APIs* if required. This would be useful in contexts outside of closed systems, such as if you were to combine weather data with traffic report data.

#### Extract
The data is extracted from the API by way of *work units.* Work units represent individual API calls, which are paired to specific endpoints. In the overwhelming majority of cases, accessing certain data to complete an ETL cycle requires you to run certain API calls first. Adopting a convention from SQL, these are referred to in the code as "primary keys."

For example, if you need to look up a team, and then subsequently use that team ID to look up how well they did for a particular season, the *team ID* is said to be the *primary key.* What this amounts to is that work units marked as primary keys will run before any other data is run, such that the needed information from those requests is pre-cached ahead of time.

If data in one work unit depends on a data in another work unit, you can take advantage of the fact that work units are parsed sequentially, with primary keys always promoted to first.

#### Transform
Work units are encapsulated into *query units*, which handle the data ingest (transform) phase of the data returned by work units. This makes the query unit the basic, "big-picture" definition of any ETL pipeline you wish to create.

When creating a query unit, [API definitions](#generalized-endpoint-handling), work unit definitions, and *output transformations* are passed in as one JSON object. At that point, all you have to do is `RunQuery()` on the query unit! You've essentially built a multi-API-call query out of nested JSON objects, with parameterization. Once you get the output from this query, you can do whatever you want with it, but while building the query units, you should set up your *output transformation* first.

The aforementioned *output transformation* is a key/value pair system that simply looks for data matching `key` in a hashtable composed of all of the WorkUnit outputs that ever occurred, and then
include it in the final output with `value` as its column name.

You can use the following embedded JSON syntax to extract nested data if needed:

```js
// Get the name of the first player from the roster query
[ {"key": "roster[0][person][fullName]", "value":"firstPlayer"}]
```

#### Load
The *load phase* is simple in that it returns JSON and can be thus converted easily into any format. For the purposes of this exercise, a CSV converter is supplied (see `etl-csv.js`).

#### Caching
Outbound API requests are always cached, as long as the endpoint defs are configured to allow it (see [below](#response-caching) for details). The results of different `QueryUnit`s can also be cached based on the input parameters, so that repeat-instances of the same query will always return the same result without saturating the network.

Cache TTL for `QueryUnit` entries is defined by the lowest-detected value of any cachable endpoint involved in the query. If no such value is detected, or none of them are cacheable, 300 seconds (5 minutes) is used as the default stand-in.

Caching must be explicitly enabled for each `QueryUnit`, so if you're operating on live, realtime data, you can omit caching from the process--because obviously, you don't want stale game-score/game-time data coming down the pipeline.

#### What does an ETL unit (query unit) look like?
```js
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
};```

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
Unit testing for each of these primary features is included in the final challenge solution. Each unit test is a simple function and has its own file. Include any of the `xxx-test.js` files found in the `unit-test` directory and run the bespoke single functions to invoke the unit tests.