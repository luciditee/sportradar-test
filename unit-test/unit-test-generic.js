
// unit-test-generic.js - Unsophisticated class defs for unit testing.

// The basic gist is just "given known inputs, compare for known output."
// If something doesn't match up, you know it's a fail and you can throw
// the appropriate exception/error/etc.
//
// There are better unit testing systems out there, but this is good
// enough for the sake of shorter turnaround and maintaining my personal
// policy of "write tests as you go" instead of waiting until the end
// to integrate some Enterprise Grade, Maximum Overkill™ testing suite.


class CallbackUnitTester {
    constructor(name, expectedOutput, onTestPass=null, onTestFail=null) {
        this.name = name;
        this.expectedOutput = expectedOutput;

        this.onTestPass = (onTestPass == null) ? 
            this.onTestPassDefault : onTestPass;

        this.onTestFail = (onTestFail == null) ? 
            this.onTestFailDefault : onTestFail;
    }

    compareOutputs(out) {
        //console.log(this.expectedOutput);
        
        // Technically O(n^2) and I'm not proud of this particular aspect.
        // I'm sure there's a better way to optimize this but I'm leaving it
        // in the interest of getting stuff done.
        for (let key in out)
            if (Object.prototype.hasOwnProperty.call(out, key)) {
                let found = false;  
                for (let i in this.expectedOutput) {
                    if (i == key) {         // It's only checking for the existence of keys.
                        found = true;       // This isn't super-thorough, but for JSON, it'll
                                            // suffice. A more exact test would be better.
                                            // I see this unit test scheme as more of a
                                            // sanity checking mechanism than a full-blown
                                            // debugging suite, and again, adding an actual
                                            // unit testing lib for this would be preferable.

                                            // Note: This may have an advantage of not being
                                            // fazed by the copyright date changing in each
                                            // request body every year!
                        break;
                    }
                }
                
                if (!found) {
                    console.log("missing key:\"" + key + "\" : " + out[key]);
                    this.onTestFail(out);
                    return false;
                }
            }
        
        this.onTestPass(out);
        return true;
    }

    onTestPassDefault(output) {
        console.log('PASS: test `' + this.name + '\' returned expected output');
    }

    onTestFailDefault(output) {
        console.log('FAIL: test `' + this.name + '\' output differed from expectation\n');
            //+ output;
    }
    
}

module.exports = {
    CallbackUnitTester : CallbackUnitTester
};