document.addEventListener('DOMContentLoaded', function () {
  // Back-to-top button
  var toTop = document.getElementById('dtToTop');
  if (toTop) {
    window.addEventListener('scroll', function () {
      toTop.classList.toggle('show', window.scrollY > 400);
    });
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Fade-in on scroll
  var fadeEls = document.querySelectorAll('.dt-fade');
  if ('IntersectionObserver' in window && fadeEls.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    fadeEls.forEach(function (el) { observer.observe(el); });
  } else {
    fadeEls.forEach(function (el) { el.classList.add('in'); });
  }
});
