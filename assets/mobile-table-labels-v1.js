(function () {
  'use strict';

  function labelExamTables() {
    document.querySelectorAll('.dates-table').forEach(function (table) {
      var labels = Array.prototype.map.call(table.querySelectorAll('thead th'), function (heading) {
        return heading.textContent.trim();
      });

      table.querySelectorAll('tbody tr').forEach(function (row) {
        Array.prototype.forEach.call(row.children, function (cell, index) {
          cell.setAttribute('data-label', labels[index] || 'Detail');
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', labelExamTables, { once: true });
  } else {
    labelExamTables();
  }
})();
