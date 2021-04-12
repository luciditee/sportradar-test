
const Outbound = require('../api/outbound.js').OutboundHandler;
const Endpoint = require('../api/outbound.js').Endpoint;

// etl-ingest.js -- The heart of the system, responsible for pulling in frequently
//                  accessed data and making meaningful use of it. Takes heavy
//                  advantage of the cache system.
//
// I could've just written a simple "player function" and "team function" and
// pulled a ton of data down, abused the cache, and make it so that you were just
// roundabout-querying a disk cache of the data that you need. That seemed very
// brute-force, so I decided to generalize the functionality a bit.
//
// TL;DR: This is a really fancy LEFT JOIN as you might do in your favorite SQL,
// but using JSON. The number of API calls emitted remotely is entirely up to
// how efficiently the work units are set up. The WHERE clause(s) are defined
// by your primary keys. CSV conversion happens later.
//
// Longer explanation:
// The primary operating principle behind this is dividing each concerned piece
// of data into "work units," which are small JSON objects that define
// - what API they're drawing from (using the slug/human-readable name)
// - what endpoints within that API are used (ditto, but for endpoints)\
// - if they are considered "primary keys" (discussed below)
// - any parameters that must be passed
// - any modifiers that must be passed
// - what the key should be called within the output object provided by a query
// - what data from the endpoint should be extracted from the query
//
// ETL pipelines themselves are called "query units" here, because they group
// work units together into a cohesive whole. Within the query units, 1 or more
// "primary keys" are specified and mapped to some work unit's output. For example,
// for the Player query unit, we want to look up a player by ID and season, so
// we look for the work unit with the key "playerID" and when the query unit runs,
// it takes the parameter labeled "playerID", runs the work unit with that local
// key, and then runs the rest of the work unit, eventually combining the data
// into an anonymous target object.
//
// Since the requirements specify to convert JSON to CSV, this is done at the last
// step by another file: etl-csv.js.
// -----------------------------------------------------------------


// This utility function allows you to resolve nested object members by
// dot-names, as you might in a .NET namespace or Java package. It's from this
// StackOverflow thread, and seems to be the best answer based on consensus:
// https://stackoverflow.com/a/6491621/3941696
// Note: I'm aware that Lodash exists and contains this utility function, but
// as stated in the README, I like to reduce external dependencies as much as I can
Object.byString = function(o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, '');           // strip a leading dot
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
        var k = a[i];
        if (typeof o === 'object' && k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}

// Function that runs a boolean intersection between two hashtables.
var intersectHashtables = function(a,b) {
    let first = Object.getOwnPropertyNames(a);
    let second = Object.getOwnPropertyNames(b);
    let output = {};

    for (let i in first) {
        for (let j in second) {
            if (first[i] === second[j]) {
                output[first[i]] = b[second[j]];
                break;
            }
        }
    }

    return output;
}

class ETLWorkUnit {
    constructor(apiSlug, endpointSlug, rename, priority, depParams, depMods) {
        this.depParams = depParams === undefined ? [] : depParams;
        this.depMods = depMods === undefined ? [] : depMods;
        this.rename = rename === undefined ? [] : rename;
        this.priority = priority === undefined ? 0 : priority;

        if (apiSlug === undefined)
            throw "API slug must be provided in order for work unit to function";

        if (endpointSlug === undefined)
            throw "Endpoint handle must be provided in order for work unit to function";
        
        if (!Array.isArray(this.rename)) 
            throw "'rename' must be passed as array of objects containing properties "
                + "'find' and 'replace': " + rename;
        
        if (!(typeof priority === 'number'))
            throw 'priority must be passed as a number'
        
        if (!Array.isArray(this.depParams))
            throw "depParams must be passed as array of string parameters to pass to the endpoint: "
                + depParams;
        
        if (!Array.isArray(this.depMods))
            throw "depMods must be passed as array of string modifiers to pass to the endpoint: "
                + depMods;

        this.apiSlug = apiSlug;
        this.endpointSlug = endpointSlug;
        this.rename = rename;
    }

    // for passing basic JSON objects, it's a good idea to make sure they share a prototype
    // with this class, so this function validates such a json object would contain all the
    // necessary values ahead-of-time
    static Build(primitive) {
        return new this(primitive['apiSlug'], primitive['endpointSlug'], primitive['rename'],
             primitive['priority'], primitive['depParams'], primitive['depMods']);
    }


}

// You might also think of a query unit as "model" of sorts that defines how we
// process a specific pattern of data. There's a lot of metaphors floating around
// in my head as I write this code, it seems like there's a lot of ways to solve this.
class QueryUnit {
    constructor(handle, apiDefs, workUnits, outputTransform) {
        this.handle = handle;
        this.apiDefs = apiDefs;

        if (apiDefs === undefined || !Array.isArray(apiDefs))
            throw "apiDefs must be passed as an array of objects";

        if (workUnits === undefined || !Array.isArray(workUnits))
            throw "workUnits must be passed as an array of objects";

        if (outputTransform === undefined || !Array.isArray(outputTransform))
            throw "outputTransform must be passed as an array of objects";
        
        this.workUnits = workUnits.sort((a, b) => (a.priority > b.priority) ? 1 : -1);
        this.outputTransform = outputTransform;
        this.outboundHandlers = {};
        
        for (let i in apiDefs) {
            this.outboundHandlers["$"+apiDefs[i].slug] = Outbound.Build(apiDefs[i]);
        }
            
    }

    // The primary linchpin of the ETL system!
    async RunQuery(data) {
        let outputMap = {};
        outputMap = Object.assign(outputMap, data);
        
        // Run each endpoint request, mapping parameters
        // and modifiers as required.
        for (let i in this.workUnits) {
            let unit = this.workUnits[i];
            //let completed = false; // see comment at bottom of for loop
            let outbound = this.GetOutboundHandlerBySlug(unit['apiSlug']);
            let queryUnit = this;

            //console.log(unit.endpointSlug);
            await this.PromiseWrapper(unit, queryUnit, outputMap, outbound);

            // previously used a spinlock to lock the loop, this introduced
            // race conditions if the request was not previously cached, causing
            // the program to lock up! Thus: removed while (!completed) loop.
        }

        // Find and replace the final output transform values, and
        // return the entire request as JSON (for debuggging) if no
        // transform was specified.
        if (this.outputTransform.length == 0)
            return outputMap;
        
        let final = {};
        for (let i in this.outputTransform) {
            let transform = this.outputTransform[i];
            if (transform['find'] !== undefined && transform['replace'] !== undefined) {
                if (transform['parseCustom'] === undefined) {
                    //console.log("finding and replacing " + transform['find'] + " with " + transform['replace']);
                    outputMap = this.FindReplaceKey(outputMap, transform['find'], transform['replace']);
                    final[transform['replace']] = outputMap[transform['replace']];
                } else {
                    // if you pass a custom parser, the function will run and its
                    // return value used for the output.
                    let base = Object.byString(outputMap, transform['find']);
                    if (base !== undefined)
                        final[transform['replace']] = transform['parseCustom'](base, outputMap, final);
                    else
                        console.warn("warning: undefined return for transform base " + transform['find'])
                }
            }

            
        }

        return final;
    }

    PromiseWrapper(unit, queryUnit, outputMap, outbound) {
        return new Promise(
            (resolve, reject) => {
                outbound.sendRequest(
                    unit.endpointSlug, 
                    outputMap,
                    outputMap,
                    (data) => {
                        //console.log("received data")
                        // data starts as string and must be parsed
                        // then it can have its find/replace operation
                        // done on it 
                        let parsed = JSON.parse(data);
                        for (let j in unit['rename']) {
                            parsed = queryUnit.FindReplaceKey(
                                parsed,
                                unit['rename'][j]['find'],
                                unit['rename'][j]['replace']
                            );
                        }
                        
                        outputMap = Object.assign(outputMap, parsed);
                        resolve();
                    },
                    null,
                    (data) =>  {
                        console.error("Failure on request " + unit.endpointSlug);
                        reject();
                    }
                );
            }
        );
    }

    FindReplaceKey(currentOutput, toFind, toReplaceWith) {
        let output = currentOutput;
        let v = Object.byString(output, toFind);
        if (v !== undefined)
            output[toReplaceWith] = v;
        else {
            //console.log("couldn't find key: " + toFind);
            //console.log(currentOutput);
        }
            

        return output;
    }

    GetOutboundHandlerBySlug(slug) {
        return this.outboundHandlers["$"+slug]; 
    }

    static Build(primitive) {
        if (primitive["handle"] === undefined) 
            primitive["handle"] = "default-query-unit";
        if (primitive["apiDefs"] === undefined) primitive["apiDefs"] = [];
        if (primitive["workUnits"] === undefined) primitive["workUnits"] = [];
        if (primitive["outputTransform"] === undefined) primitive["outputTransform"] = [];

        let units = [];
        for (let i in primitive["workUnits"]) {
            units.push(ETLWorkUnit.Build(primitive["workUnits"][i]))
        }

        return new this(primitive["handle"], primitive["apiDefs"],
            units, primitive["outputTransform"]);
    }
}

module.exports = {
    QueryUnit : QueryUnit,
    ETLWorkUnit : ETLWorkUnit
};