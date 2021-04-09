
const fs = require('fs');

/*
 * cache.js -- A simple cache-to-disk system for generic object storage.
 * 
 * Once again, because we're mostly tossing around JSON and GET requests, the
 * implementation here can be kept fairly straightforward.
 * 
 * The basic idea here is that we're storing a cache in key/value format.
 * Cache objects contain cache entry objects, and cache entry are composed of
 * a string key and the stringified JSON value of the response.*
 * 
 * For the purposes of outbound.js, we use the request URI as the key, and
 * use the response body as the value. A hashtable implementation is also
 * included to speed up lookup times, and it all gets serialized down to
 * JSON for convenience.
 * 
 * The entire cache object is then serialized to JSON, and written to disk
 * as a file.
 * 
 * IN MY OPINION: It'd probably be good to add a feature to outbound.js to
 * allow us to define whether or not output from an endpoint is cacheable.
 * Wouldn't take too long to do, but I'm focused on reaching the goal atm.
 * 
 * * The bespoke "JSON value" uses the aforementioned hashtable, and hashtables
 *   are, at their core, a hashing function with a linked list or array under
 *   each hash value so as to provide O(1) lookup time in best cases, or O(n)
 *   in the event of a collision (which is rare, but possible.)
 * 
 * Claiming O(1) is somewhat bold, so I've included a blog post on why memory
 * or space complexity is the real killer in this scenario:
 * 
 * https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html
 * 
 */

const timeToLive = 300; // At one point was the default, kept for posterity

class CacheEntry {
    constructor(uniqueInputKey, value, ttl=300) {
        this.uniqueInputKey = uniqueInputKey;
        this.value = value;
        this.timestamp = Math.floor(Date.now() / 1000);
        this.ttl = ttl;
    }

    isStale() {
        return (Math.floor(Date.now() / 1000) - this.timestamp) > this.ttl;
    }
}

// Just using a dynamic array for now, a faster and more canonical implementation
// would be to make a class called "ClassListEntry" which ends up being a
// linked list--but as long as we aren't colliding all the time, we can just
// stick to using the array backing for now.
class CacheList { 
    constructor(hash) {
        this.hash = hash;
        this.content = [];
    }

    findByKey(key) {
        for (i in this.content)
            if (this.content[i].uniqueInputKey !== undefined) 
                if (this.content[i].uniqueInputKey === key) 
                    return content[i];
        return undefined;
    }

    // I wanted separate functions for these because semantically
    // there are different cases where I'd need the index, not the value
    getIndexByKey(key) {
        for (i in this.content)
            if (this.content[i].uniqueInputKey !== undefined) 
                if (this.content[i].uniqueInputKey === key) 
                    return i;
        return -1;
    }

    keyExists(key) {
        return this.findByKey(key) !== undefined;
    }
}

class CacheContainer {
    constructor(name="default") {
        this.name = name;

        // initialize cache
        let cacheEntriesTemp = {};
        cacheEntriesTemp["cacheName"] = this.name;
        if (fs.existsSync(this.fileName)) {
            console.log("Found existing cache @ " + this.fileName + ", using it");
            // cache already existed, attempt to parse it
            // Format sanity checking would be good to do here, but
            // since I only expect to read/write from this class, I'll
            // leave that out for now and it can be revisited later.
            cacheEntriesTemp = JSON.parse(fs.readFileSync(this.fileName, 'utf8'));
            //console.log(cacheEntriesTemp);
        }

        this.cacheEntries = cacheEntriesTemp;
        //console.log(this.cacheEntries);
    }

    get fileName() {
        // Maybe an absolute path would be better here?
        return "./" + this.name + ".cache";
    }

    hash(str) {
        if (!(typeof str === 'string' || str instanceof String)) 
            throw "passed invalid key, keys should always be strings: "
                + str;

        // This is just a CRC32 implementation I found elsewhere:
        // https://stackoverflow.com/a/50579690/3941696
        // There's probably better options out there and definitely built-in hashing
        // in Node, but that's okay. Most hashtable implementations I've seen use
        // some kind of homegrown algorithm anyway, so this keeps with the theme.
        for (var a, o = [], c = 0; c < 256; c++) {
            a = c;
            for (var f = 0; f < 8; f++) a = 1 & a ? 3988292384 ^ (a >>> 1) : a >>> 1;
            o[c] = a;
        }
        for (var n = -1, t = 0; t < str.length; t++) n = (n >>> 8) ^ o[255 & (n ^ str.charCodeAt(t))];
        return "$"+((-1 ^ n) >>> 0).toString(16).toUpperCase();
        //  ^^^ the "$" is in case we get an all-numeric CRC, which would be bad news
        // because non-array-index identifiers cannot be all numbers. 
        // I'm not sure if encapsulating it into a string as we're doing here
        // negates that problem, but the addition of the $ removes any doubt in my 
        // mind so I'm keeping it there for now. Loose-typed languages are funky!
    }

    addToCache(key, value, ttl=300) {
        let keyHash = this.hash(key);
        let entry = new CacheEntry(key, value, ttl);        

        // If there was no collision, we're just defining an array of
        // 0 length so when we push it to the array, there's an array
        // to push to.
        if (this.cacheEntries[keyHash] === undefined) {
            let list = new CacheList(keyHash);
            this.cacheEntries[keyHash] = list;
        }

        console.log("adding " + key + " to cache");
        
        // Since we know for a fact there's an array here, let's make
        // sure we didn't already store this.
        let preExisting = this.cacheEntries[keyHash].findByKey(key);
        if (preExisting !== undefined) { // Cache collision, but only if it's stale
            if (preExisting.isStale) { // Overwrite stale entries & save
                let i = this.cacheEntries[keyHash].getIndexByKey(keyHash);
                this.cacheEntries[keyHash].content = entry;
                this.writeToDisk();
            } // If it isn't stale, we're not going to be doing anything.
        } else {
            // There was no pre-existing value.
            // Push it to the content array and save
            this.cacheEntries[keyHash].content.push(entry);
            this.writeToDisk();
        }
    }

    findByKey(key) {
        let keyHash = this.hash(key);
        
        // If this hash isn't even present, it's straight up not here.
        if (this.cacheEntries[keyHash] === undefined)
            return undefined;
        
        // Otherwise, traverse the inner array.
        let found = undefined;
        for (let i in this.cacheEntries[keyHash].content) {
            if (this.cacheEntries[keyHash].content[i]) {
                // Never return stale items. Deleting them is preferable.
                if (this.cacheEntries[keyHash].content[i].isStale) {
                    this.deleteByKey(key);
                    this.writeToDisk();
                    return undefined;
                }

                found = this.cacheEntries[keyHash].content[i].value;
                break;
            }
        }

        // Return the found object (or not, it's possible there was a collision
        // but the un-hashed key wasn't the same as what was passed to findByKey)
        return found;
    }

    deleteByKey(key) {
        let keyHash = this.hash(key);
        
        // If this hash isn't even present, it doesn't exist in the cache.
        if (this.cacheEntries[keyHash] === undefined)
            return false;
        
        // Otherwise, traverse the inner array.
        let found = undefined;
        for (let i in this.cacheEntries[keyHash].content) {
            if (this.cacheEntries[keyHash].content[i]) {
                found = i;
                break;
            }
        }

        if (found === undefined)
            return false;
        
        this.cacheEntries[keyHash].content.splice(found, 1);
        return true;
    }

    // Useful if we absolutely must ensure we are dealing with live data.
    // I don't plan on using this in this demo, but it would be exceedingly stupid
    // not to include a function like this if I'm implementing a cache.
    garbageCollect() {
        this.writeToDisk();
        let staleKeys = [];
        for (let i in this.cacheEntries) {
            for (let j in this.cacheEntries[i].content) {
                if (this.cacheEntries[i].content[j].isStale)
                    staleKeys.push(this.cacheEntries[i].content[j].uniqueInputKey);
            }
        }

        for (let i in staleKeys)
            deleteByKey(staleKeys[i]);
        
        this.writeToDisk(0);
    }

    // Simple save-to-disk. Overwrites contents of what's already there.
    writeToDisk() {
        // This is a blocking call to writeFile, so we might want to change this
        // to run asynchronously. My fear would be of requests happening faster
        // than a flush-to-disk can take, so maybe a queue would be implemented
        // at that point? Leaving it as-is for now, but wanted to acknowledge it.
        fs.writeFile(this.fileName, JSON.stringify(this.cacheEntries), err => {
            if (err) {
              console.error(err)
              return;
            }
        })
    }   
}

module.exports = {
    Cache : CacheContainer
};