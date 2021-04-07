const Outbound = require('./api/outbound.js').OutboundHandler;
const APIs = require('./apidefs.js');
const OutboundUnitTests = require('./unit-test/outbound-test.js');

// unit testing!
OutboundUnitTests.RunUnitTests();