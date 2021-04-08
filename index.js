const Outbound = require('./api/outbound.js').OutboundHandler;
const APIs = require('./apidefs.js');
const OutboundUnitTests = require('./unit-test/outbound-test.js');

// unit testing!
OutboundUnitTests.RunUnitTests();

// spinlock? I think that's what you'd call this.
// My local version of node doesn't have the nice new promise-based sleep
// so this'll have to do for now.
var waitTill = new Date(new Date().getTime() + 3 * 1000);
while(waitTill > new Date()){}

// unit testing again!
OutboundUnitTests.RunUnitTests();


// note that if you run the code at this stage, you'll get the "using existing
// cache" message twice. This is expected behavior because the unit test func-
// tion creates a new OutboundHandler each time it runs. In a real-world scen-
// ario, this wouldn't happen, because you're supposed to reuse the outbound
// object instance. The idea is to have one outbound object per API.