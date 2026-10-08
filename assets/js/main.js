(function () {
  "use strict";

  var mobileQuery = window.matchMedia("(max-width: 1020px)");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var toggle = document.querySelector(".nav-toggle");
  var panel = document.querySelector("[data-nav-panel]");
  var dropdowns = Array.prototype.slice.call(document.querySelectorAll("[data-nav-dropdown]"));
  var lastFocused = null;
  var openLabel = toggle ? toggle.getAttribute("aria-label") || "Open navigation" : "Open navigation";
  var closeLabel = toggle
    ? toggle.getAttribute("data-close-label") || openLabel.replace(/^open/i, "Close")
    : "Close navigation";

  function setInert(element, value) {
    if (!element) return;
    element.inert = value;
    if (value) element.setAttribute("inert", "");
    else element.removeAttribute("inert");
  }

  function dropdownControl(dropdown) {
    return dropdown ? dropdown.querySelector("[data-dropdown-toggle]") : null;
  }

  function dropdownPanel(dropdown) {
    return dropdown ? dropdown.querySelector("[data-dropdown-panel]") : null;
  }

  function setDropdownOpen(dropdown, open) {
    var control = dropdownControl(dropdown);
    var submenu = dropdownPanel(dropdown);
    if (!dropdown || !control || !submenu) return;
    dropdown.classList.toggle("is-open", open);
    control.setAttribute("aria-expanded", open ? "true" : "false");
    submenu.setAttribute("aria-hidden", open ? "false" : "true");
    var state = control.querySelector("[data-dropdown-state]");
    if (state) {
      state.textContent = open
        ? control.getAttribute("data-close-label") || "Close menu"
        : control.getAttribute("data-open-label") || "Open menu";
    }
  }

  function closeDropdowns(except) {
    dropdowns.forEach(function (dropdown) {
      if (dropdown !== except) setDropdownOpen(dropdown, false);
    });
  }

  dropdowns.forEach(function (dropdown) {
    var control = dropdownControl(dropdown);
    var submenu = dropdownPanel(dropdown);
    var closeTimer = 0;
    if (!control || !submenu) return;

    setDropdownOpen(dropdown, false);

    control.addEventListener("click", function () {
      // Desktop menus already open on pointer/focus entry; activating the
      // chevron should keep that intent open rather than immediately undoing
      // the preceding pointerenter. Mobile uses the control as a true
      // accordion toggle because hover is unavailable there.
      var shouldOpen = mobileQuery.matches
        ? control.getAttribute("aria-expanded") !== "true"
        : true;
      closeDropdowns(dropdown);
      setDropdownOpen(dropdown, shouldOpen);
    });

    control.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      closeDropdowns(dropdown);
      setDropdownOpen(dropdown, true);
      var items = submenu.querySelectorAll("a[href]");
      var item = event.key === "ArrowUp" ? items[items.length - 1] : items[0];
      if (item) item.focus();
    });

    dropdown.addEventListener("pointerenter", function () {
      if (mobileQuery.matches) return;
      window.clearTimeout(closeTimer);
      closeDropdowns(dropdown);
      setDropdownOpen(dropdown, true);
    });

    dropdown.addEventListener("pointerleave", function () {
      if (mobileQuery.matches) return;
      closeTimer = window.setTimeout(function () {
        if (!dropdown.contains(document.activeElement)) setDropdownOpen(dropdown, false);
      }, 140);
    });

    dropdown.addEventListener("focusin", function () {
      if (mobileQuery.matches) return;
      window.clearTimeout(closeTimer);
      closeDropdowns(dropdown);
      setDropdownOpen(dropdown, true);
    });

    dropdown.addEventListener("focusout", function (event) {
      if (mobileQuery.matches || dropdown.contains(event.relatedTarget)) return;
      closeTimer = window.setTimeout(function () {
        if (!dropdown.contains(document.activeElement)) setDropdownOpen(dropdown, false);
      }, 0);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var openDropdown = dropdowns.find(function (dropdown) {
      return dropdown.classList.contains("is-open");
    });
    if (!openDropdown) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setDropdownOpen(openDropdown, false);
    var control = dropdownControl(openDropdown);
    if (control) control.focus();
  });

  document.addEventListener("pointerdown", function (event) {
    var insideDropdown = dropdowns.some(function (dropdown) {
      return dropdown.contains(event.target);
    });
    if (!insideDropdown) closeDropdowns();
  });

  function backgroundNodes() {
    return [
      document.querySelector(".topbar"),
      document.querySelector(".navbar > .brand"),
      document.querySelector("main"),
      document.querySelector(".footer"),
      document.querySelector(".sticky-call"),
    ].filter(Boolean);
  }

  function menuIsOpen() {
    return Boolean(toggle && toggle.getAttribute("aria-expanded") === "true");
  }

  function focusableMenuItems() {
    if (!panel) return [];
    return Array.prototype.slice.call(
      panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'),
    ).filter(function (item) {
      var collapsed = item.closest("[data-dropdown-panel][aria-hidden=\"true\"]");
      return !collapsed && item.getClientRects().length > 0;
    });
  }

  function openMenu() {
    if (!toggle || !panel || !mobileQuery.matches) return;
    lastFocused = document.activeElement;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", closeLabel);
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    setInert(panel, false);
    document.body.classList.add("menu-open");
    backgroundNodes().forEach(function (node) {
      setInert(node, true);
      node.setAttribute("aria-hidden", "true");
    });
    window.requestAnimationFrame(function () {
      var items = focusableMenuItems();
      if (items.length) items[0].focus();
    });
  }

  function closeMenu(options) {
    if (!toggle || !panel) return;
    var shouldRestore = !options || options.restoreFocus !== false;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", openLabel);
    panel.classList.remove("open");
    closeDropdowns();
    document.body.classList.remove("menu-open");
    backgroundNodes().forEach(function (node) {
      setInert(node, false);
      node.removeAttribute("aria-hidden");
    });
    if (mobileQuery.matches) {
      panel.setAttribute("aria-hidden", "true");
      setInert(panel, true);
    } else {
      panel.removeAttribute("aria-hidden");
      setInert(panel, false);
    }
    if (shouldRestore && lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
    lastFocused = null;
    syncStickyCall();
  }

  function syncMenuMode() {
    if (!toggle || !panel) return;
    if (mobileQuery.matches) {
      if (!menuIsOpen()) {
        panel.setAttribute("aria-hidden", "true");
        setInert(panel, true);
      }
    } else {
      closeMenu({ restoreFocus: false });
      panel.removeAttribute("aria-hidden");
      setInert(panel, false);
    }
  }

  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      if (menuIsOpen()) closeMenu();
      else openMenu();
    });

    panel.addEventListener("click", function (event) {
      if (!mobileQuery.matches) return;
      var link = event.target.closest("a");
      if (!link) return;
      var href = link.getAttribute("href") || "";
      if (href.charAt(0) !== "#") {
        closeMenu({ restoreFocus: false });
        return;
      }

      var id = href.slice(1);
      try { id = decodeURIComponent(id); } catch (_) { /* Use the literal fragment. */ }
      var target = id ? document.getElementById(id) : null;
      if (!target) {
        closeMenu();
        return;
      }

      var addedTabIndex = !target.hasAttribute("tabindex") &&
        !target.matches('a[href], button, input, select, textarea, summary');
      if (addedTabIndex) target.setAttribute("tabindex", "-1");
      closeMenu({ restoreFocus: false });
      target.focus({ preventScroll: true });
      if (addedTabIndex) {
        target.addEventListener("blur", function () {
          target.removeAttribute("tabindex");
        }, { once: true });
      }
    });

    document.addEventListener("keydown", function (event) {
      if (!menuIsOpen()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      var items = [toggle].concat(focusableMenuItems());
      if (!items.length) return;
      var first = items[0];
      var firstMenuItem = items[1];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (event.shiftKey && firstMenuItem && document.activeElement === firstMenuItem) {
        event.preventDefault();
        first.focus();
      } else if (!event.shiftKey && firstMenuItem && document.activeElement === first) {
        event.preventDefault();
        firstMenuItem.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    document.addEventListener("pointerdown", function (event) {
      if (!menuIsOpen() || panel.contains(event.target) || toggle.contains(event.target)) return;
      closeMenu();
    });

    if (typeof mobileQuery.addEventListener === "function") mobileQuery.addEventListener("change", syncMenuMode);
    else mobileQuery.addListener(syncMenuMode);
    window.addEventListener("pageshow", function () { closeMenu({ restoreFocus: false }); });
    syncMenuMode();
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-copy-code]"), function (button) {
    button.addEventListener("click", function () {
      var code = button.getAttribute("data-copy-code") || "";
      var status = button.parentElement ? button.parentElement.querySelector(".copy-status") : null;

      function announce(success) {
        if (status) status.textContent = success ? code + " copied." : "Copy unavailable. Code: " + code;
        if (success) {
          var original = button.textContent;
          button.textContent = code + " copied";
          window.setTimeout(function () { button.textContent = original; }, 1800);
        }
      }

      function fallbackCopy() {
        var input = document.createElement("textarea");
        input.value = code;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        var copied = false;
        try { copied = document.execCommand("copy"); } catch (_) { copied = false; }
        input.remove();
        announce(copied);
      }

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(function () { announce(true); }, fallbackCopy);
      } else {
        fallbackCopy();
      }
    });
  });

  function leadsConfig() {
    var config = window.__RL_LEADS || {};
    var apiBase = String(config.apiBase || "");
    var siteId = String(config.siteId || "");
    if (!/^https?:\/\//.test(apiBase) || !siteId || siteId.indexOf("{{") !== -1) return null;
    return {
      apiBase: apiBase.replace(/\/+$/, ""),
      siteId: siteId,
    };
  }

  function leadFormFromEvent(event) {
    var detailForm = event.detail && event.detail.form;
    return detailForm || (event.target && event.target.closest
      ? event.target.closest("form[data-rl-lead]")
      : null);
  }

  function revealLeadSuccess(event) {
    var form = leadFormFromEvent(event);
    if (!form || !form.matches("form[data-rl-lead]")) return;
    form.classList.remove("is-error");
    form.classList.add("is-success");
    form.setAttribute("data-status", "success");
    var status = form.querySelector(".form-success");
    if (status) status.classList.add("visible");
    var error = form.querySelector(".form-error");
    if (error) error.classList.remove("visible");
    var button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.removeAttribute("aria-busy");
    }
  }

  function revealLeadError(event) {
    var form = leadFormFromEvent(event);
    if (!form || !form.matches("form[data-rl-lead]")) return;
    form.classList.remove("is-success");
    form.classList.add("is-error");
    form.setAttribute("data-status", "error");
    var success = form.querySelector(".form-success");
    if (success) success.classList.remove("visible");
    var status = form.querySelector(".form-error");
    if (status) {
      status.classList.add("visible");
      status.focus({ preventScroll: true });
    }
    var button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }

  document.addEventListener("submit", function (event) {
    var form = event.target && event.target.matches && event.target.matches("form[data-rl-lead]")
      ? event.target
      : null;
    if (!form) return;
    event.preventDefault();
    if (form.getAttribute("data-status") === "success" || form.getAttribute("data-status") === "pending") return;

    var honeypot = form.querySelector('[name="_hp"]');
    if (honeypot && honeypot.value) {
      revealLeadSuccess({ detail: { form: form } });
      return;
    }

    var config = leadsConfig();
    if (!config) {
      revealLeadError({ detail: { form: form } });
      return;
    }

    form.classList.remove("is-error");
    form.setAttribute("data-status", "pending");
    var previousError = form.querySelector(".form-error");
    if (previousError) previousError.classList.remove("visible");
    var button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }

    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (key === "_hp") return;
      if (key === "cf-turnstile-response") {
        if (value) data.turnstileToken = String(value);
        return;
      }
      data[key] = typeof value === "string" ? value : String(value);
    });
    data.pageUrl = window.location.href;

    try {
      fetch(config.apiBase + "/api/leads/" + encodeURIComponent(config.siteId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        keepalive: true,
      }).then(function (response) {
        if (!response.ok) throw new Error("Lead request failed");
        revealLeadSuccess({ detail: { form: form } });
      }).catch(function () {
        revealLeadError({ detail: { form: form } });
      });
    } catch (_) {
      revealLeadError({ detail: { form: form } });
    }
  });

  document.addEventListener("rl:lead-success", revealLeadSuccess);
  document.addEventListener("ranklocal:lead-success", revealLeadSuccess);
  document.addEventListener("rl:lead-error", revealLeadError);
  document.addEventListener("ranklocal:lead-error", revealLeadError);

  function markCurrentNavigation() {
    var current = window.location.pathname.replace(/\/+$/, "") || "/";
    Array.prototype.forEach.call(document.querySelectorAll(".nav-links a[href]"), function (link) {
      var raw = link.getAttribute("href");
      if (!raw || raw.charAt(0) === "#" || raw.indexOf("tel:") === 0 || raw.indexOf("mailto:") === 0) return;
      try {
        var target = new URL(raw, window.location.href).pathname.replace(/\/+$/, "") || "/";
        if (target === current) link.setAttribute("aria-current", "page");
      } catch (_) {
        /* Ignore malformed user-provided URLs. */
      }
    });
  }
  markCurrentNavigation();

  var stickyCall = document.querySelector(".sticky-call");
  function syncStickyCall() {
    if (!stickyCall) return;
    var visible = mobileQuery.matches && window.scrollY > Math.min(280, window.innerHeight * 0.38);
    stickyCall.classList.toggle("is-visible", visible);
    stickyCall.setAttribute("aria-hidden", visible ? "false" : "true");
    stickyCall.tabIndex = visible ? 0 : -1;
  }
  if (stickyCall) {
    window.addEventListener("scroll", syncStickyCall, { passive: true });
    window.addEventListener("resize", syncStickyCall);
    window.addEventListener("pageshow", syncStickyCall);
    if (typeof mobileQuery.addEventListener === "function") mobileQuery.addEventListener("change", syncStickyCall);
    else mobileQuery.addListener(syncStickyCall);
    syncStickyCall();
  }

  if (!reduceMotion.matches && "IntersectionObserver" in window) {
    document.documentElement.classList.add("motion-ready");
    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("sal-animate");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    Array.prototype.forEach.call(document.querySelectorAll("[data-sal]"), function (element) {
      revealObserver.observe(element);
    });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll("[data-sal]"), function (element) {
      element.classList.add("sal-animate");
    });
  }

  if ("IntersectionObserver" in window) {
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".blog-toc-link"));
    var tocById = {};
    tocLinks.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if (href.charAt(0) === "#") tocById[href.slice(1)] = link;
    });
    var headings = Object.keys(tocById).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (headings.length) {
      var tocObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          tocLinks.forEach(function (link) { link.classList.remove("is-active"); });
          if (tocById[entry.target.id]) tocById[entry.target.id].classList.add("is-active");
        });
      }, { rootMargin: "-24% 0px -64% 0px", threshold: 0 });
      headings.forEach(function (heading) { tocObserver.observe(heading); });
    }
  }
})();
