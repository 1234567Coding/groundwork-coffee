/* Groundwork Coffee — site.js
   Shared progressive enhancements for the static site:
   1. mobile nav toggle, 2. site search, 3. article table of contents,
   4. reading progress bar, 5. sortable tables, 6. FAQ accordions,
   7. dark mode, 8. back-to-top button.
   Everything degrades gracefully: without JS the site is fully readable
   (plain search box, expanded FAQs, static tables, light theme). */
(function () {
  'use strict';

  // Articles live in articles/; the site root is one level up from there.
  var ROOT = location.pathname.indexOf('/articles/') !== -1 ? '../' : '';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function each(list, fn) {
    for (var i = 0; i < list.length; i++) fn(list[i], i);
  }

  /* ---------- 1. Mobile nav toggle ---------- */
  function initNav() {
    var btn = document.getElementById('navToggle');
    var nav = document.getElementById('siteNav');
    if (!btn || !nav || btn.getAttribute('data-initialized')) return;
    btn.setAttribute('data-initialized', 'true');
    function setOpen(open) {
      nav.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      setOpen(!nav.classList.contains('open'));
    });
    each(nav.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        setOpen(false);
        btn.focus();
      }
    });
  }

  /* ---------- 2. Site-wide client-side search ---------- */
  function initSearch() {
    var input = document.getElementById('siteSearch');
    var results = document.getElementById('siteSearchResults');
    if (!input || !results || input.getAttribute('data-initialized')) return;
    input.setAttribute('data-initialized', 'true');

    var index = null;
    var active = -1;

    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function closeResults() {
      results.hidden = true;
      results.innerHTML = '';
      active = -1;
      input.setAttribute('aria-expanded', 'false');
    }

    function render() {
      var q = input.value.trim().toLowerCase();
      closeResults();
      if (q.length < 2 || !index) return;
      var terms = q.split(/\s+/);
      var hits = [];
      each(index, function (entry) {
        var hay = (entry.title + ' ' + entry.excerpt + ' ' + (entry.headings || []).join(' ')).toLowerCase();
        var match = true;
        for (var i = 0; i < terms.length; i++) {
          if (hay.indexOf(terms[i]) === -1) { match = false; break; }
        }
        if (match) hits.push(entry);
      });
      hits = hits.slice(0, 8);
      if (!hits.length) {
        results.innerHTML = '<li class="site-search-none">No guides found for \u201C' + esc(input.value.trim()) + '\u201D.</li>';
      } else {
        var html = '';
        each(hits, function (entry) {
          html += '<li role="option"><a href="' + ROOT + esc(entry.url) + '">' +
            '<strong>' + esc(entry.title) + '</strong>' +
            '<span>' + esc(entry.excerpt) + '</span></a></li>';
        });
        results.innerHTML = html;
      }
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    fetch(ROOT + 'search-index.json')
      .then(function (r) { if (!r.ok) throw new Error('index unavailable'); return r.json(); })
      .then(function (data) { if (Object.prototype.toString.call(data) === '[object Array]') index = data; })
      .catch(function () { index = null; }); // search silently disabled without the index

    input.addEventListener('input', function () { active = -1; render(); });
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) render(); });
    input.addEventListener('keydown', function (e) {
      var opts = results.querySelectorAll('li a');
      if (!opts.length) {
        if (e.key === 'Escape') { closeResults(); input.blur(); }
        return;
      }
      if (e.key === 'Escape') {
        closeResults();
        input.blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        active = (active + 1) % opts.length;
        setActive(opts);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active - 1 + opts.length) % opts.length;
        setActive(opts);
      } else if (e.key === 'Enter' && active >= 0 && opts[active]) {
        opts[active].click();
      }
    });

    function setActive(opts) {
      each(opts, function (o, i) { o.classList.toggle('active', i === active); });
      // focus stays in the input so arrow keys keep working; the .active link is highlighted
    }

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.site-search')) closeResults();
    });
  }

  /* ---------- 3. Article table of contents + scroll-spy ---------- */
  function slugify(text) {
    var s = text.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return s || 'section';
  }

  function initToc() {
    var post = document.querySelector('article.post');
    if (!post || post.querySelector('.toc')) return;
    var heads = [];
    each(post.querySelectorAll('h2, h3'), function (h) {
      if (h.closest('.keep-reading')) return;                    // skip "Keep Reading"
      if (h.tagName === 'H3' && h.closest('.faq')) return;       // FAQ questions get accordions instead
      heads.push(h);
    });
    if (heads.length < 2) return;

    var used = {};
    each(heads, function (h) {
      if (!h.id) {
        var base = slugify(h.textContent), slug = base, n = 1;
        while (used[slug]) { n++; slug = base + '-' + n; }
        h.id = slug;
      }
      used[h.id] = true;
    });

    var nav = document.createElement('nav');
    nav.className = 'toc';
    nav.setAttribute('aria-label', 'On this page');
    var title = document.createElement('h2');
    title.textContent = 'On this page';
    var ul = document.createElement('ul');
    each(heads, function (h) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.setAttribute('data-target', h.id);
      if (h.tagName === 'H3') li.className = 'toc-h3';
      li.appendChild(a);
      ul.appendChild(li);
    });
    nav.appendChild(title);
    nav.appendChild(ul);
    var byline = post.querySelector('.byline');
    if (byline && byline.parentNode) {
      byline.parentNode.insertBefore(nav, byline.nextSibling);
    } else {
      post.insertBefore(nav, post.firstChild);
    }

    // Scroll-spy: highlight the section currently in view.
    if (!('IntersectionObserver' in window)) return;
    var links = ul.querySelectorAll('a');
    function clear() { each(links, function (l) { l.classList.remove('active'); }); }
    var obs = new IntersectionObserver(function (entries) {
      each(entries, function (en) {
        if (en.isIntersecting) {
          clear();
          each(links, function (l) {
            if (l.getAttribute('data-target') === en.target.id) l.classList.add('active');
          });
        }
      });
    }, { rootMargin: '-15% 0px -75% 0px' });
    each(heads, function (h) { obs.observe(h); });
  }

  /* ---------- 4. Reading progress bar ---------- */
  function initProgress() {
    var post = document.querySelector('article.post');
    if (!post || document.querySelector('.read-progress') || !('requestAnimationFrame' in window)) return;
    var bar = document.createElement('div');
    bar.className = 'read-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      ticking = false;
      var top = post.getBoundingClientRect().top + window.scrollY;
      var total = post.offsetHeight - window.innerHeight;
      var p = total > 0 ? (window.scrollY - top) / total : 0;
      p = Math.max(0, Math.min(1, p));
      bar.style.width = (p * 100).toFixed(2) + '%';
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ---------- 5. Sortable comparison tables ---------- */
  function firstNumber(s) {
    var m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }

  function initSortable() {
    var tables = document.querySelectorAll('article.post table');
    each(tables, function (table) {
      if (table.classList.contains('sortable')) return; // already initialized
      var thead = table.querySelector('thead');
      if (!thead) return;
      var ths = thead.querySelectorAll('th');
      if (!ths.length) return;
      table.classList.add('sortable');
      each(ths, function (th, col) {
        th.setAttribute('tabindex', '0');
        th.setAttribute('role', 'columnheader');
        th.setAttribute('aria-sort', 'none');
        function sort() {
          var tbody = table.querySelector('tbody') || table;
          var rows = [];
          each(tbody.querySelectorAll('tr'), function (r) { rows.push(r); });
          var asc = th.getAttribute('aria-sort') !== 'ascending';
          var numeric = rows.length > 0 && rows.every(function (r) {
            var cell = r.cells && r.cells[col];
            return cell && firstNumber(cell.textContent) !== null;
          });
          rows.sort(function (a, b) {
            var ca = a.cells && a.cells[col] ? a.cells[col].textContent.trim() : '';
            var cb = b.cells && b.cells[col] ? b.cells[col].textContent.trim() : '';
            var cmp;
            if (numeric) cmp = firstNumber(ca) - firstNumber(cb);
            else cmp = ca.toLowerCase().localeCompare(cb.toLowerCase());
            return asc ? cmp : -cmp;
          });
          each(rows, function (r) { tbody.appendChild(r); });
          each(ths, function (o) {
            o.setAttribute('aria-sort', 'none');
            o.classList.remove('sorted-asc', 'sorted-desc');
          });
          th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
          th.classList.add(asc ? 'sorted-asc' : 'sorted-desc');
        }
        th.addEventListener('click', sort);
        th.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); }
        });
      });
    });
  }

  /* ---------- 6. FAQ accordions ---------- */
  function initFaq() {
    var faqs = document.querySelectorAll('.faq');
    each(faqs, function (faq, fi) {
      each(faq.querySelectorAll('h3'), function (q, qi) {
        var item = document.createElement('div');
        item.className = 'faq-item';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'faq-q';
        var answerId = 'faq-answer-' + fi + '-' + qi;
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', answerId);
        var icon = document.createElement('span');
        icon.className = 'faq-icon';
        icon.setAttribute('aria-hidden', 'true');
        while (q.firstChild) btn.appendChild(q.firstChild); // preserve any inline markup
        btn.appendChild(icon);
        var answer = document.createElement('div');
        answer.className = 'faq-answer';
        answer.id = answerId;
        answer.hidden = true;
        var node = q.nextElementSibling;
        while (node && node.tagName !== 'H3') {
          var next = node.nextElementSibling;
          answer.appendChild(node);
          node = next;
        }
        q.parentNode.replaceChild(item, q);
        item.appendChild(btn);
        item.appendChild(answer);
        btn.addEventListener('click', function () {
          var open = btn.getAttribute('aria-expanded') === 'true';
          btn.setAttribute('aria-expanded', open ? 'false' : 'true');
          answer.hidden = open;
        });
      });
    });
  }

  /* ---------- 7. Dark mode ---------- */
  var THEME_KEY = 'gw-theme';

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function initTheme() {
    var btn = document.getElementById('themeToggle');
    var mode = document.documentElement.getAttribute('data-theme');
    if (mode !== 'dark' && mode !== 'light') {
      mode = storedTheme() ||
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', mode);
    }
    function updateBtn() {
      if (!btn) return;
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    if (btn) {
      btn.addEventListener('click', function () {
        var dark = document.documentElement.getAttribute('data-theme') === 'dark';
        var next = dark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        updateBtn();
      });
    }
    updateBtn();
  }

  /* ---------- 8. Back-to-top button ---------- */
  function initBackToTop() {
    if (document.querySelector('.back-to-top')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(btn);
    function onScroll() {
      btn.classList.toggle('show', window.scrollY > 600);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', function () {
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
    onScroll();
  }

  ready(function () {
    var inits = [initNav, initSearch, initToc, initProgress, initSortable, initFaq, initTheme, initBackToTop];
    each(inits, function (fn) {
      try { fn(); } catch (e) { /* each feature degrades independently */ }
    });
  });
})();
