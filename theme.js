// Hell/Dunkel: folgt dem System, bis jemand umschaltet; Wahl wird pro Gerät gemerkt
(function(){
  var KEY = "kyushu-theme", root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function saved(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
  function effective(){ var s = saved(); return s || (mq && mq.matches ? "dark" : "light"); }
  function apply(){
    var s = saved(); if(s) root.setAttribute("data-theme", s); else root.removeAttribute("data-theme");
    var dark = effective() === "dark";
    var m = document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", dark ? "#0e1418" : (m.dataset.light || m.getAttribute("content")));
    var b = document.getElementById("themeBtn");
    if(b){ b.textContent = dark ? "☀︎" : "☾"; b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode"); b.title = b.getAttribute("aria-label"); }
  }
  var m0 = document.querySelector('meta[name="theme-color"]'); if(m0) m0.dataset.light = m0.getAttribute("content");
  apply();
  if(mq && mq.addEventListener) mq.addEventListener("change", apply);
  function addBtn(){
    if(document.getElementById("themeBtn")) return;
    var b = document.createElement("button"); b.id = "themeBtn"; b.type = "button"; b.className = "themebtn";
    b.addEventListener("click", function(){ try{ localStorage.setItem(KEY, effective() === "dark" ? "light" : "dark"); }catch(e){} apply(); });
    document.body.appendChild(b); apply();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", addBtn); else addBtn();
})();
