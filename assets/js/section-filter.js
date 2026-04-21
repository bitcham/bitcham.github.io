(function () {
  function initMobileMenu() {
    var toggle = document.querySelector("[data-mobile-menu-toggle]");
    var menu = document.querySelector("[data-mobile-menu]");

    if (!toggle || !menu) {
      return;
    }

    toggle.addEventListener("click", function () {
      menu.classList.toggle("hidden");
    });
  }

  function getCutoff(period) {
    if (period === "all") {
      return null;
    }

    var months = Number(period);
    var cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return cutoff;
  }

  function setPeriodButton(button, active) {
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.classList.toggle("bg-primary", active);
    button.classList.toggle("text-on-primary", active);
    button.classList.toggle("border", !active);
    button.classList.toggle("border-outline-variant/20", !active);
    button.classList.toggle("bg-surface", !active);
    button.classList.toggle("text-on-surface-variant", !active);
  }

  function initSectionFilters() {
    var page = document.querySelector("[data-section-page]");

    if (!page) {
      return;
    }

    var grid = page.querySelector("[data-article-grid]");
    var cards = Array.prototype.slice.call(page.querySelectorAll("[data-post-card]"));
    var emptyState = page.querySelector("[data-empty-state]");
    var sortSelect = page.querySelector("[data-sort-select]");
    var periodButtons = Array.prototype.slice.call(page.querySelectorAll("[data-period-button]"));
    var domainCheckboxes = Array.prototype.slice.call(page.querySelectorAll("[data-domain-checkbox]"));
    var allDomain = domainCheckboxes.find(function (input) {
      return input.value === "ALL";
    });
    var state = {
      sort: sortSelect ? sortSelect.value : "desc",
      period: "all"
    };

    if (!grid || cards.length === 0) {
      return;
    }

    function selectedDomains() {
      if (domainCheckboxes.length === 0 || (allDomain && allDomain.checked)) {
        return ["ALL"];
      }

      return domainCheckboxes
        .filter(function (input) {
          return input.checked && input.value !== "ALL";
        })
        .map(function (input) {
          return input.value;
        });
    }

    function matchesPeriod(card) {
      var cutoff = getCutoff(state.period);

      if (!cutoff) {
        return true;
      }

      return new Date(card.dataset.date) >= cutoff;
    }

    function matchesDomain(card) {
      var domains = selectedDomains();

      if (domains.indexOf("ALL") >= 0) {
        return true;
      }

      return domains.indexOf(card.dataset.domain) >= 0;
    }

    function applyFilters() {
      var visibleCount = 0;
      var sortedCards = cards.slice().sort(function (left, right) {
        var leftTime = new Date(left.dataset.date).getTime();
        var rightTime = new Date(right.dataset.date).getTime();
        return state.sort === "asc" ? leftTime - rightTime : rightTime - leftTime;
      });

      sortedCards.forEach(function (card) {
        grid.appendChild(card);
      });

      sortedCards.forEach(function (card) {
        var visible = matchesPeriod(card) && matchesDomain(card);
        card.classList.toggle("hidden", !visible);

        if (visible) {
          visibleCount += 1;
        }
      });

      if (emptyState) {
        emptyState.classList.toggle("hidden", visibleCount !== 0);
      }
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", function (event) {
        state.sort = event.target.value;
        applyFilters();
      });
    }

    periodButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        state.period = button.dataset.periodButton;

        periodButtons.forEach(function (candidate) {
          setPeriodButton(candidate, candidate === button);
        });

        applyFilters();
      });
    });

    domainCheckboxes.forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        var selectedSpecifics = domainCheckboxes.filter(function (input) {
          return input.value !== "ALL" && input.checked;
        });

        if (checkbox.value === "ALL" && checkbox.checked) {
          domainCheckboxes.forEach(function (input) {
            if (input.value !== "ALL") {
              input.checked = false;
            }
          });
        }

        if (checkbox.value !== "ALL" && checkbox.checked && allDomain) {
          allDomain.checked = false;
        }

        if (checkbox.value === "ALL" && !checkbox.checked && selectedSpecifics.length === 0) {
          checkbox.checked = true;
        }

        if (checkbox.value !== "ALL" && selectedSpecifics.length === 0 && allDomain) {
          allDomain.checked = true;
        }

        applyFilters();
      });
    });

    applyFilters();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMobileMenu();
    initSectionFilters();
  });
})();
