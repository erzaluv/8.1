window.alert = function(msg) { console.warn("Blocked alert: " + msg); };
window.confirm = function() { return true; };