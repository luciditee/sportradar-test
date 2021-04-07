const Outbound = require('../api/outbound.js').OutboundHandler;
const APIs = require('../apidefs.js');

const CallbackUnitTester = require('./unit-test-generic.js').CallbackUnitTester;
const Primitives = require('./outbound-test-inputs.js').OutboundTestPrimitives;

// outbound-test.js --  Unit tests for outbound.js
//
// For info on how this is generally supposed to work,
// see commentary in unit-test-generic.js

var RunUnitTests = function(specificTest=null) {
    console.log("Running unit tests for outbound.js: ");

    // Set up target for tests
    let out = Outbound.CreateHandler(APIs.NHLPublicAPI);

    // Set up unit tests w/ expected outputs
    let testObjects = [
        { 
            "handler" : new CallbackUnitTester("teams w/ no parameters",
                Primitives.TestInputTeams_NoModifiers),

            get test() {
                return () => {
                    out.sendRequest("Teams", null, null,
                        (data, uri) => { this.handler.compareOutputs(JSON.parse(data)); },
                        null,
                        (error, uri) => { this.handler.compareOutputs(JSON.parse(data)); }
                    );   
                }
            }
        },


    ];
    
    // If we wanted to test something specific, we can call it by name
    // i.e. RunUnitTests("teams w/ no parameters");
    if (specificTest != null && 
        (typeof endpoint === 'string' || endpoint instanceof String)) {
        for (let i = 0; i < testObjects.length; i++) {
            if (testObjects[i].handler.name === specificTest) {
                return testObjects[i].test();
            }
        }
    }
    
    // Otherwise it'll just run them all.
    for (let i = 0; i < testObjects.length; i++) {
        if (!testObjects[i].test()) {
            return false;
        }
    }

    return true;
}

module.exports = {
    RunUnitTests : RunUnitTests
};