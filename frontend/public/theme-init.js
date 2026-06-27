(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("app_theme");
  } catch (_e) {
    stored = null;
  }

  var allowed = ["soft", "vextrom", "xvextrom", "xvetrom"];
  var theme = allowed.indexOf(stored) >= 0 ? stored : "vextrom";
  if (theme === "xvetrom") theme = "xvextrom";

  document.documentElement.setAttribute("data-theme", theme);
})();
