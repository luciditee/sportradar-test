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

## Features
### Generalized endpoint handling
Within `api/outbound.js` is a generalized handler for any REST API. It defines endpoints, parameterized inputs, and modifier inputs that can be passed as part of a URI (in a GET request).\*

The general structure of this implementation follows a standard callback pattern, specifically the [continuation-passing style](https://subscription.packtpub.com/book/web_development/9781783287314/1/ch01lvl1sec10/the-callback-pattern).

Target REST APIs can be defined as pure JSON, as seen in `apidefs.js`. You just define the endpoint, what parameters it takes, any modifiers you think may be relevant to its usage, and then send for an API call:

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

\* Support for `POST`, `PUT`, `DELETE`, etc. are not included in this demonstration because the target API for the challenge does not use any of those request types. Adding them would be relatively trivial--see comments in `api/outbound.js` for more info.

### Response caching
To combat cases of rate limiting, as well as to allow holding on to exceptionally large response bodies, or perhaps even copies of data unlikely to ever change (such as historic data), each endpoint object in `apidefs.js` can be configured to `useCache` (either `true` or `false`).

Caches are implemented in a very similar fashion to a [hashtable](https://en.wikipedia.org/wiki/Hash_table), which themselves are typically fixed-size arrays whose indices are generated from a hashing function, with a subsequent linked-list at each index to allow for standard iterative lookup in the event of a hash collision. JS possesses the ability to `arbitarily['define'] = "objects"`, but I wanted to be able to use straight HTTP requests as keys, and using URIs as keys is generally ill-advised. (I also thought it would be worth showing that I haven't forgotten compsci fundamentals!)

A `.cache` file is made for each `outbound.js` instance, and named after the API def the instance is tied to.

**Note:** The cache engine is not designed to have many different processes accessing it at once. If this were a distributed application, each node running the application code would have to possess its own cache to prevent race conditions. An asynchronous/queued I/O system could be devised to handle this, but this is a major caveat I thought worth mentioning.

### Unit testing
Unit testing for each of these primary features is included in the final challenge solution. Each unit test is a simple function and has its own file. Include any of the `xxx-test.js` files found in the `unit-test` directory and run the bespoke single functions to invoke the unit tests.