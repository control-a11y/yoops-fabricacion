/* ============================================
   Searchable Combobox - Shared Component
   ============================================
   
   Usage:
   1. HTML structure:
      <div class="searchable-select" id="myCombobox">
          <div class="input-wrapper">
              <input type="text" id="myInput" placeholder="Buscar..." autocomplete="off">
              <span class="input-suffix search-icon">🔍</span>
          </div>
          <input type="hidden" id="myValue">
          <div class="searchable-dropdown hidden" id="myDropdown">
              <div class="searchable-list" id="myList"></div>
          </div>
      </div>

   2. JS:
      const combo = new SearchableCombo({
          inputEl: document.getElementById('myInput'),
          valueEl: document.getElementById('myValue'),
          dropdownEl: document.getElementById('myDropdown'),
          listEl: document.getElementById('myList'),
          containerId: 'myCombobox',
          items: ['Item 1', 'Item 2', ...],
          onSelect: (value) => { ... }  // optional callback
      });

      // Update items later:
      combo.setItems(['New Item 1', ...]);
      
      // Get value:
      combo.getValue();
      
      // Reset:
      combo.reset();
   ============================================ */

class SearchableCombo {
    constructor(opts) {
        this.inputEl = opts.inputEl;
        this.valueEl = opts.valueEl;
        this.dropdownEl = opts.dropdownEl;
        this.listEl = opts.listEl;
        this.containerId = opts.containerId;
        this.items = opts.items || [];
        this.onSelect = opts.onSelect || null;
        this.highlightedIdx = -1;

        this._bindEvents();
    }

    setItems(items) {
        this.items = items || [];
    }

    getValue() {
        return this.valueEl.value;
    }

    reset() {
        this.inputEl.value = '';
        this.valueEl.value = '';
        this.highlightedIdx = -1;
        this.dropdownEl.classList.add('hidden');
    }

    _render(filter = '') {
        this.listEl.innerHTML = '';
        const query = filter.toLowerCase().trim();
        const filtered = query
            ? this.items.filter(a => a.toLowerCase().includes(query))
            : this.items;

        if (filtered.length === 0) {
            this.listEl.innerHTML = '<div class="searchable-no-results">Sin resultados</div>';
            return;
        }

        filtered.forEach((name, idx) => {
            const item = document.createElement('div');
            item.className = 'searchable-item';
            if (name === this.valueEl.value) item.classList.add('selected');
            item.dataset.value = name;
            item.dataset.idx = idx;

            if (query) {
                const lowerName = name.toLowerCase();
                const matchStart = lowerName.indexOf(query);
                if (matchStart >= 0) {
                    const before = name.substring(0, matchStart);
                    const match = name.substring(matchStart, matchStart + query.length);
                    const after = name.substring(matchStart + query.length);
                    item.innerHTML = `${before}<mark>${match}</mark>${after}`;
                } else {
                    item.textContent = name;
                }
            } else {
                item.textContent = name;
            }

            item.addEventListener('click', () => this._select(name));
            this.listEl.appendChild(item);
        });
        this.highlightedIdx = -1;
    }

    _select(name) {
        this.inputEl.value = name;
        this.valueEl.value = name;
        this.dropdownEl.classList.add('hidden');
        this.highlightedIdx = -1;
        if (this.onSelect) this.onSelect(name);
    }

    _open() {
        this._render(this.inputEl.value);
        this.dropdownEl.classList.remove('hidden');
    }

    _close() {
        this.dropdownEl.classList.add('hidden');
        this.highlightedIdx = -1;
    }

    _updateHighlight(items) {
        items.forEach((el, i) => {
            el.classList.toggle('highlighted', i === this.highlightedIdx);
            if (i === this.highlightedIdx) el.scrollIntoView({ block: 'nearest' });
        });
    }

    _bindEvents() {
        this.inputEl.addEventListener('focus', () => this._open());

        this.inputEl.addEventListener('input', () => {
            this.valueEl.value = '';
            this._render(this.inputEl.value);
            this.dropdownEl.classList.remove('hidden');
        });

        this.inputEl.addEventListener('keydown', (e) => {
            const items = this.listEl.querySelectorAll('.searchable-item');
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.highlightedIdx = Math.min(this.highlightedIdx + 1, items.length - 1);
                this._updateHighlight(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.highlightedIdx = Math.max(this.highlightedIdx - 1, 0);
                this._updateHighlight(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.highlightedIdx >= 0 && items[this.highlightedIdx]) {
                    this._select(items[this.highlightedIdx].dataset.value);
                }
            } else if (e.key === 'Escape') {
                this._close();
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest(`#${this.containerId}`)) {
                this._close();
            }
        });
    }
}
