
const https = require('https')

/*
 * outbound.js -- A simple functional wrapper for making outbound API requests.
 * 
 * This was the first thing written for this assignment. I've heavily commented it in a "why"
 * instead of just a "what" fashion, so it's abundantly clear *why* certain decisions were made.
 * 
 * It is certain that there are better implementations of this sort of thing out there, especially
 * with NPM being as diverse as it is. I chose to approach this with only knowledge of past experience
 * and what the end requirements of the assignment are. I felt that clouding my perception with
 * 'which plugin/library is best' would get in the way of actually getting work done.
 * 
 */

/*
 * Module exports can be found at the bottom of this file.
 */

const RequestTypeEnum = { "GET":0, /*"POST":1,*/ "default":0 }  // POST is commented out because I didn't code
                                                                // support for it, since all of the documentation
                                                                // provided for this assignment ended up being
                                                                // nothing but GET requests. Support can be added
                                                                // at a later date if needed, same with PUT, etc

// Note: using declarative technique for classes -- as someone transitioning from other languages, this feels
// a tiny bit more homely than expression-style class defs
class EndpointModifier {
    constructor(handle = "defaultModifier", priority=-1) {
        this.handle = handle;
        //this.priority = priority; // Originally for enforcing specific order, proved to be unnecessary.
    }

    // These static wrappers for the constructor are written such that anonymous objects are
    // converted, value-for-value, to the correct object prototype.
    static generateFromObject(primitive={}) {
        if (primitive["handle"] === undefined)
            primitive["handle"] = "defaultModifier";
        
        /*if (primitive["priority"] === undefined)
            primitive["priority"] = -1;*/

        return new this(primitive["handle"]/*, primitive["priority"]*/);
    }
}

class Endpoint {
    constructor(slug, request, method, parameters=[], modifiers=[]) {
        this.slug = slug;               // human-readable name (must be unique)
        this.request = request;         // the endpoint handle, i.e. foo in http://abc.com/api/v1.0/foo
        this.method = method;           // the HTTP method in which this request is emitted (POST, GET, etc.)
        this.parameters = parameters;   // string patterns to extract when replacing certain parameters
                                        // i.e. when passing an ID, the string patterns
        this.modifiers = modifiers;

        // data validation
        if (!Array.isArray(parameters))
            throw 'Expected parameters array for endpoint `' 
                + slug + '\', found object: ' + parameters.toString();

        if (!Array.isArray(modifiers))
            throw 'Expected modifiers array for endpoint `' 
                + slug + '\', found object: ' + modifiers.toString();

        for (let m in modifiers) {
            if (!(m instanceof EndpointModifier))
                throw 'Passed invalid EndpointModifer object for endpoint `' + slug 
                    + '\', found object: ' + m.toString();
        }

        // silly way of validating the method, should have a min/max bounding on the RequestTypeEnum object, but
        // for the purposes of this demo it's only POST or GET so it's fine for now and could be swapped
        // if required in the future (only GET requests will be implemented for this demonstration)
        switch(method) {
            case RequestTypeEnum.GET:
            //case RequestTypeEnum.POST:
            case RequestTypeEnum.default:
                // explicitly do nothing, because these are known values
                break;
            default:
                throw 'Invalid parameter method submitted for endpoint `' + this.slug + '\' (' + method + ')';
        }
    }

    static generateFromObject(primitive={}) {
        // validation--really just making sure things that should be present are present
        if (primitive["slug"] === undefined)    primitive["slug"] = "DefaultEndpoint";
        if (primitive["request"] === undefined) primitive["request"] = "default-endpoint";
        if (primitive["method"] === undefined)  primitive["method"] = RequestTypeEnum.GET;
        if (primitive["parameters"] === undefined || !Array.isArray(primitive["parameters"]))
            primitive["parameters"] = [];
        if (primitive["modifiers"] === undefined || !Array.isArray(primitive["modifiers"]))
            primitive["modifiers"] = [];
        
        // convert modifier sub-object array into the correct object type (i.e. so instanceof
        // cooperates with future operations on these objects)
        let e = [];
        for (let modifier in primitive["modifiers"])
            e.push(EndpointModifier.generateFromObject(endpoint));
        primitive["endpoints"] = e;
        
        // by doing this, we ensure the object matches the prototype of Endpoint
        return new this(primitive["slug"], primitive["request"], 
            primitive["method"], primitive["parameters"], primitive["modifiers"])
    }
}

/* Simplified outbound transaction handler. */
class OutboundHandler {
    constructor(slug, parentURI, version, port=443) {
        this.slug = slug;               // human readable name (should be unique, but at present nothing enforces this)
        this.parentURI = parentURI;     // where is the API? i.e. https://foo.com/api - NO TRAILING SLASH!
        this.version = version;         // what version should we use?
        this.endpoints = [];


        let url = new URL(slug)

        this.connectionOptions = {
            hostname: url.hostname,
            port: port, 
            path: url.pathname,
            method: 'GET' // TODO: For the moment, our outbound only supports GET
        };

    }

    // A nice convenient way to add endpoints in the form of a JSON object. 
    // In theory, we could pass files full of these things which would make redefining endpoints a lot easier
    // and would allow live changes to the endpoint config with only one file.
    static CreateHandler(primitive={}) {
        // validation--really just making sure things that should be present are present
        if (primitive["slug"] === undefined) primitive["slug"] = "default-outbound-handler";
        if (primitive["parentURI"] === undefined) primitive["parentURI"] = "http://localhost/api";
        if (primitive["version"] === undefined) primitive["version"] = "";
        if (primitive["endpoints"] === undefined || !Array.isArray(primitive["endpoints"]))
            primitive["endpoints"] = [];

        // convert endpoint sub-object array into the correct object type (i.e. so instanceof
        // cooperates with future operations on these objects)
        let e = [];
        for (let endpoint in primitive["endpoints"])
            e.push(Endpoint.generateFromObject(endpoint));
        primitive["endpoints"] = e;
        
        // by doing this, we ensure the object matches the prototype of OutboundHandler
        return new this(
            primitive["slug"], 
            primitive["parentURI"], 
            primitive["version"],
            primitive["endpoints"]
        );
    }

    // Getter that returns the base URI in the format
    // https://foo.tld/whatever/api/directory/version_here/ such that we can append endpoint 
    // slugs/params/modifiers to it to generate a valid request URI.
    get RequestBaseURI() {
        return this.version !== "" ? this.parentURI + "/" + this.version + "/"
            : this.parentURI + "/"; // In case some nerd forgets to specify a version with their REST API
    }

    // Adds an object of type Endpoint to this handler.
    // Needs accompanying removeEndpoint method, but it's here for completeness' sake.
    addEndpoint(endpoint) {
        if (!(endpoint instanceof endpoint)) { // someone passed an arbitrary object
            throw 'Attempted to add non-endpoint to outbound handler ' + this.slug 
                + ' (object: ' + endpoint.toString() + ')';
        }

        for (let e in this.endpoints) { // enforcing the slug "must be unique"
            if (e.slug === endpoint.slug)
                throw 'Duplicate endpoint with slug `' + e.slug + '\' added to outbound handler `' 
                    + this.slug + '\'';
        }

        this.endpoints.push(endpoint);
    }

    generateRequestURI(endpoint, parameters={}, modifiers={}) {
        let ep = null;
        if (typeof endpoint === 'string' || myVar instanceof String) {
            for (let e in this.endpoints)
                if (endpoint === e.slug) {
                    ep = e;
                    break;
                }
        } else if (endpoint instanceof Endpoint) {
            for (let e in this.endpoints)
                if (endpoint === e) {
                    endpoint = e;
                    break;
                }
        } else {
            throw 'Specified endpoint object is not the correct type for a '
                + 'valid Endpoint object, expecting string or Endpoint (' 
                + ep.toString() + ')';
        }

        // endpoint should never be null/mistyped beyond this point
        console.assert(ep !== null);
        console.assert(ep instanceof Endpoint);

        let output = ep.slug.repeat(1); // force copy of the slug string

        // really quick--what's the point of a parameter array on the endpoint itself
        // if we're just going to pass them here? Well, during initial setup of an endpoint,
        // you can specify replaceable text params that match a bracketed string {LikeThis}.
        // So if you create an endpoint with the handle end-point/{ID}, and you pass "ID"
        // in the params array on the endpoint constructor, this tells the parser that you
        // intend to replace {ID} (because there might be some esoteric case where we need {
        // or } characters and I don't want to make assumptions about that.)
        // It's also useful for a 'chain of accountability' to make sure people aren't arbitrarily
        // adding things that might cause undefined behavior.
        for (let key in parameters)
            if (Object.prototype.hasOwnProperty.call(parameters, key)) // no prototype nonsense
                for (let validParam in ep.parameters)
                    if (validParam == key) {
                        // did we match a valid parameter? if so, perform replacement
                        output = output.replace("{"+validParam+"}", parameters[key]);
                        break;
                    }
        
        // TODO: Strip out any {UnusedValues}?

        // parameters are accounted for, we can now worry about modifiers (if any)
        // NOTE: if we still sorted modifiers, which we don't anymore, this is where it would happen        
        let first = true;
        for (let key in modifiers)
            if (Object.prototype.hasOwnProperty.call(modifiers, key))
                for (let validModifier in ep.modifiers)
                    if (validModifier == key) {
                        // we found a valid modifier, append it to the string with its value
                        output += ((!first ? "&" : "?") + key + "=" + modifiers[key]);
                        break;
                    }

        return output;
    }

    // The main show: sending a request out based on predefined endpoints.
    sendRequest(endpoint, callbackSuccess=null, callbackFailure=null, parameters={}, modifiers={}) {
        let requestStr = this.generateRequestURI(endpoint, parameters, modifiers);
        console.log("Requesting the following: `" + requestStr + "'");
        
        let req = https.request(this.connectionOptions, res => {
            console.log(`Received status code: ${res.statusCode}`);
            
            res.on('data', d => {
                //process.stdout.write(d);
                if (callbackSuccess != null)
                    callbackSuccess(d, requestStr);
            });
        });
          
        req.on('error', error => {
            //throw 'Received error `' + error + "' for request `" + requestStr + "'";
            if (callbackFailure != null)
                callbackFailure(error, requestStr);
        });
          
        req.end();
    }

    // Further logic for, say, disabling endpoints selectively, rate limiting, etc. would need to be defined as part
    // of this class. I am leaving these things undefined for the moment so as to focus and test other things.

}

module.exports = {
    RequestTypeEnum : RequestTypeEnum,
    EndpointModifier : EndpointModifier,
    Endpoint : Endpoint,
    OutboundHandler : OutboundHandler
};
