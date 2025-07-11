// docs/script.js

document.addEventListener("DOMContentLoaded", () => {
    // === DOM Elements ===
    const searchInput = document.getElementById("searchInput");
    const searchButton = document.getElementById("searchButton");
    const suggestionsContainer = document.getElementById("suggestions");
    const recentSearchesContainer = document.getElementById("recentSearches");
    const errorContainer = document.getElementById("errorContainer");
    const loadingContainer = document.getElementById("loadingContainer");
    const medicineInfoContainer = document.getElementById("medicineInfo");
    const consultDoctorSection = document.getElementById("consultDoctor");
    const themeToggle = document.getElementById("themeToggle");
    const uploadButton = document.getElementById("uploadButton");
    const imageUpload = document.getElementById("imageUpload");
    const imagePreview = document.getElementById("imagePreview");
  
    // === Config ===
    // Change this to your backend URL if running frontend and backend on different ports
    const API_BASE = window.location.hostname === "localhost"
      ? "http://localhost:3000"
      : "";
  
    // === Recent Searches ===
    let recentSearches = JSON.parse(localStorage.getItem("recentSearches")) || [];
  
    function updateRecentSearches() {
      recentSearchesContainer.innerHTML = "";
      if (recentSearches.length > 0) {
        const heading = document.createElement("h3");
        heading.textContent = "Recent Searches";
        recentSearchesContainer.appendChild(heading);
  
        recentSearches.forEach((search) => {
          const badge = document.createElement("span");
          badge.classList.add("badge");
          badge.textContent = search;
          badge.addEventListener("click", () => handleSearch(search));
          recentSearchesContainer.appendChild(badge);
        });
        // Add clear button
        const clearBtn = document.createElement("button");
        clearBtn.innerHTML = "&times;";
        clearBtn.title = "Clear recent searches";
        clearBtn.style.cssText = "font-size:1.3em;line-height:1;padding:0 8px;background:none;border:none;cursor:pointer;color:#2563eb;position:relative;top:2px;";
        clearBtn.onclick = () => {
          recentSearches = [];
          localStorage.removeItem("recentSearches");
          updateRecentSearches();
        };
        recentSearchesContainer.appendChild(clearBtn);
      }
    }
  
    function addToRecentSearches(search) {
      recentSearches = [search, ...recentSearches.filter((s) => s !== search).slice(0, 7)];
      localStorage.setItem("recentSearches", JSON.stringify(recentSearches));
      updateRecentSearches();
    }
  
    // === Suggestions ===
    async function fetchSuggestions(input) {
      if (!input.trim()) {
        suggestionsContainer.innerHTML = "";
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/api/suggestions?name=${encodeURIComponent(input)}`);
        const data = await response.json();
        displaySuggestions(data.suggestions || []);
      } catch (error) {
        suggestionsContainer.innerHTML = "";
      }
    }
  
    function displaySuggestions(suggestions) {
      suggestionsContainer.innerHTML = "";
      if (suggestions.length > 0) {
        // Add small cross button to close suggestions
        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "&times;";
        closeBtn.title = "Close suggestions";
        closeBtn.style.cssText = "font-size:1.3em;line-height:1;padding:0 8px;background:none;border:none;cursor:pointer;color:#2563eb;position:absolute;top:2px;right:2px;z-index:2;";
        closeBtn.onclick = () => { suggestionsContainer.innerHTML = ""; };
        suggestionsContainer.style.position = "relative";
        suggestionsContainer.appendChild(closeBtn);
      }
      suggestions.forEach((suggestion) => {
        const item = document.createElement("div");
        item.classList.add("suggestion-item");
        item.textContent = suggestion;
        item.addEventListener("click", () => {
          searchInput.value = suggestion;
          suggestionsContainer.innerHTML = "";
          handleSearch(suggestion);
        });
        suggestionsContainer.appendChild(item);
      });
    }
  
    // === Particles (background animation) ===
    if (window.tsParticles) {
      tsParticles.load("particles-container", {
        particles: {
          number: { value: 20, density: { enable: true, value_area: 800 } },
          color: { value: "#0284c7" },
          shape: { type: ["circle", "triangle"], stroke: { width: 0, color: "#000" } },
          opacity: { value: 0.1, random: false },
          size: { value: 3, random: true },
          line_linked: { enable: true, distance: 150, color: "#0284c7", opacity: 0.1, width: 1 },
          move: { enable: true, speed: 2, direction: "none", random: false, straight: false, out_mode: "out", bounce: false }
        },
        interactivity: {
          detect_on: "canvas",
          events: { onhover: { enable: true, mode: "repulse" }, resize: true },
          modes: { repulse: { distance: 100, duration: 0.4 } }
        },
        retina_detect: true
      });
    }
  
    // === UI Helpers ===
    function animateResults() {
      const results = document.querySelectorAll('.medicine-info-section > *');
      results.forEach((result, index) => {
        result.style.animation = `slideIn 0.5s ease ${index * 0.1}s both`;
      });
    }
  
    function showLoading() {
      loadingContainer.style.display = 'flex';
    }
  
    function hideLoading() {
      loadingContainer.style.display = 'none';
    }
  
    function scrollToResults() {
      const resultsSection = document.querySelector('.medicine-info-section');
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  
    function showError(message) {
      errorContainer.textContent = message;
      errorContainer.style.display = 'block';
      errorContainer.style.animation = 'shake 0.5s ease';
      setTimeout(() => { errorContainer.style.animation = ''; }, 500);
    }
  
    function hideError() {
      errorContainer.style.display = 'none';
    }
  
    // Keyframe animation for error shake
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
      @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
      @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    `;
    document.head.appendChild(styleSheet);
  
    // === Main Search Handler ===
    async function handleSearch(searchQuery) {
      hideError();
      showLoading();
      medicineInfoContainer.style.display = "none";
      try {
        const response = await fetch(`${API_BASE}/api/medicine-info?name=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        if (data.error) {
          showError(data.error || "Medicine information not found");
          return;
        }
        displayMedicineInfo(data.data, data.source);
        addToRecentSearches(searchQuery);
        scrollToResults();
        animateResults();
        if (window.lucide) window.lucide.createIcons();
      } catch (err) {
        showError("Failed to fetch medicine information. Please check your backend server and API key.");
      } finally {
        hideLoading();
      }
    }
  
    // === Image Upload Handler (uses backend for extraction) ===
    uploadButton.addEventListener("click", () => imageUpload.click());
    imageUpload.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) {
        showLoading();
        try {
          const formData = new FormData();
          formData.append("image", file);
          const response = await fetch(`${API_BASE}/api/extract-medicine-name`, { method: "POST", body: formData });
          const data = await response.json();
          if (data.medicineName) {
            searchInput.value = data.medicineName;
            handleSearch(data.medicineName);
          } else if (data.text) { // If backend returns raw text
            searchInput.value = data.text;
            showError("Could not detect a valid medicine name. Please edit and search.");
          } else {
            showError(data.error || "Failed to extract medicine name from the image.");
          }
        } catch (error) {
          showError("Something went wrong while processing the image. Please try again, or you can provide your input as text instead.");
        } finally {
          hideLoading();
        }
      }
    });
  
    // === Display Medicine Info ===
    function displayMedicineInfo(medicineInfo, source = 'openfda') {
      medicineInfoContainer.innerHTML = '';
      medicineInfoContainer.style.display = "block";
      // Helper to check if a value is meaningful
      function hasContent(val) {
        if (!val) return false;
        if (typeof val === 'string') return val.trim() && val.trim().toUpperCase() !== 'N/A';
        if (Array.isArray(val)) return val.join('').trim() && val.join('').toUpperCase() !== 'N/A';
        return true;
      }
      // --- OpenFDA ---
      if (source === 'openfda') {
        const openfda = medicineInfo.openfda || {};
        const overviewFields = [
          { label: 'Brand Name', value: openfda.brand_name?.join(', ') },
          { label: 'Generic Name', value: openfda.generic_name?.join(', ') },
          { label: 'Manufacturer', value: openfda.manufacturer_name?.join(', ') },
          { label: 'Product Type', value: openfda.product_type?.join(', ') },
          { label: 'Route', value: openfda.route?.join(', ') },
          { label: 'Application Number', value: openfda.application_number?.join(', ') },
          { label: 'Product NDC', value: openfda.product_ndc?.join(', ') },
          { label: 'RXCUI', value: openfda.rxcui?.join(', ') },
          { label: 'Substance Name', value: openfda.substance_name?.join(', ') },
          { label: 'UNII', value: openfda.unii?.join(', ') },
          { label: 'Pharm Class MOA', value: openfda.pharm_class_moa?.join(', ') },
          { label: 'Pharm Class PE', value: openfda.pharm_class_pe?.join(', ') },
          { label: 'Pharm Class CS', value: openfda.pharm_class_cs?.join(', ') },
          { label: 'Pharm Class EPC', value: openfda.pharm_class_epc?.join(', ') },
          { label: 'SPL ID', value: openfda.spl_id?.join(', ') },
          { label: 'SPL Set ID', value: openfda.spl_set_id?.join(', ') },
          { label: 'Package NDC', value: openfda.package_ndc?.join(', ') },
          { label: 'Is Original Packager', value: openfda.is_original_packager?.toString() },
          { label: 'NUI', value: openfda.nui?.join(', ') },
        ];
        // Priority order: Overview, Indications & Usage, Purpose, Dosage & Administration, Warnings, Active Ingredients, Inactive Ingredients, Do Not Use, Ask Doctor, Ask Doctor or Pharmacist, Stop Use, Pregnancy or Breast Feeding, Storage & Handling, Questions, Package Label Principal Display Panel, Version/Effective Time/Set ID/ID, Additional Information
        const tabDataRaw = [
          { key: "overview", label: "Overview", render: () => {
            const items = overviewFields.filter(f => hasContent(f.value));
            if (!items.length) return '';
            return `<h3><i data-lucide=\"activity\"></i> Overview</h3><ul>${items.map(f => `<li><strong>${f.label}:</strong> ${f.value}</li>`).join('')}</ul>`;
          } },
          { key: "indications_and_usage", label: "Indications & Usage", render: () => {
            const val = medicineInfo.indications_and_usage?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Indications & Usage");
          } },
          { key: "purpose", label: "Purpose", render: () => {
            const val = medicineInfo.purpose?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Purpose");
          } },
          { key: "dosage_and_administration", label: "Dosage & Administration", render: () => {
            const val = medicineInfo.dosage_and_administration?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Dosage & Administration");
          } },
          { key: "warnings", label: "Warnings", render: () => {
            const val = medicineInfo.warnings?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Warnings");
          } },
          { key: "active_ingredient", label: "Active Ingredients", render: () => {
            const arr = medicineInfo.active_ingredient||[];
            if (!arr.length || !arr.some(hasContent)) return '';
            return `<h3>Active Ingredients</h3><div>${arr.filter(hasContent).map(i => `<span class=\"badge\">${i}</span>`).join(' ')}</div>`;
          } },
          { key: "inactive_ingredient", label: "Inactive Ingredients", render: () => {
            const arr = medicineInfo.inactive_ingredient||[];
            if (!arr.length || !arr.some(hasContent)) return '';
            return `<h3>Inactive Ingredients</h3><div>${arr.filter(hasContent).map(i => `<span class=\"badge\">${i}</span>`).join(' ')}</div>`;
          } },
          { key: "do_not_use", label: "Do Not Use", render: () => {
            const val = medicineInfo.do_not_use?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Do Not Use");
          } },
          { key: "ask_doctor", label: "Ask Doctor", render: () => {
            const val = medicineInfo.ask_doctor?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Ask Doctor");
          } },
          { key: "ask_doctor_or_pharmacist", label: "Ask Doctor or Pharmacist", render: () => {
            const val = medicineInfo.ask_doctor_or_pharmacist?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Ask Doctor or Pharmacist");
          } },
          { key: "stop_use", label: "Stop Use", render: () => {
            const val = medicineInfo.stop_use?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Stop Use");
          } },
          { key: "pregnancy_or_breast_feeding", label: "Pregnancy or Breast Feeding", render: () => {
            const val = medicineInfo.pregnancy_or_breast_feeding?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Pregnancy or Breast Feeding");
          } },
          { key: "storage_and_handling", label: "Storage & Handling", render: () => {
            const val = medicineInfo.storage_and_handling?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Storage & Handling");
          } },
          { key: "questions", label: "Questions", render: () => {
            const val = medicineInfo.questions?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Questions");
          } },
          { key: "package_label_principal_display_panel", label: "Package Label Principal Display Panel", render: () => {
            const val = medicineInfo.package_label_principal_display_panel?.[0];
            if (!hasContent(val)) return '';
            return renderSummarizableField(val, "Package Label Principal Display Panel");
          } },
          { key: "version", label: "Version/Effective Time/Set ID/ID", render: () => {
            const items = [
              { label: 'Version', value: medicineInfo.version },
              { label: 'Effective Time', value: medicineInfo.effective_time },
              { label: 'Set ID', value: medicineInfo.set_id },
              { label: 'ID', value: medicineInfo.id },
            ].filter(f => hasContent(f.value));
            if (!items.length) return '';
            return `<ul>${items.map(f => `<li><strong>${f.label}:</strong> ${f.value}</li>`).join('')}</ul>`;
          } },
          { key: "additional", label: "Additional Information", render: () => {
            const shown = new Set(tabDataRaw.map(t => t.key).concat(['openfda']));
            const additional = Object.entries(medicineInfo)
              .filter(([k, v]) => !shown.has(k) && hasContent(v) && typeof v !== 'object')
              .map(([k, v]) => `<li><strong>${k.replace(/_/g, ' ')}:</strong> ${Array.isArray(v) ? v.join(', ') : v}</li>`)
              .join('');
            return additional ? `<ul>${additional}</ul>` : '';
          } },
        ];
        const tabData = tabDataRaw.filter(tab => {
          const html = tab.render();
          return html && html.replace(/<[^>]+>/g, '').trim() && html.indexOf('N/A') === -1;
        }).map(tab => ({ ...tab, html: tab.render() }));
        let tabList = '<div class="tab-list">';
        tabData.forEach((tab, i) => {
          tabList += `<button class="tab${i===0?' active':''}" data-tab="${tab.key}">${tab.label}</button>`;
        });
        tabList += '</div>';
        let tabContents = '';
        tabData.forEach((tab, i) => {
          tabContents += `<div class="tab-content" id="${tab.key}Tab" style="display:${i===0?'block':'none'};">${tab.html}</div>`;
        });
        let oneLiner = '';
        // Prefer Indications & Usage, fallback to Purpose
        const ind = medicineInfo.indications_and_usage?.[0];
        const purp = medicineInfo.purpose?.[0];
        function getFirstSentence(text) {
          if (!text) return '';
          const match = text.match(/^.*?[.!?](\s|$)/);
          return match ? match[0].trim() : text.split('. ')[0].trim();
        }
        if (hasContent(ind)) {
          oneLiner = getFirstSentence(ind);
        } else if (hasContent(purp)) {
          oneLiner = getFirstSentence(purp);
        }
        // If too long or missing, try Wikipedia short description
        async function setOneLinerFromWikiIfNeeded() {
          if (!oneLiner || oneLiner.length > 200) {
            try {
              const resp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(openfda.brand_name?.[0] || openfda.generic_name?.[0] || '')}`);
              if (resp.ok) {
                const wiki = await resp.json();
                if (wiki.description && wiki.description.length < 200) {
                  oneLiner = wiki.description;
                } else if (wiki.extract) {
                  oneLiner = getFirstSentence(wiki.extract).slice(0, 200);
                }
              }
            } catch {}
          }
          // Re-render header with new oneLiner
          document.querySelector('.one-liner-summary')?.remove();
          if (oneLiner) {
            const header = document.querySelector('.medicine-info-header');
            if (header) {
              const div = document.createElement('div');
              div.className = 'one-liner-summary';
              div.style = 'margin-top:0.5em;font-size:1.1em;color:#6b7280;';
              div.innerHTML = oneLiner;
              header.appendChild(div);
              if (window.lucide) window.lucide.createIcons();
            }
          }
        }
        medicineInfoContainer.innerHTML = `
          <div class="medicine-info-header">
            <div class="top-buttons">
              <button id="printButton" aria-label="Print"><i data-lucide="printer"></i></button>
              <button id="shareButton" aria-label="Share"><i data-lucide="share-2"></i></button>
              <button id="bookmarkButton" aria-label="Bookmark"><i data-lucide="bookmark-plus"></i></button>
            </div>
            <h2><i data-lucide="pill"></i> ${openfda.brand_name?.[0] || "Unknown Medicine"}</h2>
            <p>${openfda.generic_name?.[0] || "No generic name available"}</p>
            <button id="pronounceButton" class="pronounce-button" title="Pronounce">
              <i data-lucide="volume-2"></i>
            </button>
            ${oneLiner ? `<div class='one-liner-summary' style='margin-top:0.5em;font-size:1.1em;color:#6b7280;'>${oneLiner}</div>` : ''}
          </div>
          ${tabList}
          ${tabContents}
        `;
        setOneLinerFromWikiIfNeeded();
        setupTabs();
        // After rendering, set up pronunciation with the best available name
        let pronounceName = openfda.brand_name?.[0] || openfda.generic_name?.[0] || '';
        setupPronunciation(pronounceName);
        setupPrintAndShare();
        displayDoctors();
        if (window.lucide) window.lucide.createIcons();
        return;
      }
      // --- RxNorm ---
      if (source === 'rxnorm') {
        // Show all RxNorm fields in a single tab, except synonyms which get their own tab if present
        const rxnormFields = Object.entries(medicineInfo)
          .filter(([k, v]) => k !== 'synonyms' && hasContent(v));
        const synonyms = medicineInfo.synonyms || [];
        let tabData = [];
        if (rxnormFields.length) {
          tabData.push({
            key: 'rxnorm_overview',
            label: 'RxNorm Info',
            html: `<ul>${rxnormFields.map(([k, v]) => `<li><strong>${k.replace(/_/g, ' ')}:</strong> ${v}</li>`).join('')}</ul>`
          });
        }
        if (synonyms.length) {
          tabData.push({
            key: 'rxnorm_synonyms',
            label: 'Synonyms',
            html: `<div>${synonyms.map(s => `<span class='badge'>${s}</span>`).join(' ')}</div>`
          });
        }
        if (!tabData.length) {
          medicineInfoContainer.innerHTML = '<div class="error-container">No RxNorm information available.</div>';
          return;
        }
        let tabList = '<div class="tab-list">';
        tabData.forEach((tab, i) => {
          tabList += `<button class="tab${i===0?' active':''}" data-tab="${tab.key}">${tab.label}</button>`;
        });
        tabList += '</div>';
        let tabContents = '';
        tabData.forEach((tab, i) => {
          tabContents += `<div class="tab-content" id="${tab.key}Tab" style="display:${i===0?'block':'none'};">${tab.html}</div>`;
        });
        medicineInfoContainer.innerHTML = `
          <div class="medicine-info-header">
            <div class="top-buttons">
              <button id="printButton" aria-label="Print"><i data-lucide="printer"></i></button>
              <button id="shareButton" aria-label="Share"><i data-lucide="share-2"></i></button>
              <button id="bookmarkButton" aria-label="Bookmark"><i data-lucide="bookmark-plus"></i></button>
            </div>
            <h2><i data-lucide="pill"></i> ${medicineInfo.name || medicineInfo.displayName || 'Unknown Medicine'}</h2>
            <p>${medicineInfo.rxcui ? `RxCUI: ${medicineInfo.rxcui}` : ''}</p>
          </div>
          ${tabList}
          ${tabContents}
        `;
        setupTabs();
        setupPrintAndShare();
        if (window.lucide) window.lucide.createIcons();
        return;
      }
      // --- Wikipedia ---
      if (source === 'wikipedia') {
        // Show summary/extract and other info in a single tab
        let tabData = [];
        if (hasContent(medicineInfo.extract)) {
          tabData.push({
            key: 'wikipedia_summary',
            label: 'Wikipedia',
            html: `<h3>${medicineInfo.title || ''}</h3><p>${medicineInfo.description || ''}</p><div style='white-space:pre-line;'>${medicineInfo.extract}</div>`
          });
        }
        // Show other fields in Additional Information
        const additional = Object.entries(medicineInfo)
          .filter(([k, v]) => !['extract','title','description','type','content_urls','pageid','thumbnail','originalimage'].includes(k) && hasContent(v))
          .map(([k, v]) => `<li><strong>${k.replace(/_/g, ' ')}:</strong> ${Array.isArray(v) ? v.join(', ') : v}</li>`)
          .join('');
        if (additional) {
          tabData.push({
            key: 'wikipedia_additional',
            label: 'Additional Information',
            html: `<ul>${additional}</ul>`
          });
        }
        if (!tabData.length) {
          medicineInfoContainer.innerHTML = '<div class="error-container">No Wikipedia information available.</div>';
          return;
        }
        let tabList = '<div class="tab-list">';
        tabData.forEach((tab, i) => {
          tabList += `<button class="tab${i===0?' active':''}" data-tab="${tab.key}">${tab.label}</button>`;
        });
        tabList += '</div>';
        let tabContents = '';
        tabData.forEach((tab, i) => {
          tabContents += `<div class="tab-content" id="${tab.key}Tab" style="display:${i===0?'block':'none'};">${tab.html}</div>`;
        });
        medicineInfoContainer.innerHTML = `
          <div class="medicine-info-header">
            <div class="top-buttons">
              <button id="printButton" aria-label="Print"><i data-lucide="printer"></i></button>
              <button id="shareButton" aria-label="Share"><i data-lucide="share-2"></i></button>
              <button id="bookmarkButton" aria-label="Bookmark"><i data-lucide="bookmark-plus"></i></button>
            </div>
            <h2><i data-lucide="pill"></i> ${medicineInfo.title || 'Unknown Medicine'}</h2>
            <p>${medicineInfo.description || ''}</p>
          </div>
          ${tabList}
          ${tabContents}
        `;
        setupTabs();
        setupPrintAndShare();
        if (window.lucide) window.lucide.createIcons();
        return;
      }
      // Fallback
      medicineInfoContainer.innerHTML = '<div class="error-container">No information available for this medicine.</div>';
    }
  
    // --- Summarizable Field Renderer ---
    function renderSummarizableField(text, label) {
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      let showSummarize = (wordCount > 200);
      let html = `<h3>${label}</h3><div class="summarizable-content">${text}</div>`;
      if (showSummarize) {
        html += `<button class="summarize-btn" style="margin-top:1em;background:#2563eb;color:#fff;border:none;padding:0.3em 0.8em;border-radius:5px;cursor:pointer;">Summarize</button>`;
      }
      return html;
    }
  
    // === Doctor List ===
    function displayDoctors() {
      const doctors = [
        { name: "Dr. Emily Johnson", specialty: "General Practitioner", image: "https://randomuser.me/api/portraits/women/68.jpg", phone: "+1 (555) 123-4567", email: "emily.johnson@example.com" },
        { name: "Dr. Michael Chen", specialty: "Cardiologist", image: "https://randomuser.me/api/portraits/men/42.jpg", phone: "+1 (555) 987-6543", email: "michael.chen@example.com" },
        { name: "Dr. Sarah Patel", specialty: "Pediatrician", image: "https://randomuser.me/api/portraits/women/33.jpg", phone: "+1 (555) 246-8135", email: "sarah.patel@example.com" }
      ];
      const doctorList = document.querySelector(".doctor-list");
      if (!doctorList) return;
      doctorList.innerHTML = doctors.map(doctor => `
        <div class="doctor-card">
          <img src="${doctor.image}" alt="${doctor.name}">
          <h3>${doctor.name}</h3>
          <p>${doctor.specialty}</p>
          <div class="contact-info">
            <a href="tel:${doctor.phone}"><i data-lucide="phone"></i></a>
            <a href="mailto:${doctor.email}"><i data-lucide="mail"></i></a>
          </div>
        </div>
      `).join("");
      if (consultDoctorSection) consultDoctorSection.style.display = "block";
      if (window.lucide) window.lucide.createIcons();
    }
  
    // === Tabs, Accordion, Pronunciation, Print/Share ===
    function setupTabs() {
      const tabs = document.querySelectorAll(".tab");
      const tabContents = document.querySelectorAll(".tab-content");
      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          tabs.forEach((t) => t.classList.remove("active"));
          tab.classList.add("active");
          const tabName = tab.getAttribute("data-tab");
          tabContents.forEach((content) => {
            content.style.display = content.id === `${tabName}Tab` ? "block" : "none";
          });
        });
      });
      // Summarize button logic
      document.querySelectorAll('.summarize-btn').forEach(btn => {
        btn.onclick = async function() {
          const contentDiv = btn.parentElement.querySelector('.summarizable-content');
          if (!contentDiv) return;
          btn.disabled = true;
          btn.textContent = 'Summarizing...';
          try {
            const res = await fetch(`${API_BASE}/api/summarize`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: contentDiv.textContent })
            });
            const { summary } = await res.json();
            contentDiv.textContent = summary;
            btn.remove();
          } catch (e) {
            btn.textContent = 'Summarize';
            alert('Summarization failed.');
          }
        };
      });
    }
  
    function setupAccordion() {
      const accordionHeaders = document.querySelectorAll(".accordion-header");
      accordionHeaders.forEach((header) => {
        header.addEventListener("click", () => {
          const content = header.nextElementSibling;
          content.classList.toggle("active");
          const icon = header.querySelector("i");
          icon.setAttribute("data-lucide", content.classList.contains("active") ? "chevron-up" : "chevron-down");
          if (window.lucide) window.lucide.createIcons();
        });
      });
    }
  
    function setupPronunciation(word) {
      const pronounceButton = document.getElementById("pronounceButton");
      if (pronounceButton) {
        // Remove previous event listeners by replacing the button
        const newButton = pronounceButton.cloneNode(true);
        pronounceButton.parentNode.replaceChild(newButton, pronounceButton);
        newButton.addEventListener("click", () => {
          if (word && word.trim()) {
            const utterance = new SpeechSynthesisUtterance(word);
            speechSynthesis.speak(utterance);
          }
        });
      }
    }
  
    function setupPrintAndShare() {
      const printButton = document.getElementById("printButton");
      const shareButton = document.getElementById("shareButton");
      if (printButton) printButton.addEventListener("click", () => window.print());
      if (shareButton) shareButton.addEventListener("click", async () => {
        try {
          await navigator.share({
            title: "Medicine Information",
            text: `Information about ${document.querySelector(".medicine-info-header h2").textContent}`,
            url: window.location.href,
          });
        } catch (error) {
          // User cancelled or not supported
        }
      });
    }
  
    // === Drug Interactions (Optional) ===
    function setupDrugInteractions() {
      const checkInteractionButton = document.getElementById("checkInteractionButton");
      const interactionResult = document.getElementById("interactionResult");
      if (!checkInteractionButton || !interactionResult) return;
      checkInteractionButton.addEventListener("click", () => {
        const drugA = document.getElementById("drugA").value;
        const drugB = document.getElementById("drugB").value;
        interactionResult.textContent = `Potential interaction between ${drugA} and ${drugB}. Please consult with your healthcare provider.`;
      });
    }
  
    // === Event Listeners ===
    searchInput.addEventListener("input", () => fetchSuggestions(searchInput.value));
    searchButton.addEventListener("click", () => handleSearch(searchInput.value));
    searchInput.addEventListener("keydown", e => {
      if (e.key === "Enter") handleSearch(searchInput.value);
    });
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      const icon = themeToggle.querySelector("i");
      icon.setAttribute("data-lucide", document.body.classList.contains("dark") ? "sun" : "moon");
      if (window.lucide) window.lucide.createIcons();
    });
  
    // === Init ===
    updateRecentSearches();
    if (window.lucide) window.lucide.createIcons();
    setupDrugInteractions();
  });