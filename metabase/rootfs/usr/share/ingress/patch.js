// Home Assistant Ingress URL rewriting for Metabase
// Patches fetch/XHR/history to rewrite absolute paths through the ingress proxy
(function() {
    var INGRESS_PATH = "%%ingress_entry%%";
    if (!INGRESS_PATH) return;

    function rewritePath(url) {
        if (typeof url === "string" && url.startsWith("/") && !url.startsWith(INGRESS_PATH)) {
            return INGRESS_PATH + url;
        }
        return url;
    }

    // Patch window.fetch to rewrite absolute paths
    var originalFetch = window.fetch;
    window.fetch = function(input, init) {
        if (typeof input === "string") {
            input = rewritePath(input);
        } else if (input instanceof Request) {
            var url = new URL(input.url);
            if (url.origin === window.location.origin && url.pathname.startsWith("/") && !url.pathname.startsWith(INGRESS_PATH)) {
                input = new Request(INGRESS_PATH + url.pathname + url.search + url.hash, input);
            }
        }
        return originalFetch.call(this, input, init);
    };

    // Patch XMLHttpRequest to rewrite absolute paths
    var originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        if (typeof url === "string") {
            arguments[1] = rewritePath(url);
        }
        return originalXHROpen.apply(this, arguments);
    };

    // Patch history.pushState and replaceState to rewrite absolute paths
    var originalPushState = history.pushState;
    history.pushState = function(state, title, url) {
        if (typeof url === "string") url = rewritePath(url);
        return originalPushState.call(this, state, title, url);
    };

    var originalReplaceState = history.replaceState;
    history.replaceState = function(state, title, url) {
        if (typeof url === "string") url = rewritePath(url);
        return originalReplaceState.call(this, state, title, url);
    };

    // Patch Element.setAttribute to rewrite src/href on dynamically created elements
    var originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
        if ((name === "src" || name === "href") && typeof value === "string") {
            value = rewritePath(value);
        }
        return originalSetAttribute.call(this, name, value);
    };
})();
