
// etl-csv.js -- An addendum to the ETL ingest code that converts a flat JSON
//               object hashtable into a comma-separated-value (CSV) output.
// 
// Note: Expected input is the JSON itself, *NOT* a JSON.stringify() string.
//       You will get no output at all if you pass a string!
//
//       This is a relatively unsophisticated function. It doesn't do any
//       special error detection or correction. It converts *most* JSON objs
//       into CSV, and from what I can tell it handles the ETL output as well
//       as it needs to. For this reason I only really spent a few minutes
//       writing this code to devote time to more important challenge bits

var obj2csv = (obj) => {
    let output = "";
    let keys = Object.keys(obj);
    output += keys.join() + "\n"; // step 1: do all the keys
    
    // step 2: do their values.
    // we iterate here to guarantee the order of data put down
    // for each column matches the order that they were join()ed
    // in the above code, otherwise we might have a player who is
    // named NaN playing for the Leafs and that's no good
    let arr = [];
    for (let i = 0; i < keys.length; i++)
        output += (obj[keys[i]]) + (i != keys.length-1) ? "," : "";

    // ways to improve this code:
    
    // 1. ES6+ guarantees order on Object.keys() calls, but if we were to
    // run this code client side where we don't know if they're stuck on some
    // ancient <= ES5 browser, we'd have to take some extra steps to guarantee
    // order. Maybe some way of passing that information in the function header
    // would be a good place to start.

    // 2. There is no checking whatsoever if a key or value name contains a
    // comma character. This would throw off ANY CSV parser, and while unlikely
    // to be a problem in our use case, would surely crop up as a problem later
    // with other APIs.
    
    return output;
}

module.exports = {
    obj2csv : obj2csv
};
