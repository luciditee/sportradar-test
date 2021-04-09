
const Outbound = require('../api/outbound.js').OutboundHandler;
const Endpoint = require('./api/outbound.js').Endpoint;

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
        if (isObject(o) && k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}

// Helper function for translating k/v pairs stored as objects into a singular,
// flat JSON object.
var TranslateHashtable = function(data) {
    let hashtable = {};
    for (k in data) {
        if (data[k]["key"] === undefined || data[k]["value"] === undefined)
            continue; // skip wholly invalid entries
        if (typeof data[k]["key"] === 'string' || data[k]["key"] instanceof String)
            continue; // key is expected to be a string, skip invalid keys
                      // might be worth putting an error/warning here to aid debugging?
        hashtable[data[k].key] = data[k].value;
    }
    return hashtable;
}

class ETLWorkUnit {
    constructor(apiSlug, endpointSlug, remoteKey, localKey, isPrimary=false, depParams=[], depMods=[]) {
        this.apiSlug = apiSlug;             // slug name for the API being used in this unit
        this.endpointSlug = endpointSlug;   // slug name for the endpoint within that API
        this.remoteKey = remoteKey;         // what remote member key to look out for
        this.localKey = localKey;           // what the local object key name should be.
        this.isPrimary = isPrimary;         // is this considered a "primary key"
        this.depParams = depParams;         // parameters derived from the output of another unit
        this.depMods = depMods;             // ditto, but modifiers
    }

    // for passing basic JSON objects, it's a good idea to make sure they share a prototype
    // with this class, so this function validates such a json object would contain all the
    // necessary values ahead-of-time
    BuildWorkUnit(primitive) {
        if (primitive["apiSlug"] === undefined)
            throw "A valid API slug is required to generate a work unit";

        if (primitive["endpointSlug"] === undefined)
            throw "A slug to refer to an endpoint is required to generate a work unit";

        if (primitive["remoteKey"] === undefined)
            throw "A remote object key name must be passed as a string to generate a work unit";

        if (primitive["localKey"] === undefined) 
            throw "A local object key name must be passed as a string to generate a work unit";
        
        if (primitive["isPrimary"] === undefined) primitive["isPrimary"] = false;
        if (primitive["depParams"] === undefined) primitive["depParams"] = [];
        if (primitive["depMods"] === undefined) primitive["depMods"] = [];

        return new this(primitive["apiDef"], primitive["endpointSlug"], primitive["remoteKey"],
            primitive["localKey"], primitive["isPrimary"], primitive["depParams"],
            primitive["depMods"]);
    }


}

// You might also think of a query unit as "model" of sorts that defines how we
// process a specific pattern of data.
class QueryUnit {
    constructor(handle, apiDefs, workUnits) {
        this.handle = handle;
        this.apiDefs = apiDefs;

        if (!Array.isArray(apiDefs))
            throw "apiDefs must be passed as an array of objects";

        if (!Array.isArray(workUnits))
            throw "workUnits must be passed as an array of objects";
        
        // "$" = once again, taking advantage of hashtables
        // $ is considered a valid variable character, so we can use it as a prefix
        // and it'd probably be good to define this as a const somewhere
        this.workUnits = {};
        this.primaryKeys = [];
        this.nonPrimaryKeys = [];
        for (let i in workUnits) {
            let u = ETLWorkUnit.BuildWorkUnit(workUnits[i])
            this.workUnits["$"+u.localKey] = u;
            if (u.isPrimary)
                this.primaryKeys.push(u.localKey);
            else
                this.nonPrimaryKeys.push(u.localKey);
        }

        if (this.primaryKeys.length == 0)
            throw "0 primary keys found on query unit `" + this.primaryKey + "', "
                + "at least one must be marked as a primary (required) key";

        this.outboundHandlers = {};
        for (let i in apiDefs) {
            let o = Outbound.CreateHandler(apiDefs[i])
            this.outboundHandlers["$"+o.slug] = o;
        }
    }

    // This is really the core of the program right here: given a series of inputs,
    // prioritize which queries to run first given a specific set of primary keys
    // "data" is an array of objects in the following format:
    // {"key":workUnitLocalKeyHere, "value":valueBeingPassedHere}
    RunQuery(data) {
        let ret = {};

        // step 1: translate input array into an anonymous container object
        let hashtable = TranslateHashtable(data);

        // step 2: get primary keys, find them in the hashtable, if they don't
        // exist then error out because that means we didn't pass the right number
        // of primary keys
        for (let p in this.primaryKeys) {
            // find it in the hashtable
            let workUnit = this.GetWorkUnitByLocalKey(this.primaryKeys[p]);
            console.assert(workUnit !== undefined);
            ret[workUnit.localKey] = this.ProcessWorkUnit(workUnit, hashtable);
            hashtable[workUnit.localKey] = ret[workUnit.localKey];
        }

        // step 3: the previous step made primary key data accessible to us
        // in the hashtable, so we just do it again for non-primary keys
        for (let n in this.nonPrimaryKeys) {
            let workUnit = this.GetWorkUnitByLocalKey(this.nonPrimaryKeys[n]);
            console.assert(workUnit !== undefined);
            ret[workUnit.localKey] = this.ProcessWorkUnit(workUnit, hashtable);
            hashtable[workUnit.localKey] = ret[workUnit.localKey];
        }

        // at this stage the returned object should have all of the data handled by
        // each work unit flattened out into one.

        return ret;
    }

    ProcessWorkUnit(workUnit, hashtable) {
        if (!(workUnit instanceof ETLWorkUnit))
            throw "attempted to process work unit on an object that isn't a work unit: "
                + workUnit;
        
        let outbound = this.GetOutboundHandlerBySlug(workUnit.apiSlug);
        if (outbound === undefined)
            throw "work unit attempted to reference outbound handler which is not defined "
                + "for this query unit";
        
        let d = null;
        outbound.sendRequest(workUnit.endpointSlug, 
            ExtractParams(workUnit, hashtable, "depParams"),
            ExtractParams(workUnit, hashtable, "depMods"),
            (data, statusCode) => {
                d = data;
            }
        );

        let ret = null;
        if (workUnit.isPrimary) {
            ret = d[workUnit.remoteKey];
        } else
            ret = d;
        
        return ret;
    }

    ExtractParams(workUnit, hashtable, target) {
        let output = {};
        // TODO: do the key/value substitution from the hashtable to the target
        // which should either be depMods or depParams
    }

    GetOutboundHandlerBySlug(slug) {
        return this.outboundHandlers["$"+slug]; 
    }

    GetWorkUnitByLocalKey(key) {
        return this.workUnits["$"+key]; 
    }

    BuildQueryUnit(primitive) {
        if (primitive["handle"] === undefined) 
            primitive["handle"] = "default-query-unit";
        if (primitive["apiDefs"] === undefined) primitive["apiDefs"] = [];
        if (primitive["workUnits"] === undefined) primitive["workUnits"] = [];
        return new this(primitive["handle"], primitive["apiDefs"],
            primitive["workUnits"]);
    }
}