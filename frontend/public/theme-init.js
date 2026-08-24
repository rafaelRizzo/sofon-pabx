(function () {
  var key = "vite-ui-theme";
  var stored = localStorage.getItem(key);
  var theme = stored === "light" || stored === "dark" ? stored : "system";
  var resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  document.documentElement.classList.add(resolved);
  document.documentElement.style.colorScheme = resolved;
})();
