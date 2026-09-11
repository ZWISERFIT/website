/**
 * ZWISERFIT website tracking — treasure hunt analytics
 * 
 * Events sent to /funnel:
 *   pv          — page view (on load)
 *   door_click  — user clicked a path door
 *   nav_click   — user clicked a nav link
 *   install     — user clicked install button
 * 
 * Privacy: no PII, no cookies, no third-party SDK.
 * Only records: page path, event type, depth, door target.
 */
(function () {
  'use strict';

  var ENDPOINT = '/funnel';

  // Treasure hunt depth layers
  var DEPTH_MAP = {
    '/': 0,
    '/v2/': 0,
    '/start-here/': 1,
    '/know-lao/': 1,
    '/know-zwiserfit/': 1,
    '/agent-know/': 1,
    '/contact/': 1,
    '/for-users/': 2,
    '/for-agents/': 2,
    '/for-investors/': 2,
    '/lao/': 3,
    '/evidence/': 3,
    '/download/': 3,
    '/experience/': 4,
    '/reliable-agent/': 4,
    '/digital-employee/': 4,
    '/experience-protocol/': 5,
    '/experience-catalog/': 5,
    '/ai-native-business/': 5,
    '/market/': 3,
    '/trust/': 3,
    '/about/': 3,
    '/privacy/': 3,
    '/community/': 3
  };

  // Door target mapping (which path is the user entering)
  var DOOR_TARGETS = {
    '/know-lao/': 'lao',
    '/know-zwiserfit/': 'zwiserfit',
    '/agent-know/': 'agent',
    '/for-users/': 'user',
    '/for-agents/': 'agent-detail',
    '/for-investors/': 'investor',
    '/start-here/': 'dispatcher',
    '/contact/': 'contact'
  };

  function getDepth() {
    var path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path === '') path = '/';
    // Try exact match first
    if (DEPTH_MAP[path] !== undefined) return DEPTH_MAP[path];
    // Try with trailing slash
    if (DEPTH_MAP[path + '/'] !== undefined) return DEPTH_MAP[path + '/'];
    // Fallback: count slashes
    var parts = path.split('/').filter(Boolean);
    return parts.length;
  }

  function getDoorTarget(href) {
    if (!href) return null;
    var path = href.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '') + '/';
    if (path === '/') path = '/';
    return DOOR_TARGETS[path] || null;
  }

  function send(event, extra) {
    var payload = {
      source: 'web',
      page: window.location.pathname,
      event: event,
      extra: extra || {}
    };
    payload.extra.depth = getDepth();
    payload.extra.ts_client = Date.now();

    // Use sendBeacon for reliability (survives page unload)
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      } catch (e) { /* fallback below */ }
    }
    // Fallback: fetch with keepalive
    try {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (e) { /* silent */ }
  }

  // 1. Page view
  send('pv');

  // 2. Door clicks (links with class .door)
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a');
    if (!link) return;

    // Door card click
    if (link.classList.contains('door')) {
      var target = getDoorTarget(link.getAttribute('href'));
      send('door_click', { door: target || link.getAttribute('href') });
      return;
    }

    // Asset category click (market page)
    var trackType = link.getAttribute('data-track');
    if (trackType === 'asset_category_click') {
      send('asset_category_click', {
        category: link.getAttribute('data-category') || 'unknown',
        href: link.getAttribute('href')
      });
      return;
    }

    // Install button click
    if (link.classList.contains('btn') && link.getAttribute('href') &&
        link.getAttribute('href').indexOf('download') !== -1) {
      send('install');
      return;
    }

    // Nav link click
    var nav = link.closest('.nav');
    if (nav) {
      send('nav_click', { href: link.getAttribute('href') });
      return;
    }

    // Internal link click (treasure hunt depth tracking)
    var href = link.getAttribute('href');
    if (href && href.charAt(0) === '/' && href.indexOf('//') === -1) {
      send('page_nav', { href: href });
    }
    // Relative links (../path/)
    if (href && href.indexOf('../') === 0) {
      send('page_nav', { href: href });
    }
  });

  // 3. Track scroll depth (which percentage of page user reached)
  var maxScroll = 0;
  var scrollReported = false;
  window.addEventListener('scroll', function () {
    var pct = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
    if (pct > maxScroll) maxScroll = pct;
    // Report when user reaches 75% and hasn't reported yet
    if (maxScroll >= 75 && !scrollReported) {
      scrollReported = true;
      send('scroll_depth', { max_pct: maxScroll });
    }
  }, { passive: true });

  // 4. Report scroll depth on page unload
  window.addEventListener('beforeunload', function () {
    if (maxScroll > 0 && !scrollReported) {
      send('scroll_depth', { max_pct: maxScroll });
    }
    send('page_exit', { max_scroll: maxScroll, duration: Math.round((Date.now() - startTime) / 1000) });
  });

  var startTime = Date.now();
})();
