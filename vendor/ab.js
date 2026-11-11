/*
 * STAND-IN for a client-side testing tool's script (VWO, Optimizely Web,
 * AB Tasty, Convert and the like). We wrote it; it is not any vendor's code.
 * It does the same jobs in the same order:
 *   1. assign the visitor to a variant and remember it in a first-party cookie,
 *   2. find the element and change it in the DOM,
 *   3. keep the change applied if the framework re-renders the element,
 *   4. reveal the page (end the anti-flicker hide),
 *   5. send an exposure beacon.
 * Real vendor scripts are much larger (tens to hundreds of KB, often with a
 * config request on top), so the numbers for this branch are a best case.
 */
(function () {
  var config = {
    experiment: "hero-headline",
    cookie: "ab_hero",
    split: 0.5,
    changes: {
      b: [
        {
          selector: '[data-testid="headline"]',
          text: "Get paid faster with invoices that send themselves",
        },
      ],
    },
  };

  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? m[1] : null;
  }

  var variant = readCookie(config.cookie);
  if (variant !== "a" && variant !== "b") {
    variant = Math.random() < config.split ? "a" : "b";
    document.cookie =
      config.cookie + "=" + variant + "; path=/; max-age=" + 60 * 60 * 24 * 90 + "; samesite=lax";
  }
  var changes = config.changes[variant] || [];

  function apply() {
    var all = true;
    for (var i = 0; i < changes.length; i++) {
      var el = document.querySelector(changes[i].selector);
      if (!el) {
        all = false;
        continue;
      }
      if (el.textContent !== changes[i].text) el.textContent = changes[i].text;
    }
    return all;
  }

  function reveal() {
    if (window.__abReveal) window.__abReveal();
  }

  // The script is async, so it can run before the body has been parsed.
  // Poll for the elements like the real tools do, then reveal.
  if (apply()) {
    reveal();
  } else {
    var poll = setInterval(function () {
      if (apply() || document.readyState !== "loading") {
        apply();
        clearInterval(poll);
        reveal();
      }
    }, 50);
  }

  // React may replace the text when it hydrates. Put the change back.
  if (changes.length) {
    new MutationObserver(apply).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  var beacon = new URL("/collect", document.currentScript ? document.currentScript.src : location.href);
  beacon.searchParams.set("e", config.experiment);
  beacon.searchParams.set("v", variant);
  navigator.sendBeacon && navigator.sendBeacon(beacon.toString());
})();
