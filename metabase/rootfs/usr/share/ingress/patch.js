// Home Assistant Ingress URL rewriting for Metabase
// Patches fetch/XHR/history to rewrite absolute paths through the ingress proxy
(function() {
    var INGRESS_PATH = "%%ingress_entry%%";
    if (!INGRESS_PATH) return;

    // Patch window.fetch to rewrite absolute paths
    var originalFetch = window.fetch;
    window.fetch = function(input, init) {
        if (typeof input === "string" && input.startsWith("/") && !input.startsWith(INGRESS_PATH)) {
            input = INGRESS_PATH + input;
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
        if (typeof url === "string" && url.startsWith("/") && !url.startsWith(INGRESS_PATH)) {
            arguments[1] = INGRESS_PATH + url;
        }
        return originalXHROpen.apply(this, arguments);
    };

    // Patch history.pushState to rewrite absolute paths
    var originalPushState = history.pushState;
    history.pushState = function(state, title, url) {
        if (typeof url === "string" && url.startsWith("/") && !url.startsWith(INGRESS_PATH)) {
            url = INGRESS_PATH + url;
        }
        return originalPushState.call(this, state, title, url);
    };

    // Patch history.replaceState to rewrite absolute paths
    var originalReplaceState = history.replaceState;
    history.replaceState = function(state, title, url) {
        if (typeof url === "string" && url.startsWith("/") && !url.startsWith(INGRESS_PATH)) {
            url = INGRESS_PATH + url;
        }
        return originalReplaceState.call(this, state, title, url);
    };
})();
