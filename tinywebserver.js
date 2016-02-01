// tinywebserver.js
//
// A modification of Rod Waldhoff's tiny node.js webserver
// original written in coffeescript
// simplified and made more native-ish by Anil Somayaji
// March 19, 2014
//
// original headers of coffeescript version:
//
// A simple static-file web server implemented as a stand-alone
// Node.js/CoffeeScript app.
//---------------------------------------------------------------------
// For more information, see:
// <https://github.com/rodw/tiny-node.js-webserver>
//---------------------------------------------------------------------
// This program is distributed under the "MIT License".
// (See <http://www.opensource.org/licenses/mit-license.php>.)
//---------------------------------------------------------------------
// Copyright (c) 2012 Rodney Waldhoff
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without restriction,
// including without limitation the rights to use, copy, modify, merge,
// publish, distribute, sublicense, and/or sell copies of the Software,
// and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
// BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//---------------------------------------------------------------------

var path = require('path');
var http = require('http');
var fs = require('fs');

var MIME_TYPES = {
    'css': 'text/css',
    'gif': 'image/gif',
    'htm': 'text/html',
    'html': 'text/html',
    'ico': 'image/x-icon',
    'jpeg': 'image/jpeg',
    'jpg': 'image/jpeg',
    'js': 'text/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'txt': 'text/text'
};

var options = function(optionsFilename) {
    try {
        options = JSON.parse(fs.readFileSync(optionsFilename, "utf-8"));
    }
    catch (e) {
        if (optionsFilename) {
            console.error("Error reading/parsing options file " + optionsFilename + ", using defaults.");
        }
        else {
            console.log("No options file specified, using defaults.");
        }
        options = default_options;
    }
};

var default_options = {
    host: process.env.IP || '127.0.0.1',
    port: process.env.PORT || 8080,
    index: 'index.html', /* @TODO: Check if files actually exists. */
    docroot: '.',
};

var get_mime = function(filename) {
    var ext, type;
    for (ext in MIME_TYPES) {
        type = MIME_TYPES[ext];
        if (filename.indexOf(ext, filename.length - ext.length) !== -1) {
            return type;
        }
    }
    return null;
};


var respond = function(request, response, status, content, content_type) {
    if (!status) {
        status = 200;
    }

    if (!content_type) {
        content_type = 'text/plain';
    }
    Console.log("" + status + "\t" +
                request.method + "\t" + request.url);
    for(var header in options['logged-headers']) {
        if(typeof options['logged-headers'][header] !== 'function') { /* Probably not needed but whatever. */
            if(request.headers[options['logged-headers'][header]]) {
                Console.log("   " + options['logged-headers'][header] + ": " + request.headers[options['logged-headers'][header]]);
            }
        }
    }
    response.writeHead(status, {
        "Content-Type": content_type
    });
    if (content) {
        response.write(content);
    }
    return response.end();
};

var serve_file = function(request, response, requestpath) {
    return fs.readFile(requestpath, function(error, content) {
        if (error != null) {
            Console.error("ERROR: Encountered error while processing " +
                          request.method + " of \"" + request.url + 
                          "\".", error);
            return respond(request, response, 500);
        } else {
            if(requestpath == options.errorpage) {
                return respond(request, response, 404,
                    content, get_mime(requestpath));
            }
            else {
                if(requestpath.indexOf("lucky") != -1) {
                    var lucky = 777;
                }
                return respond(request, response, lucky || 200,
                    content, get_mime(requestpath));
            }
        }
    });
};


var return_index = function(request, response, requestpath)  {

    var exists_callback = function(file_exists) {
        if (file_exists) {
            return serve_file(request, response, requestpath);
        } else {
            return respond(request, response, 404);
        }
    };
    
    if (requestpath.substr(-1) !== '/') {
        requestpath += "/";
    }
    requestpath += options.index;
    return fs.exists(requestpath, exists_callback);
};

var request_handler = function(request, response) {
    var requestpath;

    if (request.url.match(/((\.|%2E|%2e)(\.|%2E|%2e))|(~|%7E|%7e)/) != null) {
        Console.warn("WARNING: " + request.method +
                     " of \"" + request.url + 
                     "\" rejected as insecure.");
        return respond(request, response, 403);
    } else {
        for(var key in options.aliases) {
            if(typeof options.aliases[key] !== 'function') { /* Probably not needed but whatever. */
                if(request.url === key) {
                    request.url = options.aliases[key];
                }
            }
        }
        requestpath = path.normalize(path.join(options.docroot, request.url));
        return fs.exists(requestpath, function(file_exists) {
            if (file_exists) {
                return fs.stat(requestpath, function(err, stat) {
                    if (err != null) {
                        Console.error("ERROR: Encountered error calling" +
                                      "fs.stat on \"" + requestpath + 
                                      "\" while processing " + 
                                      request.method + " of \"" + 
                                      request.url + "\".", err);
                        return respond(request, response, 500);
                    } else {
                        if ((stat != null) && stat.isDirectory()) {
                            return return_index(request, response, requestpath);
                        } else {
                            return serve_file(request, response, requestpath);
                        }
                    }
                });
            } else {
                return serve_file(request, response, options.errorpage);
            }
        });
    }
};

var server = http.createServer(request_handler);

options(process.argv[2]);
logStream = process.stdout;

var Console = require('console').Console;
try {
    logStream = fs.createWriteStream(options.logfile, {'flags': 'a'});
}
catch(e) {
    console.log("No log file set, redirecting to stdout.");
}

var Console = new Console(logStream);

server.listen(options.port, options.host, function() {
    return Console.log("Server listening at http://" +
                       options.host + ":" + options.port + "/");
});
