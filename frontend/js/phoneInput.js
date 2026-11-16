/**
 * Componente y Gestor de Teléfonos Internacionales con Formato Automático
 * - Selector de países con búsqueda por nombre y prefijo internacional.
 * - Formato automático con guiones en tiempo real mientras el usuario escribe (ej. 77778888 -> 7777-8888).
 * - Prevención de duplicación de prefijos y bloqueo de caracteres inválidos.
 * - Guardado estandarizado con prefijo internacional en MongoDB (ej. +503 7777-8888).
 */

export const COUNTRIES = [
  { code: 'SV', flag: '🇸🇻', name: 'El Salvador', dial: '+503', pattern: 'XXXX-XXXX', placeholder: '7777-8888', maxDigits: 8 },
  { code: 'US', flag: '🇺🇸', name: 'Estados Unidos', dial: '+1', pattern: 'XXX-XXX-XXXX', placeholder: '202-555-0143', maxDigits: 10 },
  { code: 'CA', flag: '🇨🇦', name: 'Canadá', dial: '+1', pattern: 'XXX-XXX-XXXX', placeholder: '416-555-0199', maxDigits: 10 },
  { code: 'MX', flag: '🇲🇽', name: 'México', dial: '+52', pattern: 'XX-XXXX-XXXX', placeholder: '55-1234-5678', maxDigits: 10 },
  { code: 'GT', flag: '🇬🇹', name: 'Guatemala', dial: '+502', pattern: 'XXXX-XXXX', placeholder: '4567-8901', maxDigits: 8 },
  { code: 'HN', flag: '🇭🇳', name: 'Honduras', dial: '+504', pattern: 'XXXX-XXXX', placeholder: '9876-5432', maxDigits: 8 },
  { code: 'NI', flag: '🇳🇮', name: 'Nicaragua', dial: '+505', pattern: 'XXXX-XXXX', placeholder: '8765-4321', maxDigits: 8 },
  { code: 'CR', flag: '🇨🇷', name: 'Costa Rica', dial: '+506', pattern: 'XXXX-XXXX', placeholder: '8888-7777', maxDigits: 8 },
  { code: 'PA', flag: '🇵🇦', name: 'Panamá', dial: '+507', pattern: 'XXXX-XXXX', placeholder: '6789-0123', maxDigits: 8 },
  { code: 'ES', flag: '🇪🇸', name: 'España', dial: '+34', pattern: 'XXX-XXX-XXX', placeholder: '612-345-678', maxDigits: 9 },
  { code: 'OT', flag: '🌐', name: 'Otros Países', dial: '+', pattern: 'XXXXXXXXXXXX', placeholder: '123456789', maxDigits: 15 }
];

const stateMap = new Map(); // idPrefix -> { countryCode, dial, rawDigits, formatted }

export function applyCountryMask(digits, country) {
  if (!digits) return '';
  const d = digits.slice(0, country.maxDigits);

  if (country.pattern === 'XXXX-XXXX') {
    if (d.length <= 4) return d;
    return `${d.slice(0, 4)}-${d.slice(4, 8)}`;
  }
  if (country.pattern === 'XXX-XXX-XXXX') {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3, 6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }
  if (country.pattern === 'XX-XXXX-XXXX') {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2, 6)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }
  if (country.pattern === 'XXX-XXX-XXX') {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3, 6)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}`;
  }
  return d;
}

export function parsePhoneNumber(fullPhone) {
  if (!fullPhone) return { country: COUNTRIES[0], digits: '', formatted: '' };

  const str = String(fullPhone).trim();
  let matchedCountry = COUNTRIES[0]; // Default El Salvador

  // Check prefix match
  for (const c of COUNTRIES) {
    if (c.code === 'OT') continue;
    if (str.startsWith(c.dial)) {
      matchedCountry = c;
      break;
    }
    // Check without plus
    const dialWithoutPlus = c.dial.replace('+', '');
    if (str.startsWith(dialWithoutPlus)) {
      matchedCountry = c;
      break;
    }
  }

  // Extract remaining digits
  let rest = str;
  if (rest.startsWith(matchedCountry.dial)) {
    rest = rest.slice(matchedCountry.dial.length);
  } else if (rest.startsWith(matchedCountry.dial.replace('+', ''))) {
    rest = rest.slice(matchedCountry.dial.replace('+', '').length);
  }

  const rawDigits = rest.replace(/\D/g, '').slice(0, matchedCountry.maxDigits);
  const formatted = applyCountryMask(rawDigits, matchedCountry);

  return { country: matchedCountry, digits: rawDigits, formatted };
}

export function renderPhoneInputHtml(idPrefix, initialValue = '', label = 'Teléfono de Contacto', required = false) {
  const parsed = parsePhoneNumber(initialValue);
  stateMap.set(idPrefix, {
    countryCode: parsed.country.code,
    dial: parsed.country.dial,
    country: parsed.country
  });

  return `
    <div class="phone-input-component" id="${idPrefix}-container">
      <label class="form-label">${label} ${required ? '<span style="color: var(--color-danger);">*</span>' : ''}</label>
      <div class="phone-input-row" style="display: flex; gap: 0.5rem; position: relative;">
        
        <!-- Country Selector Dropdown -->
        <div class="phone-dropdown-wrapper" style="position: relative;">
          <button type="button" class="btn btn-secondary phone-select-btn" id="${idPrefix}-country-btn" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.65rem 0.75rem; font-size: 0.88rem; min-width: 110px;" onclick="window.phoneHelper.toggleDropdown('${idPrefix}')">
            <span id="${idPrefix}-flag">${parsed.country.flag}</span>
            <span id="${idPrefix}-dial" style="font-weight: 700; color: var(--color-text-main);">${parsed.country.dial}</span>
            <span style="font-size: 0.65rem; color: var(--color-text-muted); margin-left: auto;">▼</span>
          </button>

          <!-- Dropdown Menu -->
          <div class="phone-dropdown-menu" id="${idPrefix}-country-menu" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; width: 280px; max-height: 250px; border-radius: var(--radius-sm); z-index: 100; overflow-y: auto;">
            <div class="phone-dropdown-search-wrap" style="padding: 0.5rem; position: sticky; top: 0; z-index: 2;">
              <input type="text" class="form-control" id="${idPrefix}-country-search" placeholder="Buscar país o prefijo (+503, México)..." style="font-size: 0.82rem; padding: 0.4rem 0.6rem;" oninput="window.phoneHelper.filterCountries('${idPrefix}', this.value)" />
            </div>
            <div id="${idPrefix}-country-list" style="padding: 0.25rem 0;">
              ${renderCountryListHtml(idPrefix, '')}
            </div>
          </div>
        </div>

        <!-- Masked Phone Input -->
        <div style="flex: 1; min-width: 0; position: relative;">
          <input type="tel" id="${idPrefix}-input" class="form-control" value="${parsed.formatted}" placeholder="${parsed.country.placeholder}" maxlength="20" ${required ? 'required' : ''} oninput="window.phoneHelper.handlePhoneInput('${idPrefix}', this)" onblur="window.phoneHelper.handlePhoneBlur('${idPrefix}', this)" autocomplete="tel" style="font-weight: 600; letter-spacing: 0.5px;" />
        </div>

        <!-- Hidden Input with Full Value -->
        <input type="hidden" id="${idPrefix}-full" value="${parsed.formatted ? `${parsed.country.dial} ${parsed.formatted}`.trim() : ''}" />
      </div>

      <div class="phone-input-hint" style="font-size: 0.76rem; color: var(--color-text-muted); margin-top: 0.35rem; display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap;">
        <span id="${idPrefix}-hint">Formato para ${parsed.country.name}: ${parsed.country.placeholder}</span>
        <span style="font-size: 0.72rem; color: var(--color-text-muted);">Guión automático al escribir</span>
      </div>
    </div>
  `;
}

function renderCountryListHtml(idPrefix, query = '') {
  const q = String(query).toLowerCase().trim();
  const filtered = COUNTRIES.filter(c => {
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    return `<div style="padding: 0.75rem 1rem; font-size: 0.82rem; color: var(--color-text-muted); text-align: center;">No se encontraron países</div>`;
  }

  return filtered.map(c => `
    <div class="country-option-item" style="padding: 0.5rem 0.85rem; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between;" onclick="window.phoneHelper.selectCountry('${idPrefix}', '${c.code}')">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.1rem;">${c.flag}</span>
        <span style="color: var(--color-text-secondary); font-weight: 500;">${c.name}</span>
      </div>
      <span style="font-weight: 700; color: var(--color-primary-text); font-size: 0.8rem;">${c.dial}</span>
    </div>
  `).join('');
}

// Global Phone Helper exposed on window
export const phoneHelper = {
  renderPhoneInputHtml,

  setupPhoneInput: (idPrefix) => {
    const inputEl = document.getElementById(`${idPrefix}-input`);
    const fullInput = document.getElementById(`${idPrefix}-full`);
    if (!inputEl) return;
    if (inputEl.value && inputEl.value.trim()) {
      phoneHelper.handlePhoneInput(idPrefix, inputEl);
    } else if (fullInput) {
      fullInput.value = '';
    }
  },

  toggleDropdown: (idPrefix) => {
    const menu = document.getElementById(`${idPrefix}-country-menu`);
    if (!menu) return;
    const isVisible = menu.style.display === 'block';
    // Close any other open dropdowns first
    document.querySelectorAll('.phone-dropdown-menu').forEach(m => m.style.display = 'none');
    menu.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      const search = document.getElementById(`${idPrefix}-country-search`);
      if (search) {
        search.value = '';
        phoneHelper.filterCountries(idPrefix, '');
        search.focus();
      }
    }
  },

  closeDropdown: (idPrefix) => {
    const menu = document.getElementById(`${idPrefix}-country-menu`);
    if (menu) menu.style.display = 'none';
  },

  filterCountries: (idPrefix, query) => {
    const listEl = document.getElementById(`${idPrefix}-country-list`);
    if (listEl) {
      listEl.innerHTML = renderCountryListHtml(idPrefix, query);
    }
  },

  selectCountry: (idPrefix, countryCode) => {
    const country = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];
    const flagEl = document.getElementById(`${idPrefix}-flag`);
    const dialEl = document.getElementById(`${idPrefix}-dial`);
    const inputEl = document.getElementById(`${idPrefix}-input`);
    const hintEl = document.getElementById(`${idPrefix}-hint`);

    if (flagEl) flagEl.textContent = country.flag;
    if (dialEl) dialEl.textContent = country.dial;
    if (inputEl) inputEl.placeholder = country.placeholder;
    if (hintEl) hintEl.textContent = `Formato para ${country.name}: ${country.placeholder}`;

    stateMap.set(idPrefix, {
      countryCode: country.code,
      dial: country.dial,
      country
    });

    phoneHelper.closeDropdown(idPrefix);

    // Re-format existing value with new country mask
    if (inputEl && inputEl.value) {
      phoneHelper.handlePhoneInput(idPrefix, inputEl);
    }
  },

  handlePhoneInput: (idPrefix, inputElement) => {
    const state = stateMap.get(idPrefix) || { country: COUNTRIES[0], dial: '+503' };
    const country = state.country || COUNTRIES[0];

    let raw = inputElement.value;
    // Strip non-digits
    let digits = raw.replace(/\D/g, '');

    // Anti-duplication: If user typed the prefix digits (e.g. 503), strip leading dial digits
    const cleanDial = country.dial.replace(/\D/g, '');
    if (cleanDial && digits.startsWith(cleanDial) && digits.length > country.maxDigits) {
      digits = digits.slice(cleanDial.length);
    }

    // Limit to max digits for this country
    digits = digits.slice(0, country.maxDigits);

    // Apply hyphen mask in real time
    const formatted = applyCountryMask(digits, country);
    inputElement.value = formatted;

    // Update hidden full input (e.g. "+503 7777-8888")
    const fullInput = document.getElementById(`${idPrefix}-full`);
    if (fullInput) {
      fullInput.value = formatted ? `${country.dial} ${formatted}` : '';
    }
  },

  handlePhoneBlur: (idPrefix, inputElement) => {
    phoneHelper.handlePhoneInput(idPrefix, inputElement);
  },

  getValue: (idPrefix) => {
    const inputEl = document.getElementById(`${idPrefix}-input`);
    if (inputEl && !inputEl.value.trim()) {
      return '';
    }
    const fullInput = document.getElementById(`${idPrefix}-full`);
    if (fullInput && fullInput.value) {
      return fullInput.value.trim();
    }
    const state = stateMap.get(idPrefix) || { dial: '+503' };
    if (inputEl && inputEl.value.trim()) {
      return `${state.dial} ${inputEl.value.trim()}`.trim();
    }
    return '';
  },

  setValue: (idPrefix, fullPhone) => {
    const parsed = parsePhoneNumber(fullPhone);
    phoneHelper.selectCountry(idPrefix, parsed.country.code);
    const inputEl = document.getElementById(`${idPrefix}-input`);
    if (inputEl) {
      inputEl.value = parsed.formatted;
      phoneHelper.handlePhoneInput(idPrefix, inputEl);
    }
  }
};

// Close dropdowns on outside click
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.phone-dropdown-wrapper')) {
      document.querySelectorAll('.phone-dropdown-menu').forEach(m => m.style.display = 'none');
    }
  });
}
