/**
 * LeadHunter - script.js (CRM Upgrade + OpenStreetMap Integration)
 * A professional SaaS-style Lead Management System.
 * Built with Vanilla JavaScript and SheetJS.
 * 🚀 LeadHunter powered by Adfluente
 * Created by Hamza Ahmed
 * Portfolio: https://hamzaportfolioweb.netlify.app/
 */

// Global state
let currentLeads = [];
let searchHistory = [];
let nextLeadId = 1;

// Status options for dropdowns
const STATUS_OPTIONS = [
    "New", "Contacted", "Interested", "Follow Up",
    "Qualified", "Proposal Sent", "Closed Won",
    "Closed Lost", "Not Interested"
];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Grab all HTML elements safely
    const searchBtn = document.getElementById('searchBtn');
    const exportBtn = document.getElementById('exportBtn');
    const leadsBody = document.getElementById('leadsBody');
    const emptyState = document.getElementById('emptyState');
    const noResultsState = document.getElementById('noResultsState');
    const resultsSection = document.getElementById('resultsSection');
    const filtersSection = document.getElementById('filtersSection');
    const loadingState = document.getElementById('loadingState');
    const toast = document.getElementById('toast');

    // 2. Initial UI Setup
    if (emptyState) emptyState.style.display = 'flex';
    if (resultsSection) resultsSection.style.display = 'none';
    if (filtersSection) filtersSection.style.display = 'none';
    if (loadingState) loadingState.style.display = 'none';
    if (noResultsState) noResultsState.style.display = 'none';

    // Initialize Data
    loadLeads();
    loadSearchHistory();
    updateLocationFilter();
    updateAnalytics();

    if (currentLeads.length > 0) {
        applyFilters();
        if (resultsSection) resultsSection.style.display = 'block';
        if (filtersSection) filtersSection.style.display = 'block';
    }

    // ==========================================
    // OpenStreetMap Integration (Steps 2-6)
    // ==========================================

    // Step 2: Location Geocoding
    async function getCoordinates(location) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Geocoding failed");
        const data = await response.json();
        if (!data || data.length === 0) throw new Error("Location not found");
        return {
            lat: parseFloat(data[0].lat),
            lon: parseFloat(data[0].lon)
        };
    }

    // Step 3: Niche Mapping
    function getOverpassTag(niche) {
        const n = niche.trim().toLowerCase();
        const map = {
            'gym': { key: 'leisure', value: 'fitness_centre' },
            'restaurant': { key: 'amenity', value: 'restaurant' },
            'cafe': { key: 'amenity', value: 'cafe' },
            'salon': { key: 'shop', value: 'hairdresser' },
            'hospital': { key: 'amenity', value: 'hospital' },
            'school': { key: 'amenity', value: 'school' },
            'hotel': { key: 'tourism', value: 'hotel' },
            'lawyer': { key: 'office', value: 'lawyer' },
            'doctor': { key: 'amenity', value: 'doctors' },
            'dentist': { key: 'amenity', value: 'dentist' },
            'real estate': { key: 'office', value: 'estate_agent' },
            'agency': { key: 'office', value: 'agency' }
        };
        return map[n] || null;
    }

    // Step 4, 5, 6, 8: Real fetchLeads with Overpass API
    async function fetchLeads(niche, location) {
        // 1. Get coordinates
        const coords = await getCoordinates(location);
        const { lat, lon } = coords;

        // 2. Generate Overpass query
        const tag = getOverpassTag(niche);
        let query;
        if (tag) {
            query = `
            [out:json][timeout:25];
            (
                node["${tag.key}"="${tag.value}"](around:10000,${lat},${lon});
                way["${tag.key}"="${tag.value}"](around:10000,${lat},${lon});
                relation["${tag.key}"="${tag.value}"](around:10000,${lat},${lon});
            );
            out center tags;
            `;
        } else {
            const escapedNiche = niche.replace(/"/g, '\\"');
            query = `
            [out:json][timeout:25];
            (
                node["name"~"${escapedNiche}",i](around:10000,${lat},${lon});
                way["name"~"${escapedNiche}",i](around:10000,${lat},${lon});
                relation["name"~"${escapedNiche}",i](around:10000,${lat},${lon});
            );
            out center tags;
            `;
        }

        // 3. Search businesses
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const response = await fetch(overpassUrl);
        if (!response.ok) throw new Error("Overpass API failed");
        const data = await response.json();

        // 4. Map results
        const leads = [];
        if (data && data.elements) {
            for (const element of data.elements) {
                const tags = element.tags || {};
                const name = tags.name || '';
                if (!name) continue; // Skip unnamed places

                const phone = tags.phone || tags['contact:phone'] || '';
                const website = tags.website || tags['contact:website'] || '';
                
                // Build address
                const addrParts = [
                    tags['addr:housenumber'],
                    tags['addr:street'],
                    tags['addr:city'],
                    tags['addr:postcode'],
                    tags['addr:country']
                ].filter(Boolean);
                const address = addrParts.length > 0 ? addrParts.join(', ') : (tags['addr:full'] || '');

                leads.push({
                    name: name,
                    phone: phone,
                    website: website,
                    address: address
                });

                if (leads.length >= 50) break; // Limit to 50
            }
        }

        return leads;
    }

    // ==========================================
    // Core CRM Functions
    // ==========================================

    function generateLeadId() {
        const id = `LH-${String(nextLeadId).padStart(4, '0')}`; 
        nextLeadId++;
        localStorage.setItem('leadHunter_nextId', nextLeadId);
        return id;
    }

    function saveLeads() {
        localStorage.setItem('leadHunter_leads', JSON.stringify(currentLeads));
        localStorage.setItem('leadHunter_nextId', nextLeadId);
    }

    function loadLeads() {
        const saved = localStorage.getItem('leadHunter_leads');
        if (saved) {
            try { currentLeads = JSON.parse(saved); } 
            catch (e) { currentLeads = []; }
        }
        
        const savedId = localStorage.getItem('leadHunter_nextId');
        if (savedId) {
            nextLeadId = parseInt(savedId, 10);
        } else {
            let maxId = 0;
            currentLeads.forEach(lead => {
                if (lead && lead.id) {
                    const num = parseInt(lead.id.replace('LH-', ''), 10);
                    if (num > maxId) maxId = num;
                }
            });
            nextLeadId = maxId + 1;
        }
    }

    async function searchLeads() {
        showLoading(true); // Step 11: Show loading
        if (emptyState) emptyState.style.display = 'none';
        disableSearchBtn(true);

        try {
            const nicheInput = document.getElementById('nicheInput') || document.getElementById('niche');
            const locationInput = document.getElementById('locationInput') || document.getElementById('location');
            
            const niche = nicheInput ? nicheInput.value.trim() || 'General' : 'General';
            const location = locationInput ? locationInput.value.trim() || 'Unknown' : 'Unknown';
            
            let rawLeads = [];
            try {
                rawLeads = await fetchLeads(niche, location);
            } catch (apiError) {
                console.error("API Error:", apiError);
                // Step 10: Error Handling
                if (apiError.message === "Location not found") {
                    showToast("Location not found");
                } else {
                    showToast("Unable to fetch leads");
                }
                return; // Exit early, finally block will handle UI cleanup
            }
            
            let addedCount = 0;
            rawLeads.forEach(lead => {
                // Step 9: Deduplication
                const isDuplicate = currentLeads.some(l => 
                    (l.businessName || '').toLowerCase().trim() === (lead.name || '').toLowerCase().trim() && 
                    (l.location || '').toLowerCase().trim() === location.toLowerCase().trim()
                );

                if (!isDuplicate) {
                    const newLead = {
                        id: generateLeadId(),
                        niche: niche,
                        location: location,
                        businessName: lead.name,
                        phone: lead.phone,
                        website: lead.website,
                        address: lead.address,
                        status: "New",
                        notes: "",
                        source: "OpenStreetMap", // Step 7: Add Source Field
                        createdAt: new Date().toISOString().split('T')[0]
                    };
                    currentLeads.push(newLead);
                    addedCount++;
                }
            });
            
            saveLeads();
            saveSearchHistory(niche, location);
            updateLocationFilter();
            applyFilters(); 
            
            if (resultsSection) resultsSection.style.display = 'block';
            if (filtersSection) filtersSection.style.display = 'block';
            
            if (addedCount > 0) {
                showToast(`${addedCount} new leads added to CRM!`);
            } else if (rawLeads.length > 0) {
                showToast(`Leads found, but they already exist in CRM.`);
            } else {
                showToast(`No businesses found for "${niche}" in "${location}".`);
            }
        } catch (error) {
            console.error("Error fetching leads:", error);
            showToast("An error occurred while hunting leads.");
        } finally {
            disableSearchBtn(false);
            showLoading(false); // Step 11: Hide loading
        }
    }

    function updateLeadStatus(id, newStatus) {
        const lead = currentLeads.find(l => l.id === id);
        if (lead) {
            lead.status = newStatus;
            saveLeads();
            updateAnalytics(getFilteredLeads());
            showToast(`Status updated to ${newStatus}`);
        }
    }

    function deleteLead() {
        const modal = document.getElementById('deleteModal');
        const id = modal ? modal.dataset.leadId : null;
        if (!id) return;
        
        currentLeads = currentLeads.filter(l => l.id !== id);
        saveLeads();
        applyFilters();
        updateLocationFilter();
        closeModal('deleteModal');
        showToast("Lead deleted successfully!");
    }

    function saveNotes() {
        const modal = document.getElementById('notesModal');
        const id = modal ? modal.dataset.leadId : null;
        if (!id) return;
        
        const notesTextarea = document.getElementById('notesTextarea');
        const notes = notesTextarea ? notesTextarea.value : '';
        const lead = currentLeads.find(l => l.id === id);
        
        if (lead) {
            lead.notes = notes;
            saveLeads();
            closeModal('notesModal');
            showToast("Notes saved successfully!");
        }
    }

    // ==========================================
    // Filtering & Analytics
    // ==========================================

    function getFilteredLeads() {
        let filteredLeads = [...currentLeads];
        
        const statusFilter = document.getElementById('filterStatus')?.value || 'all';
        if (statusFilter !== 'all') filteredLeads = filteredLeads.filter(l => l.status === statusFilter);
        
        const phoneFilter = document.getElementById('filterPhone')?.value || 'all';
        if (phoneFilter === 'has') filteredLeads = filteredLeads.filter(l => l.phone && l.phone.trim() !== '');
        if (phoneFilter === 'no') filteredLeads = filteredLeads.filter(l => !l.phone || l.phone.trim() === '');
        
        const websiteFilter = document.getElementById('filterWebsite')?.value || 'all';
        if (websiteFilter === 'has') filteredLeads = filteredLeads.filter(l => l.website && l.website.trim() !== '');
        if (websiteFilter === 'no') filteredLeads = filteredLeads.filter(l => !l.website || l.website.trim() === '');
        
        const nicheFilter = document.getElementById('filterNiche')?.value || 'all';
        if (nicheFilter !== 'all') filteredLeads = filteredLeads.filter(l => l.niche === nicheFilter);
        
        const locationFilter = document.getElementById('filterLocation')?.value || 'all';
        if (locationFilter !== 'all') filteredLeads = filteredLeads.filter(l => l.location === locationFilter);
        
        const idFilter = document.getElementById('filterId')?.value.trim().toLowerCase() || '';
        if (idFilter) filteredLeads = filteredLeads.filter(l => (l.id || '').toLowerCase().includes(idFilter));
        
        const nameFilter = document.getElementById('filterName')?.value.trim().toLowerCase() || '';
        if (nameFilter) filteredLeads = filteredLeads.filter(l => (l.businessName || '').toLowerCase().includes(nameFilter));
        
        const dateFilter = document.getElementById('filterDate')?.value || 'all';
        if (dateFilter !== 'all') {
            const today = new Date(); today.setHours(0,0,0,0);
            filteredLeads = filteredLeads.filter(l => {
                if (!l.createdAt) return false;
                const leadDate = new Date(l.createdAt); leadDate.setHours(0,0,0,0);
                if (dateFilter === 'today') return leadDate.getTime() === today.getTime();
                if (dateFilter === 'week') {
                    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
                    return leadDate >= weekAgo;
                }
                if (dateFilter === 'month') return leadDate.getMonth() === today.getMonth() && leadDate.getFullYear() === today.getFullYear();
                return true;
            });
        }
        return filteredLeads;
    }

    function applyFilters() {
        const filteredLeads = getFilteredLeads();
        renderTable(filteredLeads);
        updateAnalytics(filteredLeads);
    }

    function updateAnalytics(leads = currentLeads) {
        const total = leads.length;
        const withWebsite = leads.filter(l => l.website && l.website.trim() !== '').length;
        const withPhone = leads.filter(l => l.phone && l.phone.trim() !== '').length;
        
        const newLeads = leads.filter(l => l.status === 'New').length;
        const contacted = leads.filter(l => l.status === 'Contacted').length;
        const interested = leads.filter(l => l.status === 'Interested').length;
        const closed = leads.filter(l => l.status === 'Closed Won' || l.status === 'Closed Lost').length;
        
        const uniqueNiches = new Set(leads.map(l => l.niche).filter(n => n)).size;
        const uniqueLocations = new Set(leads.map(l => l.location).filter(l => l)).size;

        const stats = {
            statTotal: total, statWebsite: withWebsite, statPhone: withPhone,
            statNew: newLeads, statContacted: contacted, statInterested: interested,
            statClosed: closed, statNiches: uniqueNiches, statLocations: uniqueLocations
        };

        Object.keys(stats).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = stats[id];
        });
    }

    function updateLocationFilter() {
        const select = document.getElementById('filterLocation');
        if (!select) return;
        
        const locations = [...new Set(currentLeads.map(l => l.location).filter(l => l))];
        const currentValue = select.value;
        
        select.innerHTML = '<option value="all">All Locations</option>';
        locations.forEach(loc => {
            const opt = document.createElement('option');
            opt.value = loc; opt.textContent = loc;
            select.appendChild(opt);
        });
        select.value = locations.includes(currentValue) ? currentValue : 'all';
    }

    // ==========================================
    // UI Rendering & Modals
    // ==========================================

    function renderTable(leads) {
        if (!leadsBody) return;
        leadsBody.innerHTML = '';

        if (leads.length === 0) {
            if (currentLeads.length === 0) {
                if (emptyState) emptyState.style.display = 'flex';
                if (resultsSection) resultsSection.style.display = 'none';
            } else {
                if (noResultsState) noResultsState.style.display = 'flex';
            }
            return;
        } else {
            if (emptyState) emptyState.style.display = 'none';
            if (noResultsState) noResultsState.style.display = 'none';
            if (resultsSection) resultsSection.style.display = 'block';
        }

        leads.forEach((lead, index) => {
            const row = document.createElement('tr');
            row.style.animationDelay = `${index * 0.05}s`;
            row.className = 'lead-row';

            const websiteHtml = lead.website 
                ? `<a href="${lead.website}" target="_blank" rel="noopener noreferrer">${lead.website}</a>` 
                : '<span class="text-muted">N/A</span>';
                
            const phoneHtml = lead.phone ? lead.phone : '<span class="text-muted">N/A</span>';
            
            const statusOptions = STATUS_OPTIONS.map(s => 
                `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${s}</option>`
            ).join('');

            row.innerHTML = `
                <td><strong>${lead.id}</strong></td>
                <td>${lead.niche || 'N/A'}</td>
                <td>${lead.location || 'N/A'}</td>
                <td>${lead.businessName}</td>
                <td>${phoneHtml}</td>
                <td>${websiteHtml}</td>
                <td>${lead.address || 'N/A'}</td>
                <td><select class="status-select" data-id="${lead.id}">${statusOptions}</select></td>
                <td class="actions-cell">
                    <button class="btn-action btn-view" data-id="${lead.id}" title="View Details">👁️</button>
                    <button class="btn-action btn-notes" data-id="${lead.id}" title="Edit Notes">📝</button>
                    <button class="btn-action btn-delete" data-id="${lead.id}" title="Delete Lead">🗑️</button>
                </td>
            `;
            leadsBody.appendChild(row);
        });
        
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => updateLeadStatus(e.target.dataset.id, e.target.value));
        });
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.addEventListener('click', (e) => openViewModal(e.target.dataset.id));
        });
        document.querySelectorAll('.btn-notes').forEach(btn => {
            btn.addEventListener('click', (e) => openNotesModal(e.target.dataset.id));
        });
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => openDeleteModal(e.target.dataset.id));
        });
    }

    function openViewModal(id) {
        const lead = currentLeads.find(l => l.id === id);
        if (!lead) return;
        
        const setText = (elId, val) => {
            const el = document.getElementById(elId);
            if (el) el.textContent = val || 'N/A';
        };

        setText('viewLeadId', lead.id);
        setText('viewNiche', lead.niche);
        setText('viewLocation', lead.location);
        setText('viewBusinessName', lead.businessName);
        setText('viewPhone', lead.phone);
        setText('viewStatus', lead.status);
        setText('viewDate', lead.createdAt);
        setText('viewNotes', lead.notes || 'No notes added yet.');
        
        const webEl = document.getElementById('viewWebsite');
        if (webEl) webEl.innerHTML = lead.website ? `<a href="${lead.website}" target="_blank">${lead.website}</a>` : 'N/A';
        
        const addrEl = document.getElementById('viewAddress');
        if (addrEl) addrEl.textContent = lead.address || 'N/A';
        
        const modal = document.getElementById('viewModal');
        if (modal) modal.classList.add('active');
    }

    function openNotesModal(id) {
        const lead = currentLeads.find(l => l.id === id);
        if (!lead) return;
        
        const setText = (elId, val) => {
            const el = document.getElementById(elId);
            if (el) el.textContent = val || 'N/A';
        };

        setText('notesLeadId', lead.id);
        setText('notesNiche', lead.niche);
        setText('notesLocation', lead.location);
        setText('notesBusinessName', lead.businessName);
        
        const notesEl = document.getElementById('notesTextarea');
        if (notesEl) notesEl.value = lead.notes || '';
        
        const modal = document.getElementById('notesModal');
        if (modal) {
            modal.dataset.leadId = id;
            modal.classList.add('active');
        }
    }

    function openDeleteModal(id) {
        const modal = document.getElementById('deleteModal');
        if (modal) {
            modal.dataset.leadId = id;
            modal.classList.add('active');
        }
    }

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }

    // ==========================================
    // Search History
    // ==========================================

    function saveSearchHistory(niche, location) {
        const now = new Date();
        const historyItem = {
            niche: niche, location: location,
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            id: Date.now()
        };
        
        searchHistory.unshift(historyItem);
        if (searchHistory.length > 10) searchHistory.pop();
        
        localStorage.setItem('leadHunter_searchHistory', JSON.stringify(searchHistory));
        renderSearchHistory();
    }

    function renderSearchHistory() {
        if (!Array.isArray(searchHistory)) {
            searchHistory = [];
        }

        const container = document.getElementById('searchHistoryList');
        if (!container) return;

        container.innerHTML = '';
        
        if (searchHistory.length === 0) {
            container.innerHTML = '<p class="text-muted" style="text-align:center; padding: 1rem;">No recent searches.</p>';
            return;
        }

        searchHistory.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-info">
                    <strong>${item.niche || 'All'}</strong> in ${item.location || 'All'}
                    <small>${item.date} ${item.time}</small>
                </div>
                <div class="history-actions">
                    <button class="btn-sm btn-rerun" data-niche="${item.niche}" data-location="${item.location}">Run</button>
                    <button class="btn-sm btn-delete-history" data-id="${item.id}">X</button>
                </div>
            `;
            container.appendChild(div);
        });
        
        document.querySelectorAll('.btn-rerun').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const nicheInput = document.getElementById('nicheInput') || document.getElementById('niche');
                const locationInput = document.getElementById('locationInput') || document.getElementById('location');
                if (nicheInput) nicheInput.value = e.target.dataset.niche;
                if (locationInput) locationInput.value = e.target.dataset.location;
                searchLeads();
            });
        });
        
        document.querySelectorAll('.btn-delete-history').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                searchHistory = searchHistory.filter(h => h.id !== id);
                localStorage.setItem('leadHunter_searchHistory', JSON.stringify(searchHistory));
                renderSearchHistory();
            });
        });
    }

    function loadSearchHistory() {
        const saved = localStorage.getItem('leadHunter_searchHistory');
        if (!saved) {
            searchHistory = [];
            renderSearchHistory();
            return;
        }

        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                searchHistory = parsed;
            } else {
                searchHistory = [];
                localStorage.removeItem('leadHunter_searchHistory');
            }
        } catch (e) {
            console.error('Search history corrupted:', e);
            searchHistory = [];
            localStorage.removeItem('leadHunter_searchHistory');
        }
        renderSearchHistory();
    }

    // ==========================================
    // Export & Utilities
    // ==========================================

    function exportToExcel() {
        if (currentLeads.length === 0) {
            showToast("No leads to export!");
            return;
        }
        if (typeof XLSX === 'undefined') {
            showToast("Error: SheetJS library not loaded.");
            return;
        }

        const leadsToExport = getFilteredLeads();
        const data = leadsToExport.map(lead => ({
            'Lead ID': lead.id,
            'Niche': lead.niche || '',
            'Location': lead.location || '',
            'Business Name': lead.businessName,
            'Phone': lead.phone || '',
            'Website': lead.website || '',
            'Address': lead.address || '',
            'Status': lead.status,
            'Source': lead.source || 'Manual',
            'Date Added': lead.createdAt,
            'Notes': lead.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leads");
        
        const today = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `LeadHunter_${today}.xlsx`);
        showToast("Leads exported successfully!");
    }

    let toastTimeout;
    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function showLoading(isLoading) {
        if (loadingState) loadingState.style.display = isLoading ? 'flex' : 'none';
    }

    function disableSearchBtn(disable) {
        if (searchBtn) {
            searchBtn.disabled = disable;
            if (disable) {
                if (!searchBtn.dataset.originalHtml) searchBtn.dataset.originalHtml = searchBtn.innerHTML;
                searchBtn.innerHTML = '<span class="spinner"></span> Hunting leads...';
            } else {
                searchBtn.innerHTML = searchBtn.dataset.originalHtml || 'Search Leads';
                delete searchBtn.dataset.originalHtml; 
            }
        }
    }

    // ==========================================
    // Event Listeners
    // ==========================================

    if (searchBtn) searchBtn.addEventListener('click', searchLeads);
    if (exportBtn) exportBtn.addEventListener('click', exportToExcel);

    const filterIds = ['filterStatus', 'filterPhone', 'filterWebsite', 'filterNiche', 'filterLocation', 'filterId', 'filterName', 'filterDate'];
    filterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', applyFilters);
            el.addEventListener('input', applyFilters);
        }
    });

    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.dataset.modal || e.target.closest('.modal-overlay')?.id;
            if (modalId) closeModal(modalId);
        });
    });

    const saveNotesBtn = document.getElementById('saveNotesBtn');
    if (saveNotesBtn) saveNotesBtn.addEventListener('click', saveNotes);
    
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', deleteLead);

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id);
        });
    });
});